import logging
import math
from typing import List, Dict, Any, Optional

logger = logging.getLogger("ats.search.reranker")


class CandidateReranker:
    """
    Stage 2 Re-Ranker utilizing BAAI/bge-reranker-large.
    Re-scores candidate-job description pairs using full cross-attention.
    """

    def __init__(
        self,
        model_name: str = "BAAI/bge-reranker-large",
        device: Optional[str] = None,
        max_length: int = 512,
        batch_size: int = 32,
    ):
        import torch
        from sentence_transformers import CrossEncoder

        # Auto-detect optimal compute device (CUDA -> MPS -> CPU)
        if device is None:
            if torch.cuda.is_available():
                self.device = "cuda"
            elif torch.backends.mps.is_available():
                self.device = "mps"
            else:
                self.device = "cpu"
        else:
            self.device = device

        logger.info(f"Loading Cross-Encoder model '{model_name}' on device: {self.device}...")
        
        self.model = CrossEncoder(
            model_name,
            max_length=max_length,
            device=self.device,
            model_kwargs={"torch_dtype": torch.float16 if self.device == "cuda" else torch.float32},
        )
        self.batch_size = batch_size

    @staticmethod
    def _sigmoid(logit: float) -> float:
        """
        Transforms unbounded logits into a [0.0, 1.0] relevance score.
        This transformation is not a calibrated hiring probability.
        Uses numerically stable computation with clamping to prevent OverflowError on extreme values.
        """
        if not math.isfinite(float(logit)):
            raise ValueError("Reranker scores must be finite")
        # Clamp logit to safe numerical range [-50.0, 50.0]
        clamped = max(-50.0, min(50.0, float(logit)))
        if clamped >= 0:
            return 1.0 / (1.0 + math.exp(-clamped))
        else:
            z = math.exp(clamped)
            return z / (1.0 + z)

    def _format_candidate_text(self, candidate: Dict[str, Any]) -> str:
        """
        Structures candidate data into a dense, high-signal representation for the Cross-Encoder.
        """
        # Support both flat text or structured payload dictionaries
        if "text" in candidate and candidate["text"]:
            return candidate["text"]

        metadata = candidate.get("metadata") or {}
        profile = {**metadata, **candidate}
        headline = profile.get("target_headline", "Software Professional")
        exp = profile.get("years_of_experience", 0)
        skills = profile.get("core_skills", profile.get("skills", []))
        if isinstance(skills, list):
            skills_str = ", ".join(skills[:15])
        else:
            skills_str = str(skills)

        summary = profile.get("executive_summary", profile.get("summary_text", ""))

        return (
            f"Role: {headline} | Experience: {exp} years | "
            f"Core Competencies: {skills_str} | "
            f"Summary: {summary}"
        )

    def rerank(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        top_k: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Takes candidate search results (e.g., top 100 from Hybrid Retrieval),
        computes cross-attention relevance scores, and returns the top_k sorted candidates.
        """
        if top_k < 0:
            raise ValueError("top_k must be nonnegative")
        if top_k == 0 or not candidates:
            return []

        # 1. Create (Query, Document) sentence pairs
        sentence_pairs = []
        for cand in candidates:
            cand_text = self._format_candidate_text(cand)
            sentence_pairs.append([query, cand_text])

        # 2. Compute cross-encoder inference scores in batches
        raw_scores = self.model.predict(
            sentence_pairs,
            batch_size=self.batch_size,
            show_progress_bar=False,
            convert_to_numpy=True,
        )
        if len(raw_scores) != len(candidates):
            raise ValueError("Reranker returned a different number of scores than candidates")

        # 3. Attach normalized scores and initial rankings
        reranked_results = []
        for idx, cand in enumerate(candidates):
            raw_logit = float(raw_scores[idx])
            normalized_score = self._sigmoid(raw_logit)

            # Preserve existing metadata and attach reranker scores
            item = dict(cand)
            item["rerank_raw_score"] = round(raw_logit, 4)
            item["rerank_score"] = round(normalized_score, 4)
            reranked_results.append(item)

        # 4. Sort descending by rerank score
        # Rank by the original precision. Rounded display scores saturate near
        # 1.0 and otherwise turn distinct scores into arbitrary input-order ties.
        reranked_results = [
            result for _, result in sorted(
                zip(raw_scores, reranked_results), key=lambda pair: float(pair[0]), reverse=True
            )
        ]

        # 5. Assign ordinal rank and trim to top_k
        top_candidates = reranked_results[:top_k]
        for rank, cand in enumerate(top_candidates, start=1):
            cand["rerank_rank"] = rank

        logger.info(f"Re-ranked {len(candidates)} candidates down to top {len(top_candidates)}.")
        return top_candidates
