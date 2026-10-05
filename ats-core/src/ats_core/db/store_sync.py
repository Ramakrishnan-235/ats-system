"""Two-way synchronization between in-memory stores and PostgreSQL.

Ensures that:
- Background worker writes to PostgreSQL are read by API worker processes.
- API candidate/job/application mutations persist to PostgreSQL.
- Server restarts reload state from PostgreSQL.
- candidates_count is derived accurately from actual candidate lists, eliminating race conditions.
- Offline/mock test environments gracefully fallback to in-memory stores without error.
"""

import os
import time
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from contextlib import contextmanager

from ats_core.models.id_utils import coerce_to_uuid, optional_coerce_to_uuid

logger = logging.getLogger("ats.db.sync")

_DB_LAST_FAILURE: float = 0.0
_DB_FAILURE_COOLDOWN: float = 10.0  # seconds to back off after DB connection failure


def is_db_available() -> bool:
    global _DB_LAST_FAILURE
    if os.getenv("ATS_DB_SYNC_ENABLED", "true").lower() in ("false", "0", "no"):
        return False
    if time.time() - _DB_LAST_FAILURE < _DB_FAILURE_COOLDOWN:
        return False
    return True


def mark_db_failed():
    global _DB_LAST_FAILURE
    _DB_LAST_FAILURE = time.time()


@contextmanager
def get_sync_session():
    if not is_db_available():
        yield None
        return

    try:
        from ats_core.workers.tasks import get_session_factory
        session_factory = get_session_factory()
        session = session_factory()
    except Exception as e:
        mark_db_failed()
        logger.debug("Database session creation failed: %s", e)
        yield None
        return

    try:
        yield session
    except Exception as e:
        mark_db_failed()
        logger.debug("Database operation failed: %s", e)
        session.rollback()
        raise
    finally:
        try:
            session.close()
        except Exception:
            pass


def _candidate_row_to_dict(db_c, original_id: Optional[str] = None) -> Dict[str, Any]:
    prof = db_c.structured_profile or {}
    cid = original_id or prof.get("candidate_id") or prof.get("id") or f"cand-{db_c.id.hex}"
    
    scorecard = prof.get("scorecard", {
        "overall_match_score": None,
        "match_tier": "Not Evaluated",
        "evaluation_status": "PENDING",
        "model_version": None,
        "categories": [],
        "risk_flags": [],
        "suggested_improvements": [],
        "suggested_questions": [],
    })

    return {
        "id": cid,
        "name": prof.get("name") or db_c.anonymized_name,
        "anonymized_name": db_c.anonymized_name,
        "target_headline": db_c.target_headline,
        "role": db_c.target_headline,
        "years_of_experience": float(db_c.years_of_experience or 0),
        "location": db_c.location or "Remote",
        "highest_education": db_c.highest_education or "N/A",
        "core_skills": db_c.core_skills or [],
        "skills": db_c.core_skills or [],
        "raw_anonymized_text": db_c.raw_anonymized_text or "",
        "raw_text": db_c.raw_anonymized_text or "",
        "structured_profile": prof,
        "experience": prof.get("experience", []),
        "scorecard": scorecard,
        "avatar": prof.get("avatar", "CD"),
        "isImageAvatar": prof.get("isImageAvatar", False),
        "stage": prof.get("stage", "Screening"),
        "status": prof.get("status", "Screening"),
        "applied_date": prof.get("applied_date", "Recently"),
        "applied_for_job": prof.get("applied_for_job", "Software Engineer (Engineering)"),
        "applied_for_job_id": prof.get("applied_for_job_id"),
        "email": prof.get("email", "N/A"),
        "phone": prof.get("phone", "N/A"),
        "linkedin": prof.get("linkedin", "N/A"),
        "created_at": db_c.created_at.isoformat() if getattr(db_c, "created_at", None) else datetime.now(timezone.utc).isoformat(),
    }


def sync_candidates_from_db() -> int:
    """Load/merge candidates from PostgreSQL candidates table into CANDIDATES_STORE."""
    with get_sync_session() as session:
        if not session:
            return 0
        try:
            from ats_core.models.db import Candidate
            from ats_core.api.v1.candidates import CANDIDATES_STORE

            db_candidates = session.query(Candidate).all()
            for db_c in db_candidates:
                cid = f"cand-{db_c.id.hex}"
                cand_dict = _candidate_row_to_dict(db_c, original_id=cid)
                if cid not in CANDIDATES_STORE:
                    CANDIDATES_STORE[cid] = cand_dict
                # Also index by UUID string
                str_id = str(db_c.id)
                if str_id not in CANDIDATES_STORE:
                    CANDIDATES_STORE[str_id] = cand_dict
            return len(db_candidates)
        except Exception as e:
            mark_db_failed()
            logger.debug("Database candidates fetch skipped or unavailable: %s", e)
            return 0


def sync_candidate_by_id_from_db(candidate_id: str) -> Optional[Dict[str, Any]]:
    """Look up a candidate from PostgreSQL by ID and populate CANDIDATES_STORE."""
    with get_sync_session() as session:
        if not session:
            return None
        try:
            from ats_core.models.db import Candidate
            from ats_core.api.v1.candidates import CANDIDATES_STORE

            cand_uuid = coerce_to_uuid(candidate_id)
            db_c = session.query(Candidate).filter(Candidate.id == cand_uuid).first()
            if db_c:
                cand_dict = _candidate_row_to_dict(db_c, original_id=candidate_id)
                CANDIDATES_STORE[candidate_id] = cand_dict
                CANDIDATES_STORE[str(db_c.id)] = cand_dict
                return cand_dict
        except Exception as e:
            mark_db_failed()
            logger.debug("Database candidate lookup skipped for %s: %s", candidate_id, e)
    return None


def sync_candidate_to_db(cand_dict: Dict[str, Any]) -> bool:
    """Upsert a candidate dictionary into PostgreSQL candidates table."""
    with get_sync_session() as session:
        if not session:
            return False
        try:
            from ats_core.models.db import Candidate

            cid = cand_dict.get("id")
            if not cid:
                return False
            cand_uuid = coerce_to_uuid(cid)

            db_c = session.query(Candidate).filter(Candidate.id == cand_uuid).first()
            if not db_c:
                db_c = Candidate(id=cand_uuid)
                session.add(db_c)

            db_c.anonymized_name = cand_dict.get("anonymized_name") or f"Candidate #{str(cid)[-8:]}"
            db_c.target_headline = cand_dict.get("target_headline") or cand_dict.get("role") or "Software Engineer"
            db_c.years_of_experience = float(cand_dict.get("years_of_experience") or 0.0)
            db_c.location = cand_dict.get("location") or "Remote"
            db_c.highest_education = cand_dict.get("highest_education")
            db_c.core_skills = cand_dict.get("core_skills") or cand_dict.get("skills") or []
            db_c.raw_anonymized_text = cand_dict.get("raw_anonymized_text") or cand_dict.get("raw_text") or ""
            db_c.structured_profile = {**cand_dict, "candidate_id": cid}

            session.commit()
            return True
        except Exception as e:
            mark_db_failed()
            logger.debug("Candidate DB write skipped for %s: %s", cand_dict.get("id"), e)
            return False


def sync_jobs_from_db() -> int:
    """Load/merge jobs from PostgreSQL job_postings table into JOBS_STORE."""
    with get_sync_session() as session:
        if not session:
            return 0
        try:
            from ats_core.models.db import JobPosting, Application
            from sqlalchemy import func
            from ats_core.api.v1.jobs import JOBS_STORE, JOB_CANDIDATES_STORE

            db_jobs = session.query(JobPosting).all()
            if not db_jobs:
                # Seed database from JOBS_STORE if PostgreSQL job_postings table is currently empty
                for jid, jdata in list(JOBS_STORE.items()):
                    sync_job_to_db(jdata)
                return len(JOBS_STORE)

            for db_j in db_jobs:
                criteria = db_j.structured_criteria or {}
                original_jid = criteria.get("job_id") or f"job-{db_j.id.hex[:8]}"

                # Prefer existing key if already known
                target_id = original_jid
                for mem_id, mem_j in JOBS_STORE.items():
                    if mem_j.get("title", "").strip().lower() == db_j.title.strip().lower():
                        target_id = mem_id
                        break

                db_app_count = session.query(func.count(Application.id)).filter(Application.job_id == db_j.id).scalar() or 0
                cand_count = max(len(JOB_CANDIDATES_STORE.get(target_id, [])), db_app_count)
                top_match = criteria.get("top_match", {
                    "score": None,
                    "label": "No Candidates",
                    "last_run": "Never",
                    "status": "ACTIVE",
                })

                JOBS_STORE[target_id] = {
                    "id": target_id,
                    "title": db_j.title,
                    "department": db_j.department or "Engineering",
                    "location": db_j.location or "Remote",
                    "status": db_j.status or "OPEN",
                    "posted_date": db_j.created_at.strftime("%Y-%m-%d") if getattr(db_j, "created_at", None) else "2026-02-10",
                    "candidates_count": cand_count,
                    "avatars": [],
                    "top_match": top_match,
                    "icon_type": criteria.get("icon_type", "tech"),
                    "job_description": db_j.job_description or "",
                    "min_years_experience": float(db_j.min_years_experience or 0),
                    "required_skills": db_j.required_skills or [],
                    "structured_criteria": criteria,
                    "created_at": db_j.created_at.isoformat() if getattr(db_j, "created_at", None) else "2026-02-10T09:00:00Z",
                    "updated_at": db_j.updated_at.isoformat() if getattr(db_j, "updated_at", None) else "2026-02-10T09:00:00Z",
                }
            return len(db_jobs)
        except Exception as e:
            mark_db_failed()
            logger.debug("Jobs DB sync skipped: %s", e)
            return 0


def sync_job_by_id_from_db(job_id: str) -> Optional[Dict[str, Any]]:
    """Look up a job from PostgreSQL by ID and populate JOBS_STORE."""
    with get_sync_session() as session:
        if not session:
            return None
        try:
            from ats_core.models.db import JobPosting, Application
            from sqlalchemy import func
            from ats_core.api.v1.jobs import JOBS_STORE, JOB_CANDIDATES_STORE

            job_uuid = coerce_to_uuid(job_id)
            db_j = session.query(JobPosting).filter(JobPosting.id == job_uuid).first()
            if db_j:
                db_app_count = session.query(func.count(Application.id)).filter(Application.job_id == db_j.id).scalar() or 0
                cand_count = max(len(JOB_CANDIDATES_STORE.get(job_id, [])), db_app_count)
                criteria = db_j.structured_criteria or {}
                job_dict = {
                    "id": job_id,
                    "title": db_j.title,
                    "department": db_j.department or "Engineering",
                    "location": db_j.location or "Remote",
                    "status": db_j.status or "OPEN",
                    "posted_date": db_j.created_at.strftime("%Y-%m-%d") if getattr(db_j, "created_at", None) else "2026-02-10",
                    "candidates_count": cand_count,
                    "avatars": [],
                    "top_match": criteria.get("top_match", {
                        "score": None,
                        "label": "No Candidates",
                        "last_run": "Never",
                        "status": "ACTIVE",
                    }),
                    "icon_type": criteria.get("icon_type", "tech"),
                    "job_description": db_j.job_description or "",
                    "min_years_experience": float(db_j.min_years_experience or 0),
                    "required_skills": db_j.required_skills or [],
                    "structured_criteria": criteria,
                    "created_at": db_j.created_at.isoformat() if getattr(db_j, "created_at", None) else "2026-02-10T09:00:00Z",
                    "updated_at": db_j.updated_at.isoformat() if getattr(db_j, "updated_at", None) else "2026-02-10T09:00:00Z",
                }
                JOBS_STORE[job_id] = job_dict
                return job_dict
        except Exception as e:
            mark_db_failed()
            logger.debug("Job DB lookup skipped for %s: %s", job_id, e)
    return None


def sync_job_to_db(job_dict: Dict[str, Any]) -> bool:
    """Upsert a job requisition dictionary into PostgreSQL job_postings table."""
    with get_sync_session() as session:
        if not session:
            return False
        try:
            from ats_core.models.db import JobPosting

            jid = job_dict.get("id")
            if not jid:
                return False
            job_uuid = coerce_to_uuid(jid)

            db_j = session.query(JobPosting).filter(JobPosting.id == job_uuid).first()
            if not db_j:
                db_j = JobPosting(id=job_uuid)
                session.add(db_j)

            db_j.title = job_dict.get("title", "Untitled Job")
            db_j.department = job_dict.get("department", "Engineering")
            db_j.location = job_dict.get("location", "Remote")
            db_j.job_description = job_dict.get("job_description", "")
            db_j.min_years_experience = float(job_dict.get("min_years_experience") or 0.0)
            db_j.required_skills = job_dict.get("required_skills") or []
            db_j.status = job_dict.get("status", "OPEN")
            db_j.structured_criteria = {
                "job_id": jid,
                "top_match": job_dict.get("top_match", {}),
                "icon_type": job_dict.get("icon_type", "tech"),
                **(job_dict.get("structured_criteria") or {}),
            }
            session.commit()
            return True
        except Exception as e:
            mark_db_failed()
            logger.debug("Job DB write skipped for %s: %s", job_dict.get("id"), e)
            return False


def sync_applications_for_job_from_db(job_id: str) -> int:
    """Synchronize job applications from PostgreSQL into JOB_CANDIDATES_STORE."""
    with get_sync_session() as session:
        if not session:
            return 0
        try:
            from ats_core.models.db import Application, Candidate
            from ats_core.api.v1.jobs import JOB_CANDIDATES_STORE, JOBS_STORE
            from ats_core.api.v1.candidates import CANDIDATES_STORE

            job_uuid = coerce_to_uuid(job_id)
            apps = session.query(Application).filter(Application.job_id == job_uuid).all()
            if not apps:
                return 0

            current_list = JOB_CANDIDATES_STORE.get(job_id, [])
            current_ids = {c["id"] for c in current_list if isinstance(c, dict) and "id" in c}

            for app in apps:
                cand_key = f"cand-{app.candidate_id.hex}"
                if cand_key in current_ids or str(app.candidate_id) in current_ids:
                    continue

                db_c = session.query(Candidate).filter(Candidate.id == app.candidate_id).first()
                if db_c:
                    c_dict = _candidate_row_to_dict(db_c, original_id=cand_key)
                    CANDIDATES_STORE[cand_key] = c_dict

                    job_cand = {
                        "id": cand_key,
                        "name": c_dict.get("name", "Candidate"),
                        "headline": c_dict.get("target_headline", "Software Engineer"),
                        "avatar": c_dict.get("avatar", "CD"),
                        "isImageAvatar": False,
                        "skills": c_dict.get("core_skills", []),
                        "stage": app.stage or "Screening",
                        "stageBadgeStyle": "bg-zinc-100 text-zinc-700",
                        "matchScore": int(round(app.current_match_score)) if app.current_match_score is not None else None,
                        "matchLabel": "Evaluated" if app.current_match_score is not None else "Not Evaluated",
                        "sourceResumeLink": f"/candidates/{cand_key}",
                        "rank": len(current_list) + 1,
                    }
                    current_list.append(job_cand)
                    current_ids.add(cand_key)

            JOB_CANDIDATES_STORE[job_id] = current_list
            if job_id in JOBS_STORE:
                JOBS_STORE[job_id]["candidates_count"] = len(current_list)
            return len(apps)
        except Exception as e:
            mark_db_failed()
            logger.debug("Applications DB sync skipped for %s: %s", job_id, e)
            return 0


def sync_application_to_db(job_id: str, candidate_obj: Dict[str, Any]) -> bool:
    """Upsert an application linking a candidate to a job requisition in PostgreSQL."""
    with get_sync_session() as session:
        if not session:
            return False
        try:
            from ats_core.models.db import Application

            cid = candidate_obj.get("id")
            if not cid or not job_id:
                return False
            cand_uuid = coerce_to_uuid(cid)
            job_uuid = coerce_to_uuid(job_id)

            app = session.query(Application).filter(
                Application.candidate_id == cand_uuid,
                Application.job_id == job_uuid,
            ).first()
            if not app:
                app = Application(candidate_id=cand_uuid, job_id=job_uuid)
                session.add(app)

            app.stage = candidate_obj.get("stage", "Screening")
            app.status = "APPLIED"
            score = candidate_obj.get("matchScore")
            if score is not None:
                app.current_match_score = float(score)

            session.commit()
            return True
        except Exception as e:
            mark_db_failed()
            logger.debug("Application DB write skipped for %s -> %s: %s", candidate_obj.get("id"), job_id, e)
            return False


def delete_application_from_db(job_id: str, candidate_id: str) -> bool:
    """Remove an application linking candidate to job from PostgreSQL."""
    with get_sync_session() as session:
        if not session:
            return False
        try:
            from ats_core.models.db import Application

            cand_uuid = coerce_to_uuid(candidate_id)
            job_uuid = coerce_to_uuid(job_id)

            app = session.query(Application).filter(
                Application.candidate_id == cand_uuid,
                Application.job_id == job_uuid,
            ).first()
            if app:
                session.delete(app)
                session.commit()
                return True
        except Exception as e:
            mark_db_failed()
            logger.debug("Application DB delete skipped for %s -> %s: %s", candidate_id, job_id, e)
    return False


def sync_task_status_from_db(task_id: str) -> Optional[Dict[str, Any]]:
    """Look up an upload task state from PostgreSQL structured profiles across worker processes."""
    with get_sync_session() as session:
        if not session:
            return None
        try:
            from ats_core.models.db import Candidate
            from ats_core.api.v1.candidates import UPLOAD_TASKS_STORE

            db_candidates = session.query(Candidate).all()
            for db_c in db_candidates:
                prof = db_c.structured_profile or {}
                if prof.get("upload_task_id") == task_id:
                    cid = f"cand-{db_c.id.hex}"
                    sc = prof.get("scorecard", {})
                    task_data = {
                        "task_id": task_id,
                        "state": "SUCCESS",
                        "execution_mode": "inline",
                        "result": {
                            "status": "COMPLETED",
                            "candidate_id": cid,
                            "match_score": sc.get("overall_match_score"),
                            "evaluation_status": sc.get("evaluation_status", "PENDING"),
                        }
                    }
                    UPLOAD_TASKS_STORE[task_id] = task_data
                    return task_data
        except Exception as e:
            mark_db_failed()
            logger.debug("Task DB lookup skipped for %s: %s", task_id, e)
    return None


def sync_all_from_db() -> Dict[str, int]:
    """Execute full startup/recovery synchronization from PostgreSQL into all in-memory caches."""
    if not is_db_available():
        return {"candidates": 0, "jobs": 0, "applications": 0}
    c_count = sync_candidates_from_db()
    if not is_db_available():
        return {"candidates": c_count, "jobs": 0, "applications": 0}
    j_count = sync_jobs_from_db()
    if not is_db_available():
        return {"candidates": c_count, "jobs": j_count, "applications": 0}
    app_count = 0
    try:
        from ats_core.api.v1.jobs import JOBS_STORE
        for jid in list(JOBS_STORE.keys()):
            if not is_db_available():
                break
            app_count += sync_applications_for_job_from_db(jid)
    except Exception:
        pass
    return {"candidates": c_count, "jobs": j_count, "applications": app_count}
