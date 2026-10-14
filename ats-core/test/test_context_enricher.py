from ats_core.parsers.context_enricher import (
    ACTION_VERB_RE,
    METRIC_RE,
    classify_mention,
    enrich_candidate_skills,
)


def test_classify_mention_tiers():
    """
    Verify mention classification across all 6 evidence tiers.
    """
    # 1. Skills bar (claimed)
    tier_s, w_s, cert_s = classify_mention("skills", "Languages: Python, Go, TypeScript")
    assert tier_s == "skills_bar"
    assert w_s == 1.0
    assert cert_s is False

    # 2. Summary (claimed)
    tier_sum, w_sum, cert_sum = classify_mention("summary", "Senior engineer with 5 years experience in Python.")
    assert tier_sum == "summary"
    assert w_sum == 0.8
    assert cert_sum is False

    # 3. Education (coursework exposure)
    tier_edu, w_edu, cert_edu = classify_mention("education", "Coursework in Database Systems and C++ Programming.")
    assert tier_edu == "education"
    assert w_edu == 0.6
    assert cert_edu is False

    # 4. Certifications (certified credential)
    tier_cert, w_cert, cert_cert = classify_mention("certifications", "AWS Certified Solutions Architect — Associate")
    assert tier_cert == "certified"
    assert w_cert == 1.0
    assert cert_cert is True

    # 5. Contextual in work history (no action verb)
    tier_ctx, w_ctx, cert_ctx = classify_mention("experience", "Responsible for day-to-day Python scripts.")
    assert tier_ctx == "contextual"
    assert w_ctx == 1.3
    assert cert_ctx is False

    # 6. Demonstrated (action verb present)
    tier_dem, w_dem, cert_dem = classify_mention("experience", "Architected high-throughput microservices using FastAPI.")
    assert tier_dem == "demonstrated"
    assert w_dem == 1.6
    assert cert_dem is False

    # 7. Demonstrated Impact (action verb + measurable metric)
    tier_imp, w_imp, cert_imp = classify_mention("experience", "Optimized PostgreSQL query performance, reducing p99 latency by 45%.")
    assert tier_imp == "demonstrated_impact"
    assert w_imp == 1.8
    assert cert_imp is False


def test_action_verbs_and_metrics_regex():
    """Verify action verb and metric regex patterns."""
    assert ACTION_VERB_RE.search("built real-time data pipelines") is not None
    assert ACTION_VERB_RE.search("scaled distributed clusters") is not None
    assert ACTION_VERB_RE.search("migrated legacy database") is not None

    assert METRIC_RE.search("reduced latency 40%") is not None
    assert METRIC_RE.search("handled 50k RPS") is not None
    assert METRIC_RE.search("saved $120k annually") is not None
    assert METRIC_RE.search("scaled to 2 million users") is not None


def test_enrich_candidate_skills_end_to_end():
    """
    Verify full context enrichment fuses Gazetteer matches with section anchors,
    inherits structured dates from experience entries, and aggregates evidence metrics.
    """
    resume_text = """
Deva Kumar B
devakumar235@gmail.com | (555) 123-4567

PROFESSIONAL SUMMARY
Senior Full Stack Engineer with 5+ years building distributed systems in Python and Go.

TECHNICAL SKILLS
Languages: Python, Go, TypeScript, SQL
Databases & Cloud: PostgreSQL, Redis, AWS, Docker

WORK EXPERIENCE
Senior Backend Engineer — TechCorp Inc.
Jan 2022 – Present
• Architected high-throughput microservices using FastAPI and Redis handling 50k RPS.
• Spearheaded containerized deployments on Kubernetes with automated CI/CD pipelines.

Software Engineer — DataFlow Systems
Jun 2019 — Dec 2021
• Optimized PostgreSQL query performance, reducing p99 latency by 45%.
• Developed real-time streaming pipelines in Python and Apache Kafka.

CERTIFICATIONS
AWS Certified Solutions Architect — Associate
"""

    experience_items = [
        {
            "role": "Senior Backend Engineer",
            "company": "TechCorp Inc.",
            "period": "Jan 2022 – Present",
            "start_date": "2022-01",
            "end_date": "Present",
            "is_current_role": True,
        },
        {
            "role": "Software Engineer",
            "company": "DataFlow Systems",
            "period": "Jun 2019 — Dec 2021",
            "start_date": "2019-06",
            "end_date": "2021-12",
            "is_current_role": False,
        }
    ]

    enriched = enrich_candidate_skills(
        raw_text=resume_text,
        experience_items=experience_items
    )

    assert len(enriched) > 0
    by_name = {e["canonical_name"]: e for e in enriched}

    # 1. PostgreSQL should have highest tier = demonstrated_impact (45% latency metric)
    assert "PostgreSQL" in by_name
    pg_entity = by_name["PostgreSQL"]
    assert pg_entity["highest_mention_tier"] == "demonstrated_impact"
    assert pg_entity["max_evidence_weight"] == 1.8
    assert pg_entity["category"] == "database"

    # 2. Redis should inherit active role from TechCorp (is_actively_used = True)
    assert "Redis" in by_name
    redis_entity = by_name["Redis"]
    assert redis_entity["is_actively_used"] is True
    assert redis_entity["highest_mention_tier"] == "demonstrated_impact"

    # 3. AWS should be recognized with is_certified = True
    assert "AWS" in by_name
    aws_entity = by_name["AWS"]
    assert aws_entity["is_certified"] is True

    # 4. Check category preservation across types (language, framework, database)
    assert by_name["Python"]["category"] == "language"
    assert by_name["FastAPI"]["category"] == "framework"


def test_enrich_candidate_skills_category_preservation_and_max_date():
    """
    P-5 Regression Test:
    Verify that context enricher preserves skill category from rich_matches
    (e.g., 'language', 'framework', 'database' instead of defaulting to 'tool')
    and picks the latest date max(dates) for last_used_date across multiple past roles.
    """
    resume_text = """
Jane Developer
jane@example.com

EXPERIENCE
Senior Backend Developer — Alpha Corp
Jan 2018 — Dec 2019
• Built microservices using Go and PostgreSQL.

Lead Systems Architect — Beta Systems
Jan 2020 — Jun 2022
• Scaled distributed high-throughput pipelines using Go and Redis.
"""

    experience_items = [
        {
            "role": "Senior Backend Developer",
            "company": "Alpha Corp",
            "period": "Jan 2018 — Dec 2019",
            "start_date": "2018-01",
            "end_date": "2019-12",
            "is_current_role": False,
        },
        {
            "role": "Lead Systems Architect",
            "company": "Beta Systems",
            "period": "Jan 2020 — Jun 2022",
            "start_date": "2020-01",
            "end_date": "2022-06",
            "is_current_role": False,
        },
    ]

    enriched = enrich_candidate_skills(
        raw_text=resume_text,
        experience_items=experience_items,
    )

    by_name = {e["canonical_name"]: e for e in enriched}

    # Verify category preservation from rich_matches / taxonomy
    assert "Go" in by_name
    go_entity = by_name["Go"]
    assert go_entity["category"] == "language", f"Expected 'language', got {go_entity['category']}"

    assert "PostgreSQL" in by_name
    pg_entity = by_name["PostgreSQL"]
    assert pg_entity["category"] == "database", f"Expected 'database', got {pg_entity['category']}"

    # Verify last_used_date uses max(dates) = "2022-06", NOT the first date "2019-12"
    assert go_entity["is_actively_used"] is False
    assert go_entity["last_used_date"] == "2022-06", f"Expected latest date '2022-06', got {go_entity['last_used_date']}"

