import asyncio
import logging
import os
import uuid
from pathlib import Path
from typing import Dict, Any

from celery import Task
from celery.exceptions import SoftTimeLimitExceeded
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from ats_core.workers.celery_app import celery_app
from ats_core.parsers.pdf_parser import HybridPDFParser
from ats_core.parsers.anonymizer import ResumeAnonymizer
from ats_core.parsers.ollama_extractor import OllamaCandidateExtractor
from ats_core.models.db import Candidate
from ats_core.search.pgvector_store import PgVectorStore

logger = logging.getLogger("ats.workers.tasks")

# Synchronous DB engine for Celery worker processes
SYNC_DATABASE_URL = os.getenv(
    "SYNC_DATABASE_URL", 
    "postgresql://ats_user:ats_password@localhost:5432/ats_db"
)
engine = create_engine(SYNC_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Module-level singletons (initialized once per worker process)
pdf_parser = HybridPDFParser()
anonymizer = ResumeAnonymizer(min_score_threshold=0.55)
extractor = OllamaCandidateExtractor(
    base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
    model_name=os.getenv("OLLAMA_MODEL", "gemma4:e2b"),
    temperature=0.0
)
vector_store = PgVectorStore()


class BaseTaskWithRetry(Task):
    """Base task class with automatic exponential backoff retry configuration."""
    autoretry_for = (Exception,)
    retry_kwargs = {"max_retries": 5}
    retry_backoff = True           # Exponential backoff (1s, 2s, 4s, 8s, 16s...)
    retry_backoff_max = 300        # Max backoff delay capped at 5 minutes
    retry_jitter = True            # Adds random jitter: delay * random(0.5, 1.5)


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
    """
    Asynchronously parses a PDF resume, masks PII, extracts structured profile,
    and updates PostgreSQL and vector embeddings.
    """
    logger.info(f"[{self.request.id}] Starting resume processing for candidate {candidate_id}")
    
    # Step 1: Read PDF Buffer
    self.update_state(state="PROGRESS", meta={"step": "READING_FILE", "progress": 10})
    file_p = Path(file_path)
    if not file_p.exists():
        raise FileNotFoundError(f"Staged resume file not found at: {file_path}")

    try:
        with open(file_p, "rb") as f:
            pdf_bytes = f.read()

        # Step 2: Hybrid PDF Layout Extraction (PyMuPDF / Docling)
        self.update_state(state="PROGRESS", meta={"step": "PARSING_LAYOUT", "progress": 30})
        extracted_text, engine_used = pdf_parser.parse_pdf(pdf_bytes, filename=original_filename)

        # Step 3: Microsoft Presidio PII Masking
        self.update_state(state="PROGRESS", meta={"step": "SCRUBBING_PII", "progress": 50})
        sanitized_text = anonymizer.anonymize(extracted_text)

        # Step 4: Ollama Local LLM Structured Extraction
        self.update_state(state="PROGRESS", meta={"step": "LLM_EXTRACTION", "progress": 70})
        profile = extractor.extract_profile(sanitized_text)

        # Step 5: Save Profile & Vector to PostgreSQL
        self.update_state(state="PROGRESS", meta={"step": "DATABASE_PERSISTENCE", "progress": 90})
        
        # Embedding summary text
        embedding_summary = f"{profile.target_role_or_headline}. {profile.executive_summary}"
        vector = vector_store.generate_embedding(embedding_summary)

        try:
            with SessionLocal() as session:
                cand_uuid = uuid.UUID(candidate_id) if candidate_id else uuid.uuid4()
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
                candidate_record.structured_profile = profile.model_dump()
                candidate_record.parsing_engine = engine_used
                candidate_record.embedding = vector
                
                session.commit()
        except Exception as db_err:
            logger.warning(f"Database update skipped or failed in worker: {db_err}")

        # Cleanup staged temporary upload file
        if file_p.exists():
            try:
                os.remove(file_p)
            except OSError:
                pass

        logger.info(f"[{self.request.id}] Successfully processed candidate {candidate_id}")
        return {
            "status": "COMPLETED",
            "candidate_id": candidate_id,
            "headline": profile.target_role_or_headline,
            "years_of_experience": profile.timeline.total_continuous_years,
            "skills_count": len(profile.skills.detailed_skills),
            "parsing_engine": engine_used
        }

    except SoftTimeLimitExceeded:
        logger.error(f"Task {self.request.id} timed out during execution.")
        raise
    except Exception as exc:
        logger.warning(
            f"Error processing candidate {candidate_id}: {exc}. "
            f"Retrying (Attempt {self.request.retries + 1}/{self.max_retries})..."
        )
        # Celery autoretry_for catches this and executes backoff delay
        raise exc
