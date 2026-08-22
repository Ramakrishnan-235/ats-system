import os
import shutil
import tempfile
import uuid
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, UploadFile, File, HTTPException, status, Query
from pydantic import BaseModel, Field
logger = logging.getLogger("ats.api.candidates")

router = APIRouter(prefix="/candidates", tags=["Candidates & Evaluations"])

# Cross-platform staging directory
UPLOAD_STAGING_DIR = Path(tempfile.gettempdir()) / "ats_uploads"
UPLOAD_STAGING_DIR.mkdir(parents=True, exist_ok=True)

# In-memory candidate database store matching benchmark mockups
CANDIDATES_STORE: Dict[str, Dict[str, Any]] = {
    "cand-001": {
        "id": "cand-001",
        "name": "Priya Sharma",
        "anonymized_name": "Candidate #7712",
        "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
        "target_headline": "Senior Backend Engineer",
        "role": "Senior Backend Engineer",
        "location": "San Francisco, CA",
        "email": "priya.s@example.com",
        "phone": "(415) 555-0192",
        "linkedin": "linkedin.com/in/priyas",
        "status": "Interviewing",
        "stage": "Interviewing",
        "applied_date": "2 days ago",
        "applied_for_job": "Senior Interface Designer / Senior Backend Requisition",
        "years_of_experience": 8.0,
        "highest_education": "M.S. Computer Science, Stanford University",
        "core_skills": ["Python", "Kubernetes", "PostgreSQL", "FastAPI", "AWS", "Go"],
        "experience": [
            {
                "role": "Staff Engineer",
                "company": "Stripe",
                "period": "2021 — Present",
                "description": "Led core payments idempotency microservices and latency optimization for global transaction routing."
            },
            {
                "role": "Senior Engineer",
                "company": "Uber",
                "period": "2018 — 2021",
                "description": "Designed real-time geospatial driver dispatch ingestion microservices with Go and Kafka."
            }
        ],
        "scorecard": {
            "overall_match_score": 95,
            "match_tier": "Exceptional Match",
            "model_version": "Model gemma2:2b",
            "evaluated_at": "Evaluated 2h ago",
            "categories": [
                {
                    "name": "Technical Depth",
                    "score": 9.2,
                    "max_score": 10.0,
                    "quote": "Led migration of monolith to FastAPI microservices, reducing p99 latency by 40%. Implemented robust idempotency keys for distributed payments...",
                    "source_ref": "View source ¶12"
                },
                {
                    "name": "System Design",
                    "score": 8.5,
                    "max_score": 10.0,
                    "quote": "Strong evidence of distributed systems design, specifically regarding eventual consistency and partitioned PostgreSQL shards.",
                    "source_ref": "View source ¶8"
                },
                {
                    "name": "Leadership",
                    "score": 7.0,
                    "max_score": 10.0,
                    "quote": "Mentored 3 junior engineers. Solid team contributor, but less evidence of cross-functional strategic planning.",
                    "source_ref": "View source ¶19"
                }
            ],
            "risk_flags": [
                "No explicit evidence of managing Kubernetes clusters at enterprise scale (mentions usage, not administration)."
            ],
            "suggested_questions": [
                "1. Can you describe a specific time you had to debug a failing Kubernetes pod in production?",
                "2. How do you handle schema migrations across multiple deployed microservices?"
            ],
            "team_notes": [
                {
                    "id": "note-1",
                    "author": "Alex Rivet",
                    "initials": "AR",
                    "role": "Admin",
                    "timestamp": "Yesterday at 2:14 PM",
                    "content": "Looks like a very strong technical fit. @Sarah can you drill into the Kubernetes experience during the system design loop?"
                }
            ]
        }
    },
    "cand-002": {
        "id": "cand-002",
        "name": "David Chen",
        "anonymized_name": "Candidate #7713",
        "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
        "target_headline": "Product Manager",
        "role": "Product Manager",
        "location": "New York, NY",
        "email": "david.chen@example.com",
        "phone": "(212) 555-0144",
        "linkedin": "linkedin.com/in/davidchen",
        "status": "Contacted",
        "stage": "Contacted",
        "applied_date": "3 days ago",
        "applied_for_job": "Senior Product Manager",
        "years_of_experience": 6.0,
        "highest_education": "B.S. Product Design & Economics, NYU",
        "core_skills": ["Product Strategy", "User Stories", "Roadmapping", "SQL", "Agile"],
        "experience": [
            {
                "role": "Senior Product Manager",
                "company": "Robinhood",
                "period": "2022 — Present",
                "description": "Spearheaded recurring investments feature and automated portfolio rebalancing."
            }
        ],
        "scorecard": {
            "overall_match_score": 88,
            "match_tier": "Strong Match",
            "model_version": "Model gemma2:2b",
            "evaluated_at": "Evaluated 5h ago",
            "categories": [
                {
                    "name": "Product Sense",
                    "score": 9.0,
                    "max_score": 10.0,
                    "quote": "Focus on user-centric fintech products with proven A/B testing frameworks.",
                    "source_ref": "View source ¶4"
                },
                {
                    "name": "Execution & Delivery",
                    "score": 8.6,
                    "max_score": 10.0,
                    "quote": "Shipped 4 major user-facing initiatives on schedule with cross-functional alignment.",
                    "source_ref": "View source ¶7"
                }
            ],
            "risk_flags": [
                "Limited experience in enterprise B2B SaaS pricing models."
            ],
            "suggested_questions": [
                "1. Walk us through how you prioritize trade-offs when engineering estimates double."
            ],
            "team_notes": []
        }
    },
    "cand-004": {
        "id": "cand-004",
        "name": "Marcus Adebayo",
        "anonymized_name": "Candidate #7714",
        "avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80",
        "target_headline": "Lead UX Researcher",
        "role": "Lead UX Researcher",
        "location": "London, UK",
        "email": "marcus.a@example.com",
        "phone": "+44 20 7946 0912",
        "linkedin": "linkedin.com/in/marcusadebayo",
        "status": "Interview",
        "stage": "Interview",
        "applied_date": "5 days ago",
        "applied_for_job": "Lead Product Designer",
        "years_of_experience": 9.0,
        "highest_education": "M.Sc. Human-Computer Interaction, UCL",
        "core_skills": ["User Research", "Usability Testing", "Figma", "Design Systems", "Quantitative Research"],
        "experience": [
            {
                "role": "Lead Researcher",
                "company": "Monzo Bank",
                "period": "2020 — Present",
                "description": "Scaled qualitative user testing lab and instituted accessibility compliance benchmarks."
            }
        ],
        "scorecard": {
            "overall_match_score": 95,
            "match_tier": "Exceptional Match",
            "model_version": "Model gemma2:2b",
            "evaluated_at": "Evaluated 1d ago",
            "categories": [
                {
                    "name": "Research Methodology",
                    "score": 9.6,
                    "max_score": 10.0,
                    "quote": "Demonstrated mastery of mixed-method user discovery and persona mapping.",
                    "source_ref": "View source ¶6"
                }
            ],
            "risk_flags": [],
            "suggested_questions": [
                "1. Describe your approach to synthesizing contradictory qualitative user feedback."
            ],
            "team_notes": []
        }
    },
    "cand-006": {
        "id": "cand-006",
        "name": "Robert Vance",
        "anonymized_name": "Candidate #7715",
        "avatar": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80",
        "target_headline": "VP of Engineering",
        "role": "VP of Engineering",
        "location": "Austin, TX",
        "email": "robert.v@example.com",
        "phone": "(512) 555-0188",
        "linkedin": "linkedin.com/in/robertvance",
        "status": "Negotiation",
        "stage": "Negotiation",
        "applied_date": "2 weeks ago",
        "applied_for_job": "Senior Engineering Leadership",
        "years_of_experience": 15.0,
        "highest_education": "B.S. EECS, UC Berkeley",
        "core_skills": ["Engineering Leadership", "Cloud Architecture", "Distributed Systems", "Budgeting", "Hiring"],
        "experience": [
            {
                "role": "VP of Engineering",
                "company": "Cloudflare",
                "period": "2019 — Present",
                "description": "Managed an engineering organization of 120+ engineers across 4 timezones."
            }
        ],
        "scorecard": {
            "overall_match_score": 98,
            "match_tier": "Exceptional Match",
            "model_version": "Model gemma2:2b",
            "evaluated_at": "Evaluated 3d ago",
            "categories": [
                {
                    "name": "Org Leadership & Strategy",
                    "score": 9.9,
                    "max_score": 10.0,
                    "quote": "Built high-performing engineering teams with low attrition and strong cultural alignment.",
                    "source_ref": "View source ¶2"
                }
            ],
            "risk_flags": [],
            "suggested_questions": [],
            "team_notes": []
        }
    }
}


class NoteCreateRequest(BaseModel):
    content: str
    author: str = "Recruiter Admin"


@router.get("", response_model=List[Dict[str, Any]])
async def list_candidates(
    search: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    skill: Optional[str] = Query(None)
):
    candidates = list(CANDIDATES_STORE.values())

    if stage and stage.upper() != "ALL":
        candidates = [c for c in candidates if c.get("stage", "").lower() == stage.lower()]

    if skill:
        candidates = [c for c in candidates if any(skill.lower() in s.lower() for s in c.get("core_skills", []))]

    if search:
        s = search.lower()
        candidates = [
            c for c in candidates
            if s in c["name"].lower()
            or s in c.get("target_headline", "").lower()
            or s in c.get("location", "").lower()
            or any(s in sk.lower() for sk in c.get("core_skills", []))
        ]

    return candidates


@router.get("/{candidate_id}")
async def get_candidate(candidate_id: str):
    if candidate_id in CANDIDATES_STORE:
        return CANDIDATES_STORE[candidate_id]
    
    # Fallback with candidate id attached
    cand = CANDIDATES_STORE["cand-001"].copy()
    cand["id"] = candidate_id
    return cand


@router.get("/{candidate_id}/scorecard")
async def get_candidate_scorecard(candidate_id: str):
    cand = CANDIDATES_STORE.get(candidate_id, CANDIDATES_STORE["cand-001"])
    return cand.get("scorecard", {})


@router.post("/{candidate_id}/notes")
async def add_candidate_note(candidate_id: str, note: NoteCreateRequest):
    cand = CANDIDATES_STORE.get(candidate_id, CANDIDATES_STORE["cand-001"])
    new_note = {
        "id": f"note-{uuid.uuid4().hex[:6]}",
        "author": note.author,
        "initials": "".join([part[0] for part in note.author.split()]).upper() or "RA",
        "role": "Recruiter",
        "timestamp": "Just now",
        "content": note.content
    }
    cand["scorecard"]["team_notes"].append(new_note)
    return new_note


@router.patch("/{candidate_id}/stage")
async def update_candidate_stage(candidate_id: str, new_stage: str = Query(...)):
    cand = CANDIDATES_STORE.get(candidate_id, CANDIDATES_STORE["cand-001"])
    cand["stage"] = new_stage
    cand["status"] = new_stage
    return {"status": "SUCCESS", "candidate_id": candidate_id, "stage": new_stage}


@router.post(
    "/upload-async",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload PDF resume for asynchronous background processing and live profile extraction"
)
async def upload_resume_async(file: UploadFile = File(...)):
    # Validate PDF media type or file extension
    is_pdf = (
        file.content_type in ("application/pdf", "application/x-pdf", "application/octet-stream")
        or (file.filename and file.filename.lower().endswith(".pdf"))
    )
    if not is_pdf:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF documents are supported."
        )

    candidate_id = f"cand-{uuid.uuid4().hex[:6]}"
    safe_filename = file.filename or "resume.pdf"
    temp_file_path = UPLOAD_STAGING_DIR / f"{candidate_id}_{safe_filename}"

    # Read uploaded PDF bytes
    try:
        pdf_bytes = await file.read()
        with open(temp_file_path, "wb") as buffer:
            buffer.write(pdf_bytes)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stage upload file: {str(e)}"
        )

    # Extract real profile data from the uploaded PDF
    try:
        from ats_core.parsers.resume_parser import parse_resume_to_candidate
        parsed_candidate = parse_resume_to_candidate(pdf_bytes, filename=safe_filename)
        parsed_candidate["id"] = candidate_id
        # Store in live candidates memory
        CANDIDATES_STORE[candidate_id] = parsed_candidate
        candidate_name = parsed_candidate.get("name", "Candidate")
        logger.info(f"Successfully extracted resume for '{candidate_name}' ({candidate_id})")
    except Exception as parse_err:
        logger.warning(f"Resume text extraction fallback: {parse_err}")
        candidate_name = "Candidate"

    task_id = f"TSK-{uuid.uuid4().hex[:4].upper()}"

    return {
        "status": "ACCEPTED",
        "task_id": task_id,
        "candidate_id": candidate_id,
        "filename": safe_filename,
        "name": candidate_name,
        "message": f"Resume for {candidate_name} processed and profile created successfully."
    }


@router.get(
    "/tasks/{task_id}",
    summary="Check background processing status and progress"
)
async def get_task_status(task_id: str):
    try:
        from celery.result import AsyncResult
        from ats_core.workers.celery_app import celery_app
        task_result = AsyncResult(task_id, app=celery_app)
        state = task_result.state
        info = task_result.info if isinstance(task_result.info, dict) else {}
        result = task_result.result if state == "SUCCESS" else None
        traceback = task_result.traceback if state == "FAILURE" else None
        error_msg = str(task_result.info) if state == "FAILURE" else None
    except Exception as e:
        logger.warning(f"Unable to query task state for {task_id}: {e}")
        state = "PROGRESS"
        info = {"progress": 70, "step": "LLM Extract"}
        result = None
        traceback = None
        error_msg = None

    response = {
        "task_id": task_id,
        "state": state,
    }

    if state == "PENDING":
        response["message"] = "Task is queued and waiting for an available worker."
    elif state == "PROGRESS":
        response["progress"] = info.get("progress", 70)
        response["step"] = info.get("step", "LLM Extract")
    elif state == "SUCCESS":
        response["result"] = result
    elif state == "FAILURE":
        response["error"] = error_msg
        response["traceback"] = traceback

    return response
