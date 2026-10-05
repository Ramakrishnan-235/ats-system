import pytest
from unittest.mock import MagicMock, patch
from pydantic import BaseModel, Field

from ats_core.llm.client import get_llm_config, get_openrouter_chat_model, get_structured_llm
from ats_core.parsers.ollama_extractor import OllamaCandidateExtractor, LangChainCandidateExtractor
from ats_core.evaluator.deep_evaluator import LocalDeepEvaluator, LangChainDeepEvaluator
from ats_core.evaluator.llm_evaluator import LLMEvaluator, EvaluationReport
from ats_core.schema.candidate import CandidateProfile
from ats_core.schema.timeline import EmploymentTimeline
from ats_core.schema.skills import SkillsTaxonomy
from ats_core.schema.evaluation import DeepCandidateEvaluationReport, QualificationTier, CriterionScore, CriterionCategory


class DummySchema(BaseModel):
    summary: str = Field(description="Summary")


def test_get_llm_config_openrouter(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-v1-mock-test-key-12345")
    monkeypatch.setenv("LLM_BASE_URL", "https://openrouter.ai/api/v1")
    monkeypatch.setenv("LLM_MODEL", "nvidia/nemotron-3.5-lightning:free")

    config = get_llm_config()
    assert config["is_openrouter"] is True
    assert config["api_key"] == "sk-or-v1-mock-test-key-12345"
    assert config["base_url"] == "https://openrouter.ai/api/v1"
    assert config["model_name"] == "nvidia/nemotron-3.5-lightning:free"


def test_get_llm_config_ollama_fallback(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
    monkeypatch.setenv("OLLAMA_MODEL", "qwen3.5:2b")

    config = get_llm_config()
    assert config["is_openrouter"] is False
    assert config["api_key"] == "ollama"
    assert config["base_url"] == "http://localhost:11434/v1"
    assert config["model_name"] == "qwen3.5:2b"


def test_get_openrouter_chat_model(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-v1-mock-test-key-12345")
    monkeypatch.setenv("OPENROUTER_HTTP_REFERER", "http://localhost:3000")
    monkeypatch.setenv("OPENROUTER_APP_TITLE", "AI-Powered ATS")

    model = get_openrouter_chat_model(
        model_name="nvidia/nemotron-3.5-lightning:free",
        temperature=0.2,
    )
    assert model.model_name == "nvidia/nemotron-3.5-lightning:free"
    assert model.temperature == 0.2
    assert "openrouter.ai" in str(model.openai_api_base or getattr(model, "base_url", ""))
    assert model.default_headers.get("HTTP-Referer") == "http://localhost:3000"
    assert model.default_headers.get("X-Title") == "AI-Powered ATS"


def test_get_structured_llm():
    model = get_openrouter_chat_model(
        api_key="mock-key",
        base_url="https://openrouter.ai/api/v1",
        model_name="nvidia/nemotron-3.5-lightning:free",
    )
    structured_runnable = get_structured_llm(DummySchema, chat_model=model)
    assert hasattr(structured_runnable, "invoke")


def test_langchain_candidate_extractor_mock(monkeypatch):
    extractor = OllamaCandidateExtractor(
        api_key="mock-key",
        base_url="https://openrouter.ai/api/v1",
        model_name="nvidia/nemotron-3.5-lightning:free",
    )

    mock_profile = CandidateProfile(
        target_role_or_headline="Senior Distributed Systems Engineer",
        executive_summary="Expert in high-scale distributed systems and Python/Go microservices.",
        timeline=EmploymentTimeline(total_continuous_years=7.5, positions=[]),
        skills=SkillsTaxonomy(core_languages=["Python", "Go"], frameworks_and_tools=["FastAPI", "Docker"]),
    )

    # Mock the LangChain chain execution
    extractor.chain = MagicMock()
    extractor.chain.invoke.return_value = mock_profile

    result = extractor.extract_profile("Experienced Python engineer with 7 years building systems.")
    assert result.target_role_or_headline == "Senior Distributed Systems Engineer"
    assert result.timeline.total_continuous_years == 7.5
    assert "Python" in result.skills.core_languages
    extractor.chain.invoke.assert_called_once()


def test_langchain_deep_evaluator_mock():
    evaluator = LocalDeepEvaluator(
        api_key="mock-key",
        base_url="https://openrouter.ai/api/v1",
        model_name="nvidia/nemotron-3.5-lightning:free",
    )

    mock_report = DeepCandidateEvaluationReport(
        candidate_id="cand-langchain-101",
        job_title="Senior Python Architect",
        overall_match_score=88.5,
        qualification_tier=QualificationTier.STRONG_FIT,
        executive_verdict="Exceptional technical candidate with deep Python experience.",
        criteria_breakdown=[
            CriterionScore(
                category=CriterionCategory.TECH_STACK_ALIGNMENT,
                score=9,
                weight=1.0,
                assessment="Outstanding Python depth",
                verbatim_citation="Architected real-time streaming pipeline in Python",
            )
        ],
        key_strengths=["Deep Python expertise"],
        risks_and_skill_gaps=[],
        suggested_interview_questions=[],
    )

    evaluator.chain = MagicMock()
    evaluator.chain.invoke.return_value = mock_report

    resume_text = "Architected real-time streaming pipeline in Python with zero downtime."
    res = evaluator.evaluate(
        candidate_id="cand-langchain-101",
        candidate_profile_text=resume_text,
        job_title="Senior Python Architect",
        job_description="Seeking a Senior Python Architect to build streaming pipelines.",
    )

    assert res["success"] is True
    report = res["report"]
    assert report.candidate_id == "cand-langchain-101"
    assert report.overall_match_score == 88.5
    assert report.qualification_tier == QualificationTier.STRONG_FIT
    assert res["telemetry"]["model"] == "nvidia/nemotron-3.5-lightning:free"


def test_langchain_evaluator_mock():
    evaluator = LLMEvaluator(
        api_key="mock-key",
        base_url="https://openrouter.ai/api/v1",
        model_name="nvidia/nemotron-3.5-lightning:free",
    )

    mock_report = EvaluationReport(
        match_score=85.0,
        qualification_tier="Strong Fit",
        pros=["Strong Python skills"],
        cons_or_risks=[],
        recommended_interview_questions=["How do you handle GIL in Python?"],
        recruiter_summary="Recommended for interview.",
    )

    evaluator.chain = MagicMock()
    evaluator.chain.invoke.return_value = mock_report

    report = evaluator.evaluate(
        candidate_summary="Senior Python Developer with 6 years experience.",
        job_description="Python developer with FastAPI experience.",
    )
    assert report.match_score == 85.0
    assert report.qualification_tier == "Strong Fit"
    assert len(report.recommended_interview_questions) == 1
