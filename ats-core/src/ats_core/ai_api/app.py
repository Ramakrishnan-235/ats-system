import os
import secrets
import threading
from contextlib import asynccontextmanager
from functools import lru_cache

from fastapi import Depends, FastAPI, Header, HTTPException
from starlette.concurrency import run_in_threadpool

from ats_core.ai_api.contracts import Citation, Dispatch, QueryEmbedding, Rerank


def service_key() -> str:
    key = os.getenv("ATS_SERVICE_KEY", "")
    if len(key) < 32:
        raise RuntimeError("ATS_SERVICE_KEY must contain at least 32 characters")
    return key


async def authenticate(x_service_key: str = Header(default="")):
    if not secrets.compare_digest(x_service_key.encode(), service_key().encode()):
        raise HTTPException(401, "Invalid service identity")


@asynccontextmanager
async def lifespan(_):
    service_key()
    yield


app = FastAPI(
    title="ATS private AI service",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@app.get("/health")
def health():
    return {"status": "OK", "engine": "private-python-ai"}


@app.post("/internal/dispatch", dependencies=[Depends(authenticate)], status_code=202)
def dispatch(payload: Dispatch):
    from ats_core.ai_api.worker import process_job

    # The core owns identity and leases; duplicate queue delivery is expected.
    process_job.apply_async(args=[str(payload.job_id)], task_id=str(payload.job_id))
    return {"job_id": str(payload.job_id), "status": "QUEUED"}


@lru_cache(maxsize=1)
def _embedder():
    from ats_core.search.dense_embedder import DenseEmbedder

    model = DenseEmbedder()
    if model.model_name not in {"google/embeddinggemma-2", "embeddinggemma-2:270m"}:
        raise ValueError("Private AI requires the configured EmbeddingGemma 2 model")
    return model


@lru_cache(maxsize=1)
def _reranker():
    from ats_core.search.reranker import CandidateReranker

    return CandidateReranker()


_model_lock = threading.RLock()


def embedder():
    with _model_lock:
        return _embedder()


def reranker():
    with _model_lock:
        return _reranker()


@app.post("/internal/embed", dependencies=[Depends(authenticate)])
async def embed(payload: QueryEmbedding):
    vector = await run_in_threadpool(lambda: embedder().embed_query(payload.text))
    return {"embedding": vector, "model": "google/embeddinggemma-2", "dimension": 768}


@app.post("/internal/rerank", dependencies=[Depends(authenticate)])
async def rerank(payload: Rerank):
    result = await run_in_threadpool(
        lambda: reranker().rerank(payload.query, payload.candidates, payload.top_k)
    )
    return {"candidates": result}


@app.post("/internal/locate-citation", dependencies=[Depends(authenticate)])
async def locate_citation(payload: Citation):
    def locate():
        from ats_core.ai_api.worker import core_client
        from ats_core.parsers.pdf_parser import HybridPDFParser

        with core_client() as client:
            response = client.get(f"/internal/documents/{payload.document_id}")
            response.raise_for_status()
        location = HybridPDFParser().locate_citation_in_pdf(response.content, payload.search_phrase)
        return {"found": location is not None, "location": location}

    return await run_in_threadpool(locate)
