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


if __name__ == "__main__":
    test_schema_generation()