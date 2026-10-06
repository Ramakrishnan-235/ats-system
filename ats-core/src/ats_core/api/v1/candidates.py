import os
import copy
import re
import uuid
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Set
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Query, Request, BackgroundTasks
from ats_core.api.auth import get_current_user
from ats_core.api.audit import check_and_audit_pii_access
from pydantic import BaseModel, Field, field_validator
from starlette.concurrency import run_in_threadpool
from ats_core.api.upload_storage import UPLOAD_STAGING_DIR, resume_path, stage_pdf_upload

logger = logging.getLogger("ats.api.candidates")

router = APIRouter(prefix="/candidates", tags=["Candidates & Evaluations"])

VALID_CANDIDATE_STAGES: Set[str] = {"Screening", "Interview", "Qualified", "Offer", "Hired", "Rejected"}

MAX_CANDIDATES_STORE: int = int(os.getenv("ATS_MAX_CANDIDATES_STORE", "5000"))
MAX_UPLOAD_TASKS: int = int(os.getenv("ATS_MAX_UPLOAD_TASKS", "1000"))

# Concurrency limiting to prevent threadpool starvation
MAX_CONCURRENT_UPLOADS: int = int(os.getenv("ATS_MAX_CONCURRENT_UPLOADS", "8"))
_upload_semaphore = asyncio.Semaphore(MAX_CONCURRENT_UPLOADS)
UPLOAD_EXECUTION_MODE: str = os.getenv("ATS_UPLOAD_EXECUTION_MODE", "async").strip().lower()

# In-memory candidate database store (populated dynamically upon upload/registration)
CANDIDATES_STORE: Dict[str, Dict[str, Any]] = {}
# Upload task state tracking
UPLOAD_TASKS_STORE: Dict[str, Dict[str, Any]] = {}


def prune_candidates_store() -> None:
    """Bounded map eviction to prevent unlimited memory growth."""
    while len(CANDIDATES_STORE) >= MAX_CANDIDATES_STORE:
        oldest_key = next(iter(CANDIDATES_STORE))
        del CANDIDATES_STORE[oldest_key]


def prune_upload_tasks() -> None:
    """Bounded task store eviction to prevent unlimited memory growth."""
    while len(UPLOAD_TASKS_STORE) >= MAX_UPLOAD_TASKS:
        pruned = False
        for tid, tdata in list(UPLOAD_TASKS_STORE.items()):
            state = tdata.get("state") or tdata.get("status")
            if state in ("COMPLETED", "FAILED", "SUCCESS", "FAILURE", "ERROR"):
                del UPLOAD_TASKS_STORE[tid]
                pruned = True
                break
        if not pruned:
            oldest_tid = next(iter(UPLOAD_TASKS_STORE))
            del UPLOAD_TASKS_STORE[oldest_tid]


def mask_candidate_pii(cand_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Returns an independent display copy with direct identifiers and their known
    occurrences masked, and raw document fields omitted. This is a display filter;
    role-based access permissions still require a separate authorization model.
    """
    replacements = {
        "name": "[REDACTED_NAME]", "email": "[REDACTED_EMAIL@DOMAIN.COM]",
        "phone": "[REDACTED_PHONE_NUMBER]", "location": "[REDACTED_LOCATION]",
        "linkedin": "[REDACTED_LINK]",
    }
    sensitive = [(str(cand_dict[key]), label) for key, label in replacements.items()
                 if cand_dict.get(key) and str(cand_dict[key]) not in ("N/A", "Candidate")]

    def redact(value):
        if isinstance(value, dict):
            return {key: item if key in ("id", "candidate_id", "anonymized_name") else redact(item) for key, item in value.items() if key not in (
                "raw_text", "raw_anonymized_text", "structured_profile", "resume_filename"
            )}
        if isinstance(value, list):
            return [redact(item) for item in value]
        if isinstance(value, str):
            for identifier, replacement in sensitive:
                value = re.sub(re.escape(identifier), lambda _, label=replacement: label, value, flags=re.IGNORECASE)
            return value
        return value

    masked = redact(cand_dict)
    # Mask direct PII identifiers
    masked["name"] = cand_dict.get("anonymized_name") or f"Candidate #{str(cand_dict.get('id', ''))[:8]}"
    masked["email"] = "[REDACTED_EMAIL@DOMAIN.COM]"
    masked["phone"] = "[REDACTED_PHONE_NUMBER]"
    masked["location"] = "[REDACTED_LOCATION]"
    masked["linkedin"] = "[REDACTED_LINK]"
    masked["avatar"] = "CD"
    masked["isImageAvatar"] = False
    masked["is_pii_masked"] = True
    return masked


def is_masked_or_anonymous_name(name: Optional[str]) -> bool:
    if not name or not isinstance(name, str):
        return True
    s = name.strip()
    return (
        s == ""
        or s.lower() == "candidate"
        or s.startswith("Candidate #")
        or s.startswith("[REDACTED")
        or s == "[REDACTED_NAME]"
    )


def is_generic_or_error_headline(headline: Optional[str]) -> bool:
    if not headline or not isinstance(headline, str):
        return True
    s = headline.strip().lower()
    return s in ("", "candidate", "pending extraction", "document parse error")


def register_candidate_profile(
    cand_dict: Dict[str, Any],
    job_title: str = "Software Engineer",
    department: str = "Engineering",
    job_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Register supplied facts without inventing employment history or AI assessments."""
    cand_id = cand_dict.get("id") or f"cand-{uuid.uuid4().hex}"
    existing = CANDIDATES_STORE.get(cand_id)
    if existing:
        # Existing candidate already in repository: preserve canonical identity, stage, and evaluation
        if job_id and not existing.get("applied_for_job_id"):
            existing["applied_for_job_id"] = job_id
        if cand_dict.get("applied_for_job") and not existing.get("applied_for_job"):
            existing["applied_for_job"] = cand_dict["applied_for_job"]
        try:
            from ats_core.db.store_sync import sync_candidate_to_db
            sync_candidate_to_db(existing)
        except Exception as e:
            logger.debug("Could not sync existing candidate to DB: %s", e)
        return existing

    incoming_name = cand_dict.get("name")
    name = (
        incoming_name
        if (incoming_name and not is_masked_or_anonymous_name(incoming_name))
        else "Candidate"
    )
    incoming_headline = cand_dict.get("headline") or cand_dict.get("target_headline")
    headline = (
        incoming_headline
        if (incoming_headline and not is_generic_or_error_headline(incoming_headline))
        else job_title
    )
    skills = cand_dict.get("skills") or cand_dict.get("core_skills") or []

    # Clean unevaluated scorecard — NEVER set manual "Recruiter assessment" or client-supplied scores
    scorecard = {
        "overall_match_score": None,
        "match_tier": "Not Evaluated",
        "evaluation_status": "PENDING",
        "model_version": None,
        "evaluated_at": None,
        "categories": [],
        "risk_flags": [],
        "suggested_improvements": [],
        "suggested_questions": [],
        "team_notes": [],
    }

    candidate = {
        "id": cand_id,
        "name": name,
        "anonymized_name": f"Candidate #{cand_id[-8:]}",
        "avatar": cand_dict.get("avatar") or "CD",
        "target_headline": headline,
        "role": headline,
        "status": "Screening",
        "stage": "Screening",
        "applied_date": "Recently",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "applied_for_job": cand_dict.get("applied_for_job") or f"{job_title} ({department})",
        "applied_for_job_id": job_id or cand_dict.get("applied_for_job_id"),
        "years_of_experience": None,
        "core_skills": skills,
        "experience": [],
        "scorecard": scorecard,
        "email": cand_dict.get("email") or "N/A",
        "phone": cand_dict.get("phone") or "N/A",
        "location": cand_dict.get("location") or "N/A",
        "linkedin": cand_dict.get("linkedin") or "N/A",
        "highest_education": cand_dict.get("highest_education") or "N/A",
    }
    prune_candidates_store()
    CANDIDATES_STORE[cand_id] = candidate
    try:
        from ats_core.db.store_sync import sync_candidate_to_db
        sync_candidate_to_db(candidate)
    except Exception as e:
        logger.debug("Could not sync registered candidate to DB: %s", e)
    return candidate


class NoteCreateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000, description="Note content")
    author: Optional[str] = Field(default=None, max_length=100, description="Author display name")

    @field_validator("content")
    @classmethod
    def validate_content_not_empty(cls, v: str) -> str:
        s = v.strip() if isinstance(v, str) else ""
        if not s:
            raise ValueError("Note content cannot be empty")
        if len(s) > 5000:
            raise ValueError("Note content exceeds maximum length of 5000 characters")
        return s

    @field_validator("author")
    @classmethod
    def validate_author_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            s = v.strip()
            if len(s) > 100:
                raise ValueError("Author exceeds maximum length of 100 characters")
            return s
        return v


@router.get("", response_model=List[Dict[str, Any]])
async def list_candidates(
    request: Request,
    search: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    skill: Optional[str] = Query(None),
    include_pii: bool = Query(False, description="Set to true only when authorized to view unmasked PII")
):
    try:
        from ats_core.db.store_sync import sync_candidates_from_db
        sync_candidates_from_db()
    except Exception as e:
        logger.debug("Could not sync candidates from DB: %s", e)

    candidates = list(CANDIDATES_STORE.values())

    if stage and stage.upper() != "ALL":
        candidates = [c for c in candidates if c.get("stage", "").lower() == stage.lower()]

    if skill:
        candidates = [c for c in candidates if any(skill.lower() in s.lower() for s in c.get("core_skills", []))]

    if search:
        s = search.lower()
        candidates = [
            c for c in candidates
            if s in c.get("name", "").lower()
            or s in c.get("target_headline", "").lower()
            or s in c.get("location", "").lower()
            or any(s in sk.lower() for sk in c.get("core_skills", []))
        ]

    if include_pii:
        user = get_current_user(request)
        check_and_audit_pii_access(request, user, "LIST_CANDIDATES_PII", "candidates", "all")
    else:
        candidates = [mask_candidate_pii(c) for c in candidates]

    return candidates


@router.get("/{candidate_id}")
async def get_candidate(
    request: Request,
    candidate_id: str,
    include_pii: bool = Query(False, description="Set to true only when authorized to view unmasked PII")
):
    target = CANDIDATES_STORE.get(candidate_id)
    if not target:
        alt_id = candidate_id.replace("cand-", "")
        target = CANDIDATES_STORE.get(alt_id)

    if not target:
        try:
            from ats_core.db.store_sync import sync_candidate_by_id_from_db
            target = sync_candidate_by_id_from_db(candidate_id)
        except Exception as e:
            logger.debug("Could not sync candidate %s from DB: %s", candidate_id, e)

    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate with ID '{candidate_id}' not found."
        )

    if include_pii:
        user = get_current_user(request)
        check_and_audit_pii_access(request, user, "VIEW_CANDIDATE_PII", "candidate", candidate_id)
        return target

    return mask_candidate_pii(target)


@router.get("/{candidate_id}/scorecard")
async def get_candidate_scorecard(candidate_id: str):
    if candidate_id not in CANDIDATES_STORE:
        try:
            from ats_core.db.store_sync import sync_candidate_by_id_from_db
            sync_candidate_by_id_from_db(candidate_id)
        except Exception as e:
            logger.debug("Could not sync candidate %s from DB: %s", candidate_id, e)

    if candidate_id not in CANDIDATES_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate with ID '{candidate_id}' not found."
        )
    return mask_candidate_pii(CANDIDATES_STORE[candidate_id]).get("scorecard", {})


@router.post("/{candidate_id}/notes")
async def add_candidate_note(request: Request, candidate_id: str, note: NoteCreateRequest):
    if candidate_id not in CANDIDATES_STORE:
        try:
            from ats_core.db.store_sync import sync_candidate_by_id_from_db
            sync_candidate_by_id_from_db(candidate_id)
        except Exception as e:
            logger.debug("Could not sync candidate %s from DB: %s", candidate_id, e)

    if candidate_id not in CANDIDATES_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate with ID '{candidate_id}' not found."
        )
    cand = CANDIDATES_STORE[candidate_id]

    # Anti-spoofing: enforce authenticated actor identity if present
    user = get_current_user(request)
    if user and (user.email or user.user_id):
        author_name = (user.email or user.user_id).strip()
        author_role = user.role.capitalize() if user.role else "Recruiter"
    else:
        author_name = note.author.strip() if note.author and note.author.strip() else "Recruiter Admin"
        author_role = "Recruiter"

    clean_content = note.content.strip()
    new_note = {
        "id": f"note-{uuid.uuid4().hex[:6]}",
        "author": author_name,
        "initials": "".join([part[0] for part in author_name.split() if part]).upper() or "RA",
        "role": author_role,
        "timestamp": "Just now",
        "content": clean_content
    }
    if "scorecard" not in cand:
        cand["scorecard"] = {}
    if "team_notes" not in cand["scorecard"]:
        cand["scorecard"]["team_notes"] = []
    cand["scorecard"]["team_notes"].append(new_note)

    try:
        from ats_core.db.store_sync import sync_candidate_to_db
        sync_candidate_to_db(cand)
    except Exception as e:
        logger.debug("Could not persist candidate note to DB: %s", e)

    return new_note


@router.patch("/{candidate_id}/stage")
async def update_candidate_stage(candidate_id: str, new_stage: str = Query(...)):
    clean_stage = new_stage.strip() if isinstance(new_stage, str) else ""
    if clean_stage not in VALID_CANDIDATE_STAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid candidate stage"
        )

    if candidate_id not in CANDIDATES_STORE:
        try:
            from ats_core.db.store_sync import sync_candidate_by_id_from_db
            sync_candidate_by_id_from_db(candidate_id)
        except Exception as e:
            logger.debug("Could not sync candidate %s from DB: %s", candidate_id, e)

    if candidate_id not in CANDIDATES_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate with ID '{candidate_id}' not found."
        )
    cand = CANDIDATES_STORE[candidate_id]
    cand["stage"] = clean_stage
    cand["status"] = clean_stage

    try:
        from ats_core.db.store_sync import sync_candidate_to_db
        sync_candidate_to_db(cand)
    except Exception as e:
        logger.debug("Could not persist candidate stage to DB: %s", e)

    return {"status": "SUCCESS", "candidate_id": candidate_id, "stage": clean_stage}


async def _process_resume_pipeline(
    task_id: str,
    candidate_id: str,
    safe_filename: str,
    doc_bytes: bytes,
    temp_file_path: Path,
    target_job: Optional[Dict[str, Any]],
    job_id: Optional[str],
    is_inline: bool = False,
) -> None:
    """
    Executes the heavy resume processing pipeline:
    1. Hybrid PDF parsing & text extraction
    2. Residue skill extraction
    3. PII anonymization & pre-flight leak check
    4. Deep LLM evaluation against requisition
    5. Database persistence and task progress updates
    """
    processing_failed = False
    effective_job_id = (target_job.get("id") or job_id) if target_job else job_id

    if task_id in UPLOAD_TASKS_STORE:
        UPLOAD_TASKS_STORE[task_id].update({
            "progress": 20,
            "step": "Parsing PDF layout",
        })

    try:
        from ats_core.parsers.resume_parser import parse_resume_to_candidate
        parsed_candidate = await run_in_threadpool(
            parse_resume_to_candidate,
            doc_bytes,
            filename=safe_filename,
            target_job=target_job
        )
        parsed_candidate["id"] = candidate_id

        # Link to target job
        if target_job:
            target_job_id = target_job.get("id") or job_id
            parsed_candidate["applied_for_job"] = f"{target_job['title']} ({target_job.get('department', 'Engineering')})"
            parsed_candidate["applied_for_job_id"] = target_job_id

        # Only score against a real requisition, never against inferred self-fit criteria.
        if target_job:
            job_title_eval = target_job["title"]
            job_desc_eval = target_job.get("job_description", "")
            if task_id in UPLOAD_TASKS_STORE:
                UPLOAD_TASKS_STORE[task_id].update({
                    "progress": 50,
                    "step": "Anonymizing personal data",
                })

            try:
                from ats_core.parsers.anonymizer import ResumeAnonymizer
                from ats_core.evaluator.deep_evaluator import LocalDeepEvaluator

                # Configured models may run remotely (e.g. OpenRouter). Never send raw resume PII.
                # Explicitly re-use all parser-extracted identifiers (name, email, phone, location, URLs).
                def redact_and_validate_resume():
                    anonymizer = ResumeAnonymizer(min_score_threshold=0.55)
                    cand_name = parsed_candidate.get("name")
                    cand_email = parsed_candidate.get("email")
                    cand_phone = parsed_candidate.get("phone")
                    cand_loc = parsed_candidate.get("location")
                    cand_linkedin = parsed_candidate.get("linkedin")
                    cand_urls = [cand_linkedin] if cand_linkedin and cand_linkedin != "N/A" else []

                    redacted = anonymizer.anonymize(
                        text=parsed_candidate.get("raw_text", ""),
                        known_name=cand_name,
                        known_email=cand_email,
                        known_phone=cand_phone,
                        known_location=cand_loc,
                        known_urls=cand_urls,
                    )

                    # Pre-flight check: verify that redacted text contains NO residual PII before sending to external LLM
                    check_fn = getattr(anonymizer, "check_preflight_leak", None)
                    if callable(check_fn):
                        check_res = check_fn(
                            text=redacted,
                            name=cand_name,
                            email=cand_email,
                            phone=cand_phone,
                            urls=cand_urls,
                        )
                        if isinstance(check_res, tuple) and len(check_res) == 2:
                            is_clean, leak_fields = check_res
                            if not is_clean:
                                logger.warning(
                                    f"Pre-flight PII check found potential residual identifiers ({leak_fields}) for candidate {candidate_id}. Performing aggressive scrub."
                                )
                                scrub_fn = getattr(anonymizer, "scrub_residual_pii", None)
                                if callable(scrub_fn):
                                    redacted = scrub_fn(
                                        text=redacted,
                                        name=cand_name,
                                        email=cand_email,
                                        phone=cand_phone,
                                        location=cand_loc,
                                        urls=cand_urls,
                                    )
                                remaining_res = check_fn(
                                    text=redacted,
                                    name=cand_name,
                                    email=cand_email,
                                    phone=cand_phone,
                                    urls=cand_urls,
                                )
                                if isinstance(remaining_res, tuple) and len(remaining_res) == 2:
                                    clean_now, remaining = remaining_res
                                    if not clean_now:
                                        raise ValueError(f"Pre-flight leak validation failed: candidate text contains unredacted PII ({remaining})")

                    return redacted

                evaluation_text = await run_in_threadpool(redact_and_validate_resume)

                if task_id in UPLOAD_TASKS_STORE:
                    UPLOAD_TASKS_STORE[task_id].update({
                        "progress": 75,
                        "step": "Evaluating candidate match",
                    })

                def get_evaluator():
                    if getattr(LocalDeepEvaluator, "_mock_return_value", None) is not None or "Mock" in type(LocalDeepEvaluator).__name__:
                        return LocalDeepEvaluator()
                    if hasattr(LocalDeepEvaluator, "get_instance"):
                        return LocalDeepEvaluator.get_instance()
                    return LocalDeepEvaluator()

                evaluator = await run_in_threadpool(get_evaluator)
                eval_result = await run_in_threadpool(
                    evaluator.evaluate,
                    candidate_id=candidate_id,
                    candidate_profile_text=evaluation_text,
                    job_title=job_title_eval,
                    job_description=job_desc_eval,
                )

                if eval_result.get("success") and eval_result.get("report"):
                    report = eval_result["report"]
                    logger.info(f"Ollama deep evaluation completed for {candidate_id} on '{job_title_eval}' with score {report.overall_match_score}")

                    categories = []
                    for crit in report.criteria_breakdown:
                        categories.append({
                            "name": crit.category.value if hasattr(crit.category, "value") else str(crit.category),
                            "score": round(min(10.0, float(crit.score) * 2.0), 1),
                            "max_score": 10.0,
                            "quote": crit.verbatim_citation or "",
                            "assessment": crit.assessment or "",
                            "source_ref": (f"Evidence: {crit.category.value if hasattr(crit.category, "value") else str(crit.category)}" if crit.verbatim_citation else "")
                        })

                    tier_name = report.qualification_tier.value if hasattr(report.qualification_tier, "value") else str(report.qualification_tier)

                    parsed_candidate["scorecard"] = {
                        "overall_match_score": int(round(report.overall_match_score)),
                        "match_tier": f"{tier_name} Match" if "Match" not in tier_name else tier_name,
                        "model_version": f"Ollama ({evaluator.model_name})",
                        "evaluated_at": datetime.now(timezone.utc).isoformat(),
                        "evaluation_status": "COMPLETED",
                        "categories": categories if categories else parsed_candidate["scorecard"]["categories"],
                        "risk_flags": report.risks_and_skill_gaps or [],
                        "suggested_improvements": report.suggested_improvements if getattr(report, "suggested_improvements", None) else parsed_candidate["scorecard"].get("suggested_improvements", []),
                        "suggested_questions": [f"{i+1}. {q.question}" if hasattr(q, "question") else f"{i+1}. {str(q)}" for i, q in enumerate(report.suggested_interview_questions)] if report.suggested_interview_questions else parsed_candidate["scorecard"]["suggested_questions"],
                        "team_notes": [
                            {
                                "id": f"note-eval-{uuid.uuid4().hex[:4]}",
                                "author": "Ollama Deep Evaluator",
                                "initials": "AI",
                                "role": "AI Evaluator",
                                "timestamp": "Just now",
                                "content": report.executive_verdict or f"Evaluated candidate against {job_title_eval} requisition requirements."
                            }
                        ]
                    }

                    # Persist immutable scoring audit for EEOC and compliance tracking
                    try:
                        from ats_core.evaluator.audit_logger import AuditLogger
                        await AuditLogger.persist_audit_record(
                            session=None,
                            report=report,
                            candidate_id=candidate_id,
                            job_id=target_job.get("id") or "job-001",
                            telemetry=eval_result.get("telemetry"),
                            raw_prompt=job_desc_eval,
                        )
                    except Exception as audit_err:
                        logger.warning(f"Could not persist scoring audit for {candidate_id}: {audit_err}")
            except Exception as eval_err:
                logger.warning(f"Ollama deep evaluation fallback: {eval_err}", exc_info=True)

        parsed_candidate["upload_task_id"] = task_id
        parsed_candidate["resume_filename"] = safe_filename
        parsed_candidate["created_at"] = datetime.now(timezone.utc).isoformat()
        prune_candidates_store()
        CANDIDATES_STORE[candidate_id] = parsed_candidate
        try:
            from ats_core.db.store_sync import sync_candidate_to_db
            sync_candidate_to_db(parsed_candidate)
        except Exception as sync_db_err:
            logger.debug("Could not sync uploaded candidate to DB: %s", sync_db_err)

        if target_job:
            target_job_id = target_job.get("id")
            if target_job_id:
                from ats_core.api.v1.jobs import JOB_CANDIDATES_STORE
                scorecard = parsed_candidate.get("scorecard", {})
                cats = {c.get("name", ""): c.get("score", 0) for c in scorecard.get("categories", [])}
                job_cand = {
                    "id": candidate_id,
                    "rank": len(JOB_CANDIDATES_STORE.get(target_job_id, [])) + 1,
                    "name": parsed_candidate.get("name", "Candidate"),
                    "headline": parsed_candidate.get("target_headline", target_job.get("title", "Candidate")),
                    "avatar": "CD",
                    "isImageAvatar": False,
                    "matchScore": scorecard.get("overall_match_score"),
                    "matchLabel": scorecard.get("match_tier", "Evaluation Pending"),
                    "skills": parsed_candidate.get("core_skills", []),
                    "stage": parsed_candidate.get("stage", "Screening"),
                    "stageBadgeStyle": "bg-emerald-50 text-emerald-700 border-emerald-200",
                    "technicalDepthScore": cats.get("Technical Depth", 8.0),
                    "systemDesignScore": cats.get("System Design", 7.5),
                    "quote": parsed_candidate.get("summary", "Resume uploaded for requisition"),
                    "sourceResumeLink": f"/candidates/{candidate_id}",
                    "potentialGap": (scorecard.get("risk_flags") or [None])[0],
                    "suggestedQuestions": scorecard.get("suggested_questions", []),
                }
                c_list = [c for c in JOB_CANDIDATES_STORE.get(target_job_id, []) if c.get("id") != candidate_id]
                c_list.append(job_cand)
                c_list.sort(key=lambda x: (x.get("matchScore") is not None, x.get("matchScore") or 0), reverse=True)
                for idx, item in enumerate(c_list):
                    item["rank"] = idx + 1
                JOB_CANDIDATES_STORE[target_job_id] = c_list
                target_job["candidates_count"] = len(c_list)
                if c_list and c_list[0].get("matchScore") is not None:
                    target_job["top_match"] = {
                        "score": c_list[0]["matchScore"],
                        "label": c_list[0].get("matchLabel", "Strong Match"),
                        "last_run": "Just now",
                        "status": "ACTIVE",
                    }
                try:
                    from ats_core.db.store_sync import sync_application_to_db, sync_job_to_db
                    sync_application_to_db(target_job_id, job_cand)
                    sync_job_to_db(target_job)
                except Exception as sync_app_err:
                    logger.debug("Could not sync application to DB: %s", sync_app_err)
            else:
                target_job["candidates_count"] = len([
                    c for c in CANDIDATES_STORE.values()
                    if c.get("applied_for_job_id") == target_job.get("id")
                    or c.get("applied_for_job") == target_job.get("title")
                ])

        try:
            from ats_core.api.v1.match import sync_candidates_to_retriever
            sync_candidates_to_retriever()
        except Exception as sync_err:
            logger.debug("Retriever sync on upload: %s", sync_err)

        candidate_name = parsed_candidate.get("name", "Candidate")
        final_score = parsed_candidate.get("scorecard", {}).get("overall_match_score")
        logger.info("Successfully processed candidate %s with score %s", candidate_id, final_score)
    except Exception as parse_err:
        logger.exception(f"Resume text extraction fallback: {parse_err}")
        processing_failed = True
        try:
            await run_in_threadpool(temp_file_path.unlink, missing_ok=True)
        except OSError:
            logger.warning("Could not remove failed resume upload for %s", candidate_id)
        candidate_name = safe_filename.replace(".pdf", "")
        final_score = 0
        parsed_candidate = {
            "id": candidate_id,
            "upload_task_id": task_id,
            "name": candidate_name,
            "anonymized_name": f"Candidate #{candidate_id.replace('cand-', '')[:5]}",
            "target_headline": "Document Parse Error",
            "role": "Pending Extraction",
            "location": "N/A",
            "email": "N/A",
            "phone": "N/A",
            "status": "EVALUATION_FAILED",
            "stage": "Review Required",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "applied_for_job": (
                f"{target_job['title']} ({target_job.get('department', 'Engineering')})"
                if target_job
                else "N/A"
            ),
            "applied_for_job_id": (target_job.get("id") or job_id) if target_job else None,
            "years_of_experience": 0.0,
            "core_skills": [],
            "scorecard": {
                "overall_match_score": 0,
                "match_tier": "Evaluation Failed",
                "evaluation_status": "FAILED",
                "risk_flags": ["Resume parsing failed. Review the uploaded document."],
                "suggested_questions": [],
                "categories": []
            }
        }
        prune_candidates_store()
        CANDIDATES_STORE[candidate_id] = parsed_candidate
        try:
            from ats_core.db.store_sync import sync_candidate_to_db
            sync_candidate_to_db(parsed_candidate)
        except Exception as e:
            logger.debug("Could not sync failed candidate to DB: %s", e)

    mode_label = "inline" if is_inline else "async"
    prune_upload_tasks()
    UPLOAD_TASKS_STORE[task_id] = {
        "task_id": task_id,
        "state": "FAILURE" if processing_failed else "SUCCESS",
        "progress": 100 if not processing_failed else 0,
        "step": "Failed" if processing_failed else "Completed",
        "execution_mode": mode_label,
    }
    if processing_failed:
        UPLOAD_TASKS_STORE[task_id]["error"] = "Resume processing failed."
    else:
        UPLOAD_TASKS_STORE[task_id]["result"] = {
            "status": "COMPLETED",
            "candidate_id": candidate_id,
            "applied_for_job_id": effective_job_id,
            "match_score": final_score,
            "evaluation_status": parsed_candidate.get("scorecard", {}).get("evaluation_status", "PENDING"),
        }


async def _process_resume_pipeline_safe(
    task_id: str,
    candidate_id: str,
    safe_filename: str,
    doc_bytes: bytes,
    temp_file_path: Path,
    target_job: Optional[Dict[str, Any]],
    job_id: Optional[str],
) -> None:
    """Safely runs background processing within the concurrency semaphore."""
    await _upload_semaphore.acquire()
    try:
        await _process_resume_pipeline(
            task_id,
            candidate_id,
            safe_filename,
            doc_bytes,
            temp_file_path,
            target_job,
            job_id,
            is_inline=False,
        )
    finally:
        _upload_semaphore.release()


@router.post(
    "/upload-async",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload and process a PDF resume asynchronously"
)
async def upload_resume_async(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    job_id: Optional[str] = Form(None),
    execution_mode: Optional[str] = Query(None),
):
    # Concurrency limit check
    if _upload_semaphore.locked():
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Upload processing capacity is full. Please retry shortly."
        )

    from ats_core.api.v1.jobs import JOBS_STORE
    target_job = JOBS_STORE.get(job_id) if job_id else None
    if job_id and target_job is None:
        await file.close()
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Target job not found.")

    candidate_id = f"cand-{uuid.uuid4().hex}"
    task_id = str(uuid.uuid4())
    try:
        doc_bytes, safe_filename, temp_file_path = await stage_pdf_upload(file, candidate_id)
    except HTTPException:
        raise
    except OSError:
        logger.exception("Failed to stage resume upload")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to store the resume upload."
        ) from None

    effective_job_id = (target_job.get("id") or job_id) if target_job else job_id

    # Determine execution mode: request param, header, or global setting
    req_mode = execution_mode or request.headers.get("X-Execution-Mode") or UPLOAD_EXECUTION_MODE
    is_inline = req_mode.lower() in ("inline", "sync")

    if is_inline:
        await _process_resume_pipeline(
            task_id,
            candidate_id,
            safe_filename,
            doc_bytes,
            temp_file_path,
            target_job,
            job_id,
            is_inline=True,
        )
        task_info = UPLOAD_TASKS_STORE.get(task_id, {})
        processing_failed = (task_info.get("state") == "FAILURE")
        parsed_candidate = CANDIDATES_STORE.get(candidate_id, {})
        final_score = parsed_candidate.get("scorecard", {}).get("overall_match_score")
        candidate_name = parsed_candidate.get("name", safe_filename.replace(".pdf", ""))

        return {
            "status": "EVALUATION_FAILED" if processing_failed else "ACCEPTED",
            "task_id": task_id,
            "candidate_id": candidate_id,
            "filename": safe_filename,
            "name": candidate_name,
            "job_id": job_id,
            "applied_for_job_id": effective_job_id,
            "match_score": final_score,
            "execution_mode": "inline",
            "evaluation_status": parsed_candidate.get("scorecard", {}).get("evaluation_status", "PENDING"),
            "message": "Resume processing failed. Review the uploaded document." if processing_failed else "Resume processed. See evaluation_status for scoring availability.",
        }

    # True asynchronous mode: initial state in task store
    prune_upload_tasks()
    UPLOAD_TASKS_STORE[task_id] = {
        "task_id": task_id,
        "state": "PROGRESS",
        "progress": 10,
        "step": "Extracting PDF",
        "execution_mode": "async",
    }

    background_tasks.add_task(
        _process_resume_pipeline_safe,
        task_id,
        candidate_id,
        safe_filename,
        doc_bytes,
        temp_file_path,
        target_job,
        job_id,
    )

    return {
        "status": "ACCEPTED",
        "task_id": task_id,
        "candidate_id": candidate_id,
        "filename": safe_filename,
        "name": safe_filename.replace(".pdf", ""),
        "job_id": job_id,
        "applied_for_job_id": effective_job_id,
        "match_score": None,
        "execution_mode": "async",
        "evaluation_status": "PROCESSING",
        "message": "Resume upload accepted and processing in background.",
    }


@router.get(
    "/tasks/{task_id}",
    summary="Check background processing status and progress"
)
async def get_task_status(task_id: str):
    if task_id in UPLOAD_TASKS_STORE:
        return copy.deepcopy(UPLOAD_TASKS_STORE[task_id])

    try:
        from ats_core.db.store_sync import sync_task_status_from_db
        db_task = sync_task_status_from_db(task_id)
        if db_task:
            return copy.deepcopy(db_task)
    except Exception as e:
        logger.debug("Could not check DB for task status: %s", e)

    # Other IDs may belong to actual worker tasks; never fabricate progress.
    try:
        from celery.result import AsyncResult
        from ats_core.workers.celery_app import celery_app
        def read_state():
            task_result = AsyncResult(task_id, app=celery_app)
            state = task_result.state
            info = task_result.info
            return state, info if isinstance(info, dict) else {}, task_result.result if state == "SUCCESS" else None

        state, info, result = await run_in_threadpool(read_state)
    except Exception as e:
        logger.warning(f"Unable to query task state for {task_id}: {e}")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Task status service is unavailable.") from None

    response = {
        "task_id": task_id,
        "state": state,
    }

    if state == "PENDING":
        response["message"] = "Task is pending or the task ID is unknown to the result backend."
    elif state == "PROGRESS":
        response["progress"] = info.get("progress", 0)
        response["step"] = info.get("step", "Processing")
    elif state == "SUCCESS":
        response["result"] = result
        if isinstance(result, dict) and "candidate_id" in result:
            try:
                from ats_core.db.store_sync import sync_candidate_by_id_from_db
                sync_candidate_by_id_from_db(result["candidate_id"])
            except Exception as e:
                logger.debug("Could not sync candidate after Celery task completion: %s", e)
    elif state == "FAILURE":
        response["error"] = "Resume processing failed."

    return response


class LocateCitationRequest(BaseModel):
    search_phrase: str = Field(min_length=1, max_length=2000)
    filename: Optional[str] = None


def _get_staged_resume_path(candidate_id: str):
    if candidate_id not in CANDIDATES_STORE:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Candidate not found.")
    try:
        path = resume_path(candidate_id)
        resolved = path.resolve(strict=True)
        if resolved.parent != UPLOAD_STAGING_DIR.resolve() or not resolved.is_file():
            raise ValueError("Invalid resume path")
        return resolved
    except (ValueError, OSError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Original PDF resume not found.") from None


@router.post(
    "/{candidate_id}/locate-citation",
    summary="Ground citation snippet to PDF page and bounding box coordinates"
)
async def locate_candidate_citation(
    candidate_id: str,
    request: LocateCitationRequest,
):
    path = await run_in_threadpool(_get_staged_resume_path, candidate_id)

    def locate():
        from ats_core.parsers.pdf_parser import HybridPDFParser
        parser = HybridPDFParser()
        return parser.locate_citation_in_pdf(path.read_bytes(), request.search_phrase)

    location = await run_in_threadpool(locate)

    return {
        "found": location is not None,
        "candidate_id": candidate_id,
        "search_phrase": request.search_phrase,
        "location": location,
    }


@router.get(
    "/{candidate_id}/resume-pdf",
    summary="Serve the actual uploaded PDF resume document"
)
async def get_candidate_resume_pdf(request: Request, candidate_id: str):
    from fastapi.responses import FileResponse
    user = get_current_user(request)
    check_and_audit_pii_access(request, user, "DOWNLOAD_RESUME_PDF", "candidate_resume_pdf", candidate_id)

    path = await run_in_threadpool(_get_staged_resume_path, candidate_id)
    return FileResponse(
        path=str(path), media_type="application/pdf",
        filename=CANDIDATES_STORE[candidate_id].get("resume_filename", "resume.pdf"),
    )
