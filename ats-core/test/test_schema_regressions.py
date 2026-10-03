"""Offline regressions for parser aliases, evidence retention, and invalid scores."""

from copy import deepcopy

import pytest
from pydantic import ValidationError

from ats_core.schema.candidate import CertificationEntry, EducationEntry
from ats_core.schema.evaluation import (
    CitationBoundingBox,
    CriterionScore,
    DeepCandidateEvaluationReport,
    SuggestedInterviewQuestion,
)
from ats_core.schema.skills import ExtractedSkill, SkillsTaxonomy
from ats_core.schema.timeline import WorkExperience


def test_work_history_aliases_normalize_without_changing_source():
    source = {
        "company": "Example",
        "from": "May 2021",
        "to": "current",
        "type": "fully remote",
        "skills": ["js", "JavaScript", "k8s"],
    }
    original = deepcopy(source)
    role = WorkExperience.model_validate(source)
    assert role.start_date == "2021-05"
    assert role.end_date == "Present"
    assert role.is_current_role is True
    assert role.workplace_type == "Remote"
    assert role.primary_technologies == ["JavaScript", "Kubernetes"]
    assert source == original


def test_flat_skill_list_retains_evidence_and_metadata():
    source = [{
        "title": "k8s",
        "proficiency_level": "advanced engineer",
        "category": "Cloud & DevOps",
        "evidence": "Operated k8s clusters serving 10,000 users.",
        "estimated_years_experience": 4.0,
        "is_core_competency": True,
    }]
    original = deepcopy(source)
    skill = SkillsTaxonomy.model_validate(source).detailed_skills[0]
    assert skill.name == "Kubernetes"
    assert skill.proficiency == "Advanced"
    assert skill.category == "Cloud & DevOps"
    assert skill.context_evidence == source[0]["evidence"]
    assert skill.estimated_years_experience == 4.0
    assert skill.is_core_competency is True
    assert source == original


def test_canonical_fields_take_precedence_over_aliases():
    skill = ExtractedSkill.model_validate({"name": "Python", "title": "Java"})
    assert skill.name == "Python"
    role = WorkExperience.model_validate({"start_date": "May 2021", "from": "June 2020"})
    assert role.start_date == "2021-05"


@pytest.mark.parametrize("model,source,field,expected", [
    (EducationEntry, {"graduation_date": 2026}, "graduation_year", "2026"),
    (CertificationEntry, {"expires": 2028, "issued": 2024}, "expiration_date", "2028"),
    (ExtractedSkill, {"title": "js", "proficiency_level": "senior"}, "name", "JavaScript"),
    (CriterionScore, {"category": "seniority", "score": "4"}, "score", 4),
    (SuggestedInterviewQuestion, {"category": "risk", "question": "Explain this gap?"}, "category", "Gap / Risk Verification"),
    (DeepCandidateEvaluationReport, {"qualification_tier": "high", "overall_match_score": "92"}, "overall_match_score", 92.0),
])
def test_validators_preserve_input(model, source, field, expected):
    original = deepcopy(source)
    result = model.model_validate(source)
    assert getattr(result, field) == expected
    assert source == original


@pytest.mark.parametrize("score", [float("nan"), float("inf"), float("-inf"), "NaN", "Infinity"])
@pytest.mark.parametrize("model,field", [
    (DeepCandidateEvaluationReport, "overall_match_score"),
    (CriterionScore, "score"),
])
def test_nonfinite_evaluation_scores_are_rejected(model, field, score):
    with pytest.raises(ValidationError):
        model.model_validate({field: score})


@pytest.mark.parametrize("field,value", [("x", -1), ("y", 101), ("width", float("nan")), ("height", float("inf"))])
def test_invalid_pdf_highlight_coordinates_are_rejected(field, value):
    with pytest.raises(ValidationError):
        CitationBoundingBox.model_validate({field: value})
