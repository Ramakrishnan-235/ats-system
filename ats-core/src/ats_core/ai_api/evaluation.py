"""Required model evidence for evaluations saved by the private worker."""

import json
import os
import re
from functools import lru_cache
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from ats_core.schema._normalization import normalization_input
from ats_core.schema.evaluation import (
    CriterionCategory, DecisionExplanation, DeepCandidateEvaluationReport,
    QualificationTier, ScreeningDecision,
)


class VerifiedCriterion(BaseModel):
    model_config = ConfigDict(use_enum_values=True)
    category: CriterionCategory = Field(description="The dimension being evaluated.")
    score: int = Field(ge=1, le=5, description="Rating from 1 to 5.")
    assessment: str = Field(default="Evaluated", min_length=1, description="One sentence explaining the score against the job requirements.")
    verbatim_citation: str | None = None
    citation_location: None = None

    @model_validator(mode="before")
    @classmethod
    def coerce_category_and_score(cls, data: Any) -> Any:
        data = normalization_input(cls, data)
        if not isinstance(data, dict):
            return data

        cat = data.get("category")
        if cat and cat not in [e.value for e in CriterionCategory]:
            cat_str = str(cat).lower()
            if "tech" in cat_str or "stack" in cat_str or "skill" in cat_str:
                data["category"] = CriterionCategory.TECH_STACK_ALIGNMENT.value
            elif "exp" in cat_str or "senior" in cat_str or "year" in cat_str:
                data["category"] = CriterionCategory.EXPERIENCE_SENIORITY.value
            elif "arch" in cat_str or "system" in cat_str or "design" in cat_str:
                data["category"] = CriterionCategory.SYSTEM_DESIGN_ARCH.value
            elif "impact" in cat_str or "quant" in cat_str or "metric" in cat_str:
                data["category"] = CriterionCategory.QUANTIFIED_IMPACT.value
            elif "domain" in cat_str or "indus" in cat_str or "know" in cat_str:
                data["category"] = CriterionCategory.DOMAIN_EXPERTISE.value
            else:
                data["category"] = CriterionCategory.TECH_STACK_ALIGNMENT.value

        score = data.get("score")
        if score is not None:
            try:
                data["score"] = max(1, min(5, int(score)))
            except (ValueError, TypeError):
                data["score"] = 3
        else:
            data["score"] = 3

        if not data.get("assessment"):
            data["assessment"] = "Evaluated"

        # PDF coordinates come from the document locator, never model predictions.
        return {**data, "citation_location": None}


class FastScoringReport(BaseModel):
    """Job-specific screening decision and reasons supplied by the configured LLM."""
    screening_decision: ScreeningDecision = Field(
        description="ACCEPT: proceed to screening; REJECT: clear job-related mismatch; REVIEW: insufficient or conflicting evidence. Choose from the resume and job, not a score threshold."
    )
    decision_explanation: DecisionExplanation = Field(
        description="2-4 sentences explaining why this candidate should be accepted, rejected, or reviewed for this job. Cite demonstrated requirements and decisive gaps; distinguish missing evidence from proven lack of ability."
    )
    overall_match_score: float = Field(strict=True, allow_inf_nan=False, ge=0.0, le=100.0, description="Overall match score from 0 to 100.")
    qualification_tier: QualificationTier = Field(
        default=QualificationTier.POTENTIAL_FIT,
        description="Strong Fit (80-100), Potential Fit (60-79), or Low Match (0-59)."
    )
    executive_verdict: str = Field(
        min_length=1,
        description="Brief 1-sentence verdict summarizing the score."
    )
    criteria_breakdown: list[VerifiedCriterion] = Field(
        min_length=1,
        description="Scores for the 5 evaluation criteria."
    )

    @model_validator(mode="before")
    @classmethod
    def coerce_tier_and_scores(cls, data: Any) -> Any:
        data = normalization_input(cls, data)
        if not isinstance(data, dict):
            return data
        tier = data.get("qualification_tier")
        if tier and tier not in [e.value for e in QualificationTier]:
            tier_str = str(tier).lower()
            if "strong" in tier_str or "high" in tier_str:
                data["qualification_tier"] = QualificationTier.STRONG_FIT.value
            elif "low" in tier_str or "poor" in tier_str or "reject" in tier_str:
                data["qualification_tier"] = QualificationTier.LOW_MATCH.value
            else:
                data["qualification_tier"] = QualificationTier.POTENTIAL_FIT.value

        return data


class VerifiedReport(DeepCandidateEvaluationReport):
    screening_decision: ScreeningDecision
    decision_explanation: DecisionExplanation
    overall_match_score: float = Field(strict=True, allow_inf_nan=False, ge=0, le=100)
    executive_verdict: str = Field(min_length=1)
    criteria_breakdown: list[VerifiedCriterion] = Field(min_length=1)

    @field_validator("key_strengths", "risks_and_skill_gaps", "suggested_improvements", mode="before")
    @classmethod
    def normalize_text_lists(cls, value):
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("["):
                try:
                    return json.loads(stripped)
                except json.JSONDecodeError:
                    pass
            return [re.sub(r"^\s*(?:[-*•]|\d+[.)])\s+", "", line).strip()
                    for line in stripped.splitlines() if line.strip()]
        return value

    @model_validator(mode="before")
    @classmethod
    def coerce_tier_and_scores(cls, data):
        # Preserve explicit model output; never fabricate a score on parse failure.
        return normalization_input(cls, data)


@lru_cache(maxsize=1)
def evaluator():
    from ats_core.evaluator.deep_evaluator import LocalDeepEvaluator
    from ats_core.llm.client import get_llm_config

    config = get_llm_config()
    is_cloud = config.get("is_openrouter", False) or "api.nvidia.com" in config.get("base_url", "")
    return LocalDeepEvaluator(
        report_schema=FastScoringReport,
        structured_method="function_calling" if is_cloud else "json_schema",
        max_retries=0,
        request_deadline=float(os.getenv("ATS_EVALUATION_TIMEOUT", "90")),
        model_options={
            "request_timeout": 180,
            # Bounded output token budget for rapid scoring without token waste
            "max_tokens": int(os.getenv("ATS_MAX_TOKENS", "4096")),
            **({"reasoning_effort": "none"} if not is_cloud else (
                {"extra_body": {"reasoning": {"enabled": False}}} if config.get("is_openrouter", False) else {}
            )),
        },
    )
