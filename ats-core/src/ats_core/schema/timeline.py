from enum import Enum
from typing import List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict, model_validator, AliasChoices


class WorkplaceType(str, Enum):
    REMOTE = "Remote"
    HYBRID = "Hybrid"
    ONSITE = "On-site"
    UNKNOWN = "Unknown"


class WorkExperience(BaseModel):
    company_name: str = Field(
        default="Unknown Company",
        description="Name of the employer or organization.",
        validation_alias=AliasChoices("company_name", "company", "employer", "organization")
    )
    job_title: str = Field(
        default="Engineer",
        description="Standardized title (e.g., 'Senior Software Engineer', 'Tech Lead').",
        validation_alias=AliasChoices("job_title", "title", "role", "position")
    )
    workplace_type: WorkplaceType = Field(
        default=WorkplaceType.UNKNOWN,
        description="Location setup for the role.",
        validation_alias=AliasChoices("workplace_type", "location_type", "type")
    )
    start_date: str = Field(
        default="Unknown",
        description="Start date in YYYY-MM or YYYY format (e.g., '2021-03').",
        validation_alias=AliasChoices("start_date", "start", "from")
    )
    end_date: Optional[str] = Field(
        default="Present",
        description="End date in YYYY-MM / YYYY format, or 'Present' if currently employed.",
        validation_alias=AliasChoices("end_date", "end", "to")
    )
    is_current_role: bool = Field(
        default=False,
        description="True if the candidate currently holds this position.",
        validation_alias=AliasChoices("is_current_role", "current", "is_current")
    )
    duration_months: Optional[int] = Field(
        default=None,
        ge=0,
        description="Total duration of the role in continuous months.",
        validation_alias=AliasChoices("duration_months", "duration")
    )
    primary_technologies: List[str] = Field(
        default_factory=list,
        description="Key tech stack used specifically in this role.",
        validation_alias=AliasChoices("primary_technologies", "technologies", "tech_stack", "skills")
    )
    responsibilities: List[str] = Field(
        default_factory=list,
        description="Core operational duties and leadership responsibilities.",
        validation_alias=AliasChoices("responsibilities", "duties")
    )
    quantified_achievements: List[str] = Field(
        default_factory=list,
        description="High-impact bullet points with metrics (e.g., 'Reduced query latency by 45%').",
        validation_alias=AliasChoices("quantified_achievements", "achievements", "highlights", "impact")
    )

    model_config = ConfigDict(use_enum_values=True, populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def sanitize_experience(cls, data: Any) -> Any:
        if isinstance(data, dict):
            wpt = data.get("workplace_type") or data.get("location_type")
            if wpt and wpt not in [e.value for e in WorkplaceType]:
                wpt_str = str(wpt).lower()
                if "remote" in wpt_str:
                    data["workplace_type"] = WorkplaceType.REMOTE.value
                elif "hybrid" in wpt_str:
                    data["workplace_type"] = WorkplaceType.HYBRID.value
                elif "onsite" in wpt_str or "on-site" in wpt_str or "office" in wpt_str:
                    data["workplace_type"] = WorkplaceType.ONSITE.value
                else:
                    data["workplace_type"] = WorkplaceType.UNKNOWN.value
        return data


class EmploymentGap(BaseModel):
    start_date: str = Field(description="Start date of employment gap in YYYY-MM format.")
    end_date: str = Field(description="End date of employment gap in YYYY-MM format.")
    gap_duration_months: int = Field(default=3, ge=1, description="Duration of gap in months.")
    inferred_reason: Optional[str] = Field(
        default=None,
        description="Explanation if referenced in resume (e.g., 'Higher Education', 'Sabbatical')."
    )


class EmploymentTimeline(BaseModel):
    total_continuous_years: float = Field(
        default=0.0,
        ge=0.0,
        description="Total cumulative years of professional full-time experience (excluding gaps/internships).",
        validation_alias=AliasChoices("total_continuous_years", "total_years", "years_of_experience", "total_experience_years")
    )
    positions: List[WorkExperience] = Field(
        default_factory=list,
        description="Chronologically ordered work history, starting from the most recent role.",
        validation_alias=AliasChoices("positions", "experiences", "work_history", "jobs")
    )
    career_gaps: List[EmploymentGap] = Field(
        default_factory=list,
        description="Identified gaps in employment greater than 3 months.",
        validation_alias=AliasChoices("career_gaps", "gaps")
    )
    longest_tenure_months: Optional[int] = Field(
        default=None,
        description="Longest single position tenure in months."
    )
    average_tenure_months: Optional[float] = Field(
        default=None,
        description="Average duration spent across past roles in months."
    )

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def handle_flexible_timeline(cls, data: Any) -> Any:
        if isinstance(data, list):
            return {"positions": data, "total_continuous_years": 0.0}
        return data