"""
normalization_cascade.py
Step 6: Normalization Cascade (For Freeform Strings).

Resolves freeform candidate skill strings (from skills bar, resume text, or LLM residue pass)
through a 4-layer deterministic-to-semantic cascade without expensive per-skill LLM calls:

Layer 1: Exact alias hit (O(1) dictionary) -> Confidence: 1.0
Layer 2: Length-gated typo fuzzy matching (RapidFuzz WRatio >= 90) -> Confidence: 0.9
Layer 3: Dense embedding cosine similarity with margin check -> Confidence: 0.7
Layer 4: Give up gracefully -> Enters status='pending' Flywheel review queue -> Confidence: 0.4
"""

import re
import logging
from typing import Dict, Any, List, Optional, Tuple, NamedTuple
import numpy as np
from rapidfuzz import process, fuzz

from ats_core.taxonomy.taxonomy_service import SkillTaxonomyService, EXACT_SHORT_MAP, SHORT_EXACT_SKILLS
from ats_core.search.dense_embedder import DenseEmbedder

logger = logging.getLogger("ats.parsers.normalization_cascade")


class EmbeddingSearchResult(NamedTuple):
    skill_id: str
    canonical_name: str
    category: str
    score: float


class SkillEmbeddingsIndex:
    """
    In-memory vector similarity index for Layer 3 semantic skill resolution.
    Pre-indexes approved canonical taxonomy skills using DenseEmbedder.
    """
    _instance: Optional["SkillEmbeddingsIndex"] = None

    def __init__(self, embedder: Optional[DenseEmbedder] = None, taxonomy_service: Optional[SkillTaxonomyService] = None):
        self.embedder = embedder or DenseEmbedder()
        self.taxonomy = taxonomy_service or SkillTaxonomyService.get_instance()
        self.skills_list: List[Dict[str, Any]] = []
        self.vectors: Optional[np.ndarray] = None
        self._build_index()

    @classmethod
    def get_instance(cls) -> "SkillEmbeddingsIndex":
        if cls._instance is None:
            cls._instance = SkillEmbeddingsIndex()
        return cls._instance

    def _build_index(self):
        """Generates dense embeddings for all approved canonical skills."""
        approved_skills = [
            s for s in self.taxonomy._skills_by_id.values()
            if s.get("status") == "approved"
        ]
        if not approved_skills:
            return

        self.skills_list = approved_skills
        names = [s["canonical_name"] for s in approved_skills]
        raw_vecs = self.embedder.embed_documents(names)
        
        # Normalize vectors for fast cosine similarity dot products
        vec_arr = np.array(raw_vecs, dtype=np.float32)
        norms = np.linalg.norm(vec_arr, axis=1, keepdims=True)
        norms[norms == 0] = 1e-8
        self.vectors = vec_arr / norms
        logger.info(f"SkillEmbeddingsIndex built with {len(self.skills_list)} canonical embeddings.")

    def search(self, query: str, k: int = 2) -> List[EmbeddingSearchResult]:
        """
        Searches nearest taxonomy skills by cosine similarity.
        """
        if self.vectors is None or len(self.skills_list) == 0 or not query.strip():
            return []

        q_vec = np.array(self.embedder.embed_query(query), dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm == 0:
            return []
        q_vec = q_vec / q_norm

        scores = np.dot(self.vectors, q_vec)
        top_indices = np.argsort(scores)[::-1][:k]

        results = []
        for idx in top_indices:
            skill = self.skills_list[idx]
            results.append(EmbeddingSearchResult(
                skill_id=skill["id"],
                canonical_name=skill["canonical_name"],
                category=skill.get("category", "tool"),
                score=float(scores[idx])
            ))
        return results


def resolve_skill(
    raw: str,
    taxonomy_service: Optional[SkillTaxonomyService] = None,
    embeddings_index: Optional[SkillEmbeddingsIndex] = None,
    register_pending: bool = True
) -> Tuple[Dict[str, Any], float, str]:
    """
    Executes the 4-layer Normalization Cascade:
    Returns: Tuple[resolved_skill_record, confidence_score, resolution_layer]
    """
    if not raw or not isinstance(raw, str) or not raw.strip():
        return {}, 0.0, "empty"

    cleaned = raw.strip()
    key = re.sub(r"[^\w\s+#.]", "", cleaned.lower()).strip()
    if not key:
        return {}, 0.0, "empty"

    taxonomy = taxonomy_service or SkillTaxonomyService.get_instance()

    # =========================================================================
    # LAYER 1: Exact Alias Hit (O(1) Dictionary — Always Correct, Always Free)
    # =========================================================================
    if key in EXACT_SHORT_MAP:
        canonical_name = EXACT_SHORT_MAP[key]
        rec = taxonomy.get_skill_by_canonical(canonical_name)
        if rec:
            return rec, 1.0, "layer1_exact"

    if key in taxonomy._alias_index:
        canonical_name = taxonomy._alias_index[key]
        rec = taxonomy.get_skill_by_canonical(canonical_name)
        if rec and rec.get("status") == "approved":
            return rec, 1.0, "layer1_exact"

    # =========================================================================
    # LAYER 2: Fuzzy Match for Typos (Length-Gated > 3, Never Short/Ambiguous)
    # =========================================================================
    if len(key) > 3 and key not in SHORT_EXACT_SKILLS:
        alias_keys = [
            k for k in taxonomy._alias_index.keys()
            if len(k) > 3 and k not in taxonomy._ambiguous_tokens
        ]
        if alias_keys:
            match = process.extractOne(
                key,
                alias_keys,
                scorer=fuzz.ratio,
                score_cutoff=88.0
            )
            if match:
                matched_key = match[0]
                canonical_name = taxonomy._alias_index[matched_key]
                rec = taxonomy.get_skill_by_canonical(canonical_name)
                if rec and rec.get("status") == "approved":
                    return rec, 0.9, "layer2_fuzzy"

    # =========================================================================
    # LAYER 3: Embedding Similarity with Margin Check (Catches Paraphrases)
    # =========================================================================
    if embeddings_index is not None and len(cleaned) >= 4:
        try:
            top = embeddings_index.search(cleaned, k=2)
            if top:
                top1 = top[0]
                top2_score = top[1].score if len(top) > 1 else 0.0
                margin = top1.score - top2_score
                # Margin check: avoids near-tie misfires
                if top1.score >= 0.75 and margin >= 0.06:
                    rec = taxonomy.get_skill_by_id(top1.skill_id)
                    if rec:
                        return rec, 0.7, "layer3_embedding"
        except Exception as e:
            logger.warning(f"Layer 3 embedding search fallback: {e}")

    # =========================================================================
    # LAYER 4: Give Up Gracefully -> Pending Taxonomy Entry + Flywheel Review
    # =========================================================================
    if register_pending:
        pending_rec = taxonomy.record_unknown_skill(cleaned, source="freeform_cascade")
        return pending_rec, 0.4, "layer4_pending"

    # Synthetic fallback record if persistence is skipped
    return {
        "id": f"skill-unresolved-{key[:8]}",
        "canonical_name": cleaned.capitalize() if cleaned[0].islower() else cleaned,
        "category": "tool",
        "status": "pending",
        "occurrence_count": 1,
    }, 0.4, "layer4_pending"


def resolve_skills_batch(
    raw_skills: List[str],
    taxonomy_service: Optional[SkillTaxonomyService] = None,
    embeddings_index: Optional[SkillEmbeddingsIndex] = None,
    register_pending: bool = True
) -> List[Dict[str, Any]]:
    """
    Resolves a batch of freeform skill strings through the 4-layer cascade.
    """
    results: List[Dict[str, Any]] = []
    seen_canonical: set = set()

    for s in raw_skills:
        rec, confidence, layer = resolve_skill(
            raw=s,
            taxonomy_service=taxonomy_service,
            embeddings_index=embeddings_index,
            register_pending=register_pending
        )
        if not rec or not rec.get("canonical_name"):
            continue

        cname = rec["canonical_name"]
        if cname.lower() not in seen_canonical:
            seen_canonical.add(cname.lower())
            results.append({
                "raw_input": s,
                "canonical_name": cname,
                "skill_id": rec.get("id"),
                "category": rec.get("category", "tool"),
                "status": rec.get("status", "approved"),
                "confidence_score": confidence,
                "resolution_layer": layer,
            })

    return results
