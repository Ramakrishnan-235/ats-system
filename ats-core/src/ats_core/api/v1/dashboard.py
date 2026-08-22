from typing import List, Dict, Any
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
    return {
        "stats": [
            {
                "id": "active_jobs",
                "label": "ACTIVE JOBS",
                "value": "12",
                "change": "+2 this week",
                "trend": "positive",
                "icon": "briefcase",
                "style": "default"
            },
            {
                "id": "candidates",
                "label": "CANDIDATES",
                "value": "1,247",
                "change": "+89 vs last month",
                "trend": "positive",
                "icon": "users",
                "style": "default"
            },
            {
                "id": "avg_time_to_hire",
                "label": "AVG TIME-TO-HIRE",
                "value": "18",
                "unit": "days",
                "change": "-2 days improved",
                "trend": "positive",
                "icon": "clock",
                "style": "default"
            },
            {
                "id": "open_offers",
                "label": "OPEN OFFERS",
                "value": "3",
                "change": "Awaiting signatures",
                "trend": "neutral",
                "icon": "award",
                "style": "highlighted_dark"
            }
        ],
        "weekly_candidates": [
            {"week": "W1", "count": 42, "is_peak": False},
            {"week": "W2", "count": 55, "is_peak": False},
            {"week": "W3", "count": 38, "is_peak": False},
            {"week": "W4", "count": 80, "is_peak": False},
            {"week": "W5", "count": 62, "is_peak": False},
            {"week": "W6", "count": 88, "is_peak": False},
            {"week": "W7", "count": 124, "is_peak": True},
            {"week": "W8", "count": 71, "is_peak": False},
        ],
        "ai_match_rate": {
            "rate": 68,
            "precision_label": "Candidate fit score precision",
            "matched_percent": 68,
            "not_matched_percent": 32,
        },
        "processing_resumes": 5,
        "today_evaluations": 94,
        "pipeline": {
            "Contacted": [
                {
                    "id": "cand-001",
                    "name": "Priya Sharma",
                    "role": "Senior Backend Engineer",
                    "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
                    "match_score": 92,
                    "summary": "Strong system design skills. Ex-Stripe, scalable microservices...",
                    "stage": "Contacted",
                    "probability": None,
                    "applied_time": "2 days ago"
                },
                {
                    "id": "cand-002",
                    "name": "David Chen",
                    "role": "Product Manager",
                    "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
                    "match_score": 88,
                    "summary": "Focus on user-centric fintech products. Messaged on LinkedIn,...",
                    "stage": "Contacted",
                    "probability": None,
                    "applied_time": "3 days ago"
                },
                {
                    "id": "cand-003",
                    "name": "Aisha Patel",
                    "role": "Frontend Architect",
                    "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
                    "match_score": 89,
                    "summary": "Next.js performance specialist. Led migration of enterprise frontend...",
                    "stage": "Contacted",
                    "probability": None,
                    "applied_time": "4 days ago"
                }
            ],
            "Interview": [
                {
                    "id": "cand-004",
                    "name": "Marcus Adebayo",
                    "role": "Lead UX Researcher",
                    "avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
                    "match_score": 95,
                    "summary": "Nailed the cultural fit round. Technical presentation schedule...",
                    "stage": "Interview",
                    "probability": None,
                    "applied_time": "5 days ago"
                },
                {
                    "id": "cand-005",
                    "name": "Elena Jimenez",
                    "role": "Data Scientist",
                    "avatar": "EJ",
                    "match_score": 84,
                    "summary": "Passed initial coding screen. Needs deeper evaluation on...",
                    "stage": "Interview",
                    "probability": None,
                    "applied_time": "1 week ago"
                }
            ],
            "Negotiation": [
                {
                    "id": "cand-006",
                    "name": "Robert Vance",
                    "role": "VP of Engineering",
                    "avatar": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80",
                    "match_score": 98,
                    "summary": "Offer sent out yesterday. Discussing equity structure and...",
                    "stage": "Negotiation",
                    "probability": 80,
                    "applied_time": "2 weeks ago"
                }
            ]
        }
    }
