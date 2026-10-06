"""Tests for RBAC, per-user identity, and audit trail on PII access."""

import os
from pathlib import Path
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from ats_core.api import auth, upload_storage
from ats_core.api.audit import audit_store
from ats_core.api.v1 import candidates, dashboard, jobs, audit


@pytest.fixture
def auth_api(tmp_path):
    """Test client with authentication enabled, mock API key."""
    api_key = "test-secret-api-key-999"
    orig_auth_enabled = auth.ATS_AUTH_ENABLED
    orig_expected_key = auth.EXPECTED_API_KEY

    auth.ATS_AUTH_ENABLED = True
    auth.EXPECTED_API_KEY = api_key

    candidates.CANDIDATES_STORE.clear()
    candidates.UPLOAD_TASKS_STORE.clear()
    candidates.UPLOAD_STAGING_DIR = tmp_path
    upload_storage.UPLOAD_STAGING_DIR = tmp_path
    jobs.JOBS_STORE.clear()
    jobs.JOBS_STORE["job-1"] = {
        "id": "job-1", "title": "Engineer", "department": "Eng",
        "status": "OPEN", "job_description": "Go/Python", "candidates_count": 1
    }
    jobs.JOB_CANDIDATES_STORE.clear()
    audit_store.clear()

    # Seed a candidate with unmasked PII
    cand_id = "cand-secret-001"
    candidates.CANDIDATES_STORE[cand_id] = {
        "id": cand_id,
        "name": "Sarah Connor",
        "email": "sarah@resistance.org",
        "phone": "+1-555-0199",
        "location": "Los Angeles, CA",
        "anonymized_name": "Candidate #999",
        "avatar": "SC",
        "target_headline": "Cybersecurity Lead",
        "core_skills": ["Python", "Security"],
        "stage": "Interview",
        "scorecard": {"overall_match_score": 95, "categories": []},
    }
    jobs.JOB_CANDIDATES_STORE["job-1"] = [candidates.CANDIDATES_STORE[cand_id]]

    app = FastAPI()
    for router in (candidates.router, dashboard.router, jobs.router, audit.router):
        app.include_router(router, prefix="/api/v1", dependencies=[Depends(auth.verify_api_key)])

    with TestClient(app) as client:
        yield client, api_key

    auth.ATS_AUTH_ENABLED = orig_auth_enabled
    auth.EXPECTED_API_KEY = orig_expected_key


def test_shared_key_without_role_denies_unmasked_pii(auth_api):
    client, key = auth_api
    # Caller has the valid shared API key but NO per-user identity or privileged role
    headers = {"X-API-Key": key}

    # 1. candidates list with include_pii=true -> 403
    resp = client.get("/api/v1/candidates?include_pii=true", headers=headers)
    assert resp.status_code == 403
    assert "not authorized to view unmasked personal data" in resp.json()["detail"].lower()

    # 2. candidate detail with include_pii=true -> 403
    resp = client.get("/api/v1/candidates/cand-secret-001?include_pii=true", headers=headers)
    assert resp.status_code == 403

    # 3. job candidates with include_pii=true -> 403
    resp = client.get("/api/v1/jobs/job-1/candidates?include_pii=true", headers=headers)
    assert resp.status_code == 403

    # 4. dashboard stats with include_pii=true -> 403
    resp = client.get("/api/v1/dashboard/stats?include_pii=true", headers=headers)
    assert resp.status_code == 403


def test_shared_key_allows_masked_data_without_privileged_role(auth_api):
    client, key = auth_api
    headers = {"X-API-Key": key}

    # Masked list -> 200 OK
    resp = client.get("/api/v1/candidates", headers=headers)
    assert resp.status_code == 200
    cands = resp.json()
    assert len(cands) == 1
    assert cands[0]["name"] == "Candidate #999"
    assert "Sarah Connor" not in str(cands[0])
    assert cands[0]["email"] == "[REDACTED_EMAIL@DOMAIN.COM]"

    # Masked detail -> 200 OK
    resp = client.get("/api/v1/candidates/cand-secret-001", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Candidate #999"
    assert "Sarah Connor" not in str(resp.json())


def test_viewer_and_interviewer_roles_blocked_from_pii(auth_api):
    client, key = auth_api

    for role in ("viewer", "interviewer", "guest"):
        headers = {
            "X-API-Key": key,
            "X-User-Id": f"user-{role}",
            "X-User-Role": role,
        }
        resp = client.get("/api/v1/candidates?include_pii=true", headers=headers)
        assert resp.status_code == 403

        resp = client.get("/api/v1/candidates/cand-secret-001?include_pii=true", headers=headers)
        assert resp.status_code == 403

        resp = client.get("/api/v1/jobs/job-1/candidates?include_pii=true", headers=headers)
        assert resp.status_code == 403

        resp = client.get("/api/v1/dashboard/stats?include_pii=true", headers=headers)
        assert resp.status_code == 403


def test_recruiter_and_admin_roles_access_unmasked_pii_and_generate_audit_trail(auth_api):
    client, key = auth_api
    audit_store.clear()

    recruiter_headers = {
        "X-API-Key": key,
        "X-User-Id": "recruiter-alice",
        "X-User-Role": "recruiter",
        "X-User-Email": "alice@acme.com",
    }

    # 1. Unmasked candidate detail
    resp = client.get("/api/v1/candidates/cand-secret-001?include_pii=true", headers=recruiter_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Sarah Connor"
    assert data["email"] == "sarah@resistance.org"
    assert data["phone"] == "+1-555-0199"

    # 2. Unmasked jobs candidates
    resp = client.get("/api/v1/jobs/job-1/candidates?include_pii=true", headers=recruiter_headers)
    assert resp.status_code == 200
    assert resp.json()[0]["name"] == "Sarah Connor"

    # 3. Check audit log records
    audit_resp = client.get("/api/v1/audit/logs", headers=recruiter_headers)
    assert audit_resp.status_code == 200
    logs = audit_resp.json()
    assert len(logs) >= 2

    view_cand_log = next(l for l in logs if l["action"] == "VIEW_CANDIDATE_PII")
    assert view_cand_log["actor_id"] == "recruiter-alice"
    assert view_cand_log["actor_role"] == "recruiter"
    assert view_cand_log["decision"] == "ALLOWED"
    assert view_cand_log["resource_type"] == "candidate"
    assert view_cand_log["resource_id"] == "cand-secret-001"
    assert "timestamp" in view_cand_log


def test_audit_logs_record_denied_pii_attempts(auth_api):
    client, key = auth_api
    audit_store.clear()

    viewer_headers = {
        "X-API-Key": key,
        "X-User-Id": "viewer-bob",
        "X-User-Role": "viewer",
    }

    # Attempt unauthorized PII access
    resp = client.get("/api/v1/candidates/cand-secret-001?include_pii=true", headers=viewer_headers)
    assert resp.status_code == 403

    # Viewer cannot view audit logs
    audit_fail = client.get("/api/v1/audit/logs", headers=viewer_headers)
    assert audit_fail.status_code == 403

    # Admin can view audit logs and sees the denied attempt
    admin_headers = {
        "X-API-Key": key,
        "X-User-Id": "admin-root",
        "X-User-Role": "admin",
    }
    audit_ok = client.get("/api/v1/audit/logs", headers=admin_headers)
    assert audit_ok.status_code == 200
    logs = audit_ok.json()
    assert len(logs) == 1
    assert logs[0]["actor_id"] == "viewer-bob"
    assert logs[0]["actor_role"] == "viewer"
    assert logs[0]["decision"] == "DENIED"
    assert logs[0]["action"] == "VIEW_CANDIDATE_PII_DENIED"


def test_resume_pdf_rbac_and_audit(auth_api):
    client, key = auth_api
    audit_store.clear()

    cand_id = "cand-secret-001"
    pdf_file = upload_storage.resume_path(cand_id)
    pdf_file.write_bytes(b"%PDF-1.4 mock resume content")

    viewer_headers = {"X-API-Key": key, "X-User-Id": "v1", "X-User-Role": "viewer"}
    resp = client.get(f"/api/v1/candidates/{cand_id}/resume-pdf", headers=viewer_headers)
    assert resp.status_code == 403

    recruiter_headers = {"X-API-Key": key, "X-User-Id": "r1", "X-User-Role": "recruiter"}
    resp = client.get(f"/api/v1/candidates/{cand_id}/resume-pdf", headers=recruiter_headers)
    assert resp.status_code == 200
    assert resp.content == b"%PDF-1.4 mock resume content"

    logs = audit_store.list_records(limit=10)
    pdf_denied = next(l for l in logs if l.action == "DOWNLOAD_RESUME_PDF_DENIED")
    assert pdf_denied.actor_id == "v1"
    assert pdf_denied.decision == "DENIED"

    pdf_allowed = next(l for l in logs if l.action == "DOWNLOAD_RESUME_PDF")
    assert pdf_allowed.actor_id == "r1"
    assert pdf_allowed.decision == "ALLOWED"
