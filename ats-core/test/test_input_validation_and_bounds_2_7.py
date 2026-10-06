"""
test_input_validation_and_bounds_2_7.py
Comprehensive regression tests for Finding 2.7:
1. Python stage endpoints validate new_stage against VALID_CANDIDATE_STAGES and reject arbitrary strings (400).
2. Candidate notes enforce content length (1-5000 chars) and prevent author spoofing by binding to user identity.
3. CreateJobRequest and UpdateJobRequest validate title and job_description min/max lengths.
4. Taxonomy category and source are validated against whitelists (422).
5. Rate limiting middleware enforces sliding window and returns HTTP 429 while exempting health endpoints.
6. Tasks and candidate stores prune and maintain bounded memory limits.
"""

import time
import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient

from ats_core.api import auth
from ats_core.api.rate_limiter import SlidingWindowRateLimiter, RateLimitMiddleware
from ats_core.api.v1.candidates import (
    router as candidates_router,
    VALID_CANDIDATE_STAGES,
    prune_candidates_store,
    prune_upload_tasks,
    CANDIDATES_STORE,
    UPLOAD_TASKS_STORE,
    MAX_CANDIDATES_STORE,
    MAX_UPLOAD_TASKS,
)
from ats_core.api.v1.jobs import router as jobs_router, JOBS_STORE, JOB_CANDIDATES_STORE
from ats_core.api.v1.taxonomy import router as taxonomy_router
from ats_core.taxonomy.taxonomy_service import SkillTaxonomyService


TEST_API_KEY = "test-key-bounds-27"


@pytest.fixture
def test_app():
    """Sets up an isolated FastAPI test app with rate limiting and auth."""
    orig_auth = auth.ATS_AUTH_ENABLED
    orig_key = auth.EXPECTED_API_KEY

    auth.ATS_AUTH_ENABLED = True
    auth.EXPECTED_API_KEY = TEST_API_KEY

    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, requests_per_minute=10)
    app.include_router(candidates_router, prefix="/api/v1", dependencies=[Depends(auth.verify_api_key)])
    app.include_router(jobs_router, prefix="/api/v1", dependencies=[Depends(auth.verify_api_key)])
    app.include_router(taxonomy_router, prefix="/api/v1", dependencies=[Depends(auth.verify_api_key)])

    @app.get("/health")
    def health():
        return {"status": "ok"}

    with TestClient(app) as client:
        yield client

    auth.ATS_AUTH_ENABLED = orig_auth
    auth.EXPECTED_API_KEY = orig_key


# ==================== 1. STAGE VALIDATION ====================

def test_candidate_stage_validation(test_app):
    """PATCH /candidates/{id}/stage must validate stage against VALID_CANDIDATE_STAGES."""
    # Seed candidate
    cand_id = "cand-val-test-1"
    CANDIDATES_STORE[cand_id] = {
        "id": cand_id,
        "name": "Jane Doe",
        "stage": "Screening",
        "scorecard": {"team_notes": []},
    }

    headers = {
        "X-API-Key": TEST_API_KEY,
        "X-User-Role": "recruiter",
    }

    # Invalid stage should return 400 Bad Request
    res_bad = test_app.patch(
        f"/api/v1/candidates/{cand_id}/stage",
        params={"new_stage": "ArbitraryUnvalidatedStage"},
        headers=headers,
    )
    assert res_bad.status_code == 400
    assert "Invalid candidate stage" in res_bad.json()["detail"]

    # Valid stage should succeed
    for stage in VALID_CANDIDATE_STAGES:
        res_ok = test_app.patch(
            f"/api/v1/candidates/{cand_id}/stage",
            params={"new_stage": stage},
            headers=headers,
        )
        assert res_ok.status_code == 200
        assert res_ok.json()["stage"] == stage


def test_job_candidate_stage_validation(test_app):
    """PATCH /jobs/{jid}/candidates/{cid}/stage must validate new_stage against VALID_CANDIDATE_STAGES."""
    job_id = "job-val-test-1"
    cand_id = "cand-val-test-2"
    JOBS_STORE[job_id] = {
        "id": job_id,
        "title": "Software Engineer",
        "job_description": "Valid job description for testing purposes",
    }
    JOB_CANDIDATES_STORE[job_id] = [
        {
            "id": cand_id,
            "name": "Alice Smith",
            "stage": "Screening",
        }
    ]

    headers = {
        "X-API-Key": TEST_API_KEY,
        "X-User-Role": "recruiter",
    }

    # Invalid stage rejected
    res_bad = test_app.patch(
        f"/api/v1/jobs/{job_id}/candidates/{cand_id}/stage",
        params={"new_stage": "HackedStatus"},
        headers=headers,
    )
    assert res_bad.status_code == 400
    assert "Invalid candidate stage" in res_bad.json()["detail"]

    # Valid stage accepted
    res_ok = test_app.patch(
        f"/api/v1/jobs/{job_id}/candidates/{cand_id}/stage",
        params={"new_stage": "Interview"},
        headers=headers,
    )
    assert res_ok.status_code == 200
    assert res_ok.json()["stage"] == "Interview"


# ==================== 2. NOTE CONTENT & ANTI-SPOOFING ====================

def test_note_content_length_and_whitespace(test_app):
    """Candidate notes must enforce 1-5000 characters and reject whitespace-only."""
    cand_id = "cand-val-test-notes"
    CANDIDATES_STORE[cand_id] = {
        "id": cand_id,
        "name": "Bob Smith",
        "scorecard": {"team_notes": []},
    }

    headers = {
        "X-API-Key": TEST_API_KEY,
        "X-User-Role": "recruiter",
    }

    # Whitespace only rejected (422)
    res = test_app.post(
        f"/api/v1/candidates/{cand_id}/notes",
        json={"content": "     ", "author": "Alice"},
        headers=headers,
    )
    assert res.status_code == 422

    # Empty content rejected (422)
    res = test_app.post(
        f"/api/v1/candidates/{cand_id}/notes",
        json={"content": "", "author": "Alice"},
        headers=headers,
    )
    assert res.status_code == 422

    # Oversized content > 5000 chars rejected (422)
    res = test_app.post(
        f"/api/v1/candidates/{cand_id}/notes",
        json={"content": "A" * 5001, "author": "Alice"},
        headers=headers,
    )
    assert res.status_code == 422


def test_note_author_anti_spoofing(test_app):
    """Candidate note author must bind to authenticated user identity, preventing spoofing."""
    cand_id = "cand-val-test-spoof"
    CANDIDATES_STORE[cand_id] = {
        "id": cand_id,
        "name": "Charlie Brown",
        "scorecard": {"team_notes": []},
    }

    headers = {
        "X-API-Key": TEST_API_KEY,
        "X-User-Role": "recruiter",
        "X-User-Id": "recruiter-actual-id",
        "X-User-Email": "verified.recruiter@company.com",
    }

    # Attacker tries to impersonate someone else in the JSON payload
    res = test_app.post(
        f"/api/v1/candidates/{cand_id}/notes",
        json={"content": "Strong system design skills", "author": "Impersonated CEO"},
        headers=headers,
    )
    assert res.status_code == 200
    saved_note = res.json()

    # The author MUST be bound to verified.recruiter@company.com
    assert saved_note["author"] == "verified.recruiter@company.com"
    assert saved_note["author"] != "Impersonated CEO"


# ==================== 3. JOB TITLE & DESCRIPTION VALIDATION ====================

def test_job_create_validation(test_app):
    """CreateJobRequest must validate title (2-200 chars) and job_description (10-50000 chars)."""
    headers = {
        "X-API-Key": TEST_API_KEY,
        "X-User-Role": "recruiter",
    }

    # Title too short (< 2)
    res = test_app.post(
        "/api/v1/jobs",
        json={"title": "A", "job_description": "Valid and sufficiently long description"},
        headers=headers,
    )
    assert res.status_code == 422

    # Title whitespace only
    res = test_app.post(
        "/api/v1/jobs",
        json={"title": "   ", "job_description": "Valid and sufficiently long description"},
        headers=headers,
    )
    assert res.status_code == 422

    # Job description too short (< 10)
    res = test_app.post(
        "/api/v1/jobs",
        json={"title": "Senior Engineer", "job_description": "Short"},
        headers=headers,
    )
    assert res.status_code == 422

    # Valid job creates successfully
    res = test_app.post(
        "/api/v1/jobs",
        json={"title": "Senior Engineer", "job_description": "Valid and sufficiently long description of the role"},
        headers=headers,
    )
    assert res.status_code == 201
    assert res.json()["title"] == "Senior Engineer"


def test_job_update_validation(test_app):
    """UpdateJobRequest must validate title and description lengths."""
    job_id = "job-update-val-1"
    JOBS_STORE[job_id] = {
        "id": job_id,
        "title": "Initial Title",
        "job_description": "Initial valid description for the job posting",
        "department": "Engineering",
        "status": "ACTIVE",
    }

    headers = {
        "X-API-Key": TEST_API_KEY,
        "X-User-Role": "recruiter",
    }

    # Update with invalid short title
    res = test_app.patch(
        f"/api/v1/jobs/{job_id}",
        json={"title": "X"},
        headers=headers,
    )
    assert res.status_code == 422

    # Update with invalid short description
    res = test_app.patch(
        f"/api/v1/jobs/{job_id}",
        json={"job_description": "tiny"},
        headers=headers,
    )
    assert res.status_code == 422


# ==================== 4. TAXONOMY CATEGORY & SOURCE VALIDATION ====================

def test_taxonomy_category_and_source_validation(test_app):
    """Taxonomy create and approve payloads must enforce category and source whitelists."""
    headers = {
        "X-API-Key": TEST_API_KEY,
        "X-User-Role": "recruiter",
    }

    # Invalid category
    res = test_app.post(
        "/api/v1/taxonomy/skills",
        json={"canonical_name": "NewSkillVal1", "category": "invalid_category_123"},
        headers=headers,
    )
    assert res.status_code == 422

    # Invalid source
    res = test_app.post(
        "/api/v1/taxonomy/skills",
        json={"canonical_name": "NewSkillVal2", "category": "tool", "source": "untrusted_hacker_src"},
        headers=headers,
    )
    assert res.status_code == 422

    # Valid category and source accepted
    res = test_app.post(
        "/api/v1/taxonomy/skills",
        json={"canonical_name": "ValidSkill27", "category": "framework", "source": "manual"},
        headers=headers,
    )
    assert res.status_code == 201
    assert res.json()["category"] == "framework"


# ==================== 5. RATE LIMITING ====================

def test_sliding_window_rate_limiter_unit():
    """Unit test for SlidingWindowRateLimiter: strictly enforces window count."""
    limiter = SlidingWindowRateLimiter(requests_per_minute=3)
    key = "unit-test-ip"

    assert limiter.is_allowed(key) is True
    assert limiter.is_allowed(key) is True
    assert limiter.is_allowed(key) is True
    # 4th request must be rejected
    assert limiter.is_allowed(key) is False

    # Different key is still allowed
    assert limiter.is_allowed("other-ip") is True


def test_rate_limiting_middleware_http(test_app):
    """FastAPI TestClient: verifies rate limit 429 response and Retry-After header."""
    headers = {
        "X-API-Key": TEST_API_KEY,
        "X-User-Role": "recruiter",
        "X-User-Id": "rate-limited-user",
    }

    # App fixture rate limit is set to 10 rpm
    for _ in range(10):
        res = test_app.get("/api/v1/candidates", headers=headers)
        assert res.status_code == 200

    # 11th request must receive 429 Too Many Requests
    blocked_res = test_app.get("/api/v1/candidates", headers=headers)
    assert blocked_res.status_code == 429
    assert blocked_res.headers.get("retry-after") == "60"
    assert "Rate limit exceeded" in blocked_res.json()["detail"]

    # Health check endpoint is exempt
    health_res = test_app.get("/health")
    assert health_res.status_code == 200


# ==================== 6. IN-MEMORY STORE BOUNDS & PRUNING ====================

def test_candidates_store_pruning():
    """Candidates store prunes entries when capacity exceeds MAX_CANDIDATES_STORE."""
    # Temporarily populate store beyond limit
    for i in range(MAX_CANDIDATES_STORE + 20):
        CANDIDATES_STORE[f"cand-prune-{i}"] = {
            "id": f"cand-prune-{i}",
            "created_at": f"2026-01-01T{i%24:02d}:00:00Z",
        }

    prune_candidates_store()
    assert len(CANDIDATES_STORE) <= MAX_CANDIDATES_STORE


def test_upload_tasks_pruning():
    """Upload tasks store prunes finished tasks when capacity exceeds MAX_UPLOAD_TASKS."""
    for i in range(MAX_UPLOAD_TASKS + 30):
        UPLOAD_TASKS_STORE[f"task-prune-{i}"] = {
            "task_id": f"task-prune-{i}",
            "state": "SUCCESS" if i % 2 == 0 else "PROGRESS",
        }

    prune_upload_tasks()
    assert len(UPLOAD_TASKS_STORE) <= MAX_UPLOAD_TASKS


def test_taxonomy_max_skills_capacity():
    """Taxonomy service rejects creating skills when max_total_skills limit is reached."""
    service = SkillTaxonomyService()
    orig_max = service.max_total_skills
    try:
        service.max_total_skills = len(service._skills_by_id)  # Set capacity to current count
        with pytest.raises(ValueError, match="Taxonomy skills capacity reached"):
            service.create_skill(canonical_name="OverflowSkill", category="tool")
    finally:
        service.max_total_skills = orig_max
