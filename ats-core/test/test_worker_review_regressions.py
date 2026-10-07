"""Worker validation and persistence tests with deterministic in-memory collaborators."""

import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from ats_core.workers import tasks


@pytest.fixture
def pipeline(monkeypatch, tmp_path):
    monkeypatch.setattr(tasks, "UPLOAD_STAGING_DIR", tmp_path)
    path = tmp_path / "resume.pdf"
    path.write_bytes(b"%PDF-1.4 deterministic test")
    task = MagicMock()
    task.request.id = "test-task"
    task.request.retries = 0
    profile = MagicMock()
    profile.target_role_or_headline = "Engineer"
    profile.executive_summary = "Python engineer"
    profile.anonymized_name = "Candidate #123"
    profile.timeline.total_continuous_years = 3.0
    profile.education = []
    profile.skills.core_languages = ["Python"]
    profile.skills.frameworks_and_tools = []
    profile.skills.detailed_skills = ["Python"]
    profile.model_dump.return_value = {"extracted_at": datetime.now(UTC).isoformat()}
    parser, redactor, extractor, vectors = (MagicMock() for _ in range(4))
    parser.parse_pdf.return_value = ("Jane Doe Python", "test-parser")
    redactor.anonymize.return_value = "[CANDIDATE] Python"
    extractor.extract_profile.return_value = profile
    vectors.generate_embedding.return_value = [0.0] * 384
    components = MagicMock(return_value=(parser, redactor, extractor, vectors))
    monkeypatch.setattr(tasks, "get_processing_components", components)
    session = MagicMock()
    session.query.return_value.filter.return_value.first.return_value = None
    session.__enter__.return_value = session
    factory = MagicMock(return_value=session)
    monkeypatch.setattr(tasks, "get_session_factory", lambda: factory)
    return SimpleNamespace(
        path=path, task=task, profile=profile, parser=parser, redactor=redactor,
        extractor=extractor, vectors=vectors, components=components, session=session,
        candidate_id=str(uuid.uuid4()),
    )


def test_worker_import_does_not_initialize_database_or_download_models():
    assert tasks.get_session_factory.cache_info().currsize == 0
    assert tasks.get_processing_components.cache_info().currsize == 0
    assert {ValueError, FileNotFoundError}.issubset(set(tasks.BaseTaskWithRetry.dont_autoretry_for))


def test_worker_rejects_invalid_uuid_before_loading_models(pipeline):
    with pytest.raises(ValueError):
        tasks._execute_resume_processing(pipeline.task, str(pipeline.path), "cand-invalid")
    pipeline.components.assert_not_called()
    pipeline.session.commit.assert_not_called()


def test_worker_rejects_paths_outside_staging(pipeline, tmp_path):
    outside = tmp_path / "outside" / "resume.pdf"
    outside.parent.mkdir()
    outside.write_bytes(b"%PDF-1.4 private document")
    with pytest.raises(ValueError):
        tasks._execute_resume_processing(pipeline.task, str(outside), pipeline.candidate_id)
    pipeline.components.assert_not_called()
    assert outside.exists()


@pytest.mark.parametrize("content", [b"not PDF", b"%PDF-1.4" + b"x" * 64])
def test_worker_rejects_invalid_or_oversized_pdf_before_models(pipeline, monkeypatch, content):
    monkeypatch.setattr(tasks, "MAX_UPLOAD_BYTES", 32)
    pipeline.path.write_bytes(content)
    with pytest.raises(ValueError):
        tasks._execute_resume_processing(pipeline.task, str(pipeline.path), pipeline.candidate_id)
    pipeline.components.assert_not_called()


def test_worker_masks_before_extraction_commits_json_then_removes_file(pipeline):
    result = tasks._execute_resume_processing(pipeline.task, str(pipeline.path), pipeline.candidate_id)
    assert result["status"] == "COMPLETED"
    pipeline.extractor.extract_profile.assert_called_once_with("[CANDIDATE] Python")
    pipeline.profile.model_dump.assert_called_once_with(mode="json")
    pipeline.session.commit.assert_called_once()
    assert not pipeline.path.exists()


def test_failed_commit_rolls_back_and_keeps_file_for_retry(pipeline):
    pipeline.session.commit.side_effect = RuntimeError("database unavailable")
    with pytest.raises(RuntimeError, match="persistence failed"):
        tasks._execute_resume_processing(pipeline.task, str(pipeline.path), pipeline.candidate_id)
    pipeline.session.rollback.assert_called_once()
    assert pipeline.path.exists()


def test_terminal_failure_cleans_only_valid_staged_file(pipeline):
    task = tasks.BaseTaskWithRetry()
    task.on_failure(RuntimeError("failed"), "task-id", (str(pipeline.path), pipeline.candidate_id), {}, None)
    assert not pipeline.path.exists()


def test_terminal_failure_never_deletes_unrelated_file(pipeline, tmp_path):
    outside = tmp_path / "outside" / "private.pdf"
    outside.parent.mkdir()
    outside.write_bytes(b"%PDF-1.4 private document")
    task = tasks.BaseTaskWithRetry()
    task.on_failure(RuntimeError("failed"), "task-id", (str(outside), pipeline.candidate_id), {}, None)
    assert outside.exists()
