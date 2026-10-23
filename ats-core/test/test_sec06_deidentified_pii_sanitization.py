"""Tests for SEC-06: De-identified columns and search corpus sanitization."""

import uuid
from unittest.mock import MagicMock, patch
import pytest

from ats_core.api.v1 import match
from ats_core.db import store_sync
from ats_core.models.db import Candidate


def test_sync_candidate_to_db_anonymizes_raw_text_and_strips_profile_pii():
    """SEC-06: sync_candidate_to_db must anonymize raw_text and strip contact identifiers from structured_profile."""
    cand_id = str(uuid.uuid4())
    cand_dict = {
        "id": cand_id,
        "name": "Alex Mercer",
        "email": "alex.mercer@prototype.io",
        "phone": "+1 (555) 987-6543",
        "location": "New York, NY",
        "linkedin": "https://linkedin.com/in/alexmercer",
        "github": "https://github.com/alexmercer",
        "target_headline": "Senior Systems Engineer",
        "core_skills": ["Rust", "Python", "Kubernetes"],
        "years_of_experience": 8.5,
        "highest_education": "Master of Science in Computer Science",
        "raw_text": (
            "Alex Mercer\n"
            "Email: alex.mercer@prototype.io | Phone: +1 (555) 987-6543\n"
            "LinkedIn: https://linkedin.com/in/alexmercer\n"
            "Summary: Senior Systems Engineer with 8+ years building distributed backends.\n"
        ),
        "experience": [
            {"role": "Systems Engineer", "company": "Acme Corp", "description": "Built distributed services."}
        ],
    }

    mock_db_candidate = Candidate(id=uuid.UUID(cand_id))
    mock_session = MagicMock()
    mock_session.query.return_value.filter.return_value.first.return_value = mock_db_candidate

    with patch.object(store_sync, "get_sync_session") as mock_get_sess:
        mock_get_sess.return_value.__enter__.return_value = mock_session
        result = store_sync.sync_candidate_to_db(cand_dict)

    assert result is True

    # 1. raw_anonymized_text must NOT contain unredacted PII
    raw_anon = mock_db_candidate.raw_anonymized_text
    assert raw_anon, "raw_anonymized_text must not be empty"
    assert "Alex Mercer" not in raw_anon
    assert "alex.mercer@prototype.io" not in raw_anon
    assert "987-6543" not in raw_anon
    assert "linkedin.com/in/alexmercer" not in raw_anon

    # 2. structured_profile must NOT contain raw contact identifiers or raw_text
    prof = mock_db_candidate.structured_profile
    assert prof, "structured_profile must not be empty"
    assert "name" not in prof or prof.get("name") is None
    assert "email" not in prof or prof.get("email") is None
    assert "phone" not in prof or prof.get("phone") is None
    assert "linkedin" not in prof or prof.get("linkedin") is None
    assert "raw_text" not in prof
    assert "unredacted_text" not in prof
    assert prof.get("target_headline") == "Senior Systems Engineer"
    assert prof.get("years_of_experience") == 8.5


def test_sync_candidates_to_retriever_sanitizes_pii_and_metadata():
    """SEC-06: sync_candidates_to_retriever must pass full contact entities to ResumeAnonymizer."""
    cand_id = f"cand-{uuid.uuid4().hex}"
    cand = {
        "id": cand_id,
        "name": "Elena Fisher",
        "email": "elena@uncharted.org",
        "phone": "+1-800-555-0199",
        "location": "Boston, MA",
        "linkedin": "https://linkedin.com/in/elenafisher",
        "target_headline": "Investigative Data Journalist",
        "core_skills": ["Data Analysis", "Python", "SQL"],
        "years_of_experience": 6.0,
        "raw_text": (
            "Elena Fisher\n"
            "Contact: elena@uncharted.org | +1-800-555-0199 | Boston, MA\n"
            "URL: https://linkedin.com/in/elenafisher\n"
            "Experienced investigative data analyst."
        ),
    }

    mock_retriever = MagicMock()
    mock_retriever.dense_embeddings = {}
    mock_retriever.candidate_corpus = {}
    indexed_records = []

    def capture_indexed(records):
        indexed_records.extend(records)

    mock_retriever.index_candidates.side_effect = capture_indexed

    from ats_core.api.v1 import candidates, jobs

    with patch.dict(candidates.CANDIDATES_STORE, {cand_id: cand}, clear=True):
        with patch.dict(jobs.JOB_CANDIDATES_STORE, {}, clear=True):
            with patch("ats_core.workers.tasks.get_session_factory") as mock_sf:
                mock_sf.return_value.return_value.__enter__.return_value.query.return_value.all.return_value = []
                count = match.sync_candidates_to_retriever(mock_retriever)

    assert count == 1
    assert len(indexed_records) == 1

    rec = indexed_records[0]
    doc_text = rec["text"]

    # Candidate PII must be redacted in indexed doc_text
    assert "Elena Fisher" not in doc_text
    assert "elena@uncharted.org" not in doc_text
    assert "555-0199" not in doc_text
    assert "linkedin.com/in/elenafisher" not in doc_text

    # Metadata must NOT contain real candidate name
    meta_name = rec["metadata"]["name"]
    assert "Elena Fisher" not in meta_name
    assert meta_name.startswith("Candidate #") or "Candidate" in meta_name
