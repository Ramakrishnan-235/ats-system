from typing import List, Dict, Any, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Metrics"])


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
    match_score: int
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
async def get_dashboard_stats():
    from ats_core.api.v1.candidates import CANDIDATES_STORE

    cand_list = list(CANDIDATES_STORE.values())
    total_candidates = len(cand_list)

    pipeline: Dict[str, List[Dict[str, Any]]] = {
        "Contacted": [],
        "Interview": [],
        "Negotiation": []
    }

    for c in cand_list:
        stage = c.get("stage", "Contacted")
        stage_key = "Interview" if "interview" in stage.lower() else ("Negotiation" if "negotiat" in stage.lower() or "offer" in stage.lower() else "Contacted")
        if stage_key not in pipeline:
            pipeline[stage_key] = []
        pipeline[stage_key].append({
            "id": c.get("id"),
            "name": c.get("name", "Candidate"),
            "role": c.get("target_headline", c.get("role", "Candidate")),
            "avatar": c.get("avatar", "CD"),
            "match_score": c.get("scorecard", {}).get("overall_match_score", 90),
            "summary": c.get("scorecard", {}).get("categories", [{}])[0].get("quote", "Candidate profile evaluated"),
            "stage": stage,
            "probability": 80 if stage_key == "Negotiation" else None,
            "applied_time": c.get("applied_date", "Recently")
        })

    return {
        "stats": [
            {
                "id": "active_jobs",
                "label": "ACTIVE JOBS",
                "value": "50",
                "change": "50 active positions",
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
                "value": "18",
                "unit": "days",
                "change": "Target benchmark",
                "trend": "positive",
                "icon": "clock",
                "style": "default"
            },
            {
                "id": "open_offers",
                "label": "OPEN OFFERS",
                "value": str(len(pipeline.get("Negotiation", []))),
                "change": "Awaiting signatures",
                "trend": "neutral",
                "icon": "award",
                "style": "highlighted_dark"
            }
        ],
        "weekly_candidates": [
            {"week": "W1", "count": 0, "is_peak": False},
            {"week": "W2", "count": 0, "is_peak": False},
            {"week": "W3", "count": 0, "is_peak": False},
            {"week": "W4", "count": 0, "is_peak": False},
            {"week": "W5", "count": 0, "is_peak": False},
            {"week": "W6", "count": 0, "is_peak": False},
            {"week": "W7", "count": 0, "is_peak": False},
            {"week": "W8", "count": total_candidates, "is_peak": total_candidates > 0},
        ],
        "ai_match_rate": {
            "rate": 0 if total_candidates == 0 else 85,
            "precision_label": "Candidate fit score precision",
            "matched_percent": 0 if total_candidates == 0 else 85,
            "not_matched_percent": 100 if total_candidates == 0 else 15,
        },
        "processing_resumes": 0,
        "today_evaluations": total_candidates,
        "pipeline": pipeline
    }
