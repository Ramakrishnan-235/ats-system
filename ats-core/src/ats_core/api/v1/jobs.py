import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator

from ats_core.api.audit import check_and_audit_pii_access
from ats_core.api.auth import get_current_user, require_write_role

logger = logging.getLogger("ats.api.jobs")
router = APIRouter(prefix="/jobs", tags=["Job Postings & Requisitions"])

from ats_core.taxonomy.seed_jobs import RAW_50_JOBS, SAMPLE_AVATARS


# Populate in-memory store
JOBS_STORE: dict[str, dict[str, Any]] = {}
for i, item in enumerate(RAW_50_JOBS):
    job_id = item["id"]

    JOBS_STORE[job_id] = {
        "id": job_id,
        "title": item["title"],
        "department": item["department"],
        "location": item["location"],
        "status": item["status"],
        "posted_date": item["posted_date"],
        "candidates_count": 0,
        "avatars": [],
        "top_match": {
            "score": 0,
            "label": "No Candidates",
            "last_run": "-",
            "status": "PENDING"
        },
        "icon_type": item["icon_type"],
        "job_description": item["job_description"],
        "min_years_experience": item["min_years_experience"],
        "required_skills": item["required_skills"],
        "structured_criteria": {
            "technical_depth_weight": 0.4,
            "domain_expertise_weight": 0.4,
            "execution_weight": 0.2
        },
        "created_at": f"{item['posted_date']}T09:00:00Z",
        "updated_at": f"{item['posted_date']}T09:00:00Z"
    }


class CreateJobRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=200, description="Job Requisition Title")
    department: str = Field(default="Software Engineering", max_length=100, description="Department name")
    location: str = Field(default="Remote", max_length=100, description="Job location")
    job_description: str = Field(..., min_length=10, max_length=50000, description="Full text or HTML job description")
    required_skills: list[str] = Field(default_factory=list, max_length=100, description="Extracted required skills")
    min_years_experience: float = Field(default=3.0, ge=0, le=70, description="Minimum years of experience")
    run_ai_match: bool = Field(default=True, description="Whether to trigger candidate matching")

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        s = v.strip() if isinstance(v, str) else ""
        if len(s) < 2 or len(s) > 200:
            raise ValueError("Job title must be between 2 and 200 characters")
        return s

    @field_validator("job_description")
    @classmethod
    def validate_job_description(cls, v: str) -> str:
        s = v.strip() if isinstance(v, str) else ""
        if len(s) < 10 or len(s) > 50000:
            raise ValueError("Job description must be between 10 and 50,000 characters")
        return s


class UpdateJobRequest(BaseModel):
    """Editable requisition fields only; omitted fields keep their current values."""
    model_config = {"extra": "forbid"}

    title: str | None = Field(default=None, max_length=200)
    department: str | None = Field(default=None, max_length=100)
    location: str | None = Field(default=None, max_length=100)
    job_description: str | None = Field(default=None, max_length=50000)
    required_skills: list[str] | None = Field(default=None, max_length=100)

    @field_validator("title", "department", "location", "job_description", "required_skills")
    @classmethod
    def reject_null_fields(cls, value):
        if value is None:
            raise ValueError("Editable job fields cannot be null")
        return value

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str | None) -> str | None:
        if v is not None:
            s = v.strip()
            if len(s) < 2 or len(s) > 200:
                raise ValueError("Job title must be between 2 and 200 characters")
            return s
        return v

    @field_validator("job_description")
    @classmethod
    def validate_job_description(cls, v: str | None) -> str | None:
        if v is not None:
            s = v.strip()
            if len(s) < 10 or len(s) > 50000:
                raise ValueError("Job description must be between 10 and 50,000 characters")
            return s
        return v


class JobResponse(BaseModel):
    id: str
    title: str
    department: str
    location: str
    status: str
    posted_date: str
    candidates_count: int
    avatars: list[str]
    top_match: dict[str, Any]
    icon_type: str
    job_description: str
    min_years_experience: float
    required_skills: list[str]
    structured_criteria: dict[str, Any]
    created_at: str
    updated_at: str


def _normalize_job_dict(j: dict[str, Any]) -> dict[str, Any]:
    jid = j.get("id", "job-unknown")
    now_iso = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    c_count = len(JOB_CANDIDATES_STORE.get(jid, [])) if jid in JOB_CANDIDATES_STORE else j.get("candidates_count", 0)
    return {
        "id": jid,
        "title": j.get("title", "Untitled Requisition"),
        "department": j.get("department", "Engineering"),
        "location": j.get("location", "Remote"),
        "status": j.get("status", "OPEN"),
        "posted_date": j.get("posted_date", "2026-02-10"),
        "candidates_count": c_count,
        "avatars": j.get("avatars", []),
        "top_match": j.get("top_match", {
            "score": None,
            "label": "No Candidates",
            "last_run": "-",
            "status": "PENDING"
        }),
        "icon_type": j.get("icon_type", "tech"),
        "job_description": j.get("job_description", ""),
        "min_years_experience": float(j.get("min_years_experience") or 0.0),
        "required_skills": j.get("required_skills", []),
        "structured_criteria": j.get("structured_criteria", {}),
        "created_at": j.get("created_at", now_iso),
        "updated_at": j.get("updated_at", now_iso),
    }


@router.get("", response_model=list[JobResponse])
async def list_jobs(
    status_filter: str | None = Query(None, alias="status"),
    department: str | None = Query(None),
    search: str | None = Query(None)
):
    try:
        from ats_core.db.store_sync import sync_jobs_from_db
        sync_jobs_from_db()
    except Exception as e:
        logger.debug("Could not sync jobs from DB: %s", e)

    raw_jobs = list(JOBS_STORE.values())
    jobs = [_normalize_job_dict(j) for j in raw_jobs]

    if status_filter and status_filter.upper() != "ALL":
        jobs = [j for j in jobs if j["status"].upper() == status_filter.upper()]

    if department and department.upper() != "ALL":
        dept_query = department.lower()
        jobs = [
            j for j in jobs
            if dept_query in j["department"].lower() or j["department"].lower() in dept_query
        ]

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
        try:
            from ats_core.db.store_sync import sync_job_by_id_from_db
            sync_job_by_id_from_db(job_id)
        except Exception as e:
            logger.debug("Could not sync job %s from DB: %s", job_id, e)

    if job_id not in JOBS_STORE:
        # Check by prefix match or index
        matched = [j for j in JOBS_STORE.values() if j["id"] == job_id or j.get("title", "").lower() == job_id.lower()]
        if matched:
            return _normalize_job_dict(matched[0])
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    return _normalize_job_dict(JOBS_STORE[job_id])


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_write_role)])
async def create_job(request: Request, payload: CreateJobRequest):
    require_write_role(request)
    new_id = f"job-{uuid.uuid4().hex[:8]}"
    now = datetime.now(UTC)
    now_str = now.strftime("%Y-%m-%d")
    now_iso = now.isoformat().replace("+00:00", "Z")

    # Auto-extract skills if none provided
    skills = payload.required_skills
    if not skills:
        common_keywords = ["Python", "FastAPI", "PostgreSQL", "Kubernetes", "AWS", "React", "TypeScript", "Docker", "PyTorch", "LLMs"]
        skills = [kw for kw in common_keywords if kw.lower() in payload.job_description.lower()]

    icon_type = "code"
    dept_lower = payload.department.lower()
    if "ai" in dept_lower or "intelligent" in dept_lower or "machine learning" in dept_lower:
        icon_type = "ai"
    elif "cloud" in dept_lower or "infrastructure" in dept_lower or "devops" in dept_lower:
        icon_type = "cloud"
    elif "data" in dept_lower or "analytics" in dept_lower:
        icon_type = "database"
    elif "security" in dept_lower or "cyber" in dept_lower:
        icon_type = "security"
    elif "qa" in dept_lower or "quality" in dept_lower or "support" in dept_lower:
        icon_type = "qa"
    elif "leadership" in dept_lower or "strategy" in dept_lower:
        icon_type = "leadership"
    elif "design" in dept_lower or "ux" in dept_lower:
        icon_type = "design"
    elif "product" in dept_lower:
        icon_type = "product"
    elif "emerging" in dept_lower or "iot" in dept_lower or "specialized" in dept_lower:
        icon_type = "emerging"

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
            "score": None,
            "label": "Pending Match",
            "last_run": "-",
            "status": "PENDING"
        },
        "icon_type": icon_type,
        "job_description": payload.job_description,
        "min_years_experience": payload.min_years_experience,
        "required_skills": skills,
        "structured_criteria": {
            "technical_depth_weight": 0.4,
            "domain_expertise_weight": 0.4,
            "execution_weight": 0.2
        },
        "created_at": now_iso,
        "updated_at": now_iso
    }

    JOBS_STORE[new_id] = new_job
    try:
        from ats_core.db.store_sync import sync_job_to_db
        sync_job_to_db(new_job)
    except Exception as e:
        logger.debug("Could not sync created job to DB: %s", e)
    return new_job


@router.patch("/{job_id}", response_model=JobResponse, dependencies=[Depends(require_write_role)])
async def update_job(request: Request, job_id: str, payload: UpdateJobRequest):
    require_write_role(request)
    if job_id not in JOBS_STORE:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")

    changes = payload.model_dump(exclude_unset=True)
    if changes:
        JOBS_STORE[job_id].update(changes)
        JOBS_STORE[job_id]["updated_at"] = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        try:
            from ats_core.db.store_sync import sync_job_to_db
            sync_job_to_db(JOBS_STORE[job_id])
        except Exception as e:
            logger.debug("Could not sync updated job to DB: %s", e)
    return JOBS_STORE[job_id]


@router.patch("/{job_id}/status", response_model=JobResponse, dependencies=[Depends(require_write_role)])
async def update_job_status(request: Request, job_id: str, new_status: str = Query(..., pattern="^(OPEN|PAUSED|CLOSED)$")):
    require_write_role(request)
    if job_id not in JOBS_STORE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    JOBS_STORE[job_id]["status"] = new_status
    if new_status == "PAUSED":
        JOBS_STORE[job_id]["top_match"]["status"] = "PAUSED"
        JOBS_STORE[job_id]["top_match"]["label"] = "Analysis Paused"
    elif new_status == "OPEN":
        JOBS_STORE[job_id]["top_match"]["status"] = "ACTIVE"

    try:
        from ats_core.db.store_sync import sync_job_to_db
        sync_job_to_db(JOBS_STORE[job_id])
    except Exception as e:
        logger.debug("Could not sync updated job status to DB: %s", e)

    return JOBS_STORE[job_id]


class JobCandidatePayload(BaseModel):
    id: str | None = None
    rank: int | None = 0
    name: str | None = ""
    headline: str | None = ""
    avatar: str | None = None
    isImageAvatar: bool | None = False
    matchScore: int | None = Field(default=None, ge=0, le=100)
    matchLabel: str | None = None
    skills: list[str] = Field(default_factory=list)
    stage: str = "Screening"
    stageBadgeStyle: str | None = "bg-zinc-100 text-zinc-700"
    technicalDepthScore: float | None = Field(default=None, ge=0, le=10)
    systemDesignScore: float | None = Field(default=None, ge=0, le=10)
    quote: str | None = ""
    sourceResumeLink: str | None = None
    potentialGap: str | None = None
    suggestedQuestions: list[str] | None = Field(default_factory=list)


VALID_CANDIDATE_STAGES = {"Screening", "Interview", "Qualified", "Offer", "Hired", "Rejected"}
JOB_CANDIDATES_STORE: dict[str, list[dict[str, Any]]] = {}


def get_or_create_job_candidates(job_id: str) -> list[dict[str, Any]]:
    if job_id not in JOBS_STORE:
        try:
            from ats_core.db.store_sync import sync_job_by_id_from_db
            sync_job_by_id_from_db(job_id)
        except Exception as e:
            logger.debug("Could not sync job %s from DB: %s", job_id, e)

    if job_id not in JOBS_STORE:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")

    try:
        from ats_core.db.store_sync import sync_applications_for_job_from_db
        sync_applications_for_job_from_db(job_id)
    except Exception as e:
        logger.debug("Could not sync applications for %s from DB: %s", job_id, e)

    return JOB_CANDIDATES_STORE.get(job_id, [])


def _present_job_candidates(current, include_pii):
    if include_pii:
        return current
    from ats_core.api.v1.candidates import mask_candidate_pii
    return [mask_candidate_pii(candidate) for candidate in current]


@router.get("/{job_id}/candidates", response_model=list[dict[str, Any]])
async def get_job_candidates(request: Request, job_id: str, include_pii: bool = Query(False)):
    if include_pii:
        user = get_current_user(request)
        check_and_audit_pii_access(request, user, "VIEW_JOB_CANDIDATES_PII", "job_candidates", job_id)
    current = get_or_create_job_candidates(job_id)
    return _present_job_candidates(current, include_pii)


@router.post("/{job_id}/candidates", response_model=list[dict[str, Any]], dependencies=[Depends(require_write_role)])
async def add_job_candidate(request: Request, job_id: str, candidate: JobCandidatePayload, include_pii: bool = Query(False)):
    require_write_role(request)
    if include_pii:
        user = get_current_user(request)
        check_and_audit_pii_access(request, user, "ADD_JOB_CANDIDATE_PII", "job_candidates", job_id)
    current = get_or_create_job_candidates(job_id)
    job = JOBS_STORE[job_id]

    if candidate.stage and candidate.stage not in VALID_CANDIDATE_STAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid candidate stage",
        )

    from ats_core.api.v1.candidates import (
        CANDIDATES_STORE,
        get_candidate_from_store,
        is_generic_or_error_headline,
        is_masked_or_anonymous_name,
        register_candidate_profile,
    )

    if candidate.id and candidate.id.strip():
        target_id = candidate.id.strip()
        cand_rec = get_candidate_from_store(target_id)
        if not cand_rec:
            try:
                from ats_core.db.store_sync import sync_candidate_by_id_from_db
                cand_rec = sync_candidate_by_id_from_db(target_id)
            except Exception as e:
                logger.debug("Could not sync candidate %s from DB: %s", target_id, e)
        if not cand_rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Candidate with ID '{candidate.id}' not found.",
            )
        target_id = cand_rec.get("id") or target_id
        is_new_candidate = False
    else:
        target_id = f"cand-{uuid.uuid4().hex}"
        cand_rec = None
        is_new_candidate = True
        if not candidate.name or not candidate.name.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Candidate name is required.",
            )

    cand_obj = candidate.model_dump()
    cand_obj["id"] = target_id

    if cand_rec:
        # Existing candidate in repository: lock canonical identity from store
        stored_name = cand_rec.get("name")
        if stored_name and not is_masked_or_anonymous_name(stored_name):
            cand_obj["name"] = stored_name
        elif candidate.name and not is_masked_or_anonymous_name(candidate.name):
            cand_obj["name"] = candidate.name
        else:
            cand_obj["name"] = stored_name or candidate.name or "Candidate"

        stored_headline = cand_rec.get("target_headline") or cand_rec.get("role")
        if stored_headline and not is_generic_or_error_headline(stored_headline):
            cand_obj["headline"] = stored_headline
        elif candidate.headline and not is_generic_or_error_headline(candidate.headline):
            cand_obj["headline"] = candidate.headline
        else:
            cand_obj["headline"] = stored_headline or candidate.headline or job.get("title", "Candidate")

        cand_obj["avatar"] = cand_rec.get("avatar") or "CD"
        cand_obj["isImageAvatar"] = cand_rec.get("isImageAvatar", False)
        cand_obj["skills"] = cand_rec.get("core_skills", candidate.skills or [])

        # Only use genuine evaluation scores if authentic scorecard exists for this candidate/job
        existing_sc = cand_rec.get("scorecard") or {}
        job_title_lower = (job.get("title") or "").strip().lower()
        applied_for_lower = (cand_rec.get("applied_for_job") or "").strip().lower()
        matches_job = (
            not cand_rec.get("applied_for_job_id")
            or cand_rec.get("applied_for_job_id") == job_id
            or (job_title_lower and job_title_lower in applied_for_lower)
        )
        if existing_sc.get("evaluation_status") == "COMPLETED" and matches_job:
            cand_obj["matchScore"] = existing_sc.get("overall_match_score")
            cand_obj["matchLabel"] = existing_sc.get("match_tier") or "Evaluated"
            tech_score = None
            sys_score = None
            quote = ""
            for cat in existing_sc.get("categories", []):
                cat_name = cat.get("name", "").lower()
                if "technical" in cat_name and tech_score is None:
                    tech_score = cat.get("score")
                elif "system" in cat_name and sys_score is None:
                    sys_score = cat.get("score")
                if not quote and cat.get("quote"):
                    quote = cat.get("quote")
            cand_obj["technicalDepthScore"] = tech_score
            cand_obj["systemDesignScore"] = sys_score
            cand_obj["quote"] = quote
        else:
            cand_obj["matchScore"] = None
            cand_obj["matchLabel"] = "Not Evaluated"
            cand_obj["technicalDepthScore"] = None
            cand_obj["systemDesignScore"] = None
            cand_obj["quote"] = ""
    else:
        # New candidate: sanitize and ensure unevaluated initial state (no client-controlled scores)
        if is_masked_or_anonymous_name(cand_obj.get("name")):
            cand_obj["name"] = "Candidate"
        if is_generic_or_error_headline(cand_obj.get("headline")):
            cand_obj["headline"] = job.get("title", "Candidate")

        cand_obj["matchScore"] = None
        cand_obj["matchLabel"] = "Not Evaluated"
        cand_obj["technicalDepthScore"] = None
        cand_obj["systemDesignScore"] = None
        cand_obj["quote"] = ""
        cand_obj["skills"] = candidate.skills or []

    initials = (cand_obj["name"].split(" ")[0][:1] + (cand_obj["name"].split(" ")[1][:1] if len(cand_obj["name"].split(" ")) > 1 else "")) if cand_obj.get("name") else "CD"
    avatar = cand_obj.get("avatar") or (initials.upper() if initials else "CD") or "CD"
    cand_obj["avatar"] = avatar
    cand_obj["sourceResumeLink"] = f"/candidates/{target_id}"
    if not cand_obj.get("stage"):
        cand_obj["stage"] = "Screening"

    # Remove any existing duplicate by ID
    updated_list = [c for c in current if c.get("id") != target_id]
    updated_list.append(cand_obj)

    # Re-rank by match score descending (with technicalDepth as tiebreaker)
    updated_list.sort(
        key=lambda c: (
            c.get("matchScore") or 0,
            c.get("technicalDepthScore") or 0.0
        ),
        reverse=True
    )

    # Re-index ranks 1..N
    for idx, c in enumerate(updated_list):
        c["rank"] = idx + 1

    if is_new_candidate:
        register_candidate_profile(
            cand_obj,
            job_title=job["title"],
            department=job["department"],
            job_id=job_id,
        )
    else:
        # Existing candidate: link job if not already set, never overwrite profile
        if not cand_rec.get("applied_for_job_id"):
            cand_rec["applied_for_job_id"] = job_id
            cand_rec["applied_for_job"] = f"{job['title']} ({job['department']})"

    JOB_CANDIDATES_STORE[job_id] = updated_list
    JOBS_STORE[job_id]["candidates_count"] = len(updated_list)

    try:
        from ats_core.db.store_sync import sync_application_to_db, sync_job_to_db
        sync_application_to_db(job_id, cand_obj)
        sync_job_to_db(JOBS_STORE[job_id])
    except Exception as e:
        logger.debug("Could not sync application to DB: %s", e)

    return _present_job_candidates(updated_list, include_pii)


@router.delete("/{job_id}/candidates/{candidate_id}", response_model=list[dict[str, Any]], dependencies=[Depends(require_write_role)])
async def remove_job_candidate(request: Request, job_id: str, candidate_id: str, include_pii: bool = Query(False)):
    require_write_role(request)
    if include_pii:
        user = get_current_user(request)
        check_and_audit_pii_access(request, user, "REMOVE_JOB_CANDIDATE_PII", "job_candidates", job_id)
    current = get_or_create_job_candidates(job_id)

    updated_list = [c for c in current if c.get("id") != candidate_id]

    # Re-rank remaining candidates 1..N
    for idx, c in enumerate(updated_list):
        c["rank"] = idx + 1

    JOB_CANDIDATES_STORE[job_id] = updated_list

    if job_id in JOBS_STORE:
        JOBS_STORE[job_id]["candidates_count"] = max(0, len(updated_list))

    try:
        from ats_core.db.store_sync import delete_application_from_db, sync_job_to_db
        delete_application_from_db(job_id, candidate_id)
        if job_id in JOBS_STORE:
            sync_job_to_db(JOBS_STORE[job_id])
    except Exception as e:
        logger.debug("Could not sync application deletion to DB: %s", e)

    return _present_job_candidates(updated_list, include_pii)


@router.patch("/{job_id}/candidates/{candidate_id}/stage", dependencies=[Depends(require_write_role)])
async def update_job_candidate_stage(request: Request, job_id: str, candidate_id: str, new_stage: str = Query(...), include_pii: bool = Query(False)):
    require_write_role(request)
    clean_stage = new_stage.strip() if isinstance(new_stage, str) else ""
    if clean_stage not in VALID_CANDIDATE_STAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid candidate stage",
        )

    if include_pii:
        user = get_current_user(request)
        check_and_audit_pii_access(request, user, "UPDATE_JOB_CANDIDATE_STAGE_PII", "job_candidates", job_id)
    current = get_or_create_job_candidates(job_id)

    matched_candidate = None
    for c in current:
        if c.get("id") == candidate_id:
            c["stage"] = clean_stage
            c["stageBadgeStyle"] = (
                "bg-emerald-100 text-emerald-900"
                if clean_stage in ("Qualified", "Offer")
                else "bg-[#ede8dc] text-zinc-800"
                if clean_stage == "Interview"
                else "bg-zinc-100 text-zinc-700"
            )
            matched_candidate = c
            break

    if not matched_candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found on this job")

    from ats_core.api.v1.candidates import CANDIDATES_STORE, get_candidate_from_store
    cand_in_store = get_candidate_from_store(candidate_id)
    if cand_in_store:
        cand_in_store["stage"] = clean_stage
        cand_in_store["status"] = clean_stage
        try:
            from ats_core.db.store_sync import sync_candidate_to_db
            sync_candidate_to_db(cand_in_store)
        except Exception as e:
            logger.debug("Could not sync candidate stage to DB: %s", e)

    try:
        from ats_core.db.store_sync import sync_application_to_db
        sync_application_to_db(job_id, matched_candidate)
    except Exception as e:
        logger.debug("Could not sync application stage to DB: %s", e)

    return _present_job_candidates([matched_candidate], include_pii)[0]
