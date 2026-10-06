"""
test_taxonomy_poisoning_prevention_2_5.py
Comprehensive regression tests for Finding 2.5:
1. Seed synchronization preserves approved edits to seeded skills and custom skills.
2. Alias hijacking is blocked (cannot silently take over another skill's alias or canonical name).
3. Approving with an existing canonical name or conflicting alias fails with 409 Conflict without overwriting indexes.
4. Gated by RBAC: viewers cannot mutate taxonomy; recruiters can curate; only admins can sync seed.
5. All administrative mutations are recorded in audit logs.
"""

import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient

from ats_core.api import auth
from ats_core.api.audit import audit_store
from ats_core.api.v1.taxonomy import router as taxonomy_router
from ats_core.taxonomy.taxonomy_service import SkillTaxonomyService


TEST_API_KEY = "sec-taxonomy-test-key-25"


@pytest.fixture
def taxonomy_test_app():
    """Sets up an isolated FastAPI test client with authentication and clean audit store."""
    orig_auth = auth.ATS_AUTH_ENABLED
    orig_key = auth.EXPECTED_API_KEY

    auth.ATS_AUTH_ENABLED = True
    auth.EXPECTED_API_KEY = TEST_API_KEY
    audit_store.clear()

    app = FastAPI()
    app.include_router(taxonomy_router, prefix="/api/v1", dependencies=[Depends(auth.verify_api_key)])

    with TestClient(app) as test_client:
        yield test_client

    auth.ATS_AUTH_ENABLED = orig_auth
    auth.EXPECTED_API_KEY = orig_key


def test_sync_seed_preserves_approved_edits_and_custom_skills():
    """
    POST /taxonomy/sync-seed must not wipe or overwrite approved edits to seeded skills
    or wipe user-created custom skills.
    """
    service = SkillTaxonomyService()

    # 1. Edit a seeded skill: add a custom alias and update category
    python_skill = service.get_skill_by_canonical("Python")
    assert python_skill is not None
    orig_python_id = python_skill["id"]

    # Add custom alias to Python
    service.add_alias("Python", "cpython-runtime")
    # Change category
    python_skill["category"] = "backend_language"

    # 2. Create a custom skill
    custom_skill = service.create_skill(
        canonical_name="CustomQuantumDB",
        category="database",
        aliases=["quantum-db", "qdb"],
    )
    custom_id = custom_skill["id"]

    # 3. Trigger sync_seed
    res = service.sync_seed()
    assert res["status"] == "SUCCESS"

    # 4. Verify Python STILL has the approved custom alias and customized category
    python_after = service.get_skill_by_canonical("Python")
    assert python_after["id"] == orig_python_id
    assert "cpython-runtime" in python_after["aliases"]
    assert python_after["category"] == "backend_language"
    assert service.lookup_skill("cpython-runtime")["canonical_name"] == "Python"

    # 5. Verify custom skill was NOT wiped out
    assert service.get_skill_by_id(custom_id) is not None
    assert service.lookup_skill("quantum-db")["canonical_name"] == "CustomQuantumDB"


def test_alias_cannot_silently_take_over_another_skill_alias():
    """
    Adding an alias that already belongs to another skill (or matches another skill's
    canonical name) must be rejected and cannot silently hijack resolution.
    """
    service = SkillTaxonomyService()

    # Kubernetes owns 'k8s'
    k8s_match = service.lookup_skill("k8s")
    assert k8s_match is not None
    assert k8s_match["canonical_name"] == "Kubernetes"

    # Attempting to add 'k8s' to Docker must raise ValueError
    with pytest.raises(ValueError, match="conflicts with existing skill 'Kubernetes'"):
        service.add_alias("Docker", "k8s")

    # 'k8s' must STILL resolve to Kubernetes, NOT Docker
    assert service.lookup_skill("k8s")["canonical_name"] == "Kubernetes"
    docker_skill = service.get_skill_by_canonical("Docker")
    assert "k8s" not in docker_skill["aliases"]

    # Attempting to add a canonical name as an alias (e.g. 'Python' to 'Docker') must fail
    with pytest.raises(ValueError, match="conflicts with canonical name of existing skill 'Python'"):
        service.add_alias("Docker", "Python")


def test_approving_with_existing_canonical_name_does_not_overwrite_index():
    """
    Approving a pending skill with a canonical_name that already exists
    must be rejected and cannot overwrite the existing canonical index entry.
    """
    service = SkillTaxonomyService()

    # Python is an approved canonical skill
    original_python = service.get_skill_by_canonical("Python")
    assert original_python is not None
    original_id = original_python["id"]

    # Register an unknown flywheel skill (must not fuzzy match Python)
    pending = service.record_unknown_skill("UniqueFlywheelSkillZ9", source="resume_parser")
    pending_id = pending["id"]
    assert pending_id != original_id
    assert pending["status"] == "pending"

    # Attempting to approve it with canonical_name='Python' must raise ValueError
    with pytest.raises(ValueError, match="already exists in taxonomy"):
        service.approve_skill(pending_id, canonical_name="Python")

    # Python's canonical index must NOT have been overwritten
    python_now = service.get_skill_by_canonical("Python")
    assert python_now["id"] == original_id
    assert python_now["id"] != pending_id


def test_approving_with_conflicting_alias_fails():
    """
    Approving a pending skill with an alias that belongs to another skill must fail.
    """
    service = SkillTaxonomyService()

    pending = service.record_unknown_skill("MicroK8sClusterTool", source="resume_parser")
    pending_id = pending["id"]
    assert pending["status"] == "pending"

    # Attempting to approve with alias 'k8s' (which belongs to Kubernetes) must fail
    with pytest.raises(ValueError, match="conflicts with existing skill 'Kubernetes'"):
        service.approve_skill(pending_id, canonical_name="MicroK8sClusterTool", aliases=["k8s"])


def test_role_gating_on_taxonomy_mutations(taxonomy_test_app):
    """
    Verify RBAC on all taxonomy routes:
    - Viewer cannot create, approve, reject, add aliases, or sync seed (403 Forbidden).
    - Recruiter can create, approve, reject, add aliases, but CANNOT sync seed (403 Forbidden).
    - Admin can perform all operations including sync seed.
    """
    client = taxonomy_test_app
    service = SkillTaxonomyService.get_instance()

    # 1. Viewer role attempts
    viewer_headers = {
        "X-API-Key": TEST_API_KEY,
        "X-User-Id": "v-1",
        "X-User-Role": "viewer",
    }

    # Viewer cannot create skill
    r = client.post("/api/v1/taxonomy/skills", json={"canonical_name": "TestTool1", "category": "tool"}, headers=viewer_headers)
    assert r.status_code == 403

    # Viewer cannot approve skill
    pending = service.record_unknown_skill("ViewerBlockedSkill")
    r = client.patch(f"/api/v1/taxonomy/skills/{pending['id']}/approve", json={"category": "tool"}, headers=viewer_headers)
    assert r.status_code == 403

    # Viewer cannot reject skill
    r = client.patch(f"/api/v1/taxonomy/skills/{pending['id']}/reject", headers=viewer_headers)
    assert r.status_code == 403

    # Viewer cannot add alias
    docker = service.get_skill_by_canonical("Docker")
    r = client.post(f"/api/v1/taxonomy/skills/{docker['id']}/aliases", json={"alias": "docker-alias-v"}, headers=viewer_headers)
    assert r.status_code == 403

    # Viewer cannot sync seed
    r = client.post("/api/v1/taxonomy/sync-seed", headers=viewer_headers)
    assert r.status_code == 403

    # 2. Recruiter role attempts
    recruiter_headers = {
        "X-API-Key": TEST_API_KEY,
        "X-User-Id": "r-1",
        "X-User-Role": "recruiter",
    }

    # Recruiter CAN create skill
    r = client.post(
        "/api/v1/taxonomy/skills",
        json={"canonical_name": "RecruiterAllowedTool", "category": "tool", "aliases": ["ratool"]},
        headers=recruiter_headers
    )
    assert r.status_code == 201

    # Recruiter CAN approve skill
    pending_r = service.record_unknown_skill("RecruiterApproveMe")
    r = client.patch(
        f"/api/v1/taxonomy/skills/{pending_r['id']}/approve",
        json={"canonical_name": "RecruiterApproved", "category": "tool"},
        headers=recruiter_headers
    )
    assert r.status_code == 200
    assert r.json()["status"] == "approved"

    # Recruiter CAN reject skill
    pending_rej = service.record_unknown_skill("RecruiterRejectMe")
    r = client.patch(f"/api/v1/taxonomy/skills/{pending_rej['id']}/reject", headers=recruiter_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "rejected"

    # Recruiter CAN add non-conflicting alias
    r = client.post(
        f"/api/v1/taxonomy/skills/{docker['id']}/aliases",
        json={"alias": "docker-recruiter-alias"},
        headers=recruiter_headers
    )
    assert r.status_code == 200

    # Recruiter CANNOT sync seed (Admin only!)
    r = client.post("/api/v1/taxonomy/sync-seed", headers=recruiter_headers)
    assert r.status_code == 403
    assert "Administrator role is required" in r.json()["detail"]

    # 3. Admin role attempts
    admin_headers = {
        "X-API-Key": TEST_API_KEY,
        "X-User-Id": "a-1",
        "X-User-Role": "admin",
    }

    # Admin CAN sync seed
    r = client.post("/api/v1/taxonomy/sync-seed", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "SUCCESS"
    assert "Approved user edits and custom skills preserved" in r.json()["message"]


def test_api_conflict_responses_and_audit_trail(taxonomy_test_app):
    """
    Verify API returns 409 Conflict when alias or canonical collisions are attempted,
    and verify audit logging captures all successful administrative actions.
    """
    client = taxonomy_test_app
    service = SkillTaxonomyService.get_instance()
    admin_headers = {
        "X-API-Key": TEST_API_KEY,
        "X-User-Id": "admin-audit-user",
        "X-User-Role": "admin",
    }

    # Collision 1: Create skill with canonical name that already exists -> 409
    r = client.post(
        "/api/v1/taxonomy/skills",
        json={"canonical_name": "Python", "category": "language"},
        headers=admin_headers
    )
    assert r.status_code == 409
    assert "already exists in taxonomy" in r.json()["detail"]

    # Collision 2: Create skill with alias that belongs to another skill -> 409
    r = client.post(
        "/api/v1/taxonomy/skills",
        json={"canonical_name": "UniqueLangXYZ", "category": "language", "aliases": ["k8s"]},
        headers=admin_headers
    )
    assert r.status_code == 409
    assert "conflicts with existing skill 'Kubernetes'" in r.json()["detail"]

    # Collision 3: Add alias that collides with another skill -> 409
    docker = service.get_skill_by_canonical("Docker")
    r = client.post(
        f"/api/v1/taxonomy/skills/{docker['id']}/aliases",
        json={"alias": "k8s"},
        headers=admin_headers
    )
    assert r.status_code == 409
    assert "conflicts with existing skill 'Kubernetes'" in r.json()["detail"]

    # Successful action 4: Create unique custom skill -> 201 & audit log
    r_success = client.post(
        "/api/v1/taxonomy/skills",
        json={"canonical_name": "AuditedAdminTool", "category": "tool"},
        headers=admin_headers
    )
    assert r_success.status_code == 201

    # Successful action 5: Sync seed -> 200 & audit log
    r_sync = client.post("/api/v1/taxonomy/sync-seed", headers=admin_headers)
    assert r_sync.status_code == 200

    # Verify audit log recorded successful actions
    audit_records = audit_store.list_records(actor_id="admin-audit-user")
    assert len(audit_records) >= 2
    actions = [rec.action for rec in audit_records]
    assert "taxonomy:create_skill" in actions
    assert "taxonomy:sync_seed" in actions
