import logging

from ats_core.search.dense_embedder import DenseEmbedder

logger = logging.getLogger("ats.search.pgvector")


class PgVectorStore:
    """Helper for generating candidate vector embeddings and indexing into PostgreSQL pgvector."""

    def __init__(self, embedder: DenseEmbedder | None = None):
        self.embedder = embedder or DenseEmbedder()

    def generate_embedding(self, text: str) -> list[float]:
        """Generates 768-dimensional dense vector embedding for search and indexing."""
        return self.embedder.embed_documents([text])[0]
