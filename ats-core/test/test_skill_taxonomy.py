import pytest
from fastapi.testclient import TestClient
from ats_core.taxonomy.seed_data import SEED_SKILLS, TAXONOMY_VERSION
from ats_core.taxonomy.taxonomy_service import SkillTaxonomyService
from ats_core.parsers.normalizers import normalize_skill, normalize_skills_list
from ats_core.schema.skills import SkillsTaxonomy, ExtractedSkill
from main import app

client = TestClient(app, headers={"X-API-Key": "ats_secret_dev_key_2026"})


# =========================================================================
# 1. TAXONOMY SERVICE CORE & SEEDING TESTS
# =========================================================================

def test_taxonomy_seeding_and_version():
    """Verify default taxonomy loads all seed skills with versioning."""
    service = SkillTaxonomyService.get_instance()
    assert service.version == TAXONOMY_VERSION
    assert service.version == "2026.08.1"
    
    stats = service.get_taxonomy_stats()
    assert stats["approved_count"] >= len(SEED_SKILLS)
    assert stats["total_skills"] >= len(SEED_SKILLS)
    assert "language" in stats["categories"]
    assert "framework" in stats["categories"]
    assert "database" in stats["categories"]


def test_taxonomy_canonical_alias_lookup():
    """Verify direct canonical alias resolution from taxonomy."""
    service = SkillTaxonomyService.get_instance()

    res_k8s = service.lookup_skill("k8s")
    assert res_k8s is not None
    assert res_k8s["canonical_name"] == "Kubernetes"
    assert res_k8s["category"] == "platform"

    res_pg = service.lookup_skill("postgres")
    assert res_pg is not None
    assert res_pg["canonical_name"] == "PostgreSQL"
    assert res_pg["category"] == "database"

    res_react = service.lookup_skill("react.js")
    assert res_react is not None
    assert res_react["canonical_name"] == "React"


def test_taxonomy_short_ambiguous_skills_isolation():
    """Verify single-letter and short acronym skills are protected from fuzzy corruption."""
    service = SkillTaxonomyService.get_instance()

    c_rec = service.lookup_skill("C")
    assert c_rec is not None
    assert c_rec["canonical_name"] == "C"

    cpp_rec = service.lookup_skill("C++")
    assert cpp_rec is not None
    assert cpp_rec["canonical_name"] == "C++"

    cs_rec = service.lookup_skill("C#")
    assert cs_rec is not None
    assert cs_rec["canonical_name"] == "C#"

    r_rec = service.lookup_skill("R")
    assert r_rec is not None
    assert r_rec["canonical_name"] == "R"

    go_rec = service.lookup_skill("Go")
    assert go_rec is not None
    assert go_rec["canonical_name"] == "Go"


def test_taxonomy_typo_fuzzy_matching():
    """Verify RapidFuzz typo correction using taxonomy database."""
    service = SkillTaxonomyService.get_instance()

    assert service.lookup_skill("javascrpt")["canonical_name"] == "JavaScript"
    assert service.lookup_skill("dockr")["canonical_name"] == "Docker"
    assert service.lookup_skill("kubernets")["canonical_name"] == "Kubernetes"
    assert service.lookup_skill("fastapii")["canonical_name"] == "FastAPI"


# =========================================================================
# 2. THE FLYWHEEL QUEUE TESTS
# =========================================================================

def test_flywheel_unknown_skill_registration():
    """Verify unmapped skill automatically creates status='pending' record with occurrence_count=1."""
    service = SkillTaxonomyService.get_instance()
    unique_new_tool = "SuperCustomQuantumDB"

    record = service.record_unknown_skill(unique_new_tool, source="llm", context="Candidate built QuantumDB pipeline")
    assert record["status"] == "pending"
    assert record["canonical_name"] == unique_new_tool
    assert record["source"] == "llm"
    assert record["occurrence_count"] == 1
    assert record["taxonomy_version"] == TAXONOMY_VERSION

    # Calling again increments occurrence count
    record_again = service.record_unknown_skill(unique_new_tool, source="resume_parser")
    assert record_again["occurrence_count"] == 2


def test_flywheel_approval_and_rejection_lifecycle():
    """Verify pending skill promotion to approved and rejection."""
    service = SkillTaxonomyService.get_instance()
    pending_skill_name = "NewModernFrameworkX"
    pending = service.record_unknown_skill(pending_skill_name, source="llm")
    skill_id = pending["id"]

    # 1. Approve
    approved = service.approve_skill(skill_id, canonical_name="FrameworkX", category="framework", aliases=["frameworkx", "fwx"])
    assert approved is not None
    assert approved["status"] == "approved"
    assert approved["canonical_name"] == "FrameworkX"
    assert approved["category"] == "framework"
    assert "fwx" in approved["aliases"]

    # Now alias lookup works
    assert service.lookup_skill("fwx")["canonical_name"] == "FrameworkX"

    # 2. Reject another pending skill
    pending2 = service.record_unknown_skill("GarbageToken123", source="resume_parser")
    rejected = service.reject_skill(pending2["id"])
    assert rejected["status"] == "rejected"


def test_add_alias_to_canonical():
    """Verify adding an alias dynamically expands matching."""
    service = SkillTaxonomyService.get_instance()
    service.add_alias("Docker", "docker-ce")
    
    match = service.lookup_skill("docker-ce")
    assert match is not None
    assert match["canonical_name"] == "Docker"


# =========================================================================
# 3. SCHEMA & NORMALIZER INTEGRATION TESTS
# =========================================================================

def test_normalizers_integrated_with_taxonomy():
    """Verify normalizers.py uses TaxonomyService and stamps version."""
    assert normalize_skill("k8s") == "Kubernetes"
    assert normalize_skill("postgres") == "PostgreSQL"
    assert normalize_skill("c++") == "C++"

    taxonomy_obj = SkillsTaxonomy(core_languages=["py", "golang", "c#"])
    assert taxonomy_obj.core_languages == ["Python", "Go", "C#"]
    assert taxonomy_obj.taxonomy_version == TAXONOMY_VERSION


# =========================================================================
# 4. REST API ENDPOINT TESTS
# =========================================================================

def test_api_get_taxonomy_version():
    """Verify GET /api/v1/taxonomy/version."""
    response = client.get("/api/v1/taxonomy/version")
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == "2026.08.1"
    assert data["approved_count"] > 0
    assert "total_skills" in data


def test_api_list_taxonomy_skills():
    """Verify GET /api/v1/taxonomy/skills."""
    response = client.get("/api/v1/taxonomy/skills?category=language&status=approved")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert data["total"] > 0
    assert any(s["canonical_name"] == "Python" for s in data["items"])


def test_api_approve_and_reject_flywheel():
    """Verify PATCH /api/v1/taxonomy/skills/{id}/approve and reject."""
    service = SkillTaxonomyService.get_instance()
    pending = service.record_unknown_skill("HyperEngineDB", source="llm")
    skill_id = pending["id"]

    # Approve via API
    resp_approve = client.patch(
        f"/api/v1/taxonomy/skills/{skill_id}/approve",
        json={"canonical_name": "HyperEngine DB", "category": "database", "aliases": ["hyperengine"]}
    )
    assert resp_approve.status_code == 200
    assert resp_approve.json()["status"] == "approved"
    assert resp_approve.json()["canonical_name"] == "HyperEngine DB"

    # Reject via API
    pending2 = service.record_unknown_skill("BadParsedNoiseWord", source="resume_parser")
    resp_reject = client.patch(f"/api/v1/taxonomy/skills/{pending2['id']}/reject")
    assert resp_reject.status_code == 200
    assert resp_reject.json()["status"] == "rejected"
