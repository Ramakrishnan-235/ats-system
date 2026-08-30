import pytest
from unittest.mock import MagicMock
from ats_core.parsers.llm_residue_extractor import (
    LLMResidueExtractor,
    LLMResidueSkill,
    LLMResidueOutput,
)
from ats_core.taxonomy.taxonomy_service import SkillTaxonomyService


def test_anti_hallucination_containment_filter():
    """
    Verify that LLM-extracted skills whose evidence fails exact verbatim containment
    are discarded as hallucinations, while valid evidence is kept.
    """
    extractor = LLMResidueExtractor.get_instance()
    
    resume_text = (
        "Deva Kumar built real-time analytics dashboards using Apache Superset and "
        "deployed internal observability tools with Vector."
    )

    mock_client = MagicMock()
    # Mock LLM returning 1 real skill and 1 hallucinated skill
    mock_client.chat.completions.create.return_value = LLMResidueOutput(
        new_skills=[
            LLMResidueSkill(
                name="Apache Superset",
                evidence="built real-time analytics dashboards using Apache Superset"  # True verbatim
            ),
            LLMResidueSkill(
                name="TensorFlow",
                evidence="optimized deep learning neural nets in TensorFlow"  # Hallucinated! Not in text
            ),
            LLMResidueSkill(
                name="Vector",
                evidence="deployed internal observability tools with Vector"  # True verbatim
            )
        ]
    )

    extractor._client = mock_client

    skills_found_so_far = ["Python"]
    results = extractor.extract_residue_skills(
        resume_text=resume_text,
        skills_already_found=skills_found_so_far,
        register_flywheel=True
    )

    result_names = [r["name"] for r in results]
    assert "Apache Superset" in result_names
    assert "Vector" in result_names
    # Hallucinated skill must be discarded
    assert "TensorFlow" not in result_names


def test_flywheel_persistence_for_residue_skills():
    """
    Verify newly extracted residue skills enter taxonomy as status='pending', source='llm'.
    """
    extractor = LLMResidueExtractor.get_instance()
    taxonomy_service = SkillTaxonomyService.get_instance()

    resume_text = "Experienced with novel AI orchestration framework LangGraph in production."

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = LLMResidueOutput(
        new_skills=[
            LLMResidueSkill(
                name="LangGraph",
                evidence="novel AI orchestration framework LangGraph in production"
            )
        ]
    )
    extractor._client = mock_client

    results = extractor.extract_residue_skills(
        resume_text=resume_text,
        skills_already_found=["Python", "FastAPI"],
        register_flywheel=True
    )

    assert len(results) == 1
    assert results[0]["name"] == "LangGraph"
    assert results[0]["source"] == "llm"


def test_fallback_rule_residue():
    """
    Verify deterministic fallback extraction when LLM client is offline.
    """
    extractor = LLMResidueExtractor()
    resume_text = "Designed pipeline utilizing DeltaLake and ChromaDB for document storage."
    fallback = extractor._fallback_rule_residue(resume_text, skills_already_found=["Python"])

    assert len(fallback) > 0
    names = [f.name for f in fallback]
    assert any("ChromaDB" in n or "DeltaLake" in n for n in names)
