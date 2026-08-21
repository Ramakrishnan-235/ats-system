import logging
import math
from typing import List, Dict, Any, Optional
import torch
from sentence_transformers import CrossEncoder

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
        """Transforms unbounded raw logits into a normalized [0.0, 1.0] probability score."""
        return 1.0 / (1.0 + math.exp(-logit))

    def _format_candidate_text(self, candidate: Dict[str, Any]) -> str:
        """
        Structures candidate data into a dense, high-signal representation for the Cross-Encoder.
        """
        # Support both flat text or structured payload dictionaries
        if "text" in candidate and candidate["text"]:
            return candidate["text"]

        headline = candidate.get("target_headline", "Software Professional")
        exp = candidate.get("years_of_experience", 0)
        skills = candidate.get("skills", [])
        if isinstance(skills, list):
            skills_str = ", ".join(skills[:15])
        else:
            skills_str = str(skills)

        summary = candidate.get("executive_summary", candidate.get("summary_text", ""))

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
        if not candidates:
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
        reranked_results.sort(key=lambda x: x["rerank_score"], reverse=True)

        # 5. Assign ordinal rank and trim to top_k
        top_candidates = reranked_results[:top_k]
        for rank, cand in enumerate(top_candidates, start=1):
            cand["rerank_rank"] = rank

        logger.info(f"Re-ranked {len(candidates)} candidates down to top {len(top_candidates)}.")
        return top_candidates
