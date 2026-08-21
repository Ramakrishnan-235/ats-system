import logging
from typing import List, Optional
from ats_core.search.dense_embedder import DenseEmbedder

logger = logging.getLogger("ats.search.pgvector")


class PgVectorStore:
    """Helper for generating candidate vector embeddings and indexing into PostgreSQL pgvector."""

    def __init__(self, embedder: Optional[DenseEmbedder] = None):
        self.embedder = embedder or DenseEmbedder()

    def generate_embedding(self, text: str) -> List[float]:
        """Generates 384-dimensional dense vector embedding for search and indexing."""
        return self.embedder.embed_query(text)
