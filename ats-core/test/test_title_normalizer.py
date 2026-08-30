import pytest
from ats_core.parsers.title_normalizer import (
    parse_title,
    calculate_title_trajectory,
    canonicalize_function,
)


def test_parse_title_seniority_levels():
    """
    Verify seniority detection across hierarchy:
    exec, vp, director, manager, staff, lead, senior, mid, junior.
    """
    # 1. Executive
    t_exec = parse_title("Chief Technology Officer (CTO)")
    assert t_exec["seniority"] == "exec"
    assert t_exec["is_management"] is True

    # 2. VP
    t_vp = parse_title("VP of Engineering")
    assert t_vp["seniority"] == "vp"
    assert t_vp["is_management"] is True

    # 3. Director
    t_dir = parse_title("Director of Product & Engineering")
    assert t_dir["seniority"] == "director"
    assert t_dir["is_management"] is True

    # 4. Manager
    t_mgr = parse_title("Engineering Manager - Core Platform")
    assert t_mgr["seniority"] == "manager"
    assert t_mgr["is_management"] is True

    # 5. Staff / Principal
    t_staff = parse_title("Principal Software Engineer")
    assert t_staff["seniority"] == "staff"

    # 6. Lead
    t_lead = parse_title("Technical Lead & Solutions Architect")
    assert t_lead["seniority"] == "lead"

    # 7. Senior
    t_sr = parse_title("Senior Full Stack Developer")
    assert t_sr["seniority"] == "senior"

    # 8. Roman numerals & abbreviations
    t_sde2 = parse_title("SDE II")
    assert t_sde2["seniority"] == "mid"
    assert t_sde2["function"] == "Software Engineer"

    t_sse = parse_title("SSE")
    assert t_sse["seniority"] == "senior"
    assert t_sse["function"] == "Software Engineer"

    # 9. Junior / Intern
    t_jr = parse_title("Junior DevOps Engineer")
    assert t_jr["seniority"] == "junior"

    t_intern = parse_title("Software Engineering Intern")
    assert t_intern["seniority"] == "junior"


def test_canonicalize_function():
    """
    Verify mapping raw title strings to O*NET canonical technical functions.
    """
    assert canonicalize_function("sre") == "Site Reliability Engineer"
    assert canonicalize_function("ml eng") == "Machine Learning Engineer"
    assert canonicalize_function("backend developer") == "Backend Engineer"
    assert canonicalize_function("fe developer") == "Frontend Engineer"
    assert canonicalize_function("fs developer") == "Full Stack Engineer"


def test_calculate_title_trajectory():
    """
    Verify title trajectory computes promotions and career progression velocity.
    """
    # Experience timeline: latest -> earliest
    experience_entries = [
        {"role": "Staff Software Engineer", "company": "TechCorp"},
        {"role": "Senior Software Engineer", "company": "TechCorp"},
        {"role": "Software Engineer II", "company": "DataFlow"},
        {"role": "Junior Developer", "company": "Startup Labs"},
    ]

    trajectory = calculate_title_trajectory(experience_entries)

    assert trajectory["current_seniority"] == "staff"
    assert trajectory["max_seniority"] == "staff"
    assert trajectory["promotions_count"] == 3
    assert trajectory["trajectory_type"] == "accelerating"
    assert trajectory["meets_senior_requirement"] is True
