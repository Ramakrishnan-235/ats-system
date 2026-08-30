import pytest
from ats_core.parsers.section_anchor import (
    anchor_sections,
    get_section_text,
    get_section_lines,
    extract_structured_experience_entries,
    anchor_skill_mentions,
    DATE_RANGE_RE,
    SECTION_HEADERS,
    HEADER_LOOKUP,
)


SAMPLE_RESUME_TEXT = """
Deva Kumar B
devakumar235@gmail.com | (555) 123-4567 | linkedin.com/in/devakumar

PROFESSIONAL SUMMARY
Senior Full Stack Engineer with 5+ years of production experience building distributed systems in Python and Go.

TECHNICAL SKILLS
Languages: Python, Go, TypeScript, SQL, Rust
Frameworks & Tools: FastAPI, React, Next.js, Docker, Kubernetes, PostgreSQL, Redis

WORK EXPERIENCE
Senior Backend Engineer — TechCorp Inc.
Jan 2022 – Present
• Architected high-throughput microservices using FastAPI, Redis, and PostgreSQL handling 50k RPS.
• Spearheaded containerized deployments on Kubernetes with automated CI/CD pipelines.

Software Engineer — DataFlow Systems
Jun 2019 — Dec 2021
• Built real-time streaming pipelines in Python and Apache Kafka.
• Optimized PostgreSQL query performance, reducing p99 latency by 45%.

PERSONAL PROJECTS
AI Video Generator
May 2023 – Aug 2023
• Developed generative video pipeline using PyTorch and OpenCV.

EDUCATION
Bachelor of Technology in Computer Science — Achariya College of Engineering Technology
2015 – 2019

CERTIFICATIONS
AWS Certified Solutions Architect — Associate
"""


def test_anchor_sections_basic():
    """Verify that every line receives a section anchor and experience entry index."""
    lines, anchors = anchor_sections(SAMPLE_RESUME_TEXT)
    assert len(lines) == len(anchors)
    assert len(lines) > 0

    # Header section
    header_indices = [i for i, (sec, _) in enumerate(anchors) if sec == "header"]
    assert len(header_indices) > 0
    assert any("Deva Kumar B" in lines[i] for i in header_indices)

    # Summary section
    summary_indices = [i for i, (sec, _) in enumerate(anchors) if sec == "summary"]
    assert len(summary_indices) > 0

    # Skills section
    skills_indices = [i for i, (sec, _) in enumerate(anchors) if sec == "skills"]
    assert len(skills_indices) > 0

    # Experience section
    exp_indices = [i for i, (sec, _) in enumerate(anchors) if sec == "experience"]
    assert len(exp_indices) > 0


def test_date_range_entry_boundaries():
    """Verify that date ranges in experience increment the entry index."""
    lines, anchors = anchor_sections(SAMPLE_RESUME_TEXT)
    
    # Collect all (line, sec, entry_idx) in experience
    exp_tuples = [(lines[i], anchors[i][0], anchors[i][1]) for i in range(len(lines)) if anchors[i][0] == "experience"]

    # Entry 1 should contain Jan 2022 – Present and TechCorp
    entry_1_lines = [t[0] for t in exp_tuples if t[2] == 1]
    assert any("TechCorp" in l or "Jan 2022" in l for l in entry_1_lines)
    assert any("FastAPI" in l for l in entry_1_lines)

    # Entry 2 should contain Jun 2019 — Dec 2021 and DataFlow Systems
    entry_2_lines = [t[0] for t in exp_tuples if t[2] == 2]
    assert any("DataFlow" in l or "Jun 2019" in l for l in entry_2_lines)
    assert any("Kafka" in l for l in entry_2_lines)


def test_get_section_text():
    """Verify get_section_text cleanly isolates specific section content."""
    lines, anchors = anchor_sections(SAMPLE_RESUME_TEXT)
    
    skills_text = get_section_text(lines, anchors, "skills")
    assert "Python, Go, TypeScript" in skills_text
    assert "FastAPI, React, Next.js" in skills_text
    assert "Achariya College" not in skills_text

    edu_text = get_section_text(lines, anchors, "education")
    assert "Achariya College" in edu_text
    assert "TechCorp" not in edu_text


def test_extract_structured_experience_entries():
    """Verify deterministic grouping of experience entries with bullets and date ranges."""
    lines, anchors = anchor_sections(SAMPLE_RESUME_TEXT)
    entries = extract_structured_experience_entries(lines, anchors)
    
    assert len(entries) == 2

    # Entry 1 (TechCorp)
    assert entries[0]["entry_index"] == 1
    assert "Jan 2022" in entries[0]["date_range"]
    assert len(entries[0]["bullets"]) == 2
    assert any("FastAPI" in b for b in entries[0]["bullets"])

    # Entry 2 (DataFlow)
    assert entries[1]["entry_index"] == 2
    assert "Jun 2019" in entries[1]["date_range"]
    assert len(entries[1]["bullets"]) == 2
    assert any("Kafka" in b for b in entries[1]["bullets"])


def test_anchor_skill_mentions_evidence_weighting():
    """Verify skills are anchored to specific sections with deterministic evidence weights."""
    skills_to_test = ["Python", "FastAPI", "Kafka", "PyTorch"]
    evidence = anchor_skill_mentions(SAMPLE_RESUME_TEXT, skills_to_test)

    assert "Python" in evidence
    assert "FastAPI" in evidence

    # FastAPI was mentioned in skills and in experience entry 1
    fastapi_ev = evidence["FastAPI"]
    sections_found = [e["section"] for e in fastapi_ev]
    assert "experience" in sections_found
    assert "skills" in sections_found

    # Experience evidence should have weight 1.0
    exp_ev = next(e for e in fastapi_ev if e["section"] == "experience")
    assert exp_ev["evidence_weight"] == 1.0
    assert exp_ev["entry_index"] == 1

    # PyTorch was in projects section
    pytorch_ev = evidence["PyTorch"]
    proj_ev = next(e for e in pytorch_ev if e["section"] == "projects")
    assert proj_ev["evidence_weight"] == 0.8


def test_date_range_regex_variations():
    """Verify DATE_RANGE_RE catches various format styles."""
    assert DATE_RANGE_RE.search("Jan 2020 – Present") is not None
    assert DATE_RANGE_RE.search("Jan 2020 - Dec 2022") is not None
    assert DATE_RANGE_RE.search("May-Aug 2025") is not None
    assert DATE_RANGE_RE.search("Jun '20 – Present") is not None
    assert DATE_RANGE_RE.search("2021 — 2023") is not None
    assert DATE_RANGE_RE.search("03/2020 - 05/2022") is not None
    assert DATE_RANGE_RE.search("Spring 2023 – Summer 2023") is not None
