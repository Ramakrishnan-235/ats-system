import uuid
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

from ats_core.schema.skills import SkillsTaxonomy
from ats_core.schema.timeline import EmploymentTimeline


class EducationEntry(BaseModel):
    institution: str = Field(description="Name of the university, college, or bootcamp.")
    degree: str = Field(description="Degree level (e.g., 'Bachelor of Science', 'Master of Engineering').")
    field_of_study: str = Field(description="Major/Field (e.g., 'Computer Science', 'Electrical Engineering').")
    graduation_year: Optional[str] = Field(
        default=None,
        description="Year of graduation (e.g., '2022')."
    )
    grade_or_gpa: Optional[str] = Field(default=None, description="Reported GPA or honors classification.")


class CertificationEntry(BaseModel):
    name: str = Field(description="Title of certification (e.g., 'AWS Certified Solutions Architect').")
    issuing_organization: str = Field(description="Issuer (e.g., 'Amazon Web Services', 'CKA/CNCF').")
    issue_date: Optional[str] = Field(default=None, description="Issue date in YYYY-MM or YYYY.")
    expiration_date: Optional[str] = Field(default=None, description="Expiration date if applicable.")
    credential_id_or_url: Optional[str] = Field(default=None, description="Verification ID or URL.")


class ProjectEntry(BaseModel):
    project_name: str = Field(description="Name of project or open-source contribution.")
    description: str = Field(description="Summary of the project purpose and architecture.")
    technologies_used: List[str] = Field(default_factory=list)
    impact_or_metrics: Optional[str] = Field(
        default=None,
        description="Quantified results (e.g., '1.2k GitHub stars', '10k active users')."
    )


class CandidateProfile(BaseModel):
    """Master Candidate Profile contract representing a fully parsed, de-identified resume."""
    candidate_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique identifier for candidate tracking."
    )
    anonymized_name: str = Field(
        default="[CANDIDATE_NAME]",
        description="Masked candidate reference."
    )
    target_role_or_headline: str = Field(
        description="Candidate headline (e.g., 'Senior Staff Backend & Distributed Systems Engineer')."
    )
    executive_summary: str = Field(
        description="3-4 sentence comprehensive career summary highlighting domain expertise and tech stack."
    )
    
    # Core Sub-Systems
    timeline: EmploymentTimeline = Field(
        description="Employment history, duration metrics, and timeline continuity."
    )
    skills: SkillsTaxonomy = Field(
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