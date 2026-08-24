from enum import Enum
from typing import List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict, model_validator


class QualificationTier(str, Enum):
    STRONG_FIT = "Strong Fit"        # 80 - 100: Meets all hard criteria & core stack
    POTENTIAL_FIT = "Potential Fit"  # 60 - 79: Meets most criteria, slight skill/domain gaps
    LOW_MATCH = "Low Match"          # 0 - 59: Missing essential prerequisites or seniority


class CriterionCategory(str, Enum):
    TECHNICAL_DEPTH = "Technical Depth & Skills"
    SYSTEM_DESIGN = "Architecture & System Design"
    EXPERIENCE_SENIORITY = "Experience & Seniority Level"
    LEADERSHIP_CULTURE = "Leadership & Communication"
    DOMAIN_EXPERTISE = "Domain / Industry Knowledge"

    # Backward compatibility aliases
    TECH_STACK_ALIGNMENT = "Technical Depth & Skills"
    SYSTEM_DESIGN_ARCH = "Architecture & System Design"
    QUANTIFIED_IMPACT = "Leadership & Communication"


class CriteriaWeights(BaseModel):
    technical_depth: float = Field(default=30.0, ge=0.0, le=100.0, description="Weight % for Technical Depth & Skills")
    system_design: float = Field(default=25.0, ge=0.0, le=100.0, description="Weight % for Architecture & System Design")
    experience_seniority: float = Field(default=20.0, ge=0.0, le=100.0, description="Weight % for Experience & Seniority")
    leadership_culture: float = Field(default=15.0, ge=0.0, le=100.0, description="Weight % for Leadership & Communication")
    domain_expertise: float = Field(default=10.0, ge=0.0, le=100.0, description="Weight % for Domain & Industry Knowledge")

    model_config = ConfigDict(populate_by_name=True)

    def normalize_proportions(self) -> dict:
        """Returns normalized weight fractions summing to 1.0."""
        total = (
            self.technical_depth
            + self.system_design
            + self.experience_seniority
            + self.leadership_culture
            + self.domain_expertise
        )
        if total <= 0:
            return {
                "technical_depth": 0.30,
                "system_design": 0.25,
                "experience_seniority": 0.20,
                "leadership_culture": 0.15,
                "domain_expertise": 0.10,
            }
        return {
            "technical_depth": self.technical_depth / total,
            "system_design": self.system_design / total,
            "experience_seniority": self.experience_seniority / total,
            "leadership_culture": self.leadership_culture / total,
            "domain_expertise": self.domain_expertise / total,
        }


class CriteriaScoreMap(BaseModel):
    technical_depth: float = Field(default=85.0, ge=0.0, le=100.0)
    system_design: float = Field(default=80.0, ge=0.0, le=100.0)
    experience_seniority: float = Field(default=80.0, ge=0.0, le=100.0)
    leadership_culture: float = Field(default=75.0, ge=0.0, le=100.0)
    domain_expertise: float = Field(default=80.0, ge=0.0, le=100.0)

    model_config = ConfigDict(populate_by_name=True)

    def compute_composite_score(self, weights: Optional[CriteriaWeights] = None) -> float:
        """Computes weighted composite score (0-100) using the given weights."""
        w = weights or CriteriaWeights()
        proportions = w.normalize_proportions()
        composite = (
            self.technical_depth * proportions["technical_depth"]
            + self.system_design * proportions["system_design"]
            + self.experience_seniority * proportions["experience_seniority"]
            + self.leadership_culture * proportions["leadership_culture"]
            + self.domain_expertise * proportions["domain_expertise"]
        )
        return round(max(0.0, min(100.0, composite)), 1)


class CriterionScore(BaseModel):
    category: CriterionCategory = Field(
        default=CriterionCategory.TECHNICAL_DEPTH,
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
                if "domain" in cat_str or "indus" in cat_str or "know" in cat_str or "vertical" in cat_str or "fintech" in cat_str or "health" in cat_str or "biotech" in cat_str:
                    data["category"] = CriterionCategory.DOMAIN_EXPERTISE.value
                elif "lead" in cat_str or "culture" in cat_str or "communicat" in cat_str or "impact" in cat_str or "quant" in cat_str or "behav" in cat_str or "mentor" in cat_str:
                    data["category"] = CriterionCategory.LEADERSHIP_CULTURE.value
                elif "arch" in cat_str or "system" in cat_str or "design" in cat_str or "topology" in cat_str or "infra" in cat_str:
                    data["category"] = CriterionCategory.SYSTEM_DESIGN.value
                elif "exp" in cat_str or "senior" in cat_str or "year" in cat_str or "track" in cat_str:
                    data["category"] = CriterionCategory.EXPERIENCE_SENIORITY.value
                elif "tech" in cat_str or "stack" in cat_str or "skill" in cat_str or "code" in cat_str or "coding" in cat_str:
                    data["category"] = CriterionCategory.TECHNICAL_DEPTH.value
                else:
                    data["category"] = CriterionCategory.TECHNICAL_DEPTH.value

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
    suggested_improvements: List[str] = Field(
        default_factory=list,
        description="Actionable recommendations on what the candidate needs to improve for this specific job role based on their resume info and skill gaps."
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

    def extract_criteria_scores(self) -> CriteriaScoreMap:
        """Extracts normalized 0-100 scores across all 5 standard dimensions from the evaluation breakdown."""
        scores = {
            "technical_depth": 80.0,
            "system_design": 80.0,
            "experience_seniority": 80.0,
            "leadership_culture": 75.0,
            "domain_expertise": 80.0,
        }
        for c in self.criteria_breakdown:
            cat_val = c.category if isinstance(c.category, str) else getattr(c.category, "value", str(c.category))
            norm_score = float(c.score) * 20.0  # Scale 1-5 to 20-100
            cat_lower = cat_val.lower()
            if "technical" in cat_lower or "tech" in cat_lower or "coding" in cat_lower or "stack" in cat_lower:
                scores["technical_depth"] = norm_score
            elif "architecture" in cat_lower or "system" in cat_lower or "design" in cat_lower:
                scores["system_design"] = norm_score
            elif "experience" in cat_lower or "seniority" in cat_lower:
                scores["experience_seniority"] = norm_score
            elif "leadership" in cat_lower or "communication" in cat_lower or "culture" in cat_lower or "impact" in cat_lower:
                scores["leadership_culture"] = norm_score
            elif "domain" in cat_lower or "industry" in cat_lower or "knowledge" in cat_lower:
                scores["domain_expertise"] = norm_score
        return CriteriaScoreMap(**scores)

