"""Screening decisions must come from the model, survive persistence, and fail closed."""

from unittest.mock import Mock
from uuid import uuid4

import pytest
from pydantic import ValidationError

from ats_core.ai_api import evaluation, worker
from ats_core.ai_api.contracts import AIResult
from ats_core.ai_api.evaluation import FastScoringReport
from ats_core.evaluator.deep_evaluator import LocalDeepEvaluator, SYSTEM_EVALUATION_MESSAGE
from ats_core.schema.evaluation import DeepCandidateEvaluationReport


def model_report(**changes):
    return {
        "overall_match_score": 85,
        "screening_decision": "REJECT",
        "decision_explanation": "The job requires production Rust ownership. The resume describes Python APIs but does not demonstrate that essential requirement.",
        "executive_verdict": "Essential Rust ownership is not demonstrated.",
        "criteria_breakdown": [{"category": "Tech Stack Alignment", "score": 4,
                                "assessment": "Python APIs are demonstrated.",
                                "verbatim_citation": "Built Python APIs."}],
        **changes,
    }


def payload():
    return {"attempt_id": str(uuid4()), "document_id": str(uuid4()),
            "document_version": 1, "input_revision": 1, "job_revision": 1,
            "candidate_id": str(uuid4()), "operation": "evaluate",
            "profile": {"core_skills": ["Python"]}, "sanitized_text": "Built Python APIs.",
            "job": {"title": "Rust engineer", "job_description": "Production Rust ownership"}}


@pytest.mark.parametrize("decision,score", [("ACCEPT", 45), ("REJECT", 85), ("REVIEW", 90)])
def test_model_decision_survives_evaluator_and_worker_independently_of_score(monkeypatch, decision, score):
    model = LocalDeepEvaluator(api_key="test-key", base_url="https://openrouter.ai/api/v1")
    model.chain = Mock()
    model.chain.invoke.return_value = FastScoringReport.model_validate(
        model_report(screening_decision=decision, overall_match_score=score))
    monkeypatch.setattr(evaluation, "evaluator", lambda: model)
    monkeypatch.setenv("ATS_AI_ENABLE_LLM", "true")
    saved = worker.compute_result(payload(), None)
    assert saved.evaluation_status == "COMPLETED"
    assert saved.scorecard["screening_decision"] == decision
    assert saved.scorecard["overall_match_score"] == score
    assert saved.scorecard["decision_explanation"] == model_report()["decision_explanation"]
    assert saved.scorecard["model_version"] == model.model_name
    assert saved.scorecard["categories"][0]["quote"] == "Built Python APIs."
    assert saved.scorecard["evaluated_at"]
    assert AIResult.model_validate(saved.model_dump()).scorecard == saved.scorecard


@pytest.mark.parametrize("changes", [
    {"screening_decision": None}, {"screening_decision": "HIRED"},
    {"decision_explanation": "   "}, {"decision_explanation": None},
    {"overall_match_score": None}, {"overall_match_score": "invalid"},
    {"overall_match_score": float("nan")}, {"criteria_breakdown": []},
])
def test_model_schema_rejects_missing_or_invalid_outputs(changes):
    with pytest.raises(ValidationError):
        FastScoringReport.model_validate(model_report(**changes))


def test_worker_does_not_invent_reason_for_old_or_incomplete_report(monkeypatch):
    model = Mock()
    old = model_report()
    old.pop("screening_decision")
    old.pop("decision_explanation")
    model.evaluate.return_value = {"success": True, "report": DeepCandidateEvaluationReport.model_validate(old)}
    monkeypatch.setattr(evaluation, "evaluator", lambda: model)
    monkeypatch.setenv("ATS_AI_ENABLE_LLM", "true")
    outcome = worker.compute_result(payload(), None)
    assert outcome.evaluation_status == "FAILED"
    assert outcome.scorecard is None


def test_prompt_requires_job_related_explanation_and_uncertainty():
    model = LocalDeepEvaluator.__new__(LocalDeepEvaluator)
    prompt = model._build_evaluation_prompt("test", "Built Python APIs.", "Engineer", "Python APIs")
    assert "decision_explanation" in prompt and "screening_decision" in prompt
    assert "Missing resume evidence is not proof" in prompt
    assert "protected personal characteristics" in prompt
    assert "Strictly do NOT provide explanations" not in prompt
    assert "decision_explanation" in SYSTEM_EVALUATION_MESSAGE
    assert "numerical scores only" not in SYSTEM_EVALUATION_MESSAGE


def test_separate_job_requirements_are_included_in_model_input():
    context = worker.scoring_job_description({"job_description": "Build APIs.",
        "required_skills": ["Python", "PostgreSQL"], "min_years_experience": 3})
    assert "Build APIs." in context
    assert "Required skills: Python, PostgreSQL" in context
    assert "Minimum relevant experience: 3 years" in context
