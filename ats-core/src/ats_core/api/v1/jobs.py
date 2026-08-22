import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/jobs", tags=["Job Postings & Requisitions"])

# In-memory store initialized with realistic benchmark ATS data
JOBS_STORE: Dict[str, Dict[str, Any]] = {
    "job-001": {
        "id": "job-001",
        "title": "Senior Backend Engineer",
        "department": "Engineering",
        "location": "Remote",
        "status": "OPEN",
        "posted_date": "2026-01-15",
        "candidates_count": 34,
        "avatars": [
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80",
        ],
        "top_match": {
            "score": 95,
            "label": "95 Top Match",
            "last_run": "2h ago",
            "status": "ACTIVE"
        },
        "icon_type": "code",
        "job_description": "We are seeking an experienced Senior Backend Engineer to join our core platform team. You will be responsible for designing, building, and maintaining scalable microservices that power our primary application.\n\nKey Responsibilities:\n• Architect high-performance APIs\n• Optimize database queries and schema design\n• Lead migration of legacy services to distributed cloud microservices",
        "min_years_experience": 5.0,
        "required_skills": ["Python", "FastAPI", "PostgreSQL", "Kubernetes", "AWS", "Go"],
        "structured_criteria": {
            "technical_depth_weight": 0.4,
            "system_design_weight": 0.4,
            "leadership_weight": 0.2
        },
        "created_at": "2026-01-15T09:00:00Z",
        "updated_at": "2026-01-15T09:00:00Z"
    },
    "job-002": {
        "id": "job-002",
        "title": "Data Platform Architect",
        "department": "Data",
        "location": "New York / Hybrid",
        "status": "OPEN",
        "posted_date": "2026-01-12",
        "candidates_count": 12,
        "avatars": [
            "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
        ],
        "top_match": {
            "score": 91,
            "label": "91 Top Match",
            "last_run": "1d ago",
            "status": "ACTIVE"
        },
        "icon_type": "database",
        "job_description": "Lead the modernization of our data lakehouse, real-time analytics streaming pipelines, and vector database infrastructure supporting enterprise AI applications.",
        "min_years_experience": 7.0,
        "required_skills": ["Apache Spark", "Kafka", "PostgreSQL", "Snowflake", "dbt", "Python"],
        "structured_criteria": {
            "data_engineering_weight": 0.5,
            "architecture_weight": 0.3,
            "analytics_weight": 0.2
        },
        "created_at": "2026-01-12T11:30:00Z",
        "updated_at": "2026-01-12T11:30:00Z"
    },
    "job-003": {
        "id": "job-003",
        "title": "Lead Product Designer",
        "department": "Design",
        "location": "London / Remote",
        "status": "PAUSED",
        "posted_date": "2025-12-01",
        "candidates_count": 8,
        "avatars": [
            "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80",
        ],
        "top_match": {
            "score": 0,
            "label": "Analysis Paused",
            "last_run": "-",
            "status": "PAUSED"
        },
        "icon_type": "design",
        "job_description": "Shape end-to-end user experiences for complex enterprise dashboards and intelligent analytics workflows. Define design systems and lead UX research.",
        "min_years_experience": 6.0,
        "required_skills": ["Figma", "Design Systems", "User Research", "Prototyping", "Design Ops"],
        "structured_criteria": {
            "ui_ux_weight": 0.6,
            "design_systems_weight": 0.4
        },
        "created_at": "2025-12-01T14:00:00Z",
        "updated_at": "2025-12-01T14:00:00Z"
    },
    "job-004": {
        "id": "job-004",
        "title": "Senior Product Manager",
        "department": "Product",
        "location": "San Francisco / Hybrid",
        "status": "OPEN",
        "posted_date": "2026-02-01",
        "candidates_count": 19,
        "avatars": [
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
        ],
        "top_match": {
            "score": 88,
            "label": "88 Top Match",
            "last_run": "5h ago",
            "status": "ACTIVE"
        },
        "icon_type": "product",
        "job_description": "Drive product roadmap and feature definition for AI-assisted workflow tools and enterprise integrations.",
        "min_years_experience": 4.0,
        "required_skills": ["Product Strategy", "User Stories", "Roadmapping", "Metrics & Analytics", "Agile"],
        "structured_criteria": {
            "strategy_weight": 0.5,
            "execution_weight": 0.5
        },
        "created_at": "2026-02-01T10:00:00Z",
        "updated_at": "2026-02-01T10:00:00Z"
    }
}


class CreateJobRequest(BaseModel):
    title: str = Field(..., description="Job Requisition Title")
    department: str = Field(default="Engineering", description="Department name")
    location: str = Field(default="Remote", description="Job location")
    job_description: str = Field(..., description="Full text or HTML job description")
    required_skills: List[str] = Field(default_factory=list, description="Extracted required skills")
    min_years_experience: float = Field(default=3.0, description="Minimum years of experience")
    run_ai_match: bool = Field(default=True, description="Whether to trigger 3-stage candidate matching")


class JobResponse(BaseModel):
    id: str
    title: str
    department: str
    location: str
    status: str
    posted_date: str
    candidates_count: int
    avatars: List[str]
    top_match: Dict[str, Any]
    icon_type: str
    job_description: str
    min_years_experience: float
    required_skills: List[str]
    structured_criteria: Dict[str, Any]
    created_at: str
    updated_at: str


@router.get("", response_model=List[JobResponse])
async def list_jobs(
    status_filter: Optional[str] = Query(None, alias="status"),
    department: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    jobs = list(JOBS_STORE.values())

    if status_filter and status_filter.upper() != "ALL":
        jobs = [j for j in jobs if j["status"].upper() == status_filter.upper()]

    if department and department.upper() != "ALL":
        jobs = [j for j in jobs if j["department"].lower() == department.lower()]

    if search:
        s = search.lower()
        jobs = [
            j for j in jobs
            if s in j["title"].lower()
            or s in j["department"].lower()
            or s in j["location"].lower()
            or any(s in skill.lower() for skill in j.get("required_skills", []))
        ]

    return jobs


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    if job_id not in JOBS_STORE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return JOBS_STORE[job_id]


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(payload: CreateJobRequest):
    new_id = f"job-{uuid.uuid4().hex[:8]}"
    now_str = datetime.utcnow().strftime("%Y-%m-%d")
    now_iso = datetime.utcnow().isoformat() + "Z"

    # Auto-extract skills if none provided
    skills = payload.required_skills
    if not skills:
        common_keywords = ["Python", "FastAPI", "PostgreSQL", "Kubernetes", "AWS", "React", "TypeScript", "Docker"]
        skills = [kw for kw in common_keywords if kw.lower() in payload.job_description.lower()] or ["Python", "FastAPI", "PostgreSQL"]

    icon_type = "code"
    dept_lower = payload.department.lower()
    if "data" in dept_lower:
        icon_type = "database"
    elif "design" in dept_lower:
        icon_type = "design"
    elif "product" in dept_lower:
        icon_type = "product"

    new_job = {
        "id": new_id,
        "title": payload.title,
        "department": payload.department,
        "location": payload.location,
        "status": "OPEN",
        "posted_date": now_str,
        "candidates_count": 0,
        "avatars": [],
        "top_match": {
            "score": 95 if payload.run_ai_match else 0,
            "label": "95 Top Match" if payload.run_ai_match else "Pending Match",
            "last_run": "Just now" if payload.run_ai_match else "-",
            "status": "ACTIVE"
        },
        "icon_type": icon_type,
        "job_description": payload.job_description,
        "min_years_experience": payload.min_years_experience,
        "required_skills": skills,
        "structured_criteria": {
            "technical_depth_weight": 0.4,
            "system_design_weight": 0.4,
            "leadership_weight": 0.2
        },
        "created_at": now_iso,
        "updated_at": now_iso
    }

    JOBS_STORE[new_id] = new_job
    return new_job


@router.patch("/{job_id}/status", response_model=JobResponse)
async def update_job_status(job_id: str, new_status: str = Query(..., regex="^(OPEN|PAUSED|CLOSED)$")):
    if job_id not in JOBS_STORE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    JOBS_STORE[job_id]["status"] = new_status
    if new_status == "PAUSED":
        JOBS_STORE[job_id]["top_match"]["status"] = "PAUSED"
        JOBS_STORE[job_id]["top_match"]["label"] = "Analysis Paused"
    elif new_status == "OPEN":
        JOBS_STORE[job_id]["top_match"]["status"] = "ACTIVE"

    return JOBS_STORE[job_id]
