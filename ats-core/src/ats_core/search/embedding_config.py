"""Shared embedding contract for the EmbeddingGemma 2 retrieval model."""

import math
from collections.abc import Iterable

DEFAULT_EMBEDDING_MODEL = "google/embeddinggemma-2"
EMBEDDING_DIMENSION = 768


def validate_embedding(values: Iterable[float]) -> list[float]:
    """Reject incompatible or invalid vectors before indexing or querying."""
    vector = [float(value) for value in values]
    if len(vector) != EMBEDDING_DIMENSION:
        raise ValueError(f"Expected {EMBEDDING_DIMENSION} embedding dimensions, got {len(vector)}")
    if not all(math.isfinite(value) for value in vector):
        raise ValueError("Embedding values must be finite")
    if not any(vector):
        raise ValueError("Embedding must have a nonzero norm for cosine similarity")
    return vector
