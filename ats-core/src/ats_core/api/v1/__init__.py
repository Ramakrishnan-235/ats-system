from ats_core.api.v1.match import router as match_router
from ats_core.api.v1.candidates import router as candidates_router
from ats_core.api.v1.jobs import router as jobs_router
from ats_core.api.v1.dashboard import router as dashboard_router

__all__ = [
    "match_router",
    "candidates_router",
    "jobs_router",
    "dashboard_router",
]
