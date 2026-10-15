"""Unit and integration tests verifying single canonical indexing of candidates in CANDIDATES_STORE."""

import sys
import uuid
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ats_core.api import auth, upload_storage
from ats_core.api.v1 import candidates, dashboard, jobs, match
from ats_core.api.v1.candidates import (
    get_candidate_from_store,
    get_candidate_key_in_store,
)
from ats_core.db import store_sync


@pytest.fixture
def clean_stores():
    candidates.CANDIDATES_STORE.clear()
    candidates.UPLOAD_TASKS_STORE.clear()
    jobs.JOB_CANDIDATES_STORE.clear()
    jobs.JOBS_STORE.clear()
    jobs.JOBS_STORE["job-open"] = {
        "id": "job-open",
        "title": "Software Engineer",
        "department": "Engineering",
        "status": "OPEN",
        "candidates_count": 0,
    }
    yield
    candidates.CANDIDATES_STORE.clear()
    candidates.UPLOAD_TASKS_STORE.clear()
    jobs.JOB_CANDIDATES_STORE.clear()


@pytest.fixture
def api(clean_stores, monkeypatch, tmp_path):
    monkeypatch.setattr(auth, "ATS_AUTH_ENABLED", False)
    monkeypatch.setattr(candidates, "UPLOAD_STAGING_DIR", tmp_path)
    monkeypatch.setattr(upload_storage, "UPLOAD_STAGING_DIR", tmp_path)
    app = FastAPI()
    for router in (candidates.router, dashboard.router, jobs.router, match.router):
        app.include_router(router, prefix="/api/v1", dependencies=[Depends(auth.verify_api_key)])
    with TestClient(app) as client:
        yield client


def _make_mock_db_candidate(cand_uuid: uuid.UUID, name: str = "Alice Smith"):
    return SimpleNamespace(
        id=cand_uuid,
        anonymized_name=f"Candidate #{cand_uuid.hex[:8]}",
        target_headline="Senior Software Engineer",
        years_of_experience=5.0,
        location="San Francisco, CA",
        highest_education="B.S. Computer Science",
        core_skills=["Python", "FastAPI", "PostgreSQL"],
        raw_anonymized_text="Experienced engineer with Python and FastAPI.",
        structured_profile={
            "name": name,
            "core_skills": ["Python", "FastAPI", "PostgreSQL"],
            "target_headline": "Senior Software Engineer",
            "stage": "Screening",
            "status": "Screening",
            "email": "alice@example.com",
            "scorecard": {
                "overall_match_score": 85,
                "match_tier": "Strong Fit",
                "evaluation_status": "COMPLETED",
                "categories": [],
                "risk_flags": [],
            },
        },
        created_at=None,
    )


def test_sync_candidates_from_db_single_canonical_key(clean_stores, monkeypatch):
    """Verify sync_candidates_from_db stores each DB candidate under cand-{hex} only."""
    u1 = uuid.uuid4()
    u2 = uuid.uuid4()
    db_cands = [
        _make_mock_db_candidate(u1, "Alice"),
        _make_mock_db_candidate(u2, "Bob"),
    ]

    mock_session = MagicMock()
    mock_session.query.return_value.all.return_value = db_cands

    @contextmanager
    def mock_get_sync_session():
        yield mock_session

    monkeypatch.setattr(store_sync, "get_sync_session", mock_get_sync_session)

    count = store_sync.sync_candidates_from_db()
    assert count == 2

    # Exactly 2 entries in CANDIDATES_STORE, NOT 4
    assert len(candidates.CANDIDATES_STORE) == 2

    canonical_1 = f"cand-{u1.hex}"
    canonical_2 = f"cand-{u2.hex}"
    assert canonical_1 in candidates.CANDIDATES_STORE
    assert canonical_2 in candidates.CANDIDATES_STORE

    # Raw UUID strings MUST NOT be duplicate keys in CANDIDATES_STORE
    assert str(u1) not in candidates.CANDIDATES_STORE
    assert str(u2) not in candidates.CANDIDATES_STORE


def test_sync_candidate_by_id_from_db_single_canonical_key(clean_stores, monkeypatch):
    """Verify sync_candidate_by_id_from_db stores candidate under cand-{hex} only."""
    u = uuid.uuid4()
    db_c = _make_mock_db_candidate(u, "Charlie")

    mock_session = MagicMock()
    mock_session.query.return_value.filter.return_value.first.return_value = db_c

    @contextmanager
    def mock_get_sync_session():
        yield mock_session

    monkeypatch.setattr(store_sync, "get_sync_session", mock_get_sync_session)

    # Look up using raw UUID string
    result = store_sync.sync_candidate_by_id_from_db(str(u))
    assert result is not None
    assert result["id"] == f"cand-{u.hex}"

    # Exactly 1 entry in store under canonical key
    assert len(candidates.CANDIDATES_STORE) == 1
    assert f"cand-{u.hex}" in candidates.CANDIDATES_STORE
    assert str(u) not in candidates.CANDIDATES_STORE


def test_get_candidate_from_store_lookup_variants(clean_stores):
    """Verify get_candidate_from_store and get_candidate_key_in_store resolve all ID formats."""
    u = uuid.uuid4()
    canonical_id = f"cand-{u.hex}"
    cand_dict = {"id": canonical_id, "name": "Diana Prince", "stage": "Screening"}
    candidates.CANDIDATES_STORE[canonical_id] = cand_dict

    # 1. Canonical key lookup
    assert get_candidate_key_in_store(canonical_id) == canonical_id
    assert get_candidate_from_store(canonical_id) == cand_dict

    # 2. Raw UUID string with dashes
    raw_uuid_dashed = str(u)
    assert get_candidate_key_in_store(raw_uuid_dashed) == canonical_id
    assert get_candidate_from_store(raw_uuid_dashed) == cand_dict

    # 3. Raw 32-char hex string
    raw_hex = u.hex
    assert get_candidate_key_in_store(raw_hex) == canonical_id
    assert get_candidate_from_store(raw_hex) == cand_dict

    # 4. Prefixed UUID with dashes (cand-<uuid-with-dashes>)
    prefixed_dashed = f"cand-{u}"
    assert get_candidate_key_in_store(prefixed_dashed) == canonical_id
    assert get_candidate_from_store(prefixed_dashed) == cand_dict

    # 5. Custom string ID
    custom_id = "cand-custom-007"
    candidates.CANDIDATES_STORE[custom_id] = {"id": custom_id, "name": "James Bond"}
    assert get_candidate_from_store(custom_id)["name"] == "James Bond"
    assert get_candidate_from_store("custom-007")["name"] == "James Bond"

    # Non-existent
    assert get_candidate_from_store("non-existent-id") is None
    assert get_candidate_key_in_store("non-existent-id") is None


def test_list_candidates_no_duplicates_from_db(api, monkeypatch):
    """Verify GET /api/v1/candidates returns exactly the count of DB candidates without duplication."""
    u1 = uuid.uuid4()
    u2 = uuid.uuid4()
    db_cands = [_make_mock_db_candidate(u1, "Alice"), _make_mock_db_candidate(u2, "Bob")]

    mock_session = MagicMock()
    mock_session.query.return_value.all.return_value = db_cands

    @contextmanager
    def mock_get_sync_session():
        yield mock_session

    monkeypatch.setattr(store_sync, "get_sync_session", mock_get_sync_session)

    res = api.get("/api/v1/candidates")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    ids = [c["id"] for c in data]
    assert len(set(ids)) == 2
    assert f"cand-{u1.hex}" in ids
    assert f"cand-{u2.hex}" in ids


def test_dashboard_stats_no_duplicates_from_db(api, monkeypatch):
    """Verify GET /api/v1/dashboard/stats reports accurate candidate count and pipeline stages."""
    u1 = uuid.uuid4()
    u2 = uuid.uuid4()
    db_cands = [_make_mock_db_candidate(u1, "Alice"), _make_mock_db_candidate(u2, "Bob")]

    mock_session = MagicMock()
    mock_session.query.return_value.all.return_value = db_cands

    @contextmanager
    def mock_get_sync_session():
        yield mock_session

    monkeypatch.setattr(store_sync, "get_sync_session", mock_get_sync_session)
    monkeypatch.setattr(store_sync, "sync_jobs_from_db", lambda: 0)

    res = api.get("/api/v1/dashboard/stats")
    assert res.status_code == 200
    data = res.json()
    # Total candidates must be 2, not 4
    candidates_stat = next(s for s in data["stats"] if s["id"] == "candidates")
    assert candidates_stat["value"] == "2"

    # Check pipeline screening list has exactly 2 candidates
    screening_cands = data["pipeline"].get("Screening", [])
    assert len(screening_cands) == 2


def test_raw_uuid_http_endpoints_resolve_correctly(api, monkeypatch):
    """Verify GET, POST, and PATCH candidate endpoints resolve raw UUID paths."""
    u = uuid.uuid4()
    db_c = _make_mock_db_candidate(u, "Eve Adams")

    mock_session = MagicMock()
    mock_session.query.return_value.filter.return_value.first.return_value = db_c

    @contextmanager
    def mock_get_sync_session():
        yield mock_session

    monkeypatch.setattr(store_sync, "get_sync_session", mock_get_sync_session)
    monkeypatch.setattr(store_sync, "sync_candidate_to_db", lambda cand: True)

    raw_uuid_str = str(u)

    # 1. GET /candidates/{raw_uuid}
    res = api.get(f"/api/v1/candidates/{raw_uuid_str}", params={"include_pii": "true"})
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Eve Adams"
    assert data["id"] == f"cand-{u.hex}"

    # Verify CANDIDATES_STORE still has only 1 entry
    assert len(candidates.CANDIDATES_STORE) == 1
    assert f"cand-{u.hex}" in candidates.CANDIDATES_STORE
    assert raw_uuid_str not in candidates.CANDIDATES_STORE

    # 2. GET /candidates/{raw_uuid}/scorecard
    res_sc = api.get(f"/api/v1/candidates/{raw_uuid_str}/scorecard")
    assert res_sc.status_code == 200
    assert res_sc.json()["overall_match_score"] == 85

    # 3. POST /candidates/{raw_uuid}/notes
    res_note = api.post(
        f"/api/v1/candidates/{raw_uuid_str}/notes",
        json={"content": "Strong background in distributed systems.", "author": "Recruiter"},
    )
    assert res_note.status_code == 200
    assert res_note.json()["content"] == "Strong background in distributed systems."

    # 4. PATCH /candidates/{raw_uuid}/stage
    res_stage = api.patch(f"/api/v1/candidates/{raw_uuid_str}/stage?new_stage=Interview")
    assert res_stage.status_code == 200
    assert res_stage.json()["stage"] == "Interview"
    assert candidates.CANDIDATES_STORE[f"cand-{u.hex}"]["stage"] == "Interview"


def test_retriever_sync_indexes_candidates_without_duplicates(clean_stores, monkeypatch):
    """Verify sync_candidates_to_retriever gathers each candidate exactly once."""
    u = uuid.uuid4()
    canonical_id = f"cand-{u.hex}"
    candidates.CANDIDATES_STORE[canonical_id] = {
        "id": canonical_id,
        "name": "Frank",
        "target_headline": "Backend Engineer",
        "core_skills": ["Go", "Python"],
    }

    mock_retriever = SimpleNamespace(
        dense_embeddings={},
        candidate_corpus={},
        index_candidates=MagicMock(),
    )

    # Also mock DB having the same candidate
    db_c = _make_mock_db_candidate(u, "Frank")
    mock_session = MagicMock()
    mock_session.query.return_value.all.return_value = [db_c]

    @contextmanager
    def mock_session_factory():
        yield mock_session

    monkeypatch.setattr(
        "ats_core.workers.tasks.get_session_factory",
        lambda: mock_session_factory,
    )

    indexed_count = match.sync_candidates_to_retriever(mock_retriever)
    # Must index Frank once, not twice
    assert indexed_count == 1
