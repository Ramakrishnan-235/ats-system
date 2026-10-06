"""
Unit and regression tests for Finding 3.1:
1. spaCy / Presidio engine caching in ResumeAnonymizer (preventing model reload per request)
2. LocalDeepEvaluator singleton caching across requests
3. Asynchronous execution mode for POST /api/v1/candidates/upload-async
4. Concurrency limiting / semaphore protection against threadpool exhaustion
5. Backward compatibility with inline execution mode
"""

import io
import time
from types import SimpleNamespace
from unittest.mock import MagicMock
import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient

from ats_core.api import auth, upload_storage
from ats_core.api.v1 import candidates, jobs
from ats_core.parsers.anonymizer import ResumeAnonymizer, get_shared_anonymizer, _ANALYZER_CACHE, _ANONYMIZER_CACHE
from ats_core.evaluator.deep_evaluator import LocalDeepEvaluator


def test_resume_anonymizer_caches_engines():
    """Verify that multiple ResumeAnonymizer instances share cached Presidio engines."""
    anon1 = ResumeAnonymizer(spacy_model="en_core_web_sm", min_score_threshold=0.55)
    anon2 = ResumeAnonymizer(spacy_model="en_core_web_sm", min_score_threshold=0.6)

    # Both instances must share the same underlying AnalyzerEngine and AnonymizerEngine
    assert anon1.analyzer is anon2.analyzer
    assert anon1.anonymizer is anon2.anonymizer
    assert "en_core_web_sm" in _ANALYZER_CACHE

    # get_shared_anonymizer returns the same wrapper object
    shared1 = get_shared_anonymizer("en_core_web_sm", 0.55)
    shared2 = get_shared_anonymizer("en_core_web_sm", 0.55)
    assert shared1 is shared2


def test_local_deep_evaluator_singleton():
    """Verify that LocalDeepEvaluator.get_instance() caches and returns a singleton instance."""
    eval1 = LocalDeepEvaluator.get_instance(model_name="offline-test")
    eval2 = LocalDeepEvaluator.get_instance()
    assert eval1 is eval2


@pytest.fixture
def test_app(monkeypatch, tmp_path):
    monkeypatch.setattr(auth, "ATS_AUTH_ENABLED", False)
    monkeypatch.setattr(candidates, "CANDIDATES_STORE", {})
    monkeypatch.setattr(candidates, "UPLOAD_TASKS_STORE", {})
    monkeypatch.setattr(candidates, "UPLOAD_STAGING_DIR", tmp_path)
    monkeypatch.setattr(upload_storage, "UPLOAD_STAGING_DIR", tmp_path)
    monkeypatch.setattr(jobs, "JOBS_STORE", {
        "job-test": {"id": "job-test", "title": "Senior Engineer", "department": "Engineering", "status": "OPEN", "job_description": "Python, FastAPI"},
    })
    monkeypatch.setattr(jobs, "JOB_CANDIDATES_STORE", {})

    app = FastAPI()
    app.include_router(candidates.router, prefix="/api/v1")
    app.include_router(jobs.router, prefix="/api/v1")
    return app


def test_upload_async_returns_accepted_immediately(test_app, monkeypatch):
    """Verify POST /upload-async in async mode returns HTTP 202 Accepted immediately with PROCESSING status."""
    monkeypatch.setattr(candidates, "UPLOAD_EXECUTION_MODE", "async")

    # Mock resume parsing to simulate non-blocking execution
    mock_parse = MagicMock(return_value={
        "name": "Jane Doe",
        "raw_text": "Jane Doe Software Engineer",
        "core_skills": ["Python"],
        "scorecard": {"overall_match_score": 85, "match_tier": "Strong Match", "evaluation_status": "COMPLETED", "categories": []},
    })
    monkeypatch.setattr("ats_core.parsers.resume_parser.parse_resume_to_candidate", mock_parse)

    client = TestClient(test_app)
    pdf_content = b"%PDF-1.4 sample content for resume"
    files = {"file": ("test_resume.pdf", io.BytesIO(pdf_content), "application/pdf")}

    response = client.post("/api/v1/candidates/upload-async", files=files, data={"job_id": "job-test"})
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "ACCEPTED"
    assert data["execution_mode"] == "async"
    assert data["evaluation_status"] == "PROCESSING"
    assert "task_id" in data
    assert "candidate_id" in data

    # Verify task status in store
    task_id = data["task_id"]
    task_resp = client.get(f"/api/v1/candidates/tasks/{task_id}")
    assert task_resp.status_code == 200
    task_data = task_resp.json()
    assert task_data["task_id"] == task_id
    assert task_data["execution_mode"] == "async"
    # Starlette TestClient runs background tasks before returning from post()
    assert task_data["state"] in ("PROGRESS", "SUCCESS")


def test_upload_concurrency_bounding(test_app, monkeypatch):
    """Verify that when concurrent upload slots are exhausted, HTTP 429 is returned."""
    # Temporarily set semaphore to locked
    semaphore = candidates._upload_semaphore
    monkeypatch.setattr(semaphore, "locked", lambda: True)

    client = TestClient(test_app)
    pdf_content = b"%PDF-1.4 sample"
    files = {"file": ("resume.pdf", io.BytesIO(pdf_content), "application/pdf")}

    response = client.post("/api/v1/candidates/upload-async", files=files)
    assert response.status_code == 429
    assert "Upload processing capacity is full" in response.json()["detail"]


def test_upload_inline_mode_backward_compatibility(test_app, monkeypatch):
    """Verify that setting execution_mode=inline runs synchronously for legacy clients and tests."""
    monkeypatch.setattr(candidates, "UPLOAD_EXECUTION_MODE", "inline")

    mock_parse = MagicMock(return_value={
        "name": "Alex Tech",
        "raw_text": "Alex Tech Backend Developer",
        "core_skills": ["Python", "FastAPI"],
        "scorecard": {"overall_match_score": 90, "match_tier": "Strong Match", "evaluation_status": "COMPLETED", "categories": []},
    })
    monkeypatch.setattr("ats_core.parsers.resume_parser.parse_resume_to_candidate", mock_parse)

    client = TestClient(test_app)
    pdf_content = b"%PDF-1.4 sample content"
    files = {"file": ("alex.pdf", io.BytesIO(pdf_content), "application/pdf")}

    response = client.post("/api/v1/candidates/upload-async?execution_mode=inline", files=files, data={"job_id": "job-test"})
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "ACCEPTED"
    assert data["execution_mode"] == "inline"
    assert data["match_score"] == 90
    assert data["evaluation_status"] == "COMPLETED"

    task_resp = client.get(f"/api/v1/candidates/tasks/{data['task_id']}")
    assert task_resp.status_code == 200
    assert task_resp.json()["state"] == "SUCCESS"
    assert task_resp.json()["execution_mode"] == "inline"
