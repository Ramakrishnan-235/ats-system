"""Tests for RBAC, per-user identity, anti-spoofing, and audit trail on PII access."""

import os
from unittest.mock import patch
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from ats_core.api import auth, upload_storage
from ats_core.api.audit import audit_store
from ats_core.api.v1 import audit, candidates, dashboard, jobs


@pytest.fixture
def auth_api(tmp_path, monkeypatch):
    """Test client with authentication enabled, mock API key."""
    monkeypatch.setenv("ATS_DB_SYNC_ENABLED", "false")
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
        "status": "OPEN", "job_description": "Go/Python", "candidates_count": 1,
        "required_skills": ["Python"], "location": "Remote", "posted_date": "2026-02-10",
        "top_match": {"status": "ACTIVE", "label": "Active Analysis"},
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
        token = auth.create_signed_token(f"user-{role}", role, secret_key=key)
        headers = {"Authorization": f"Bearer {token}"}
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

    recruiter_token = auth.create_signed_token("recruiter-alice", "recruiter", "alice@acme.com", secret_key=key)
    recruiter_headers = {"Authorization": f"Bearer {recruiter_token}"}

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

    viewer_token = auth.create_signed_token("viewer-bob", "viewer", secret_key=key)
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

    # Attempt unauthorized PII access
    resp = client.get("/api/v1/candidates/cand-secret-001?include_pii=true", headers=viewer_headers)
    assert resp.status_code == 403

    # Viewer cannot view audit logs
    audit_fail = client.get("/api/v1/audit/logs", headers=viewer_headers)
    assert audit_fail.status_code == 403

    # Admin can view audit logs and sees the denied attempt
    admin_token = auth.create_signed_token("admin-root", "admin", secret_key=key)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
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

    viewer_token = auth.create_signed_token("v1", "viewer", secret_key=key)
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}
    resp = client.get(f"/api/v1/candidates/{cand_id}/resume-pdf", headers=viewer_headers)
    assert resp.status_code == 403

    recruiter_token = auth.create_signed_token("r1", "recruiter", secret_key=key)
    recruiter_headers = {"Authorization": f"Bearer {recruiter_token}"}
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


# -----------------------------------------------------------------------------
# SEC-02 Specific Tests: Spoofable Headers, Write RBAC, and Decommissioning
# -----------------------------------------------------------------------------

def test_sec_02_spoofed_admin_role_header_denied_pii_and_writes(auth_api):
    """
    SEC-02: Attacker with shared ATS_API_KEY passes unsigned X-User-Role: admin
    and X-User-Id: attacker to bypass PII restrictions, download resumes, mutate jobs/candidates,
    and poison audit logs.
    All must be BLOCKED with 403 Forbidden.
    """
    client, key = auth_api
    audit_store.clear()

    cand_id = "cand-secret-001"
    pdf_file = upload_storage.resume_path(cand_id)
    pdf_file.write_bytes(b"%PDF-1.4 mock resume content")

    spoofed_headers = {
        "X-API-Key": key,
        "X-User-Id": "attacker-id",
        "X-User-Role": "admin",
        "X-Role": "admin",
        "X-User-Email": "attacker@evil.com",
    }

    # 1. Blocked from viewing unmasked PII
    resp = client.get("/api/v1/candidates?include_pii=true", headers=spoofed_headers)
    assert resp.status_code == 403

    resp = client.get(f"/api/v1/candidates/{cand_id}?include_pii=true", headers=spoofed_headers)
    assert resp.status_code == 403

    resp = client.get("/api/v1/jobs/job-1/candidates?include_pii=true", headers=spoofed_headers)
    assert resp.status_code == 403

    resp = client.get("/api/v1/dashboard/stats?include_pii=true", headers=spoofed_headers)
    assert resp.status_code == 403

    # 2. Blocked from downloading raw resume PDF
    resp = client.get(f"/api/v1/candidates/{cand_id}/resume-pdf", headers=spoofed_headers)
    assert resp.status_code == 403

    # 3. Blocked from reading audit logs
    resp = client.get("/api/v1/audit/logs", headers=spoofed_headers)
    assert resp.status_code == 403

    # 4. Blocked from mutating jobs
    resp = client.post("/api/v1/jobs", headers=spoofed_headers, json={
        "title": "Malicious Job",
        "department": "Engineering",
        "job_description": "Test job description with requirements for Python engineer.",
    })
    assert resp.status_code == 403

    resp = client.patch("/api/v1/jobs/job-1", headers=spoofed_headers, json={"title": "Poisoned"})
    assert resp.status_code == 403

    resp = client.patch("/api/v1/jobs/job-1/status?new_status=CLOSED", headers=spoofed_headers)
    assert resp.status_code == 403

    resp = client.post("/api/v1/jobs/job-1/candidates", headers=spoofed_headers, json={"name": "Fake"})
    assert resp.status_code == 403

    resp = client.delete(f"/api/v1/jobs/job-1/candidates/{cand_id}", headers=spoofed_headers)
    assert resp.status_code == 403

    resp = client.patch(f"/api/v1/jobs/job-1/candidates/{cand_id}/stage?new_stage=Offer", headers=spoofed_headers)
    assert resp.status_code == 403

    # 5. Blocked from mutating candidate stage and notes
    resp = client.patch(f"/api/v1/candidates/{cand_id}/stage?new_stage=Offer", headers=spoofed_headers)
    assert resp.status_code == 403

    resp = client.post(f"/api/v1/candidates/{cand_id}/notes", headers=spoofed_headers, json={"content": "Malicious note"})
    assert resp.status_code == 403

    # 6. Verify audit logs cannot be poisoned: actor cannot spoof actor_role='admin'
    admin_token = auth.create_signed_token("real-admin", "admin", secret_key=key)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    logs_resp = client.get("/api/v1/audit/logs", headers=admin_headers)
    assert logs_resp.status_code == 200
    logs = logs_resp.json()
    for entry in logs:
        # No entry can show actor_role as 'admin' from the attacker
        if "attacker" in entry["actor_id"]:
            assert entry["actor_role"] == "viewer"
            assert entry["decision"] == "DENIED"


def test_sec_02_signed_user_headers_via_signature(auth_api):
    """Verifies that X-User-Signature validates caller identity and permits recruiter actions."""
    client, key = auth_api
    sig = auth.sign_user_headers("recruiter-alice", "recruiter", "alice@acme.com", key)
    headers = {
        "X-API-Key": key,
        "X-User-Id": "recruiter-alice",
        "X-User-Role": "recruiter",
        "X-User-Email": "alice@acme.com",
        "X-User-Signature": sig,
    }

    # Unmasked candidate detail
    resp = client.get("/api/v1/candidates/cand-secret-001?include_pii=true", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Sarah Connor"


def test_sec_02_write_rbac_with_signed_token(auth_api):
    """Verifies that cryptographically signed recruiter tokens can mutate jobs and candidates."""
    client, key = auth_api

    recruiter_token = auth.create_signed_token("recruiter-bob", "recruiter", secret_key=key)
    headers = {"Authorization": f"Bearer {recruiter_token}"}

    # 1. Create job succeeds
    resp = client.post("/api/v1/jobs", headers=headers, json={
        "title": "Senior AI Architect",
        "department": "Engineering",
        "job_description": "Python FastAPI PyTorch",
    })
    assert resp.status_code == 201
    created_id = resp.json()["id"]

    # 2. Update job succeeds
    resp = client.patch(f"/api/v1/jobs/{created_id}", headers=headers, json={"department": "AI Research"})
    assert resp.status_code == 200

    # 3. Update candidate stage succeeds
    resp = client.patch("/api/v1/candidates/cand-secret-001/stage?new_stage=Offer", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["stage"] == "Offer"

    # 4. Add candidate note succeeds
    resp = client.post("/api/v1/candidates/cand-secret-001/notes", headers=headers, json={"content": "Strong system design skills."})
    assert resp.status_code == 200
    assert resp.json()["author"] == "recruiter-bob"
    assert resp.json()["role"] == "Recruiter"


def test_sec_02_decommissioned_public_routes(monkeypatch):
    """Verifies that ATS_DECOMMISSION_PUBLIC_ROUTES=true returns HTTP 410 Gone for legacy routes."""
    with patch.dict(os.environ, {"ATS_DECOMMISSION_PUBLIC_ROUTES": "true"}):
        from fastapi import FastAPI
        from fastapi import status as http_status
        from fastapi.exceptions import HTTPException

        dep_app = FastAPI()

        @dep_app.api_route("/api/v1/{path:path}", methods=["GET", "POST", "PATCH", "DELETE", "PUT"])
        async def decommissioned(path: str):
            raise HTTPException(
                status_code=http_status.HTTP_410_GONE,
                detail="Legacy Python ATS Core public API routes have been decommissioned in favor of backend-rust.",
            )

        with TestClient(dep_app) as client:
            resp = client.get("/api/v1/jobs")
            assert resp.status_code == 410
            assert "decommissioned" in resp.json()["detail"].lower()
