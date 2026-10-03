import logging
from typing import List
from ats_core.search.embedding_config import DEFAULT_EMBEDDING_MODEL, validate_embedding

logger = logging.getLogger("ats.search.dense")


class DenseEmbedder:
    """Generates 384-dimensional dense vectors using BAAI/bge-small-en-v1.5."""

    def __init__(self, model_name: str = DEFAULT_EMBEDDING_MODEL, threads: int = 4):
        from fastembed import TextEmbedding

        self.model_name = model_name
        logger.info(f"Loading dense embedding model: {model_name}...")
        self.model = TextEmbedding(model_name=model_name, threads=threads)

    def embed_documents(self, documents: List[str]) -> List[List[float]]:
        """Generates embeddings for a batch of candidate resumes or summaries."""
        if not documents:
            return []
        embeddings_generator = self.model.embed(documents)
        return [validate_embedding(embedding.tolist()) for embedding in embeddings_generator]

    def embed_query(self, query: str) -> List[float]:
        """Generates embedding for a single search query or Job Description."""
        # BGE models benefit from instruction prefixing on queries
        prefixed_query = f"Represent this sentence for searching relevant passages: {query}"
        return validate_embedding(list(self.model.embed([prefixed_query]))[0].tolist())
