"""Pure AI jobs. Business rows are read/applied exclusively through the Rust core."""

import hashlib
import logging
import os
import re
import threading
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any
from uuid import UUID

import httpx
from celery import Celery
from dotenv import load_dotenv

from ats_core.ai_api.contracts import AIResult
from ats_core.evidence import strip_privacy_markers

load_dotenv(Path(__file__).resolve().parents[3] / ".env", override=False)
logger = logging.getLogger(__name__)
celery_app = Celery("ats_private_ai", broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"))
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    task_ignore_result=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_soft_time_limit=540,
    task_time_limit=600,
    broker_transport_options={"visibility_timeout": 900},
)


@lru_cache(maxsize=1)
def anonymizer():
    from ats_core.parsers.anonymizer import ResumeAnonymizer

    return ResumeAnonymizer(min_score_threshold=0.55)


def sanitize_fields(value: Any, contact: dict):
    if isinstance(value, str):
        return anonymizer().scrub_residual_pii(
            value,
            name=contact.get("name"),
            email=contact.get("email"),
            phone=contact.get("phone"),
            location=contact.get("location"),
            urls=[contact.get("linkedin", "")],
        )
    if isinstance(value, list):
        return [sanitize_fields(item, contact) for item in value]
    if isinstance(value, dict):
        return {k: sanitize_fields(v, contact) for k, v in value.items()}
    return value


def scoring_dossier(text: str, profile: dict) -> str:
    """Give the scorer technical evidence without service-generated PII markers."""
    clean = strip_privacy_markers(text)
    clean = "\n".join(line for line in clean.splitlines() if re.search(r"\w", line))
    # The parser's extracted skills retain evidence that PII recognition may mask
    # in prose (for example a tool incorrectly recognized as a person's name).
    skills = profile.get("core_skills", [])
    skills = [skill for skill in skills if isinstance(skill, str) and skill.strip()]
    if skills:
        clean += "\nSkills extracted from the resume: " + ", ".join(skills)
    return clean


def scoring_job_description(job: dict) -> str:
    """Include requirements saved separately from the free-form job description."""
    parts = [job["job_description"]]
    skills = job.get("required_skills", [])
    if skills:
        parts.append("Required skills: " + ", ".join(skills))
    minimum = job.get("min_years_experience")
    if minimum is not None:
        parts.append(f"Minimum relevant experience: {minimum} years")
    return "\n\n".join(parts)


def compute_result(payload: dict, document: bytes | None, on_progress=None) -> AIResult:
    """Reuse the existing parser/evaluator, while keeping contact data separate."""
    emit = on_progress or (lambda stage, status, detail=None: None)
    base = {
        k: payload.get(k)
        for k in ("attempt_id", "document_id", "document_version", "input_revision", "job_revision")
    }
    llm_enabled = os.getenv("ATS_AI_ENABLE_LLM", "true").lower() == "true"
    if payload["operation"] == "ingest":
        if not document or hashlib.sha256(document).hexdigest() != payload["source_hash"]:
            raise ValueError("DOCUMENT_HASH_MISMATCH")
        emit("document_verification", "COMPLETED")
        emit("pdf_parsing", "RUNNING")
        from ats_core.parsers.llm_embedding_resume_parser import (
            parse_resume_with_llm_and_embeddings as parse_resume_to_candidate,
        )

        profile = parse_resume_to_candidate(
            document,
            filename=payload["filename"],
            target_job=payload.get("job"),
            taxonomy_rows=payload["taxonomy"],
            allow_llm=llm_enabled,
            on_progress=emit,
        )
        raw_text = profile.pop("raw_text", "")
        extraction_warnings = profile.pop("extraction_warnings", [])
        if len(raw_text.strip()) < 10:
            raise ValueError("DOCUMENT_TEXT_EMPTY")
        emit("profile_sanitization", "RUNNING")
        contact = {
            k: profile.pop(k, "N/A") for k in ("name", "email", "phone", "linkedin", "location")
        }
        safe_text = anonymizer().anonymize(raw_text, known_entities=contact)
        profile.pop("scorecard", None)
        profile = sanitize_fields(profile, contact)
        profile["taxonomy_version"] = payload["taxonomy_version"]
        result = AIResult(
            **base,
            extraction_status="COMPLETED",
            evaluation_status="SKIPPED",
            profile=profile,
            contact=contact,
            sanitized_text=safe_text,
            warnings=extraction_warnings,
        )
        emit("profile_sanitization", "COMPLETED")
    else:
        result = AIResult(
            **base,
            extraction_status="SKIPPED",
            evaluation_status="PENDING",
            profile=payload["profile"],
            sanitized_text=payload["sanitized_text"],
        )
    if (
        payload["operation"] == "ingest"
        and os.getenv("ATS_AI_ENABLE_EMBEDDINGS", "true").lower() == "true"
    ):
        emit("document_embedding", "RUNNING")
        try:
            from ats_core.ai_api.app import embedder

            result.embedding = embedder().embed_documents([result.sanitized_text])[0]
            result.embedding_model = "google/embeddinggemma-2"
            result.preprocessing_version = "candidate-summary-v1"
            emit("document_embedding", "COMPLETED")
        except Exception:  # noqa: BLE001 -- optional model failure must not discard extracted facts
            result.warnings.append("EMBEDDING_UNAVAILABLE")
            emit("document_embedding", "FAILED", "MODEL_UNAVAILABLE")
    elif payload["operation"] == "ingest":
        emit("document_embedding", "SKIPPED", "EMBEDDINGS_DISABLED")
    if payload.get("job") and llm_enabled:
        emit("llm_evaluation", "RUNNING")
        try:
            from ats_core.ai_api.evaluation import VerifiedReport
            from ats_core.ai_api.evaluation import evaluator as get_evaluator

            evaluator = get_evaluator()
            evaluation = evaluator.evaluate(
                candidate_id=payload["candidate_id"],
                candidate_profile_text=scoring_dossier(result.sanitized_text, result.profile),
                citation_source_text=result.sanitized_text,
                job_title=payload["job"]["title"],
                job_description=scoring_job_description(payload["job"]),
            )
            if not evaluation.get("success") or not evaluation.get("report"):
                raise ValueError("EVALUATION_UNAVAILABLE")
            raw_rep = evaluation["report"]
            rep_dict = raw_rep.model_dump() if hasattr(raw_rep, "model_dump") else raw_rep
            report = VerifiedReport.model_validate(rep_dict)
            result.scorecard = {
                "overall_match_score": report.overall_match_score,
                "evaluation_status": "COMPLETED",
                "screening_decision": str(getattr(report.screening_decision, "value", report.screening_decision)),
                "decision_explanation": report.decision_explanation,
                "executive_verdict": report.executive_verdict,
                "match_tier": str(
                    getattr(report.qualification_tier, "value", report.qualification_tier)
                ),
                "model_version": evaluator.model_name,
                "evaluated_at": datetime.now(UTC).isoformat(),
                "categories": [
                    {
                        "name": str(getattr(c.category, "value", c.category)),
                        "score": c.score,
                        "max_score": 5,
                        "quote": getattr(c, "verbatim_citation", None),
                        "assessment": c.assessment,
                    }
                    for c in report.criteria_breakdown
                ],
                "risk_flags": [],
                "suggested_improvements": [],
                "suggested_questions": [],
                "team_notes": [],
            }
            result.evaluation_status = "COMPLETED"
            emit("llm_evaluation", "COMPLETED")
        except Exception:  # noqa: BLE001 -- keep manual recruiting available during model failures
            result.evaluation_status = "FAILED"
            result.warnings.append("EVALUATION_UNAVAILABLE")
            emit("llm_evaluation", "FAILED", "MODEL_UNAVAILABLE")
    elif payload["operation"] == "evaluate":
        result.evaluation_status = "FAILED"
        result.error_code = "EVALUATION_DISABLED"
        emit("llm_evaluation", "SKIPPED", "LLM_DISABLED")
    else:
        emit("llm_evaluation", "SKIPPED", "NO_JOB" if not payload.get("job") else "LLM_DISABLED")
    return AIResult.model_validate(result.model_dump())


def core_client() -> httpx.Client:
    key = os.getenv("ATS_SERVICE_KEY", "")
    if len(key) < 32:
        raise RuntimeError("ATS_SERVICE_KEY must contain at least 32 characters")
    return httpx.Client(
        base_url=os.getenv("ATS_CORE_URL", "http://127.0.0.1:8080"),
        headers={"x-service-key": key},
        timeout=30,
        follow_redirects=False,
    )


def run_job(job_id: str):
    UUID(job_id)  # reject malformed identities before any network operation
    with core_client() as client:
        leased = client.post(f"/internal/jobs/{job_id}/lease")
        if leased.status_code == 409:
            return {"status": "duplicate_or_terminal"}
        leased.raise_for_status()
        payload = leased.json()
        stop = threading.Event()
        lost_lease = threading.Event()
        current_stage = None

        def report_progress(stage, status="RUNNING", detail=None):
            nonlocal current_stage
            if status == "RUNNING":
                current_stage = stage
            elif current_stage == stage:
                current_stage = None
            try:
                with core_client() as progress_client:
                    response = progress_client.post(
                        f"/internal/jobs/{job_id}/progress",
                        json={"attempt_id": payload["attempt_id"], "stage": stage,
                              "status": status, "detail": detail}, timeout=3,
                    )
                    if response.status_code == 409:
                        lost_lease.set()
                    response.raise_for_status()
            except httpx.HTTPError:
                logger.warning("Operation progress unavailable for job %s", job_id)

        def renew():
            with core_client() as heartbeat_client:
                while not stop.wait(20):
                    try:
                        response = heartbeat_client.post(
                            f"/internal/jobs/{job_id}/heartbeat",
                            json={"attempt_id": payload["attempt_id"]},
                        )
                        if response.status_code == 409:
                            lost_lease.set()
                            return
                        response.raise_for_status()
                    except httpx.HTTPError:
                        logger.warning("Worker heartbeat unavailable for job %s", job_id)

        heartbeat = threading.Thread(target=renew, daemon=True)
        heartbeat.start()
        try:
            document = None
            if payload["operation"] == "ingest":
                report_progress("document_verification")
                response = client.get(
                    f"/internal/jobs/{job_id}/document",
                    params={"attempt_id": payload["attempt_id"]},
                )
                response.raise_for_status()
                document = response.content
            try:
                result = compute_result(payload, document, on_progress=report_progress)
            except Exception as exc:  # noqa: BLE001 -- task boundary returns safe errors without retaining resume text
                logger.exception("Task %s failed in compute_result: %s", job_id, exc)
                if current_stage:
                    report_progress(current_stage, "FAILED")
                # Never put exception strings, prompts or resume text into public errors.
                result = AIResult(
                    **{
                        k: payload.get(k)
                        for k in (
                            "attempt_id",
                            "document_id",
                            "document_version",
                            "input_revision",
                            "job_revision",
                        )
                    },
                    extraction_status="FAILED",
                    evaluation_status="FAILED",
                    error_code="PROCESSING_FAILED",
                )
            if lost_lease.is_set():
                return {"status": "lease_lost"}
            body = result.model_dump(mode="json")
            report_progress("saving_results")
            response = client.post(f"/internal/jobs/{job_id}/artifact", json=body)
            response.raise_for_status()
            for attempt in range(6):
                try:
                    response = client.post(f"/internal/jobs/{job_id}/result", json=body)
                    if response.status_code == 409:
                        return {"status": "stale_or_terminal"}
                    response.raise_for_status()
                    return response.json()
                except httpx.HTTPError:
                    if attempt == 5:
                        raise
                    stop.wait(min(2**attempt, 30))
        finally:
            stop.set()
            heartbeat.join(timeout=35)


@celery_app.task(
    name="ats.ai.process_job",
    autoretry_for=(httpx.HTTPError,),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=5,
)
def process_job(job_id: str):
    return run_job(job_id)
