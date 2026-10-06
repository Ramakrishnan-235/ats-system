from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Query, Request
from ats_core.api.auth import get_current_user
from ats_core.api.audit import check_and_audit_pii_access
from pydantic import BaseModel

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Metrics"])

PIPELINE_STAGES = (
    "Screening", "Review Required", "Qualified", "Contacted", "Interview",
    "Negotiation", "Offer", "Hired", "Rejected",
)


def pipeline_stage(stage: Any) -> str:
    """Preserve actual stages, including custom stages; never imply contact."""
    value = stage.strip() if isinstance(stage, str) else ""
    return next((known for known in PIPELINE_STAGES if known.casefold() == value.casefold()), value or "Unassigned")


class StatCard(BaseModel):
    id: str
    label: str
    value: str
    change: str
    trend: str  # positive, negative, neutral
    icon: str
    style: str = "default"  # default or highlighted_dark


class WeeklyVolume(BaseModel):
    week: str
    count: int
    is_peak: bool = False


class PipelineCandidate(BaseModel):
    id: str
    name: str
    role: str
    avatar: str
    match_score: Optional[int]
    summary: str
    stage: str
    probability: Optional[int] = None
    applied_time: str


class DashboardStatsResponse(BaseModel):
    stats: List[StatCard]
    weekly_candidates: List[WeeklyVolume]
    ai_match_rate: Dict[str, Any]
    processing_resumes: int
    today_evaluations: int
    pipeline: Dict[str, List[Dict[str, Any]]]


@router.get("/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(request: Request, include_pii: bool = Query(False)):
    if include_pii:
        user = get_current_user(request)
        check_and_audit_pii_access(request, user, "VIEW_DASHBOARD_PII", "dashboard", "stats")
    try:
        from ats_core.db.store_sync import sync_candidates_from_db, sync_jobs_from_db
        sync_candidates_from_db()
        sync_jobs_from_db()
    except Exception:
        pass
    from ats_core.api.v1.candidates import CANDIDATES_STORE, mask_candidate_pii
    from ats_core.api.v1.jobs import JOBS_STORE

    cand_list = list(CANDIDATES_STORE.values())
    total_candidates = len(cand_list)
    active_jobs = sum(job.get("status") == "OPEN" for job in JOBS_STORE.values())
    evaluated_scores = [c.get("scorecard", {}).get("overall_match_score") for c in cand_list
                        if c.get("scorecard", {}).get("evaluation_status") not in ("FAILED", "PENDING")]
    evaluated_scores = [score for score in evaluated_scores if isinstance(score, (int, float))]
    matched_percent = round(100 * sum(score >= 70 for score in evaluated_scores) / len(evaluated_scores)) if evaluated_scores else 0
    now = datetime.now(timezone.utc)

    def timestamp(value):
        try:
            date = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return date.replace(tzinfo=timezone.utc) if date.tzinfo is None else date
        except (ValueError, TypeError, AttributeError):
            return None

    today_evaluations = sum(
        date is not None and date.date() == now.date()
        for date in [timestamp(c.get("scorecard", {}).get("evaluated_at")) for c in cand_list]
    )
    current_week_start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=now.weekday())
    weekly_candidates = []
    for week in range(8):
        start = current_week_start - timedelta(weeks=7 - week)
        end = start + timedelta(weeks=1)
        count = sum(date is not None and start <= date < end for date in [timestamp(c.get("created_at")) for c in cand_list])
        weekly_candidates.append({"week": f"W{week + 1}", "count": count, "is_peak": False})
    peak = max(item["count"] for item in weekly_candidates)
    for item in weekly_candidates:
        item["is_peak"] = peak > 0 and item["count"] == peak

    pipeline: Dict[str, List[Dict[str, Any]]] = {stage: [] for stage in PIPELINE_STAGES}

    for candidate in cand_list:
        c = candidate if include_pii else mask_candidate_pii(candidate)
        categories = c.get("scorecard", {}).get("categories") or []
        stage = c.get("stage")
        stage_key = pipeline_stage(stage)
        if stage_key not in pipeline:
            pipeline[stage_key] = []
        pipeline[stage_key].append({
            "id": c.get("id"),
            "name": c.get("name", "Candidate"),
            "role": c.get("target_headline", c.get("role", "Candidate")),
            "avatar": c.get("avatar", "CD"),
            "match_score": c.get("scorecard", {}).get("overall_match_score"),
            "summary": categories[0].get("quote", "Candidate profile") if categories else "Awaiting evaluation",
            "stage": stage_key,
            "probability": None,
            "applied_time": c.get("applied_date", "Recently")
        })

    return {
        "stats": [
            {
                "id": "active_jobs",
                "label": "ACTIVE JOBS",
                "value": str(active_jobs),
                "change": f"{active_jobs} active positions",
                "trend": "positive",
                "icon": "briefcase",
                "style": "default"
            },
            {
                "id": "candidates",
                "label": "CANDIDATES",
                "value": str(total_candidates),
                "change": "Real ingested candidates",
                "trend": "positive" if total_candidates > 0 else "neutral",
                "icon": "users",
                "style": "default"
            },
            {
                "id": "avg_time_to_hire",
                "label": "AVG TIME-TO-HIRE",
                "value": "—",
                "unit": "days",
                "change": "Hire dates not recorded",
                "trend": "neutral",
                "icon": "clock",
                "style": "default"
            },
            {
                "id": "open_offers",
                "label": "OPEN OFFERS",
                "value": str(len(pipeline.get("Offer", []))),
                "change": "Candidates in Offer stage",
                "trend": "neutral",
                "icon": "award",
                "style": "highlighted_dark"
            }
        ],
        "weekly_candidates": weekly_candidates,
        "ai_match_rate": {
            "rate": matched_percent,
            "precision_label": "Evaluated candidates scoring at least 70",
            "matched_percent": matched_percent,
            "not_matched_percent": 100 - matched_percent if evaluated_scores else 0,
            "evaluated_count": len(evaluated_scores),
        },
        "processing_resumes": 0,
        "today_evaluations": today_evaluations,
        "pipeline": pipeline
    }
