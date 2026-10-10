"""Required model evidence for evaluations saved by the private worker."""

import math
from functools import lru_cache

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ats_core.schema.evaluation import CriterionCategory, DeepCandidateEvaluationReport


class VerifiedCriterion(BaseModel):
    model_config = ConfigDict(use_enum_values=True)
    category: CriterionCategory
    score: int = Field(ge=1, le=5)
    assessment: str = Field(min_length=1)
    verbatim_citation: str | None = None
    citation_location: None = None

    @model_validator(mode="before")
    @classmethod
    def coerce_category_and_score(cls, data):
        if not isinstance(data, dict) or type(data.get("score")) is not int:
            raise ValueError("Explicit integer criterion scores are required")
        # PDF coordinates come from the document locator, never model predictions.
        return {**data, "citation_location": None}


class VerifiedReport(DeepCandidateEvaluationReport):
    overall_match_score: float = Field(ge=0, le=100)
    executive_verdict: str = Field(min_length=1)
    criteria_breakdown: list[VerifiedCriterion] = Field(min_length=1)

    @model_validator(mode="before")
    @classmethod
    def coerce_tier_and_scores(cls, data):
        score = data.get("overall_match_score") if isinstance(data, dict) else None
        if type(score) not in (float, int) or not math.isfinite(score):
            raise ValueError("Explicit finite overall score is required")
        return data


@lru_cache(maxsize=1)
def evaluator():
    from ats_core.evaluator.deep_evaluator import LocalDeepEvaluator
    from ats_core.llm.client import get_llm_config

    config = get_llm_config()
    return LocalDeepEvaluator(
        report_schema=VerifiedReport,
        structured_method="function_calling" if config["is_openrouter"] else "json_schema",
        max_retries=0,
        model_options={
            "request_timeout": 180,
            # Leave room for the complete rubric, citations and interview questions.
            "max_tokens": 4096,
            **({"reasoning_effort": "none"} if not config["is_openrouter"] else {
                "extra_body": {"reasoning": {"enabled": False}},
            }),
        },
    )
