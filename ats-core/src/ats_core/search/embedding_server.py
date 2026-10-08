"""Text-only EmbeddingGemma 2 service for Linux Docker."""
from contextlib import asynccontextmanager
from threading import Lock
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from ats_core.search.dense_embedder import DenseEmbedder


class EmbedRequest(BaseModel):
    model: Literal["google/embeddinggemma-2", "embeddinggemma-2:270m"] = "google/embeddinggemma-2"
    input: str | list[str]
    dimensions: Literal[768] = 768
    truncate: Literal[False] = False


@asynccontextmanager
async def lifespan(app):
    app.state.encoder = DenseEmbedder(backend="sentence_transformers", model_name="google/embeddinggemma-2")
    app.state.lock = Lock()
    yield
    app.state.encoder.close()


app = FastAPI(lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ready", "model": "google/embeddinggemma-2", "dimensions": 768}


@app.post("/api/embed")
def embed(request: EmbedRequest):
    inputs = [request.input] if isinstance(request.input, str) else request.input
    if not inputs or len(inputs) > 64 or any(not item.strip() for item in inputs):
        raise HTTPException(400, "Provide between 1 and 64 nonempty text inputs")
    encoder = app.state.encoder
    with app.state.lock:
        tokenizer = encoder.model[0].tokenizer
        if any(len(tokenizer.encode(item)) > 8192 for item in inputs):
            raise HTTPException(400, "Input exceeds the 8192-token limit; split it into sections")
        # The caller supplies the document/query prefix. Do not prepend it twice.
        vectors = encoder._encode(inputs, "")
    return {"model": "google/embeddinggemma-2", "embeddings": vectors}
