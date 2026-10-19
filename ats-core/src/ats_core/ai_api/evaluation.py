"""Required model evidence for evaluations saved by the private worker."""

import json
import math
import os
import re
from functools import lru_cache

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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

    @field_validator("key_strengths", "risks_and_skill_gaps", "suggested_improvements", mode="before")
    @classmethod
    def normalize_text_lists(cls, value):
        # Some tool-call providers serialize bullet lists as strings. Preserve
        # their text without relaxing score/evidence validation or inventing data.
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
        score = data.get("overall_match_score") if isinstance(data, dict) else None
        if type(score) not in (float, int) or not math.isfinite(score):
            raise ValueError("Explicit finite overall score is required")
        return data


@lru_cache(maxsize=1)
def evaluator():
    from ats_core.evaluator.deep_evaluator import LocalDeepEvaluator
    from ats_core.llm.client import get_llm_config

    config = get_llm_config()
    is_cloud = config.get("is_openrouter", False) or "api.nvidia.com" in config.get("base_url", "")
    return LocalDeepEvaluator(
        report_schema=VerifiedReport,
        structured_method="function_calling" if is_cloud else "json_schema",
        max_retries=0,
        request_deadline=float(os.getenv("ATS_EVALUATION_TIMEOUT", "90")),
        model_options={
            "request_timeout": 180,
            # Leave room for the complete rubric, citations and interview questions.
            "max_tokens": 4096,
            **({"reasoning_effort": "none"} if not is_cloud else (
                {"extra_body": {"reasoning": {"enabled": False}}} if config.get("is_openrouter", False) else {}
            )),
        },
    )
