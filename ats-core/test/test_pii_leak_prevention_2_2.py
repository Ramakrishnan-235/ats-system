import pytest
import hashlib
from types import SimpleNamespace
from unittest.mock import Mock, AsyncMock, patch

from ats_core.parsers.anonymizer import ResumeAnonymizer
from ats_core.evaluator.audit_logger import AuditLogger, sanitize_audit_prompt
from ats_core.schema.evaluation import DeepCandidateEvaluationReport


def test_anonymizer_redacts_known_name_parts_emails_phones_urls():
    """Finding 2.2: Re-use name, email, phone and URLs extracted by parser even if Presidio misses them."""
    anonymizer = ResumeAnonymizer()
    raw_text = (
        "Deva Kumar B\n"
        "Email: devakumar@example.com | Phone: +91 98765 43210 | Location: Cuddalore, Tamil Nadu\n"
        "LinkedIn: https://linkedin.com/in/devakumar | GitHub: https://github.com/devakumar\n"
        "Experience:\n"
        "Staff Engineer at Acme Corp (2019 - 2023)\n"
        "- Deva architected microservices. Kumar also managed database migrations.\n"
    )

    redacted = anonymizer.anonymize(
        text=raw_text,
        known_name="Deva Kumar B",
        known_email="devakumar@example.com",
        known_phone="+91 98765 43210",
        known_location="Cuddalore, Tamil Nadu",
        known_urls=["https://linkedin.com/in/devakumar", "https://github.com/devakumar"],
    )

    # Real name and its constituent tokens must be removed
    assert "Deva Kumar B" not in redacted
    assert "Deva" not in redacted
    assert "Kumar" not in redacted
    assert "devakumar@example.com" not in redacted
    assert "98765" not in redacted
    assert "linkedin.com/in/devakumar" not in redacted
    assert "github.com/devakumar" not in redacted

    # Placeholders must be present
    assert "[CANDIDATE_NAME]" in redacted
    assert "[EMAIL_ADDRESS]" in redacted
    assert "[PHONE_NUMBER]" in redacted
    assert "[PROFILE_URL]" in redacted


def test_anonymizer_preserves_date_intervals_against_phone_overmatching():
    """Finding 2.2: Phone scrubbing must not wipe date ranges like 2019 - 2023."""
    anonymizer = ResumeAnonymizer()
    raw_text = (
        "Employment History:\n"
        "- Senior Backend Engineer (2019 - 2023)\n"
        "- Software Engineer (2015 – 2019)\n"
        "- Lead Architect (Jan 2019 - Dec 2023)\n"
        "- Principal Specialist (2020 - Present)\n"
        "Contact: +1 (555) 123-4567 or 555-867-5309"
    )

    redacted = anonymizer.anonymize(raw_text)

    # Phone numbers must be scrubbed
    assert "123-4567" not in redacted
    assert "867-5309" not in redacted
    assert "[PHONE_NUMBER]" in redacted

    # Employment dates must be preserved for evaluator quality
    assert "2019 - 2023" in redacted
    assert "2015 – 2019" in redacted
    assert "Jan 2019 - Dec 2023" in redacted
    assert "2020 - Present" in redacted


def test_preflight_leak_detection_and_residual_scrubbing():
    """Finding 2.2: Pre-flight check detects lingering PII and sanitizes it before external LLM dispatch."""
    anonymizer = ResumeAnonymizer()
    dirty_text = "Here is some candidate notes mentioning Johnathan and contact at john@example.com"
    
    is_clean, leaks = anonymizer.check_preflight_leak(
        text=dirty_text,
        name="Johnathan Smith",
        email="john@example.com",
    )
    assert not is_clean
    assert any("name" in l for l in leaks)
    assert any("email" in l for l in leaks)

    # Residual scrubbing clears it
    scrubbed = anonymizer.scrub_residual_pii(
        text=dirty_text,
        name="Johnathan Smith",
        email="john@example.com",
    )
    clean_now, remaining = anonymizer.check_preflight_leak(
        text=scrubbed,
        name="Johnathan Smith",
        email="john@example.com",
    )
    assert clean_now
    assert remaining == []
    assert "Johnathan" not in scrubbed
    assert "john@example.com" not in scrubbed


@pytest.mark.asyncio
async def test_audit_logger_hashes_raw_prompt_to_prevent_long_term_storage():
    """Finding 2.2: ScoringAudit.raw_prompt stores cryptographic hash rather than full raw prompt long-term."""
    raw_candidate_prompt = "CONFIDENTIAL RESUME DOSSIER: Jane Doe, jane@example.com, Experience at Secret Corp"
    expected_hash = f"sha256:{hashlib.sha256(raw_candidate_prompt.encode('utf-8')).hexdigest()}"

    # Direct helper test
    sanitized = sanitize_audit_prompt(raw_candidate_prompt)
    assert sanitized == expected_hash
    assert "Jane Doe" not in sanitized
    assert "CONFIDENTIAL" not in sanitized

    # Persist audit record test
    mock_session = SimpleNamespace(add=Mock(), commit=AsyncMock())
    report = DeepCandidateEvaluationReport(overall_match_score=88)

    entry = await AuditLogger.persist_audit_record(
        session=mock_session,
        report=report,
        candidate_id="cand-test-pii-1",
        job_id="job-test-pii-1",
        raw_prompt=raw_candidate_prompt,
    )

    assert entry.raw_prompt == expected_hash
    assert "Jane Doe" not in str(entry.raw_prompt)
    assert "Secret Corp" not in str(entry.raw_prompt)


def test_sanitize_audit_prompt_preserves_existing_hash_or_empty():
    """Already hashed prompt digests or empty prompts should be handled cleanly."""
    assert sanitize_audit_prompt("") is None
    assert sanitize_audit_prompt(None) is None
    assert sanitize_audit_prompt("sha256:abc12345") == "sha256:abc12345"
