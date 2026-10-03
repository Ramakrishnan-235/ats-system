"""Shared embedding contract for the configured BGE-small retrieval model."""

import math
from collections.abc import Iterable

DEFAULT_EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
EMBEDDING_DIMENSION = 384


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
