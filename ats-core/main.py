from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ats_core.api.v1.candidates import router as candidates_router
from ats_core.api.v1.match import router as match_router
from ats_core.api.v1.jobs import router as jobs_router
from ats_core.api.v1.dashboard import router as dashboard_router

app = FastAPI(
    title="AI-Powered ATS Core Engine",
    description="Asynchronous layout parsing, PII redaction, hybrid vector retrieval, and LLM evaluations",
    version="0.1.0",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(jobs_router, prefix="/api/v1")
app.include_router(candidates_router, prefix="/api/v1")
app.include_router(match_router, prefix="/api/v1")


@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "HEALTHY", "engine": "ATS Core Engine v0.1.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
