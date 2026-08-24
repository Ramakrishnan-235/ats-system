import pytest
from ats_core.schema.evaluation import CriteriaWeights, CriteriaScoreMap
from ats_core.api.v1.jobs import (
    compute_composite_match_score,
    get_match_label,
    DEFAULT_CRITERIA_WEIGHTS,
    get_or_create_job_candidates,
    JOBS_STORE,
)


def test_criteria_weights_normalization():
    """Test that weights normalize to exact proportions summing to 1.0."""
    w = CriteriaWeights(
        technical_depth=45.0,
        system_design=35.0,
        experience_seniority=10.0,
        leadership_culture=5.0,
        domain_expertise=5.0,
    )
    proportions = w.normalize_proportions()
    assert sum(proportions.values()) == pytest.approx(1.0, 0.001)
    assert proportions["technical_depth"] == pytest.approx(0.45, 0.001)
    assert proportions["system_design"] == pytest.approx(0.35, 0.001)


def test_composite_score_shifts_based_on_weights():
    """
    Test that candidate with high technical depth but low domain expertise
    scores significantly higher under a Tech-Heavy rubric than a Domain-Heavy rubric.
    """
    # Candidate A: Heavy Coder / Tech Wizard (Tech: 98, System: 95, Exp: 70, Lead: 60, Domain: 50)
    scores_tech_heavy = {
        "technical_depth": 98.0,
        "system_design": 95.0,
        "experience_seniority": 70.0,
        "leadership_culture": 60.0,
        "domain_expertise": 50.0,
    }

    # Candidate B: Domain Specialist / Veteran (Tech: 75, System: 70, Exp: 95, Lead: 85, Domain: 98)
    scores_domain_heavy = {
        "technical_depth": 75.0,
        "system_design": 70.0,
        "experience_seniority": 95.0,
        "leadership_culture": 85.0,
        "domain_expertise": 98.0,
    }

    tech_weights = {
        "technical_depth": 50.0,
        "system_design": 30.0,
        "experience_seniority": 10.0,
        "leadership_culture": 5.0,
        "domain_expertise": 5.0,
    }

    domain_weights = {
        "technical_depth": 15.0,
        "system_design": 10.0,
        "experience_seniority": 25.0,
        "leadership_culture": 10.0,
        "domain_expertise": 40.0,
    }

    # Under tech weights: Candidate A must beat Candidate B
    score_a_tech = compute_composite_match_score(scores_tech_heavy, tech_weights)
    score_b_tech = compute_composite_match_score(scores_domain_heavy, tech_weights)
    assert score_a_tech > score_b_tech
    assert score_a_tech >= 90.0

    # Under domain weights: Candidate B must beat Candidate A
    score_a_domain = compute_composite_match_score(scores_tech_heavy, domain_weights)
    score_b_domain = compute_composite_match_score(scores_domain_heavy, domain_weights)
    assert score_b_domain > score_a_domain
    assert score_b_domain >= 88.0


def test_match_labels():
    """Verify tier assignment boundaries."""
    assert get_match_label(96.5) == "Top Match"
    assert get_match_label(90.0) == "Strong Match"
    assert get_match_label(84.0) == "Match"
    assert get_match_label(72.0) == "Potential Match"
    assert get_match_label(50.0) == "Low Match"


def test_job_candidate_pool_has_criteria_scores():
    """Verify job candidate store generates rich 5-factor criteriaScores."""
    candidates = get_or_create_job_candidates("job-001")
    assert len(candidates) >= 5
    for c in candidates:
        assert "criteriaScores" in c
        scores = c["criteriaScores"]
        assert "technical_depth" in scores
        assert "system_design" in scores
        assert "experience_seniority" in scores
        assert "leadership_culture" in scores
        assert "domain_expertise" in scores
        assert 0 <= scores["technical_depth"] <= 100
        assert "rank" in c
        assert "rankDelta" in c
