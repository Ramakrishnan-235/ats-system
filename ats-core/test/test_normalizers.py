import pytest
from ats_core.parsers.normalizers import (
    normalize_date,
    normalize_date_range,
    normalize_phone,
    normalize_skill,
    normalize_skills_list,
    SKILL_ALIASES,
    SHORT_EXACT_SKILLS,
)
from ats_core.schema.skills import SkillsTaxonomy, ExtractedSkill
from ats_core.schema.timeline import WorkExperience


# =====================================================================
# 1. DATE NORMALIZATION TESTS
# =====================================================================

def test_normalize_date_present_tokens():
    """Verify 'Present' tokens are special-cased and NEVER hit dateparser."""
    assert normalize_date("present") == "Present"
    assert normalize_date("Present") == "Present"
    assert normalize_date("CURRENT") == "Present"
    assert normalize_date("now") == "Present"
    assert normalize_date("till date") == "Present"
    assert normalize_date("to date.") == "Present"
    assert normalize_date("present day") == "Present"
    assert normalize_date("2021-05", is_current=True) == "Present"


def test_normalize_date_year_only_precision():
    """Verify 4-digit year dates maintain year precision and do NOT fabricate months (e.g. '2020-01')."""
    assert normalize_date("2020") == "2020"
    assert normalize_date("2024") == "2024"
    assert normalize_date("1998") == "1998"
    assert normalize_date("2026 (exp)") == "2026"


def test_normalize_date_month_year():
    """Verify Month-Year formats are standardized to YYYY-MM."""
    assert normalize_date("May 2021") == "2021-05"
    assert normalize_date("Dec 2024") == "2024-12"
    assert normalize_date("January 2023") == "2023-01"
    assert normalize_date("03/2022") == "2022-03"


def test_normalize_date_garbage():
    """Verify unparseable string returns None rather than garbage."""
    assert normalize_date(None) is None
    assert normalize_date("") is None
    assert normalize_date("random text here") is None
    assert normalize_date("asdfqwer") is None


def test_normalize_date_range():
    """Verify date ranges with mixed tokens, dashes, and present words."""
    start, end, is_curr = normalize_date_range("May 2021 - Present")
    assert start == "2021-05"
    assert end == "Present"
    assert is_curr is True

    start, end, is_curr = normalize_date_range("2020 — 2023")
    assert start == "2020"
    assert end == "2023"
    assert is_curr is False

    start, end, is_curr = normalize_date_range("Dec 2024 to Jan 2025")
    assert start == "2024-12"
    assert end == "2025-01"
    assert is_curr is False


# =====================================================================
# 2. PHONE NUMBER NORMALIZATION TESTS
# =====================================================================

def test_normalize_phone_e164_us():
    """Verify US/Canada standard phone numbers format to E.164."""
    assert normalize_phone("(415) 555-0182", default_region="US") == "+14155550182"
    assert normalize_phone("+1-415-555-0182") == "+14155550182"
    assert normalize_phone("415.555.0182", default_region="US") == "+14155550182"
    assert normalize_phone("4155550182", default_region="US") == "+14155550182"


def test_normalize_phone_e164_india():
    """Verify Indian standard phone numbers (+91) format to E.164."""
    assert normalize_phone("+91-86676-60065") == "+918667660065"
    assert normalize_phone("+91 86676 60065") == "+918667660065"
    assert normalize_phone("918667660065") == "+918667660065"
    assert normalize_phone("8667660065", default_region="IN") == "+918667660065"


def test_normalize_phone_invalid():
    """Verify invalid phone numbers return None."""
    assert normalize_phone(None) is None
    assert normalize_phone("") is None
    assert normalize_phone("12345") is None
    assert normalize_phone("not a phone number") is None


# =====================================================================
# 3. SKILL TAXONOMY & NORMALIZATION TESTS
# =====================================================================

def test_short_skills_never_fuzzy_match():
    """Verify single-letter and short acronym skills NEVER go through fuzzy matching."""
    # Critical distinct language checks
    assert normalize_skill("C") == "C"
    assert normalize_skill("c") == "C"
    assert normalize_skill("c++") == "C++"
    assert normalize_skill("cpp") == "C++"
    assert normalize_skill("C#") == "C#"
    assert normalize_skill("csharp") == "C#"
    assert normalize_skill("R") == "R"
    assert normalize_skill("Go") == "Go"
    assert normalize_skill("golang") == "Go"
    assert normalize_skill("JS") == "JavaScript"
    assert normalize_skill("TS") == "TypeScript"
    assert normalize_skill("SQL") == "SQL"
    assert normalize_skill("Git") == "Git"

    # Ensure C does not match CI or C++ or C#
    assert normalize_skill("C") != "CI/CD"
    assert normalize_skill("C") != "C++"
    assert normalize_skill("C") != "C#"


def test_skill_aliases_lookup():
    """Verify direct alias mappings."""
    assert normalize_skill("k8s") == "Kubernetes"
    assert normalize_skill("kubernetes") == "Kubernetes"
    assert normalize_skill("reactjs") == "React"
    assert normalize_skill("react.js") == "React"
    assert normalize_skill("postgres") == "PostgreSQL"
    assert normalize_skill("postgresql") == "PostgreSQL"
    assert normalize_skill("nodejs") == "Node.js"
    assert normalize_skill("node.js") == "Node.js"
    assert normalize_skill("tailwind") == "Tailwind CSS"
    assert normalize_skill("tailwindcss") == "Tailwind CSS"
    assert normalize_skill("fastapi") == "FastAPI"
    assert normalize_skill("docker") == "Docker"
    assert normalize_skill("aws") == "AWS"
    assert normalize_skill("gcp") == "GCP"


def test_skill_fuzzy_matching_typos():
    """Verify rapidfuzz fuzzy matching corrects typos in long skill names."""
    assert normalize_skill("javascrpt") == "JavaScript"
    assert normalize_skill("kubernets") == "Kubernetes"
    assert normalize_skill("typecript") == "TypeScript"
    assert normalize_skill("postgressql") == "PostgreSQL"
    assert normalize_skill("dockr") == "Docker"
    assert normalize_skill("fastapii") == "FastAPI"
    assert normalize_skill("pytorh") == "PyTorch"


def test_unknown_skills_preserved():
    """Verify unknown or specialized proprietary skills preserve candidate wording without inventing."""
    assert normalize_skill("InternalCustomFramework") == "InternalCustomFramework"
    assert normalize_skill("ProprietaryDatabaseEngine") == "ProprietaryDatabaseEngine"


def test_normalize_skills_list_deduplication():
    """Verify normalize_skills_list deduplicates while preserving canonical titles."""
    raw_list = ["js", "JavaScript", "javascrpt", "k8s", "Kubernetes", "C++", "C", "C#", "tailwind", "Tailwind CSS"]
    norm_list = normalize_skills_list(raw_list)

    assert norm_list == ["JavaScript", "Kubernetes", "C++", "C", "C#", "Tailwind CSS"]


# =====================================================================
# 4. SCHEMA INTEGRATION TESTS
# =====================================================================

def test_skills_schema_deterministic_normalization():
    """Verify SkillsTaxonomy and ExtractedSkill schemas trigger deterministic normalization on ingestion."""
    data = {
        "core_languages": ["py", "javascrpt", "c++", "c", "c#", "golang"],
        "frameworks_and_tools": ["k8s", "dockr", "fastapii", "tailwind"],
        "databases_and_infrastructure": ["postgres", "redis", "aws"]
    }
    taxonomy = SkillsTaxonomy(**data)
    assert taxonomy.core_languages == ["Python", "JavaScript", "C++", "C", "C#", "Go"]
    assert taxonomy.frameworks_and_tools == ["Kubernetes", "Docker", "FastAPI", "Tailwind CSS"]
    assert taxonomy.databases_and_infrastructure == ["PostgreSQL", "Redis", "AWS"]


def test_timeline_schema_deterministic_normalization():
    """Verify WorkExperience schema normalizes dates and skills."""
    role_data = {
        "company_name": "Stripe",
        "job_title": "Senior Staff Engineer",
        "start_date": "May 2021",
        "end_date": "present",
        "primary_technologies": ["k8s", "postgres", "fastapi", "c++"]
    }
    exp = WorkExperience(**role_data)
    assert exp.start_date == "2021-05"
    assert exp.end_date == "Present"
    assert exp.is_current_role is True
    assert exp.primary_technologies == ["Kubernetes", "PostgreSQL", "FastAPI", "C++"]
