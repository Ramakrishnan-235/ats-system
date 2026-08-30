import pytest
from ats_core.evaluator.skill_evaluator import evaluate_candidate_skills_coverage


def test_evaluate_candidate_skills_coverage_complete():
    """
    Verify deterministic scoring evaluator matches requirements,
    detects missing/stale skills, and outputs human-readable compliance explanations.
    """
    skill_matrix = {
        "python": {
            "canonical_name": "Python",
            "years": 6.2,
            "months_of_use": 74,
            "current": True,
            "months_since_last_use": None,
            "evidence": "demonstrated_impact",
            "weighted": 11.4,
            "certified": False,
            "roles_count": 3,
            "explanation": "6.2 yrs (current), demonstrated impact across 3 role(s)"
        },
        "react": {
            "canonical_name": "React",
            "years": 1.5,
            "months_of_use": 18,
            "current": True,
            "months_since_last_use": None,
            "evidence": "contextual",
            "weighted": 2.6,
            "certified": False,
            "roles_count": 1,
            "explanation": "1.5 yrs (current), contextual across 1 role(s)"
        },
        "aws": {
            "canonical_name": "AWS",
            "years": 3.0,
            "months_of_use": 36,
            "current": False,
            "months_since_last_use": 41,  # > 36 months -> Stale
            "evidence": "demonstrated",
            "weighted": 4.8,
            "certified": True,
            "roles_count": 1,
            "explanation": "3.0 yrs (last used 2022-01), demonstrated across 1 role(s)"
        }
    }

    required_skills = ["Python", "AWS", "Kubernetes"]

    eval_result = evaluate_candidate_skills_coverage(
        skill_matrix=skill_matrix,
        required_skills=required_skills,
        min_years_experience=3.0,
        max_stale_months=36
    )

    assert eval_result["matched_count"] == 2
    assert eval_result["total_required"] == 3
    assert eval_result["coverage_ratio"] == 0.67
    assert "Kubernetes" in eval_result["missing_skills"]
    assert "AWS" in eval_result["stale_skills"]

    # Verify breakdown items
    breakdown_by_skill = {b["skill"]: b for b in eval_result["breakdown"]}
    assert breakdown_by_skill["Python"]["status"] == "MATCHED"
    assert breakdown_by_skill["Python"]["is_current"] is True
    assert breakdown_by_skill["Kubernetes"]["status"] == "MISSING"
