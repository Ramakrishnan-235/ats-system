import logging
import math
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
        if rrf_constant < 0:
            raise ValueError("rrf_constant must be nonnegative")
        self.dense = dense_embedder or DenseEmbedder()
        self.bm25 = bm25_index or BM25LexicalIndex()
        self.rrf_constant = rrf_constant
        self.candidate_metadata: Dict[str, Dict[str, Any]] = {}
        self.dense_embeddings: Dict[str, List[float]] = {}
        self.candidate_corpus: Dict[str, str] = {}

    def index_candidates(self, candidate_records: List[Dict[str, Any]]):
        """
        Indexes candidate batch across both dense and sparse representations.
        Preserves previously indexed candidates without wiping vector memory.
        Expected record format: {"id": str, "text": str, "metadata": dict}
        """
        if not candidate_records:
            return

        ids = [rec["id"] for rec in candidate_records]
        texts = [rec["text"] for rec in candidate_records]
        
        if len(set(ids)) != len(ids):
            raise ValueError("Candidate IDs in an indexing batch must be unique")
        # Compute first so a failed/short embedding batch cannot leave the
        # lexical corpus ahead of the dense index.
        new_embeddings = self.dense.embed_documents(texts)
        if len(new_embeddings) != len(ids):
            raise ValueError("Embedder returned a different number of vectors than documents")
        dimension = len(next(iter(self.dense_embeddings.values()))) if self.dense_embeddings else len(new_embeddings[0])
        for vector in new_embeddings:
            if not vector or len(vector) != dimension or not all(math.isfinite(v) for v in vector):
                raise ValueError("Embedding batch contains invalid or inconsistent vectors")

        corpus = dict(self.candidate_corpus)
        corpus.update(zip(ids, texts))
        self.bm25.build_index(candidate_ids=list(corpus), documents=list(corpus.values()))
        self.candidate_corpus = corpus
        for rec in candidate_records:
            self.candidate_metadata[rec["id"]] = rec.get("metadata", {})
        for cid, vec in zip(ids, new_embeddings):
            self.dense_embeddings[cid] = vec

    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        if len(a) != len(b) or not all(math.isfinite(v) for v in (*a, *b)):
            raise ValueError("Cosine similarity requires finite vectors of equal dimension")
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(y * y for y in b) ** 0.5
        return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0

    def search_dense(self, query: str, top_k: int = 50) -> List[Tuple[str, float]]:
        """Performs vector search in-memory (or replaces with pgvector query)."""
        if top_k < 0:
            raise ValueError("top_k must be nonnegative")
        if top_k == 0 or not query.strip() or not self.dense_embeddings:
            return []
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
        if top_k < 0:
            raise ValueError("top_k must be nonnegative")
        if top_k == 0 or not query.strip():
            return []
        retrieval_limit = max(50, top_k)
        dense_results = self.search_dense(query, top_k=retrieval_limit)
        bm25_results = self.bm25.search(query, top_k=retrieval_limit)

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
                "text": self.candidate_corpus.get(cid, ""),
                "metadata": self.candidate_metadata.get(cid, {}),
            })

        return output
