"""EmbeddingGemma 2 text embeddings, with one shared 768-dimensional contract."""

import math
import os
from typing import List

import httpx

from ats_core.search.embedding_config import (
    DEFAULT_EMBEDDING_MODEL, EMBEDDING_DIMENSION, validate_embedding,
)


class DenseEmbedder:
    """Encode documents and queries with their respective retrieval prefixes.

    Sentence Transformers supports Windows/CPU. The optional Ollama backend
    requires an Ollama build capable of running EmbeddingGemma 2 on the host.
    Provider failures never fall back to an incompatible embedding model.
    """

    def __init__(self, model_name: str | None = None, threads: int = 4,
                 *, backend: str | None = None, base_url: str | None = None,
                 transport: httpx.BaseTransport | None = None):
        self.backend = backend or os.getenv("ATS_EMBEDDING_BACKEND", "sentence_transformers")
        if self.backend not in ("sentence_transformers", "ollama", "http"):
            raise ValueError("ATS_EMBEDDING_BACKEND must be sentence_transformers, ollama or http")
        default_model = DEFAULT_EMBEDDING_MODEL if self.backend != "ollama" else "embeddinggemma-2:270m"
        self.model_name = model_name or os.getenv("ATS_EMBEDDING_MODEL") or default_model
        self.batch_size = int(os.getenv("ATS_EMBEDDING_BATCH_SIZE", "16"))
        if self.batch_size <= 0 or threads <= 0:
            raise ValueError("Embedding batch size and threads must be positive")
        if self.backend in ("ollama", "http"):
            default_url = "http://localhost:8001" if self.backend == "http" else "http://localhost:11434"
            url = (base_url or os.getenv("ATS_EMBEDDING_BASE_URL", default_url)).rstrip("/")
            # The generation client commonly uses /v1; embeddings use native /api/embed.
            if url.endswith("/v1"):
                url = url[:-3]
            self.client = httpx.Client(base_url=url, timeout=float(os.getenv("ATS_EMBEDDING_TIMEOUT", "120")),
                                       transport=transport, follow_redirects=False)
        else:
            import torch
            from sentence_transformers import SentenceTransformer

            torch.set_num_threads(threads)
            device = os.getenv("ATS_EMBEDDING_DEVICE", "cpu")
            dtype = torch.bfloat16 if device.startswith("cuda") and torch.cuda.is_bf16_supported() else torch.float32
            self.model = SentenceTransformer(
                self.model_name, device=device,
                cache_folder=os.getenv("ATS_EMBEDDING_CACHE_DIR") or None,
                config_kwargs={"vision_config": None, "audio_config": None},
                model_kwargs={"torch_dtype": dtype},
            )
            self.model.max_seq_length = min(self.model.max_seq_length, 8192)

    def _encode(self, texts: List[str], prefix: str) -> List[List[float]]:
        if not texts:
            return []
        if any(not isinstance(text, str) or not text.strip() for text in texts):
            raise ValueError("Embedding input must contain nonempty text")
        vectors = []
        for start in range(0, len(texts), self.batch_size):
            batch = texts[start:start + self.batch_size]
            if self.backend in ("ollama", "http"):
                response = self.client.post("/api/embed", json={
                    "model": self.model_name, "input": [prefix + text for text in batch],
                    "dimensions": EMBEDDING_DIMENSION, "truncate": False,
                })
                response.raise_for_status()
                result = response.json()
                if result.get("error"):
                    raise RuntimeError("Embedding provider failed to generate embeddings")
                encoded = result.get("embeddings")
            else:
                encoded = self.model.encode(batch, prompt=prefix,
                    batch_size=self.batch_size, normalize_embeddings=True,
                    truncate_dim=EMBEDDING_DIMENSION, show_progress_bar=False).tolist()
            if not isinstance(encoded, list) or len(encoded) != len(batch):
                raise ValueError("Embedding provider returned the wrong number of vectors")
            for values in encoded:
                vector = validate_embedding(values)
                # Enforce unit length for both providers rather than assuming it.
                norm = math.hypot(*vector)
                vectors.append([value / norm for value in vector])
        return vectors

    def embed_documents(self, documents: List[str]) -> List[List[float]]:
        return self._encode(documents, "title: none | text: ")

    def embed_query(self, query: str) -> List[float]:
        return self._encode([query], "task: search result | query: ")[0]

    def close(self):
        if self.backend in ("ollama", "http"):
            self.client.close()
