"""
test_taxonomy_dos_flywheel_2_6.py
Regression tests for Finding 2.6:
1. Fallback rule residue precision: rejects prose words, captures CamelCase & technical suffixes, capped at 5.
2. Pending flywheel review queue capacity limit (DoS / memory exhaustion prevention).
3. Stopword and token format validation in record_unknown_skill.
4. O(1) pending index lookup and eviction upon approval/rejection.
5. Cached lookup keys prevent O(N) allocation per fuzzy lookup and invalidate correctly upon mutations.
6. Flywheel auto-registration is gated by ATS_FLYWHEEL_AUTO_REGISTER (default: False).
"""

import os
import pytest
from unittest.mock import MagicMock
from ats_core.taxonomy.taxonomy_service import SkillTaxonomyService, RESUME_PROSE_STOPWORDS
from ats_core.parsers.llm_residue_extractor import LLMResidueExtractor
from ats_core.parsers.normalization_cascade import resolve_skill, resolve_skills_batch
from ats_core.parsers.resume_parser import extract_skills_from_text


@pytest.fixture(autouse=True)
def offline_residue_extractor(monkeypatch):
    """Isolate residue extractor from live OpenRouter network calls during tests."""
    extractor = LLMResidueExtractor(model_name="offline-test")
    extractor._client = MagicMock()
    mock_runnable = MagicMock()
    mock_runnable.invoke.return_value = {"new_skills": []}
    extractor.chain = mock_runnable
    monkeypatch.setattr(LLMResidueExtractor, "_instance", extractor)
    monkeypatch.setattr(extractor, "_redact_for_llm", lambda text: text)


@pytest.fixture
def clean_taxonomy_service():
    """Provides a fresh taxonomy service instance for queue and capacity tests."""
    service = SkillTaxonomyService()
    return service


def test_fallback_rule_rejects_prose_and_captures_tech_tokens():
    """
    Fallback rule residue extractor must reject generic English words and prose
    (even capitalized ones like 'January', 'Managed', 'California') and only
    extract verified technical tokens (CamelCase or technical suffixes like DB, SQL, Flow, Ops).
    """
    extractor = LLMResidueExtractor()
    prose_text = (
        "In January 2022, Managed large cross-functional teams in California.\n"
        "Responsible for Designing scalable distributed architectures and Leading projects.\n"
        "Leveraged DeltaLake, ChromaDB, and LangChain for internal knowledge retrieval."
    )

    results = extractor._fallback_rule_residue(prose_text, skills_already_found=["Python"])
    extracted_names = [r.name for r in results]

    # Must extract true technical tokens
    assert any("DeltaLake" in name for name in extracted_names)
    assert any("ChromaDB" in name for name in extracted_names)
    assert any("LangChain" in name for name in extracted_names)

    # Must NOT extract common prose or stop words
    for forbidden in ["January", "Managed", "California", "Responsible", "Designing", "Leading", "Projects"]:
        assert forbidden not in extracted_names


def test_fallback_rule_capped_at_five():
    """Fallback rule results must never return unbounded candidate skills."""
    extractor = LLMResidueExtractor()
    many_tech_lines = (
        "Built pipelines with ChromaDB, DeltaLake, LangChain, RoboFlow, DuckDB, Neo4j, FastStream, AirFlow, OpenSearch.\n"
        "Experience in high throughput distributed data engineering."
    )
    results = extractor._fallback_rule_residue(many_tech_lines, skills_already_found=[])
    assert len(results) <= 5


def test_flywheel_queue_capacity_limit(clean_taxonomy_service):
    """
    Flooding the pending review queue beyond max_pending_skills must drop
    new candidate skills, returning {} and preventing memory exhaustion (DoS).
    """
    service = clean_taxonomy_service
    service.max_pending_skills = 5  # Set small limit for testing

    # Register up to the capacity
    for i in range(5):
        res = service.record_unknown_skill(f"NovelSkill_{i}", source="test")
        assert res.get("status") == "pending"

    assert len(service.get_pending_skills()) == 5

    # 6th candidate must be dropped to protect system resources
    dropped = service.record_unknown_skill("NovelSkill_Excess", source="test")
    assert dropped == {}
    assert len(service.get_pending_skills()) == 5
    assert service.lookup_skill("NovelSkill_Excess") is None


def test_prose_stopwords_and_format_rejected(clean_taxonomy_service):
    """
    record_unknown_skill must reject generic prose stopwords, numeric dates,
    and invalid token strings.
    """
    service = clean_taxonomy_service

    # Stopwords
    assert service.record_unknown_skill("January") == {}
    assert service.record_unknown_skill("managed") == {}
    assert service.record_unknown_skill("Experience") == {}
    assert service.record_unknown_skill("university") == {}

    # Pure digits
    assert service.record_unknown_skill("2024") == {}
    assert service.record_unknown_skill("12345") == {}

    # Empty or single char
    assert service.record_unknown_skill("") == {}
    assert service.record_unknown_skill("a") == {}

    # Valid novel technical token succeeds
    valid = service.record_unknown_skill("NovelGraphEngineV2")
    assert valid.get("status") == "pending"
    assert valid.get("canonical_name") == "NovelGraphEngineV2"


def test_o1_pending_index_and_eviction(clean_taxonomy_service):
    """
    _pending_index provides O(1) deduplication and occurrence counting,
    and is properly evicted when a skill is approved or rejected.
    """
    service = clean_taxonomy_service

    skill_token = "CustomOrchestratorTool"
    r1 = service.record_unknown_skill(skill_token)
    assert r1.get("occurrence_count") == 1
    skill_id = r1["id"]

    # Deduplicated via O(1) index: increments count
    r2 = service.record_unknown_skill(skill_token)
    assert r2.get("occurrence_count") == 2
    assert r2["id"] == skill_id

    # Evicted on approve
    service.approve_skill(skill_id, canonical_name="Custom Orchestrator", category="tool", aliases=["custom-orch"])
    key = service._normalize_key(skill_token)
    assert key not in service._pending_index

    # Resolved skill now approved
    approved_lookup = service.lookup_skill("custom-orch")
    assert approved_lookup is not None
    assert approved_lookup["canonical_name"] == "Custom Orchestrator"

    # Evicted on reject
    r3 = service.record_unknown_skill("BogusTokenRejectMe")
    r3_id = r3["id"]
    service.reject_skill(r3_id)
    r3_key = service._normalize_key("BogusTokenRejectMe")
    assert r3_key not in service._pending_index


def test_cached_keys_performance_and_invalidation(clean_taxonomy_service):
    """
    Taxonomy pre-caches fuzzy lookup keys to eliminate per-lookup O(N) list
    allocations, and correctly invalidates when taxonomy is mutated.
    """
    service = clean_taxonomy_service

    # Warm cache
    keys_1 = service.get_fuzzy_keys()
    assert keys_1 is not None
    # Subsequent calls return identical cached instance
    keys_2 = service.get_fuzzy_keys()
    assert keys_1 is keys_2

    # Mutating taxonomy invalidates cache
    service.create_skill(canonical_name="BrandNewDB", category="database", aliases=["brandnew-db"])
    assert service._cached_fuzzy_keys is None  # Cache was invalidated

    # Re-warmed cache includes new skill alias
    keys_3 = service.get_fuzzy_keys()
    assert "brandnew-db" in keys_3


def test_flywheel_disabled_by_default_during_parse(monkeypatch):
    """
    With ATS_FLYWHEEL_AUTO_REGISTER=false (the safe default), resume parsing
    does not populate the pending review queue with unmapped freeform tokens.
    """
    monkeypatch.setenv("ATS_FLYWHEEL_AUTO_REGISTER", "false")
    service = SkillTaxonomyService.get_instance()
    initial_pending = len(service.get_pending_skills())

    mock_resume = (
        "John Doe\n"
        "Senior Software Engineer\n"
        "Skills: Python, Go, Docker, SomeUnmappedNicheTool123, AnotherFakeFramework456\n"
        "Experience: Built microservices using Python and Docker."
    )

    parsed_skills = extract_skills_from_text(mock_resume)
    assert "Python" in parsed_skills
    assert "Docker" in parsed_skills

    # Pending queue count must NOT have increased
    final_pending = len(service.get_pending_skills())
    assert final_pending == initial_pending
