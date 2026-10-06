# ruff: noqa: E402
# Environment loading and the src path must precede application module imports.
import sys
import os
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load local development settings before importing modules that read configuration.
# Exported environment variables keep precedence over the .env file.
load_dotenv(Path(__file__).resolve().parent / ".env", override=False)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from ats_core.api.auth import verify_api_key, validate_auth_configuration
from ats_core.api.v1.candidates import router as candidates_router
from ats_core.api.v1.match import router as match_router
from ats_core.api.v1.jobs import router as jobs_router
from ats_core.api.v1.dashboard import router as dashboard_router
from ats_core.api.v1.taxonomy import router as taxonomy_router
from ats_core.api.v1.audit import router as audit_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_auth_configuration()
    try:
        from ats_core.db.store_sync import sync_all_from_db
        sync_all_from_db()
    except Exception as e:
        import logging
        logging.getLogger("ats.main").debug("Startup DB sync skipped or unavailable: %s", e)
    yield


app = FastAPI(
    title="AI-Powered ATS Core Engine",
    description="Asynchronous layout parsing, PII redaction, hybrid vector retrieval, and LLM evaluations",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv(
        "ATS_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "X-User-Id", "X-User-Role", "X-User-Email"],
)

# Mount API Routers with Security Authentication Dependency
app.include_router(dashboard_router, prefix="/api/v1", dependencies=[Depends(verify_api_key)])
app.include_router(jobs_router, prefix="/api/v1", dependencies=[Depends(verify_api_key)])
app.include_router(candidates_router, prefix="/api/v1", dependencies=[Depends(verify_api_key)])
app.include_router(match_router, prefix="/api/v1", dependencies=[Depends(verify_api_key)])
app.include_router(taxonomy_router, prefix="/api/v1", dependencies=[Depends(verify_api_key)])
app.include_router(audit_router, prefix="/api/v1", dependencies=[Depends(verify_api_key)])


@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "HEALTHY", "engine": "ATS Core Engine v0.1.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
