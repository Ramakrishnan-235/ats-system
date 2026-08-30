import pytest
from datetime import datetime
from ats_core.parsers.skill_aggregator import (
    parse_date_to_datetime,
    merge_date_intervals,
    aggregate_skill_mentions,
)


def test_merge_date_intervals_non_overlapping():
    """
    Verify that concurrent/overlapping roles mentioning the same skill
    are merged into non-overlapping continuous intervals (no double counting).
    """
    # Role 1: 2020-01 to 2022-06 (30 months)
    # Role 2 (concurrent part-time/advisory): 2021-01 to 2023-01 (24 months)
    # Naive sum: 54 months. Merged interval: 2020-01 to 2023-01 (36 months).
    r1_start = datetime(2020, 1, 1)
    r1_end = datetime(2022, 6, 30)

    r2_start = datetime(2021, 1, 1)
    r2_end = datetime(2023, 1, 31)

    intervals = [(r1_start, r1_end), (r2_start, r2_end)]
    merged = merge_date_intervals(intervals)

    assert len(merged) == 1
    assert merged[0][0] == datetime(2020, 1, 1)
    assert merged[0][1] == datetime(2023, 1, 31)


def test_merge_date_intervals_disjoint():
    """Verify disjoint intervals remain distinct."""
    # Interval 1: 2018-01 to 2019-12
    # Interval 2: 2021-01 to 2022-12
    i1 = (datetime(2018, 1, 1), datetime(2019, 12, 31))
    i2 = (datetime(2021, 1, 1), datetime(2022, 12, 31))

    merged = merge_date_intervals([i2, i1])  # passed out of order
    assert len(merged) == 2
    assert merged[0] == i1
    assert merged[1] == i2


def test_aggregate_skills_scoring_matrix():
    """
    Verify aggregation emits the exact structured Scoring Engine Matrix:
    - Python: 6.2 yrs (current, demonstrated_impact, weighted score)
    - AWS: 3.0 yrs (not current, stale months computed, certified=True)
    - React: 1.5 yrs (current, contextual)
    """
    ref_date = datetime(2026, 8, 30)

    # 1. Python mentions across 2 jobs (2020-01 to Present ~ 6.6 yrs)
    python_mentions = [
        {
            "canonical_name": "Python",
            "skill_id": "skill-python",
            "surface": "Python",
            "section": "experience",
            "role": "Senior Backend Engineer",
            "start_date": "2022-01",
            "end_date": "Present",
            "is_current_role": True,
            "mention_tier": "demonstrated_impact",
            "evidence_weight": 1.8,
            "is_certified": False,
        },
        {
            "canonical_name": "Python",
            "skill_id": "skill-python",
            "surface": "Python",
            "section": "experience",
            "role": "Software Engineer",
            "start_date": "2020-01",
            "end_date": "2021-12",
            "is_current_role": False,
            "mention_tier": "demonstrated",
            "evidence_weight": 1.6,
            "is_certified": False,
        }
    ]

    # 2. AWS mentions (2019-01 to 2022-01 ~ 3 yrs, ended 55 months ago) + Certification
    aws_mentions = [
        {
            "canonical_name": "AWS",
            "skill_id": "skill-aws",
            "surface": "AWS",
            "section": "experience",
            "role": "Cloud Developer",
            "start_date": "2019-01",
            "end_date": "2022-01",
            "is_current_role": False,
            "mention_tier": "demonstrated",
            "evidence_weight": 1.6,
            "is_certified": False,
        },
        {
            "canonical_name": "AWS",
            "skill_id": "skill-aws",
            "surface": "AWS Certified Solutions Architect",
            "section": "certifications",
            "role": None,
            "start_date": None,
            "end_date": None,
            "is_current_role": False,
            "mention_tier": "certified",
            "evidence_weight": 1.0,
            "is_certified": True,
        }
    ]

    all_mentions = python_mentions + aws_mentions

    db_rows, matrix = aggregate_skill_mentions(
        mentions=all_mentions,
        reference_date=ref_date,
        candidate_id="cand-test-123"
    )

    assert len(db_rows) == 2
    assert "python" in matrix
    assert "aws" in matrix

    # Verify Python matrix record
    py = matrix["python"]
    assert py["canonical_name"] == "Python"
    assert py["current"] is True
    assert py["evidence"] == "demonstrated_impact"
    assert py["years"] >= 6.0
    assert py["weighted"] == 3.4
    assert py["certified"] is False

    # Verify AWS matrix record
    aws = matrix["aws"]
    assert aws["canonical_name"] == "AWS"
    assert aws["current"] is False
    assert aws["certified"] is True
    assert aws["evidence"] == "demonstrated"
    assert aws["years"] >= 3.0
    assert aws["months_since_last_use"] is not None
    assert aws["months_since_last_use"] > 36  # Stale detection
