import logging
import os
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Dict, Any

from celery import Task
from celery.exceptions import SoftTimeLimitExceeded
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from ats_core.workers.celery_app import celery_app
from ats_core.models.db import Candidate
from ats_core.models.id_utils import coerce_to_uuid
from ats_core.api.upload_storage import UPLOAD_STAGING_DIR, MAX_UPLOAD_BYTES

logger = logging.getLogger("ats.workers.tasks")

# Synchronous DB engine for Celery worker processes
SYNC_DATABASE_URL = os.getenv(
    "SYNC_DATABASE_URL", 
    "postgresql://ats_user:ats_password@localhost:5433/ats_db"
)

@lru_cache(maxsize=1)
def get_session_factory():
    # Create pooled connections in a worker child, never in the prefork parent.
    engine = create_engine(SYNC_DATABASE_URL, pool_pre_ping=True)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


@lru_cache(maxsize=1)
def get_processing_components():
    # Heavy models load only when a task runs, not when Celery discovers tasks.
    from ats_core.parsers.pdf_parser import HybridPDFParser
    from ats_core.parsers.anonymizer import ResumeAnonymizer
    from ats_core.parsers.ollama_extractor import OllamaCandidateExtractor
    from ats_core.search.pgvector_store import PgVectorStore

    return (
        HybridPDFParser(), ResumeAnonymizer(min_score_threshold=0.55),
        OllamaCandidateExtractor(temperature=0.0), PgVectorStore(),
    )


def _validated_staged_path(file_path: str) -> Path:
    path = Path(file_path).resolve(strict=True)
    if path.parent != UPLOAD_STAGING_DIR.resolve() or path.suffix.lower() != ".pdf" or not path.is_file():
        raise ValueError("Resume must be a PDF in the configured upload staging directory")
    return path


class BaseTaskWithRetry(Task):
    """Base task class with automatic exponential backoff retry configuration."""
    autoretry_for = (Exception,)
    dont_autoretry_for = (ValueError, FileNotFoundError)
    retry_kwargs = {"max_retries": 5}
    retry_backoff = True           # Exponential backoff (1s, 2s, 4s, 8s, 16s...)
    retry_backoff_max = 300        # Max backoff delay capped at 5 minutes
    retry_jitter = True            # Adds random jitter: delay * random(0.5, 1.5)

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        # Preserve files during retries, but remove them after terminal failure.
        file_path = kwargs.get("file_path") or (args[0] if args else None)
        if file_path:
            try:
                _validated_staged_path(file_path).unlink(missing_ok=True)
            except (OSError, ValueError):
                logger.warning("Could not clean up staged resume for failed task %s", task_id)
        super().on_failure(exc, task_id, args, kwargs, einfo)


def _execute_resume_processing(
    task_instance: Task,
    file_path: str,
    candidate_id: str,
    original_filename: str = "resume.pdf"
) -> Dict[str, Any]:
    """
    Core resume processing pipeline:
    Parses PDF layout, masks PII, extracts structured profile,
    and updates PostgreSQL and vector embeddings.
    """
    # Reject permanent input errors before loading models or scheduling retries.
    cand_uuid = coerce_to_uuid(candidate_id)
    file_p = _validated_staged_path(file_path)
    logger.info(f"[{task_instance.request.id}] Starting PDF resume processing for candidate {candidate_id}")
    
    # Step 1: Read File Buffer
    task_instance.update_state(state="PROGRESS", meta={"step": "READING_FILE", "progress": 10})
    try:
        with open(file_p, "rb") as f:
            file_bytes = f.read(MAX_UPLOAD_BYTES + 1)
        if len(file_bytes) > MAX_UPLOAD_BYTES or not file_bytes.startswith(b"%PDF-"):
            raise ValueError("Invalid or oversized staged PDF")
        pdf_parser, anonymizer, extractor, vector_store = get_processing_components()

        # Step 2: PDF Layout Extraction
        task_instance.update_state(state="PROGRESS", meta={"step": "PARSING_PDF_LAYOUT", "progress": 30, "format": "pdf"})
        extracted_text, engine_used = pdf_parser.parse_pdf(file_bytes, filename=original_filename)

        # Step 3: Microsoft Presidio PII Masking
        task_instance.update_state(state="PROGRESS", meta={"step": "SCRUBBING_PII", "progress": 50, "engine": engine_used})
        sanitized_text = anonymizer.anonymize(extracted_text)

        # Step 4: Ollama Local LLM Structured Extraction
        task_instance.update_state(state="PROGRESS", meta={"step": "LLM_EXTRACTION", "progress": 70})
        profile = extractor.extract_profile(sanitized_text)

        # Step 5: Save Profile & Vector to PostgreSQL
        task_instance.update_state(state="PROGRESS", meta={"step": "DATABASE_PERSISTENCE", "progress": 90})
        
        # Embedding summary text
        embedding_summary = f"{profile.target_role_or_headline}. {profile.executive_summary}"
        vector = vector_store.generate_embedding(embedding_summary)

        # Transactional DB persistence with strict error propagation (no silent data loss)
        with get_session_factory()() as session:
            try:
                # Upsert Candidate Record
                candidate_record = session.query(Candidate).filter(Candidate.id == cand_uuid).first()
                if not candidate_record:
                    candidate_record = Candidate(id=cand_uuid)
                    session.add(candidate_record)

                candidate_record.anonymized_name = profile.anonymized_name
                candidate_record.target_headline = profile.target_role_or_headline
                candidate_record.years_of_experience = profile.timeline.total_continuous_years
                candidate_record.highest_education = (
                    profile.education[0].degree if profile.education else "Not Specified"
                )
                candidate_record.core_skills = profile.skills.core_languages + profile.skills.frameworks_and_tools
                candidate_record.raw_anonymized_text = sanitized_text
                candidate_record.structured_profile = profile.model_dump(mode="json")
                candidate_record.parsing_engine = engine_used
                candidate_record.embedding = vector
                
                session.commit()
            except Exception as db_err:
                session.rollback()
                logger.error(f"Database update failed in worker for candidate {candidate_id}: {db_err}")
                raise RuntimeError(f"Database persistence failed: {db_err}") from db_err

        # Cleanup staged temporary upload file ONLY on successful DB commit
        if file_p.exists():
            try:
                os.remove(file_p)
            except OSError as cleanup_err:
                logger.warning(f"Failed to remove temp file {file_p}: {cleanup_err}")

        logger.info(f"[{task_instance.request.id}] Successfully processed candidate {candidate_id}")
        return {
            "status": "COMPLETED",
            "candidate_id": candidate_id,
            "headline": profile.target_role_or_headline,
            "years_of_experience": profile.timeline.total_continuous_years,
            "skills_count": len(profile.skills.detailed_skills),
            "parsing_engine": engine_used
        }

    except SoftTimeLimitExceeded:
        logger.error(f"Task {task_instance.request.id} timed out during execution.")
        raise
    except Exception as exc:
        retries_count = getattr(task_instance.request, "retries", 0)
        max_retries = getattr(task_instance, "max_retries", 5)
        logger.warning(
            f"Error processing candidate {candidate_id}: {exc}. "
            f"Retrying (Attempt {retries_count + 1}/{max_retries})..."
        )
        # Celery autoretry_for catches this and executes backoff delay
        raise


@celery_app.task(
    bind=True,
    base=BaseTaskWithRetry,
    name="ats.tasks.process_resume"
)
def process_resume_task(
    self,
    file_path: str,
    candidate_id: str,
    original_filename: str = "resume.pdf"
) -> Dict[str, Any]:
    return _execute_resume_processing(self, file_path, candidate_id, original_filename)


@celery_app.task(
    bind=True,
    base=BaseTaskWithRetry,
    name="ats.tasks.process_resume_pdf"
)
def process_resume_pdf_task(
    self,
    file_path: str,
    candidate_id: str,
    original_filename: str = "resume.pdf"
) -> Dict[str, Any]:
    return _execute_resume_processing(self, file_path, candidate_id, original_filename)
