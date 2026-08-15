from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class SkillCategory(str, Enum):
    PROGRAMMING_LANGUAGE = "Programming Language"
    FRAMEWORK_LIBRARY = "Framework / Library"
    DATABASE_STORAGE = "Database / Storage"
    CLOUD_DEVOPS = "Cloud & DevOps"
    AI_DATA_ML = "AI / ML / Data Engineering"
    SYSTEM_DESIGN_ARCH = "Architecture & Systems"
    SECURITY_COMPLIANCE = "Security & Compliance"
    TOOLING_PLATFORM = "Tooling & Platforms"
    DOMAIN_KNOWLEDGE = "Domain Knowledge"
    SOFT_SKILL = "Soft Skill"


class SkillProficiency(str, Enum):
    BEGINNER = "Beginner"          # Basic awareness / academic / minor project
    INTERMEDIATE = "Intermediate"  # 1-3 years production application
    ADVANCED = "Advanced"          # 3-6 years, deep architectural knowledge
    EXPERT = "Expert"              # 6+ years, subject-matter authority / lead


class ExtractedSkill(BaseModel):
    name: str = Field(
        description="Standardized name of the skill, tool, or framework (e.g., 'PostgreSQL', 'FastAPI')."
    )
    category: SkillCategory = Field(
        description="Functional category for domain classification."
    )
    proficiency: SkillProficiency = Field(
        default=SkillProficiency.INTERMEDIATE,
        description="Inferred proficiency level based on years used and depth of responsibilities."
    )
    estimated_years_experience: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Estimated total years using this skill across all roles."
    )
    is_core_competency: bool = Field(
        default=False,
        description="True if this is one of the candidate's primary daily tools or specialized strengths."
    )
    context_evidence: Optional[str] = Field(
        default=None,
        description="Short snippet or evidence from resume demonstrating applied impact."
    )

    model_config = ConfigDict(use_enum_values=True)


class SkillsTaxonomy(BaseModel):
    """Aggregated taxonomy breakdown for vectorization and rule-based matching."""
    core_languages: List[str] = Field(
        default_factory=list,
        description="Primary programming languages (e.g., ['Python', 'Go', 'TypeScript'])."
    )
    frameworks_and_tools: List[str] = Field(
        default_factory=list,
        description="Frameworks, libraries, and developer tools (e.g., ['FastAPI', 'Docker'])."
    )
    databases_and_infrastructure: List[str] = Field(
        default_factory=list,
        description="Databases, message brokers, and cloud providers (e.g., ['PostgreSQL', 'AWS'])."
    )
    detailed_skills: List[ExtractedSkill] = Field(
        default_factory=list,
        description="Complete list of all detected skills with categorized metadata."
    )