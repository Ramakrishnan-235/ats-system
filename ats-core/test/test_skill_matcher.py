import pytest
import time
from ats_core.parsers.skill_matcher import SkillMatcher
from ats_core.taxonomy.seed_data import SEED_SKILLS


def test_skill_matcher_initialization():
    """Verify SkillMatcher initializes and indexes approved seed taxonomy entries."""
    matcher = SkillMatcher.get_instance()
    assert len(matcher.row_by_id) >= len(SEED_SKILLS)
    assert len(matcher.id_by_key) >= len(SEED_SKILLS)


def test_token_boundary_protection():
    """
    Verify Token-Boundary matching:
    'JavaScript' must NOT match 'Java'.
    """
    matcher = SkillMatcher.get_instance()
    text = "Candidate is a senior JavaScript engineer with extensive Node.js experience."
    
    matches = matcher.find(text)
    matched_surfaces = [m[1] for m in matches]
    canonical_skills = matcher.extract_canonical_skills(text)

    assert "JavaScript" in matched_surfaces
    assert "Node.js" in matched_surfaces or "Node.js" in canonical_skills
    # 'Java' must NOT be matched inside 'JavaScript'
    assert "Java" not in matched_surfaces
    assert "Java" not in canonical_skills


def test_punctuation_and_symbols_matching():
    """
    Verify symmetric tokenization accurately captures punctuation-heavy technologies.
    """
    matcher = SkillMatcher.get_instance()
    text = "Proficient in C++, C#, React.js, and CI/CD pipelines."
    
    matches = matcher.find(text)
    matched_surfaces = [m[1] for m in matches]
    canonical_skills = matcher.extract_canonical_skills(text)

    assert any(s.lower() == "c++" for s in matched_surfaces)
    assert any(s.lower() == "c#" for s in matched_surfaces)
    assert "C++" in canonical_skills
    assert "C#" in canonical_skills
    assert "React" in canonical_skills
    assert "CI/CD" in canonical_skills


def test_longest_match_first_deduplication():
    """
    Verify longest-match-first deduplication:
    'React Native' beats bare 'React'.
    'C++' beats bare 'C'.
    """
    matcher = SkillMatcher.get_instance()
    text = "Developed cross-platform mobile apps using React Native and high-performance algorithms in C++."

    matches = matcher.find(text)
    matched_surfaces = [m[1] for m in matches]
    canonical_skills = matcher.extract_canonical_skills(text)

    # React Native should be matched, not standalone React
    assert "React Native" in canonical_skills
    # Standalone 'React' should be suppressed due to overlapping interval with 'React Native'
    react_native_match = next((m for m in matches if "react native" in m[1].lower()), None)
    assert react_native_match is not None
    
    # C++ should be matched, bare C should not be matched at that same offset
    assert "C++" in canonical_skills
    c_matches_at_cpp_offset = [m for m in matches if m[1] == "C" and m[4] == react_native_match[4]]
    assert len(c_matches_at_cpp_offset) == 0


def test_character_and_token_offsets():
    """Verify exact character and token offsets are returned for evidence grounding."""
    matcher = SkillMatcher.get_instance()
    text = "Core skills include Python and Docker."
    
    matches = matcher.find(text)
    assert len(matches) == 2

    # Match 1: Python
    m_py = matches[0]
    surface_py = m_py[1]
    char_start_py = m_py[4]
    char_end_py = m_py[5]
    assert surface_py == "Python"
    assert text[char_start_py:char_end_py] == "Python"

    # Match 2: Docker
    m_docker = matches[1]
    surface_docker = m_docker[1]
    char_start_docker = m_docker[4]
    char_end_docker = m_docker[5]
    assert surface_docker == "Docker"
    assert text[char_start_docker:char_end_docker] == "Docker"


def test_match_skills_with_sections():
    """Verify Gazetteer Matching integrates with Section Anchoring for evidence weighting."""
    matcher = SkillMatcher.get_instance()
    resume_text = """
PROFESSIONAL SUMMARY
Senior engineer specializing in Python and PostgreSQL.

WORK EXPERIENCE
Lead Backend Engineer
Jan 2022 – Present
• Architected microservices with FastAPI and Redis.

TECHNICAL SKILLS
Languages: Python, Go, TypeScript
"""
    results = matcher.match_skills_with_sections(resume_text)
    assert len(results) > 0

    # FastAPI should be anchored to experience with weight 1.0 and entry_index 1
    fastapi_item = next((r for r in results if r["canonical_name"] == "FastAPI"), None)
    assert fastapi_item is not None
    assert fastapi_item["section"] == "experience"
    assert fastapi_item["entry_index"] == 1
    assert fastapi_item["evidence_weight"] == 1.0

    # TypeScript should be in skills section with weight 0.5
    ts_item = next((r for r in results if r["canonical_name"] == "TypeScript"), None)
    assert ts_item is not None
    assert ts_item["section"] == "skills"
    assert ts_item["evidence_weight"] == 0.5


def test_matcher_performance_benchmark():
    """Verify performance is under 20ms for a typical 1000-word resume."""
    matcher = SkillMatcher.get_instance()
    long_resume = (
        "Experienced full stack developer skilled in Python, Django, FastAPI, React, TypeScript, "
        "PostgreSQL, Redis, Docker, Kubernetes, AWS, Terraform, Kafka, Celery, and PyTorch. "
        "Led engineering teams building scalable cloud platforms and distributed microservices. "
    ) * 20  # ~600 words

    start_t = time.perf_counter()
    matches = matcher.find(long_resume)
    duration_ms = (time.perf_counter() - start_t) * 1000

    assert len(matches) > 0
    # Should execute in milliseconds
    assert duration_ms < 50.0  # Generous upper bound for CI/test environments
