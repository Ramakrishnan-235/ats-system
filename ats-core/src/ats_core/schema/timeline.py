from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict, model_validator


class WorkplaceType(str, Enum):
    REMOTE = "Remote"
    HYBRID = "Hybrid"
    ONSITE = "On-site"
    UNKNOWN = "Unknown"


class WorkExperience(BaseModel):
    company_name: str = Field(
        description="Name of the employer or organization."
    )
    job_title: str = Field(
        description="Standardized title (e.g., 'Senior Software Engineer', 'Tech Lead')."
    )
    workplace_type: WorkplaceType = Field(
        default=WorkplaceType.UNKNOWN,
        description="Location setup for the role."
    )
    start_date: str = Field(
        description="Start date in YYYY-MM or YYYY format (e.g., '2021-03')."
    )
    end_date: Optional[str] = Field(
        default="Present",
        description="End date in YYYY-MM / YYYY format, or 'Present' if currently employed."
    )
    is_current_role: bool = Field(
        default=False,
        description="True if the candidate currently holds this position."
    )
    duration_months: Optional[int] = Field(
        default=None,
        ge=0,
        description="Total duration of the role in continuous months."
    )
    primary_technologies: List[str] = Field(
        default_factory=list,
        description="Key tech stack used specifically in this role."
    )
    responsibilities: List[str] = Field(
        default_factory=list,
        description="Core operational duties and leadership responsibilities."
    )
    quantified_achievements: List[str] = Field(
        default_factory=list,
        description="High-impact bullet points with metrics (e.g., 'Reduced query latency by 45%')."
    )

    model_config = ConfigDict(use_enum_values=True)


class EmploymentGap(BaseModel):
    start_date: str = Field(description="Start date of employment gap in YYYY-MM format.")
    end_date: str = Field(description="End date of employment gap in YYYY-MM format.")
    gap_duration_months: int = Field(ge=1, description="Duration of gap in months.")
    inferred_reason: Optional[str] = Field(
        default=None,
        description="Explanation if referenced in resume (e.g., 'Higher Education', 'Sabbatical')."
    )


class EmploymentTimeline(BaseModel):
    total_continuous_years: float = Field(
        ge=0.0,
        description="Total cumulative years of professional full-time experience (excluding gaps/internships)."
    )
    positions: List[WorkExperience] = Field(
        default_factory=list,
        description="Chronologically ordered work history, starting from the most recent role."
    )
    career_gaps: List[EmploymentGap] = Field(
        default_factory=list,
        description="Identified gaps in employment greater than 3 months."
    )
    longest_tenure_months: Optional[int] = Field(
        default=None,
        description="Longest single position tenure in months."
    )
    average_tenure_months: Optional[float] = Field(
        default=None,
        description="Average duration spent across past roles in months."
    )