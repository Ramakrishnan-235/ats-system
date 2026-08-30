from enum import Enum
from typing import List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict, model_validator, AliasChoices


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
        description="Standardized name of the skill, tool, or framework (e.g., 'PostgreSQL', 'FastAPI').",
        validation_alias=AliasChoices("name", "skill", "skill_name", "title")
    )
    category: SkillCategory = Field(
        default=SkillCategory.TOOLING_PLATFORM,
        description="Functional category for domain classification."
    )
    proficiency: SkillProficiency = Field(
        default=SkillProficiency.INTERMEDIATE,
        description="Inferred proficiency level based on years used and depth of responsibilities.",
        validation_alias=AliasChoices("proficiency", "level", "proficiency_level")
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
        description="Short snippet or evidence from resume demonstrating applied impact.",
        validation_alias=AliasChoices("context_evidence", "evidence", "details")
    )

    model_config = ConfigDict(use_enum_values=True, populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def sanitize_skill(cls, data: Any) -> Any:
        from ats_core.parsers.normalizers import normalize_skill
        if isinstance(data, str):
            return {"name": normalize_skill(data)}
        if isinstance(data, dict):
            raw_name = data.get("name") or data.get("skill") or data.get("skill_name") or "Unknown Skill"
            data["name"] = normalize_skill(str(raw_name))

            cat = data.get("category")
            if cat and cat not in [e.value for e in SkillCategory]:
                # Attempt soft mapping or fallback
                data["category"] = SkillCategory.TOOLING_PLATFORM.value
            prof = data.get("proficiency") or data.get("level")
            if prof and prof not in [e.value for e in SkillProficiency]:
                prof_str = str(prof).lower()
                if "exp" in prof_str or "lead" in prof_str:
                    data["proficiency"] = SkillProficiency.EXPERT.value
                elif "adv" in prof_str or "sr" in prof_str:
                    data["proficiency"] = SkillProficiency.ADVANCED.value
                elif "beg" in prof_str or "jun" in prof_str:
                    data["proficiency"] = SkillProficiency.BEGINNER.value
                else:
                    data["proficiency"] = SkillProficiency.INTERMEDIATE.value
        return data


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
    taxonomy_version: str = Field(
        default="2026.08.1",
        description="Ontology version under which skills were normalized and extracted."
    )

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def handle_flexible_skills_input(cls, data: Any) -> Any:
        from ats_core.parsers.normalizers import normalize_skill, normalize_skills_list
        if isinstance(data, list):
            detailed = []
            for item in data:
                if isinstance(item, str):
                    detailed.append({"name": normalize_skill(item), "category": SkillCategory.TOOLING_PLATFORM.value})
                elif isinstance(item, dict):
                    name = item.get("name") or item.get("skill") or item.get("skill_name") or "Unknown"
                    level = item.get("proficiency") or item.get("level") or SkillProficiency.INTERMEDIATE.value
                    detailed.append({
                        "name": normalize_skill(str(name)),
                        "proficiency": level,
                        "category": SkillCategory.TOOLING_PLATFORM.value
                    })
            return {"detailed_skills": detailed}
        elif isinstance(data, dict):
            if "core_languages" in data and isinstance(data["core_languages"], list):
                data["core_languages"] = normalize_skills_list(data["core_languages"])
            if "frameworks_and_tools" in data and isinstance(data["frameworks_and_tools"], list):
                data["frameworks_and_tools"] = normalize_skills_list(data["frameworks_and_tools"])
            if "databases_and_infrastructure" in data and isinstance(data["databases_and_infrastructure"], list):
                data["databases_and_infrastructure"] = normalize_skills_list(data["databases_and_infrastructure"])

            known_fields = {"core_languages", "frameworks_and_tools", "databases_and_infrastructure", "detailed_skills"}
            if not any(k in known_fields for k in data.keys()):
                flat_skills = []
                for _, skill_list in data.items():
                    if isinstance(skill_list, list):
                        for s in skill_list:
                            flat_skills.append({"name": normalize_skill(str(s)), "category": SkillCategory.TOOLING_PLATFORM.value})
                return {"detailed_skills": flat_skills}
        return data