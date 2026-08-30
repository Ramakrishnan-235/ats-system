# test_schemas.py
from ats_core.schema import candidate, timeline, skills

def test_schema_generation():
    # 1. Verify JSON Schema export (used by Instructor)
    json_schema = candidate.CandidateProfile.model_json_schema()
    assert "properties" in json_schema
    assert "timeline" in json_schema["properties"]
    assert "skills" in json_schema["properties"]
    print("✓ Pydantic v2 JSON Schema exported successfully.")

    # 2. Verify model instantiation
    profile = candidate.CandidateProfile(
        target_role_or_headline="MLOps / Backend Engineer",
        executive_summary="4+ years experience deploying production LLM architectures.",
        timeline=timeline.EmploymentTimeline(total_continuous_years=4.5),
        skills=skills.SkillsTaxonomy(core_languages=["Python", "Rust"])
    )
    assert len(profile.candidate_id) > 0
    assert profile.skills.core_languages == ["Python", "Rust"]
    print(f"✓ Created sample profile with Candidate ID: {profile.candidate_id}")

if __name__ == "__main__":
    test_schema_generation()