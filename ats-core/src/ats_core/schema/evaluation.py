from enum import Enum
from typing import List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict, model_validator


class QualificationTier(str, Enum):
    STRONG_FIT = "Strong Fit"        # 80 - 100: Meets all hard criteria & core stack
    POTENTIAL_FIT = "Potential Fit"  # 60 - 79: Meets most criteria, slight skill/domain gaps
    LOW_MATCH = "Low Match"          # 0 - 59: Missing essential prerequisites or seniority


class CriterionCategory(str, Enum):
    TECH_STACK_ALIGNMENT = "Tech Stack Alignment"
    EXPERIENCE_SENIORITY = "Experience & Seniority Level"
    SYSTEM_DESIGN_ARCH = "Architecture & Systems Depth"
    QUANTIFIED_IMPACT = "Quantified Impact & Scope"
    DOMAIN_EXPERTISE = "Domain / Industry Knowledge"


class CriterionScore(BaseModel):
    category: CriterionCategory = Field(
        default=CriterionCategory.TECH_STACK_ALIGNMENT,
        description="The dimension being evaluated."
    )
    score: int = Field(
        default=3,
        ge=1, le=5,
        description="Rating from 1 (poor/missing) to 5 (exceptional/exceeds requirements)."
    )
    weight: float = Field(
        default=1.0, ge=0.5, le=2.0,
        description="Importance multiplier for this criterion (1.0 = standard, 1.5 = critical)."
    )
    assessment: str = Field(
        default="",
        description="Concise justification explaining why this score was assigned."
    )
    verbatim_citation: Optional[str] = Field(
        default=None,
        description="Exact quote or phrase from the resume proving this assessment."
    )

    model_config = ConfigDict(use_enum_values=True, populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def coerce_category_and_score(cls, data: Any) -> Any:
        if isinstance(data, dict):
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
                    s_int = int(score)
                    data["score"] = max(1, min(5, s_int))
                except (ValueError, TypeError):
                    data["score"] = 3
        return data


class QuestionCategory(str, Enum):
    TECHNICAL_DEEP_DIVE = "Technical Deep Dive"
    ARCHITECTURE_SYSTEM_DESIGN = "Architecture & System Design"
    GAP_VERIFICATION = "Gap / Risk Verification"
    BEHAVIORAL_LEADERSHIP = "Behavioral & Leadership"


class SuggestedInterviewQuestion(BaseModel):
    category: QuestionCategory = Field(
        default=QuestionCategory.TECHNICAL_DEEP_DIVE,
        description="The focus area of the question."
    )
    question: str = Field(description="The exact question the interviewer should ask.")
    target_competency: str = Field(
        default="Technical Competency",
        description="The specific skill, claim, or gap being tested."
    )
    expected_positive_signal: str = Field(
        default="Candidate explains architectural trade-offs with concrete examples.",
        description="What a strong candidate response should cover."
    )

    model_config = ConfigDict(use_enum_values=True, populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def coerce_question_category(cls, data: Any) -> Any:
        if isinstance(data, dict):
            cat = data.get("category")
            if cat and cat not in [e.value for e in QuestionCategory]:
                cat_str = str(cat).lower()
                if "tech" in cat_str or "code" in cat_str:
                    data["category"] = QuestionCategory.TECHNICAL_DEEP_DIVE.value
                elif "arch" in cat_str or "sys" in cat_str or "design" in cat_str:
                    data["category"] = QuestionCategory.ARCHITECTURE_SYSTEM_DESIGN.value
                elif "gap" in cat_str or "risk" in cat_str:
                    data["category"] = QuestionCategory.GAP_VERIFICATION.value
                elif "behav" in cat_str or "lead" in cat_str:
                    data["category"] = QuestionCategory.BEHAVIORAL_LEADERSHIP.value
                else:
                    data["category"] = QuestionCategory.TECHNICAL_DEEP_DIVE.value
        return data


class DeepCandidateEvaluationReport(BaseModel):
    """Structured master evaluation report produced by the LLM."""
    candidate_id: str = Field(default="", description="Identifier of the evaluated candidate.")
    job_title: str = Field(default="", description="Target role title.")
    overall_match_score: float = Field(
        default=50.0,
        ge=0.0, le=100.0,
        description="Weighted composite score out of 100 based on all evaluation dimensions."
    )
    qualification_tier: QualificationTier = Field(
        default=QualificationTier.POTENTIAL_FIT,
        description="Categorical readiness tier for recruiter sorting."
    )
    executive_verdict: str = Field(
        default="",
        description="2-3 sentence hiring committee summary evaluating technical fit, level, and growth potential."
    )
    criteria_breakdown: List[CriterionScore] = Field(
        default_factory=list,
        description="Multi-factor evaluation dimensions with evidence citations."
    )
    key_strengths: List[str] = Field(
        default_factory=list,
        description="Bullet points detailing verifiable candidate strengths relative to the JD."
    )
    risks_and_skill_gaps: List[str] = Field(
        default_factory=list,
        description="Potential risks, unverified claims, missing tools, or experience deficits."
    )
    suggested_interview_questions: List[SuggestedInterviewQuestion] = Field(
        default_factory=list,
        description="Tailored technical and gap-investigation questions for the hiring team."
    )

    model_config = ConfigDict(use_enum_values=True, populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def coerce_tier_and_scores(cls, data: Any) -> Any:
        if isinstance(data, dict):
            tier = data.get("qualification_tier")
            if tier and tier not in [e.value for e in QualificationTier]:
                tier_str = str(tier).lower()
                if "strong" in tier_str or "high" in tier_str:
                    data["qualification_tier"] = QualificationTier.STRONG_FIT.value
                elif "low" in tier_str or "poor" in tier_str or "reject" in tier_str:
                    data["qualification_tier"] = QualificationTier.LOW_MATCH.value
                else:
                    data["qualification_tier"] = QualificationTier.POTENTIAL_FIT.value

            score = data.get("overall_match_score")
            if score is not None:
                try:
                    s_flt = float(score)
                    data["overall_match_score"] = max(0.0, min(100.0, s_flt))
                except (ValueError, TypeError):
                    data["overall_match_score"] = 50.0
        return data
