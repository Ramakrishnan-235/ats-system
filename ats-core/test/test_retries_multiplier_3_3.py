"""Tests for Finding 3.3: Retries multiplication and string overflow protection.

Verifies:
1. LLM client, extractor, and evaluator default to max_retries=1 instead of 3.
2. Celery tasks include deterministic errors (ValidationError, DataError, IntegrityError,
   ProgrammingError) in dont_autoretry_for and do not schedule retries.
3. String and numeric fields are truncated/bounded before DB persistence to prevent
   String(100)/String(255) and Numeric(4,1) DataErrors.
"""

import os
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from pydantic import BaseModel, ValidationError
from sqlalchemy.exc import DataError, IntegrityError, ProgrammingError

# Ensure src is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from ats_core.llm.client import get_openrouter_chat_model
from ats_core.parsers.ollama_extractor import OllamaCandidateExtractor
from ats_core.evaluator.deep_evaluator import LocalDeepEvaluator
from ats_core.workers import tasks
from ats_core.workers.tasks import BaseTaskWithRetry


def test_llm_client_defaults_max_retries_to_one(monkeypatch):
    monkeypatch.delenv("ATS_LLM_MAX_RETRIES", raising=False)
    model = get_openrouter_chat_model(api_key="test-key", model_name="test/model")
    assert model.max_retries == 1

    monkeypatch.setenv("ATS_LLM_MAX_RETRIES", "2")
    model_custom = get_openrouter_chat_model(api_key="test-key", model_name="test/model")
    assert model_custom.max_retries == 2


def test_parsers_and_evaluators_default_max_retries_to_one():
    extractor = OllamaCandidateExtractor(model_name="llama3")
    assert extractor.max_retries == 1

    evaluator = LocalDeepEvaluator(model_name="llama3")
    assert evaluator.max_retries == 1


def test_celery_task_dont_autoretry_for_contains_deterministic_errors():
    dont_retry = tasks.BaseTaskWithRetry.dont_autoretry_for
    expected_exceptions = {
        ValidationError,
        DataError,
        IntegrityError,
        ProgrammingError,
        ValueError,
        FileNotFoundError,
        TypeError,
        KeyError,
    }
    assert expected_exceptions.issubset(set(dont_retry))


def test_celery_task_retry_raises_directly_on_deterministic_errors():
    task = BaseTaskWithRetry()

    class DummyModel(BaseModel):
        name: str

    val_err = None
    try:
        DummyModel()
    except ValidationError as e:
        val_err = e

    assert val_err is not None
    # Deterministic ValidationError must be raised directly without calling Celery retry
    with pytest.raises(ValidationError):
        task.retry(exc=val_err)

    # Database DataError should also raise immediately without scheduling retry
    data_err = DataError("statement", {}, Exception("string data right truncation"))
    with pytest.raises(DataError):
        task.retry(exc=data_err)

    # Database IntegrityError should also raise immediately without scheduling retry
    integ_err = IntegrityError("statement", {}, Exception("unique constraint violation"))
    with pytest.raises(IntegrityError):
        task.retry(exc=integ_err)

    # Wrapped exception with cause in dont_autoretry_for should also raise immediately
    wrapped_err = RuntimeError("Pipeline failure")
    wrapped_err.__cause__ = val_err
    with pytest.raises(RuntimeError):
        task.retry(exc=wrapped_err)


def test_execute_resume_processing_truncates_long_strings_before_db(tmp_path, monkeypatch):
    monkeypatch.setattr(tasks, "UPLOAD_STAGING_DIR", tmp_path)
    path = tmp_path / "resume.pdf"
    path.write_bytes(b"%PDF-1.4 sample data")

    task = MagicMock()
    task.request.id = "task-truncation-test"
    task.request.retries = 0

    profile = MagicMock()
    # Provide oversized strings
    profile.anonymized_name = "Candidate Name " * 15  # ~225 chars (> 100)
    profile.target_role_or_headline = "Principal Distributed Systems Architect " * 10  # ~410 chars (> 255)
    profile.executive_summary = "Experienced architect..."
    profile.timeline.total_continuous_years = 999.5  # Exceeds Numeric(4, 1) limit of 99.9
    edu_mock = SimpleNamespace(degree="Master of Science in Distributed Cloud Computing and AI Systems", institution="University " * 15)
    profile.education = [edu_mock]
    profile.skills.core_languages = ["Go", "Python"]
    profile.skills.frameworks_and_tools = ["PostgreSQL"]
    profile.skills.detailed_skills = ["Go", "Python", "PostgreSQL"]
    profile.model_dump.return_value = {"extracted_at": datetime.now(UTC).isoformat()}

    parser, redactor, extractor, vectors = (MagicMock() for _ in range(4))
    parser.parse_pdf.return_value = ("Oversized candidate text", "ollama_hybrid_parser_name_that_is_very_long" * 3)
    redactor.anonymize.return_value = "Oversized candidate redacted text"
    extractor.extract_profile.return_value = profile
    vectors.generate_embedding.return_value = [0.0] * 384

    components = MagicMock(return_value=(parser, redactor, extractor, vectors))
    monkeypatch.setattr(tasks, "get_processing_components", components)

    session = MagicMock()
    session.query.return_value.filter.return_value.first.return_value = None
    session.__enter__.return_value = session
    factory = MagicMock(return_value=session)
    monkeypatch.setattr(tasks, "get_session_factory", lambda: factory)

    candidate_id = str(uuid.uuid4())
    tasks._execute_resume_processing(task, str(path), candidate_id)

    # Verify session.add was called with Candidate object having truncated values
    session.add.assert_called_once()
    saved_candidate = session.add.call_args[0][0]

    assert len(saved_candidate.anonymized_name) <= 100
    assert len(saved_candidate.target_headline) <= 255
    assert len(saved_candidate.highest_education) <= 100
    assert len(saved_candidate.parsing_engine) <= 50
    assert saved_candidate.years_of_experience <= 99.9
