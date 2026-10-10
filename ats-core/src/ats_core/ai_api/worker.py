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
    clean = re.sub(r"\[(?:CANDIDATE_NAME|EMAIL_ADDRESS|PHONE_NUMBER|LOCATION|REDACTED)\]", "", text)
    clean = "\n".join(line for line in clean.splitlines() if re.search(r"\w", line))
    # The parser's extracted skills retain evidence that PII recognition may mask
    # in prose (for example a tool incorrectly recognized as a person's name).
    skills = profile.get("core_skills", [])
    skills = [skill for skill in skills if isinstance(skill, str) and skill.strip()]
    if skills:
        clean += "\nSkills extracted from the resume: " + ", ".join(skills)
    return clean


def compute_result(payload: dict, document: bytes | None) -> AIResult:
    """Reuse the existing parser/evaluator, while keeping contact data separate."""
    base = {
        k: payload.get(k)
        for k in ("attempt_id", "document_id", "document_version", "input_revision", "job_revision")
    }
    llm_enabled = os.getenv("ATS_AI_ENABLE_LLM", "true").lower() == "true"
    if payload["operation"] == "ingest":
        if not document or hashlib.sha256(document).hexdigest() != payload["source_hash"]:
            raise ValueError("DOCUMENT_HASH_MISMATCH")
        from ats_core.parsers.resume_parser import parse_resume_to_candidate

        profile = parse_resume_to_candidate(
            document,
            filename=payload["filename"],
            target_job=payload.get("job"),
            taxonomy_rows=payload["taxonomy"],
            allow_llm=llm_enabled,
        )
        raw_text = profile.pop("raw_text", "")
        if len(raw_text.strip()) < 10:
            raise ValueError("DOCUMENT_TEXT_EMPTY")
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
        )
    else:
        result = AIResult(
            **base,
            extraction_status="SKIPPED",
            evaluation_status="PENDING",
            profile=payload["profile"],
            sanitized_text=payload["sanitized_text"],
        )
    if os.getenv("ATS_AI_ENABLE_EMBEDDINGS", "true").lower() == "true":
        try:
            from ats_core.ai_api.app import embedder

            result.embedding = embedder().embed_documents([result.sanitized_text])[0]
            result.embedding_model = "google/embeddinggemma-2"
            result.preprocessing_version = "candidate-summary-v1"
        except Exception:  # noqa: BLE001 -- optional model failure must not discard extracted facts
            result.warnings.append("EMBEDDING_UNAVAILABLE")
    if payload.get("job") and llm_enabled:
        try:
            from ats_core.ai_api.evaluation import VerifiedReport
            from ats_core.ai_api.evaluation import evaluator as get_evaluator

            evaluator = get_evaluator()
            evaluation = evaluator.evaluate(
                candidate_id=payload["candidate_id"],
                candidate_profile_text=scoring_dossier(result.sanitized_text, result.profile),
                citation_source_text=result.sanitized_text,
                job_title=payload["job"]["title"],
                job_description=payload["job"]["job_description"],
            )
            if not evaluation.get("success") or not evaluation.get("report"):
                raise ValueError("EVALUATION_UNAVAILABLE")
            report = VerifiedReport.model_validate(evaluation["report"].model_dump())
            result.scorecard = {
                "overall_match_score": report.overall_match_score,
                "evaluation_status": "COMPLETED",
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
                        "quote": c.verbatim_citation,
                        "assessment": c.assessment,
                    }
                    for c in report.criteria_breakdown
                ],
                "risk_flags": report.risks_and_skill_gaps,
                "suggested_improvements": report.suggested_improvements,
                "suggested_questions": [q.question for q in report.suggested_interview_questions],
                "team_notes": [],
            }
            result.evaluation_status = "COMPLETED"
        except Exception:  # noqa: BLE001 -- keep manual recruiting available during model failures
            result.evaluation_status = "FAILED"
            result.warnings.append("EVALUATION_UNAVAILABLE")
    elif payload["operation"] == "evaluate":
        result.evaluation_status = "FAILED"
        result.error_code = "EVALUATION_DISABLED"
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
                response = client.get(
                    f"/internal/jobs/{job_id}/document",
                    params={"attempt_id": payload["attempt_id"]},
                )
                response.raise_for_status()
                document = response.content
            try:
                result = compute_result(payload, document)
            except Exception:  # noqa: BLE001 -- task boundary returns safe errors without retaining resume text
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
