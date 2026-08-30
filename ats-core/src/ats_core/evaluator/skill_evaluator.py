"""
skill_evaluator.py
Deterministic Skill Requirements & Compliance Evaluator.

Consumes the Structured Scoring Engine Matrix from Step 8 to evaluate required skill coverage,
production tenure compliance, staleness, and evidence quality with complete auditability.
"""

import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("ats.evaluator.skill")


def evaluate_candidate_skills_coverage(
    skill_matrix: Dict[str, Dict[str, Any]],
    required_skills: List[str],
    min_years_experience: float = 0.0,
    max_stale_months: int = 36
) -> Dict[str, Any]:
    """
    Evaluates candidate's aggregated skill matrix against job requisition requirements.
    
    Computes:
    - required_skills_matched: count of required skills present
    - total_required: total count of required skills
    - coverage_ratio: matched / total
    - breakdown: list of detailed compliance items with human-readable explanations
    - overall_skill_score: calibrated 0-100 score based on coverage, depth, and evidence tier
    """
    if not required_skills:
        return {
            "coverage_ratio": 1.0,
            "overall_skill_score": 90.0,
            "matched_count": 0,
            "total_required": 0,
            "breakdown": [],
            "missing_skills": [],
            "stale_skills": [],
        }

    breakdown: List[Dict[str, Any]] = []
    missing_skills: List[str] = []
    stale_skills: List[str] = []
    total_coverage_weight = 0.0

    TIER_SCORE_MAP = {
        "demonstrated_impact": 1.0,
        "demonstrated": 0.9,
        "contextual": 0.75,
        "skills_bar": 0.6,
        "summary": 0.5,
        "education": 0.4,
        "certified": 0.85,
    }

    for req in required_skills:
        req_clean = req.strip()
        req_lower = req_clean.lower()

        # Check in matrix
        stat = skill_matrix.get(req_lower)
        if not stat:
            # Check for partial key match
            stat = next((v for k, v in skill_matrix.items() if req_lower in k or k in req_lower), None)

        if stat:
            years = stat.get("years", 0.0)
            is_current = stat.get("current", False)
            months_stale = stat.get("months_since_last_use")
            evidence = stat.get("evidence", "skills_bar")
            is_cert = stat.get("certified", False)

            is_stale = (months_stale is not None and months_stale > max_stale_months)
            if is_stale:
                stale_skills.append(req_clean)

            # Base score for this skill
            base_tier_mult = TIER_SCORE_MAP.get(evidence, 0.6)
            if is_cert:
                base_tier_mult = min(1.0, base_tier_mult + 0.1)

            # Tenure multiplier
            tenure_mult = 1.0
            if min_years_experience > 0:
                if years >= min_years_experience:
                    tenure_mult = 1.0
                elif years > 0:
                    tenure_mult = max(0.5, years / min_years_experience)
                else:
                    tenure_mult = 0.6

            # Staleness penalty
            staleness_mult = 0.75 if is_stale else 1.0

            skill_score = base_tier_mult * tenure_mult * staleness_mult
            total_coverage_weight += skill_score

            status_str = "Current" if is_current else (f"Stale ({months_stale}m ago)" if is_stale else f"Last used {stat.get('months_since_last_use', 'recent')}m ago")

            breakdown.append({
                "skill": req_clean,
                "status": "MATCHED",
                "years_experience": years,
                "is_current": is_current,
                "is_stale": is_stale,
                "is_certified": is_cert,
                "evidence_tier": evidence,
                "weighted_score": stat.get("weighted", 1.0),
                "explanation": f"Meets requirement: {years} yrs ({status_str}), {evidence.replace('_', ' ')} across {stat.get('roles_count', 1)} role(s)",
            })
        else:
            missing_skills.append(req_clean)
            breakdown.append({
                "skill": req_clean,
                "status": "MISSING",
                "years_experience": 0.0,
                "is_current": False,
                "is_stale": False,
                "is_certified": False,
                "evidence_tier": "none",
                "weighted_score": 0.0,
                "explanation": f"Missing from candidate profile; no verified evidence found",
            })

    matched_count = len(required_skills) - len(missing_skills)
    coverage_ratio = round(matched_count / len(required_skills), 2)
    normalized_score = round((total_coverage_weight / len(required_skills)) * 100.0, 1)

    return {
        "coverage_ratio": coverage_ratio,
        "overall_skill_score": normalized_score,
        "matched_count": matched_count,
        "total_required": len(required_skills),
        "breakdown": breakdown,
        "missing_skills": missing_skills,
        "stale_skills": stale_skills,
    }
