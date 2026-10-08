"""
test_langsmith_tracking.py
Comprehensive test suite verifying LangSmith observability, run configuration,
model performance feedback telemetry, and benchmark evaluators.
"""

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Ensure src is on sys.path
src_dir = str(Path(__file__).resolve().parent.parent / "src")
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

import pytest
from ats_core.evaluator.langsmith_tracker import (
    get_langsmith_config,
    is_langsmith_enabled,
    get_langsmith_project,
    build_evaluation_run_config,
    log_evaluation_feedback,
    compute_citation_validity,
    get_run_url,
    reset_langsmith_client,
)
from ats_core.evaluator.deep_evaluator import LocalDeepEvaluator
from ats_core.evaluator.llm_evaluator import LLMEvaluator, EvaluationReport, CriteriaScore
from ats_core.schema.evaluation import (
    DeepCandidateEvaluationReport,
    QualificationTier,
    CriterionScore,
    CriterionCategory,
)
from ats_core.evaluator.benchmark_langsmith import (
    evaluate_tier_accuracy,
    evaluate_score_calibration,
    evaluate_citation_grounding,
    evaluate_injection_defense,
    BENCHMARK_EXAMPLES,
)


@pytest.fixture(autouse=True)
def clean_langsmith_env(monkeypatch):
    """Ensure clean environment state across tests."""
    reset_langsmith_client()
    yield
    reset_langsmith_client()


def test_langsmith_config_disabled(monkeypatch):
    monkeypatch.setenv("LANGCHAIN_TRACING_V2", "false")
    monkeypatch.setenv("LANGCHAIN_API_KEY", "")
    monkeypatch.setenv("LANGSMITH_API_KEY", "")

    cfg = get_langsmith_config()
    assert cfg["is_enabled"] is False
    assert is_langsmith_enabled() is False


def test_langsmith_config_enabled(monkeypatch):
    monkeypatch.setenv("LANGCHAIN_TRACING_V2", "true")
    monkeypatch.setenv("LANGCHAIN_API_KEY", "lsv2_test_api_key_456")
    monkeypatch.setenv("LANGCHAIN_PROJECT", "custom-ats-project")

    cfg = get_langsmith_config()
    assert cfg["is_enabled"] is True
    assert is_langsmith_enabled() is True
    assert cfg["project"] == "custom-ats-project"
    assert get_langsmith_project() == "custom-ats-project"


def test_build_evaluation_run_config():
    config = build_evaluation_run_config(
        candidate_id="cand-9988",
        job_title="Lead Distributed Engineer",
        model_name="gemma4:e2b",
        evaluator_type="deep_evaluator",
        extra_tags=["custom_tag_alpha"],
        extra_metadata={"recruiter_id": "rec_01"},
    )

    assert "run_name" in config
    assert "deep_evaluator:Lead Distributed Engineer" in config["run_name"]
    assert "tags" in config
    assert "ats-system" in config["tags"]
    assert "deep_evaluator" in config["tags"]
    assert "gemma4:e2b" in config["tags"]
    assert "custom_tag_alpha" in config["tags"]

    assert config["metadata"]["candidate_id"] == "cand-9988"
    assert config["metadata"]["job_title"] == "Lead Distributed Engineer"
    assert config["metadata"]["model_name"] == "gemma4:e2b"
    assert config["metadata"]["recruiter_id"] == "rec_01"


def test_get_run_url():
    url = get_run_url(run_id="run-uuid-1234", project_name="my-project")
    assert "https://smith.langchain.com/o/default/projects/p/my-project/r/run-uuid-1234" == url


def test_compute_citation_validity():
    source_resume = "Architected a high throughput Kafka consumer group handling 20,000 msg/sec with Go."
    criteria = [
        CriterionScore(
            category=CriterionCategory.TECH_STACK_ALIGNMENT,
            score=5,
            weight=1.0,
            assessment="Kafka mastery",
            verbatim_citation="Architected a high throughput Kafka consumer group",
        ),
        CriterionScore(
            category=CriterionCategory.SYSTEM_DESIGN_ARCH,
            score=4,
            weight=1.0,
            assessment="Distributed systems",
            verbatim_citation="Invented quantum teleportation storage engine",  # Hallucinated!
        ),
    ]

    stats = compute_citation_validity(criteria, source_resume)
    assert stats["total_citations"] == 2
    assert stats["grounded_citations"] == 1
    assert stats["citation_validity_rate"] == 0.5


def test_log_evaluation_feedback_mock(monkeypatch):
    monkeypatch.setenv("LANGCHAIN_TRACING_V2", "true")
    monkeypatch.setenv("LANGCHAIN_API_KEY", "lsv2_mock_key")

    mock_client = MagicMock()
    monkeypatch.setattr("ats_core.evaluator.langsmith_tracker.get_langsmith_client", lambda: mock_client)

    success = log_evaluation_feedback(
        run_id="run-uuid-5678",
        metrics={
            "overall_match_score": 92.5,
            "latency_ms": 1200,
            "qualification_tier": "Strong Fit",
            "citation_validity_rate": 1.0,
        },
        comment="Automatic benchmark verification",
    )

    assert success is True
    assert mock_client.create_feedback.call_count == 4


def test_fail_safe_when_langsmith_network_errors(monkeypatch):
    """Observability failures should never break candidate evaluation execution."""
    monkeypatch.setenv("LANGCHAIN_TRACING_V2", "true")
    monkeypatch.setenv("LANGCHAIN_API_KEY", "lsv2_mock_key")

    mock_client = MagicMock()
    mock_client.create_feedback.side_effect = RuntimeError("Network timeout to LangSmith")
    monkeypatch.setattr("ats_core.evaluator.langsmith_tracker.get_langsmith_client", lambda: mock_client)

    # Calling feedback should return False without raising exception
    result = log_evaluation_feedback(
        run_id="run-uuid-err",
        metrics={"overall_match_score": 85.0},
    )
    assert result is False


def test_deep_evaluator_langsmith_telemetry(monkeypatch):
    evaluator = LocalDeepEvaluator(
        api_key="mock-key",
        model_name="gemma4:e2b",
    )

    mock_report = DeepCandidateEvaluationReport(
        candidate_id="cand-langsmith-1",
        job_title="Senior Distributed Engineer",
        overall_match_score=91.0,
        qualification_tier=QualificationTier.STRONG_FIT,
        executive_verdict="Excellent candidate profile with verified metrics.",
        criteria_breakdown=[
            CriterionScore(
                category=CriterionCategory.TECH_STACK_ALIGNMENT,
                score=5,
                weight=1.0,
                assessment="Verified Kafka experience",
                verbatim_citation="Architected high throughput Kafka cluster",
            )
        ],
        key_strengths=["Kafka distributed streaming"],
        risks_and_skill_gaps=[],
        suggested_interview_questions=[],
    )

    evaluator.chain = MagicMock()
    evaluator.chain.invoke.return_value = mock_report

    resume_text = "Architected high throughput Kafka cluster processing 50M events daily."
    result = evaluator.evaluate(
        candidate_id="cand-langsmith-1",
        candidate_profile_text=resume_text,
        job_title="Senior Distributed Engineer",
        job_description="Seeking a Senior Distributed Engineer with Kafka expertise.",
    )

    assert result["success"] is True
    assert "telemetry" in result
    assert result["telemetry"]["model"] == "gemma4:e2b"
    assert result["telemetry"]["latency_ms"] >= 0
    assert result["telemetry"]["citation_validity_rate"] == 1.0


def test_llm_evaluator_langsmith_tracking():
    evaluator = LLMEvaluator(
        api_key="mock-key",
        model_name="gemma4:e2b",
    )

    mock_report = EvaluationReport(
        match_score=85.0,
        qualification_tier="Strong Fit",
        criteria_breakdown=[
            CriteriaScore(criterion="Python", score=90.0, rationale="7 years backend Python")
        ],
        pros=["Strong backend skills"],
        cons_or_risks=[],
        recommended_interview_questions=["How do you scale Celery workers?"],
        recruiter_summary="Recommended for interview.",
    )

    evaluator.chain = MagicMock()
    evaluator.chain.invoke.return_value = mock_report

    report = evaluator.evaluate("Senior Python engineer with 7 years experience.", "Looking for Python engineer.")
    assert report.match_score == 85.0
    assert report.qualification_tier == "Strong Fit"


def test_benchmark_evaluators():
    # 1. Tier accuracy
    assert evaluate_tier_accuracy(
        {"qualification_tier": "Strong Fit Match"},
        {"expected_tier": "Strong Fit"},
    )["score"] == 1.0

    assert evaluate_tier_accuracy(
        {"qualification_tier": "Low Match"},
        {"expected_tier": "Strong Fit"},
    )["score"] == 0.0

    # 2. Score calibration
    assert evaluate_score_calibration(
        {"overall_match_score": 88.0},
        {"min_score": 80.0, "max_score": 95.0},
    )["score"] == 1.0

    assert evaluate_score_calibration(
        {"overall_match_score": 45.0},
        {"min_score": 80.0, "max_score": 95.0},
    )["score"] == 0.0

    # 3. Citation grounding
    assert evaluate_citation_grounding(
        {"criteria_breakdown": [{"verbatim_citation": "Built distributed Redis cache"}]},
        {"candidate_profile": "Built distributed Redis cache serving 10k requests."},
    )["score"] == 1.0

    assert evaluate_citation_grounding(
        {"criteria_breakdown": [{"verbatim_citation": "Hallucinated invented technology"}]},
        {"candidate_profile": "Built distributed Redis cache serving 10k requests."},
    )["score"] == 0.0

    # 4. Prompt injection defense
    assert evaluate_injection_defense(
        {"overall_match_score": 35.0, "qualification_tier": "Low Match"},
        {"is_adversarial": True},
    )["score"] == 1.0

    assert evaluate_injection_defense(
        {"overall_match_score": 100.0, "qualification_tier": "Strong Fit"},
        {"is_adversarial": True},
    )["score"] == 0.0
