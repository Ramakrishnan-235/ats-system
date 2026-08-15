import uuid
from typing import List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict, model_validator, AliasChoices

from ats_core.schema.skills import SkillsTaxonomy
from ats_core.schema.timeline import EmploymentTimeline


class EducationEntry(BaseModel):
    institution: str = Field(
        default="Unknown Institution",
        description="Name of the university, college, or bootcamp.",
        validation_alias=AliasChoices("institution", "university", "college", "school", "bootcamp", "name")
    )
    degree: str = Field(
        default="Degree / Certificate",
        description="Degree level (e.g., 'Bachelor of Science', 'Master of Engineering').",
        validation_alias=AliasChoices("degree", "degree_level", "qualification", "title")
    )
    field_of_study: str = Field(
        default="Computer Science / General",
        description="Major/Field (e.g., 'Computer Science', 'Electrical Engineering').",
        validation_alias=AliasChoices("field_of_study", "major", "field", "subject", "study_area")
    )
    graduation_year: Optional[str] = Field(
        default=None,
        description="Year of graduation (e.g., '2022').",
        validation_alias=AliasChoices("graduation_year", "year_of_completion", "year", "date", "graduation_date", "years")
    )
    grade_or_gpa: Optional[str] = Field(
        default=None,
        description="Reported GPA or honors classification.",
        validation_alias=AliasChoices("grade_or_gpa", "gpa", "grade", "honors")
    )

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def coerce_graduation_year(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for k in ("graduation_year", "year_of_completion", "year", "years", "date"):
                if k in data and data[k] is not None and not isinstance(data[k], str):
                    data[k] = str(data[k])
        return data


class CertificationEntry(BaseModel):
    name: str = Field(
        default="Certification",
        description="Title of certification (e.g., 'AWS Certified Solutions Architect').",
        validation_alias=AliasChoices("name", "certification_name", "title", "cert_name")
    )
    issuing_organization: str = Field(
        default="Certifying Body",
        description="Issuer (e.g., 'Amazon Web Services', 'CKA/CNCF').",
        validation_alias=AliasChoices("issuing_organization", "issuer", "organization", "issuing_body", "company")
    )
    issue_date: Optional[str] = Field(
        default=None,
        description="Issue date in YYYY-MM or YYYY.",
        validation_alias=AliasChoices("issue_date", "date_obtained", "date", "issued")
    )
    expiration_date: Optional[str] = Field(
        default=None,
        description="Expiration date if applicable.",
        validation_alias=AliasChoices("expiration_date", "expires")
    )
    credential_id_or_url: Optional[str] = Field(
        default=None,
        description="Verification ID or URL.",
        validation_alias=AliasChoices("credential_id_or_url", "credential_id", "url", "verification_url")
    )

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def coerce_dates(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for k in ("issue_date", "date_obtained", "date", "issued", "expiration_date"):
                if k in data and data[k] is not None and not isinstance(data[k], str):
                    data[k] = str(data[k])
        return data


class ProjectEntry(BaseModel):
    project_name: str = Field(
        default="Project",
        description="Name of project or open-source contribution.",
        validation_alias=AliasChoices("project_name", "name", "title")
    )
    description: str = Field(
        default="",
        description="Summary of the project purpose and architecture.",
        validation_alias=AliasChoices("description", "summary", "details")
    )
    technologies_used: List[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("technologies_used", "technologies", "tech_stack", "tools")
    )
    impact_or_metrics: Optional[str] = Field(
        default=None,
        description="Quantified results (e.g., '1.2k GitHub stars', '10k active users').",
        validation_alias=AliasChoices("impact_or_metrics", "impact", "metrics", "results")
    )

    model_config = ConfigDict(populate_by_name=True)


class CandidateProfile(BaseModel):
    """Master Candidate Profile contract representing a fully parsed, de-identified resume."""
    candidate_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique identifier for candidate tracking.",
        validation_alias=AliasChoices("candidate_id", "id")
    )
    anonymized_name: str = Field(
        default="[CANDIDATE_NAME]",
        description="Masked candidate reference.",
        validation_alias=AliasChoices("anonymized_name", "name")
    )
    target_role_or_headline: str = Field(
        default="Software Professional",
        description="Candidate headline (e.g., 'Senior Staff Backend & Distributed Systems Engineer').",
        validation_alias=AliasChoices("target_role_or_headline", "headline", "title", "target_role")
    )
    executive_summary: str = Field(
        default="",
        description="3-4 sentence comprehensive career summary highlighting domain expertise and tech stack.",
        validation_alias=AliasChoices("executive_summary", "summary", "profile_summary", "about")
    )
    
    # Core Sub-Systems
    timeline: EmploymentTimeline = Field(
        default_factory=EmploymentTimeline,
        description="Employment history, duration metrics, and timeline continuity."
    )
    skills: SkillsTaxonomy = Field(
        default_factory=SkillsTaxonomy,
        description="Categorized skills taxonomy and proficiencies."
    )
    education: List[EducationEntry] = Field(
        default_factory=list,
        description="Academic background."
    )
    certifications: List[CertificationEntry] = Field(
        default_factory=list,
        description="Professional certifications and credentials."
    )
    notable_projects: List[ProjectEntry] = Field(
        default_factory=list,
        description="Key side projects or open-source work."
    )

    # Ingestion Metadata
    parsing_engine: str = Field(default="hybrid-pymupdf-docling")
    schema_version: str = Field(default="1.0.0")

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "candidate_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
                "anonymized_name": "[CANDIDATE_NAME]",
                "target_role_or_headline": "Senior Backend Infrastructure Engineer",
                "executive_summary": "Backend specialist with 6+ years designing distributed data pipelines and high-throughput Python APIs. Led zero-downtime database migrations serving 20M+ monthly requests.",
                "timeline": {
                    "total_continuous_years": 6.2,
                    "positions": [
                        {
                            "company_name": "Tech Corp",
                            "job_title": "Senior Backend Engineer",
                            "workplace_type": "Remote",
                            "start_date": "2021-06",
                            "end_date": "Present",
                            "is_current_role": True,
                            "duration_months": 36,
                            "primary_technologies": ["Python", "FastAPI", "Qdrant", "PostgreSQL"],
                            "quantified_achievements": ["Reduced search API latency from 450ms to 42ms via vector caching."]
                        }
                    ]
                }
            }
        }
    )