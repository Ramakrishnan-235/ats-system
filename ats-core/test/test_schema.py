# test_schemas.py
import sys
from pathlib import Path

# Add src to sys.path so ats_core is importable when running test script directly
src_dir = str(Path(__file__).resolve().parent.parent / "src")
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

from ats_core.schema import CandidateProfile, EmploymentTimeline, SkillsTaxonomy


def test_schema_generation():
    # 1. Verify JSON Schema export (used by Instructor)
    json_schema = CandidateProfile.model_json_schema()
    assert "properties" in json_schema
    assert "timeline" in json_schema["properties"]
    assert "skills" in json_schema["properties"]
    print("✓ Pydantic v2 JSON Schema exported successfully.")

    # 2. Verify model instantiation
    profile = CandidateProfile(
        target_role_or_headline="MLOps / Backend Engineer",
        executive_summary="4+ years experience deploying production LLM architectures.",
        timeline=EmploymentTimeline(total_continuous_years=4.5),
        skills=SkillsTaxonomy(core_languages=["Python", "Rust"]),
    )
    assert len(profile.candidate_id) > 0
    assert profile.skills.core_languages == ["Python", "Rust"]
    print(f"✓ Created sample profile with Candidate ID: {profile.candidate_id}")


def test_flexible_llm_json_parsing():
    """Verify that varied LLM JSON outputs (e.g. from local Ollama models) parse smoothly."""
    sample_llm_output = {
        "candidate_id": "test-uuid-123",
        "anonymized_name": "[CANDIDATE_NAME]",
        "target_role_or_headline": "Cloud DevOps Lead with 6+ years of experience",
        "executive_summary": "Accomplished Cloud DevOps Lead specialized in building platforms.",
        "timeline": [
            {
                "company_name": "Acme Corp",
                "job_title": "Senior Lead",
                "duration_months": 36,
                "start_date": "2021-03",
                "end_date": "Present",
                "primary_technologies": ["Terraform", "AWS", "Go"],
            }
        ],
        "skills": [
            {"skill": "Python", "level": "Expert", "proficiency_score": 95},
            {"name": "Terraform", "details": "IaC automation"},
        ],
        "education": [
            {
                "institution": "National Institute of Technology",
                "degree": "Bachelor of Science",
                "field_of_study": "Computer Science",
                "year_of_completion": 2018,
            }
        ],
        "certifications": [
            {
                "name": "AWS Certified Solutions Architect",
                "issuer": "Amazon Web Services",
                "date_obtained": "2022",
            }
        ],
        "notable_projects": [
            {
                "name": "Distributed Vector Search Engine",
                "description": "Developed high-performance vector search service.",
                "technologies": ["Python", "Qdrant"],
            }
        ],
    }

    profile = CandidateProfile.model_validate(sample_llm_output)
    assert profile.timeline.positions[0].company_name == "Acme Corp"
    assert len(profile.skills.detailed_skills) == 2
    assert profile.certifications[0].issuing_organization == "Amazon Web Services"
    assert profile.notable_projects[0].project_name == "Distributed Vector Search Engine"
    print("✓ Flexible LLM JSON parsing verified successfully.")


if __name__ == "__main__":
    test_schema_generation()
    test_flexible_llm_json_parsing()