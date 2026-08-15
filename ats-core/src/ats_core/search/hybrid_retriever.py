import logging
from typing import List, Dict, Any, Optional, Tuple
from ats_core.search.dense_embedder import DenseEmbedder
from ats_core.search.bm25_indexer import BM25LexicalIndex

logger = logging.getLogger("ats.search.hybrid")


class HybridCandidateRetriever:
    """Orchestrates multi-channel retrieval combining Dense Vectors and BM25 Lexical Search."""

    def __init__(
        self,
        dense_embedder: Optional[DenseEmbedder] = None,
        bm25_index: Optional[BM25LexicalIndex] = None,
        rrf_constant: int = 60
    ):
        self.dense = dense_embedder or DenseEmbedder()
        self.bm25 = bm25_index or BM25LexicalIndex()
        self.rrf_constant = rrf_constant
        self.candidate_metadata: Dict[str, Dict[str, Any]] = {}
        self.dense_embeddings: Dict[str, List[float]] = {}

    def index_candidates(self, candidate_records: List[Dict[str, Any]]):
        """
        Indexes candidate batch across both dense and sparse representations.
        Expected record format: {"id": str, "text": str, "metadata": dict}
        """
        ids = [rec["id"] for rec in candidate_records]
        texts = [rec["text"] for rec in candidate_records]
        
        for rec in candidate_records:
            self.candidate_metadata[rec["id"]] = rec.get("metadata", {})

        # 1. Build Sparse Index
        self.bm25.build_index(candidate_ids=ids, documents=texts)

        # 2. Dense embeddings can be indexed into pgvector or cached in-memory
        logger.info(f"Generating dense embeddings for {len(texts)} documents...")
        self.dense_embeddings = {
            cid: vec for cid, vec in zip(ids, self.dense.embed_documents(texts))
        }

    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(y * y for y in b) ** 0.5
        return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0

    def search_dense(self, query: str, top_k: int = 50) -> List[Tuple[str, float]]:
        """Performs vector search in-memory (or replaces with pgvector query)."""
        query_vec = self.dense.embed_query(query)
        scored = [
            (cid, self._cosine_similarity(query_vec, doc_vec))
            for cid, doc_vec in self.dense_embeddings.items()
        ]
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]

    def hybrid_search(self, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
        """
        Executes parallel Dense + BM25 searches and applies Reciprocal Rank Fusion (RRF).
        """
        dense_results = self.search_dense(query, top_k=50)
        bm25_results = self.bm25.search(query, top_k=50)

        # Calculate RRF Scores
        rrf_scores: Dict[str, float] = {}
        dense_ranks: Dict[str, int] = {}
        bm25_ranks: Dict[str, int] = {}

        # 1. Score Dense Ranks
        for rank, (cid, score) in enumerate(dense_results, start=1):
            dense_ranks[cid] = rank
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (1.0 / (self.rrf_constant + rank))

        # 2. Score BM25 Ranks
        for rank, (cid, score) in enumerate(bm25_results, start=1):
            bm25_ranks[cid] = rank
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (1.0 / (self.rrf_constant + rank))

        # 3. Sort Candidates by Final RRF Score
        sorted_candidates = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]

        output = []
        for cid, rrf_score in sorted_candidates:
            output.append({
                "candidate_id": cid,
                "rrf_score": round(rrf_score, 6),
                "dense_rank": dense_ranks.get(cid, None),
                "bm25_rank": bm25_ranks.get(cid, None),
                "metadata": self.candidate_metadata.get(cid, {}),
            })

        return output
