"""
Unit and regression tests for Finding 3.2:
1. Concurrent evaluation of candidates in POST /api/v1/match/evaluate-job
2. Preventing HTTP timeouts by parallelizing evaluations up to 50 candidates
3. Bounded concurrency via semaphore to protect downstream resources
4. Individual evaluation failures do not abort the entire batch
5. Full failure returns HTTP 502 Bad Gateway
"""

import os
import sys
import time
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock
import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from ats_core.api import auth
from ats_core.api.v1 import match, candidates, jobs


@pytest.fixture
def match_api(monkeypatch, tmp_path):
    monkeypatch.setattr(auth, "ATS_AUTH_ENABLED", False)
    monkeypatch.setattr(candidates, "CANDIDATES_STORE", {})
    monkeypatch.setattr(candidates, "UPLOAD_TASKS_STORE", {})
    monkeypatch.setattr(match, "sync_candidates_to_retriever", lambda *args, **kwargs: 0)
    monkeypatch.setattr(jobs, "JOBS_STORE", {
        "job-eng": {
            "id": "job-eng",
            "title": "Senior Python Engineer",
            "department": "Engineering",
            "status": "OPEN",
            "job_description": "Senior Python and FastAPI backend engineer",
            "candidates_count": 0,
        }
    })
    monkeypatch.setattr(jobs, "JOB_CANDIDATES_STORE", {})

    app = FastAPI()
    app.include_router(match.router, prefix="/api/v1", dependencies=[Depends(auth.verify_api_key)])
    with TestClient(app) as client:
        yield client


def _make_mock_report(score: float = 85.0):
    return SimpleNamespace(
        overall_match_score=score,
        match_score=score,
        qualification_tier="Strong Fit" if score >= 80 else "Potential Fit",
        criteria_breakdown=[{"criterion": "Python", "score": score, "rationale": "Solid experience"}],
        cons_or_risks=[],
        pros=["Strong Python skills"],
        recommended_interview_questions=["How do you structure FastAPI apps?"],
        recruiter_summary="Recommended candidate.",
    )


def test_match_evaluates_candidates_concurrently_and_fast(match_api, monkeypatch):
    """
    Verify that 10 candidates are evaluated concurrently in parallel rather than sequentially.
    Sequential execution of 10 * 60ms = 600ms minimum.
    Concurrent execution with concurrency 10 finishes in ~100-250ms.
    """
    # Seed 10 candidates in CANDIDATES_STORE
    num_candidates = 10
    cand_list = []
    for i in range(num_candidates):
        cid = f"cand-{i}"
        cand_data = {
            "id": cid,
            "name": f"Candidate {i}",
            "target_headline": "Python Engineer",
            "core_skills": ["Python", "FastAPI"],
            "raw_text": f"Candidate {i} with 5 years Python and FastAPI experience.",
            "scorecard": {"overall_match_score": None, "evaluation_status": "PENDING"},
            "stage": "Screening",
        }
        candidates.CANDIDATES_STORE[cid] = cand_data
        cand_list.append({
            "candidate_id": cid,
            "text": cand_data["raw_text"],
            "rerank_score": 0.90 + (i * 0.005),
            "rerank_rank": i + 1,
            "metadata": {"name": cand_data["name"], "title": cand_data["target_headline"], "skills": cand_data["core_skills"]}
        })

    # Mock retriever, reranker, and sync to avoid offline DB connection timeout
    monkeypatch.setattr(match, "sync_candidates_to_retriever", lambda *args, **kwargs: 0)
    mock_retriever = MagicMock()
    mock_retriever.hybrid_search.return_value = cand_list
    monkeypatch.setattr(match, "get_retriever", lambda: mock_retriever)
    mock_reranker = MagicMock()
    mock_reranker.rerank.return_value = cand_list
    monkeypatch.setattr(match, "get_reranker", lambda: mock_reranker)

    # Mock evaluate_candidate with a 60ms simulated LLM latency
    def slow_evaluate(*args, **kwargs):
        time.sleep(0.06)
        return _make_mock_report(88.0)

    monkeypatch.setitem(sys.modules, "ats_core.evaluator.llm_evaluator", SimpleNamespace(
        evaluate_candidate=slow_evaluate,
        EvaluationReport=object,
    ))

    start_time = time.time()
    response = match_api.post("/api/v1/match/evaluate-job", json={
        "job_id": "job-eng",
        "job_title": "Senior Python Engineer",
        "job_description": "Senior Python and FastAPI backend engineer",
        "stage1_retrieve_limit": 50,
        "stage2_rerank_limit": 10,
    })
    elapsed = time.time() - start_time

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["stage3_final_ranked"] == num_candidates
    assert len(data["candidates"]) == num_candidates
    assert len(data["failed_candidate_ids"]) == 0

    # Sequential: 10 * 0.06 = 0.60s minimum.
    # Concurrent: runs in parallel in ~0.08 - 0.35s (< 0.45s).
    assert elapsed < 0.45, f"Evaluations took too long ({elapsed:.3f}s), expected concurrent execution"


def test_match_bounded_concurrency_limit(match_api, monkeypatch):
    """Verify that ATS_MATCH_CONCURRENCY bounds the maximum number of simultaneous evaluations."""
    monkeypatch.setenv("ATS_MATCH_CONCURRENCY", "3")

    num_candidates = 8
    cand_list = []
    for i in range(num_candidates):
        cid = f"bound-cand-{i}"
        candidates.CANDIDATES_STORE[cid] = {
            "id": cid, "name": f"Cand {i}", "target_headline": "Python Dev", "core_skills": ["Python"],
            "raw_text": "Python dev", "scorecard": {}, "stage": "Screening"
        }
        cand_list.append({
            "candidate_id": cid, "text": "Python dev", "rerank_score": 0.85, "rerank_rank": i + 1, "metadata": {}
        })

    mock_retriever = MagicMock()
    mock_retriever.hybrid_search.return_value = cand_list
    monkeypatch.setattr(match, "get_retriever", lambda: mock_retriever)
    mock_reranker = MagicMock()
    mock_reranker.rerank.return_value = cand_list
    monkeypatch.setattr(match, "get_reranker", lambda: mock_reranker)

    active_evals = 0
    max_active_evals = 0

    def tracking_evaluate(*args, **kwargs):
        nonlocal active_evals, max_active_evals
        active_evals += 1
        if active_evals > max_active_evals:
            max_active_evals = active_evals
        time.sleep(0.04)
        active_evals -= 1
        return _make_mock_report(80.0)

    monkeypatch.setitem(sys.modules, "ats_core.evaluator.llm_evaluator", SimpleNamespace(
        evaluate_candidate=tracking_evaluate,
        EvaluationReport=object,
    ))

    response = match_api.post("/api/v1/match/evaluate-job", json={
        "job_title": "Python Dev",
        "job_description": "Python developer",
        "stage1_retrieve_limit": 50,
        "stage2_rerank_limit": 8,
    })
    assert response.status_code == 200
    assert max_active_evals <= 3, f"Max concurrent evaluations {max_active_evals} exceeded semaphore limit of 3"


def test_match_individual_candidate_failure_does_not_abort_batch(match_api, monkeypatch):
    """Verify that if one candidate evaluation fails, other candidate evaluations still succeed."""
    cands = [
        {"candidate_id": "good-1", "text": "Good candidate 1", "rerank_score": 0.9, "rerank_rank": 1, "metadata": {}},
        {"candidate_id": "bad-2", "text": "Bad candidate 2", "rerank_score": 0.8, "rerank_rank": 2, "metadata": {}},
        {"candidate_id": "good-3", "text": "Good candidate 3", "rerank_score": 0.7, "rerank_rank": 3, "metadata": {}},
    ]
    for c in cands:
        candidates.CANDIDATES_STORE[c["candidate_id"]] = {
            "id": c["candidate_id"], "name": c["candidate_id"], "target_headline": "Engineer",
            "core_skills": ["Python"], "raw_text": c["text"], "scorecard": {}, "stage": "Screening"
        }

    mock_retriever = MagicMock()
    mock_retriever.hybrid_search.return_value = cands
    monkeypatch.setattr(match, "get_retriever", lambda: mock_retriever)
    mock_reranker = MagicMock()
    mock_reranker.rerank.return_value = cands
    monkeypatch.setattr(match, "get_reranker", lambda: mock_reranker)

    def flaky_evaluate(candidate_summary: str, job_description: str):
        if "Bad candidate" in candidate_summary:
            raise RuntimeError("Candidate dossier syntax corrupted")
        return _make_mock_report(90.0)

    monkeypatch.setitem(sys.modules, "ats_core.evaluator.llm_evaluator", SimpleNamespace(
        evaluate_candidate=flaky_evaluate,
        EvaluationReport=object,
    ))

    response = match_api.post("/api/v1/match/evaluate-job", json={
        "job_title": "Engineer",
        "job_description": "Python",
        "stage1_retrieve_limit": 10,
        "stage2_rerank_limit": 3,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["stage3_final_ranked"] == 2
    assert "bad-2" in data["failed_candidate_ids"]
    candidate_ids = [c["id"] for c in data["candidates"]]
    assert "good-1" in candidate_ids
    assert "good-3" in candidate_ids
    assert "bad-2" not in candidate_ids


def test_match_up_to_50_candidates_evaluated(match_api, monkeypatch):
    """Verify that evaluating the maximum allowed 50 candidates executes concurrently without timeout."""
    num_candidates = 50
    cand_list = []
    for i in range(num_candidates):
        cid = f"cand-max-{i}"
        candidates.CANDIDATES_STORE[cid] = {
            "id": cid, "name": f"Cand {i}", "target_headline": "Dev", "core_skills": ["Python"],
            "raw_text": f"Cand {i} text", "scorecard": {}, "stage": "Screening"
        }
        cand_list.append({
            "candidate_id": cid, "text": f"Cand {i} text", "rerank_score": 0.8, "rerank_rank": i + 1, "metadata": {}
        })

    mock_retriever = MagicMock()
    mock_retriever.hybrid_search.return_value = cand_list
    monkeypatch.setattr(match, "get_retriever", lambda: mock_retriever)
    mock_reranker = MagicMock()
    mock_reranker.rerank.return_value = cand_list
    monkeypatch.setattr(match, "get_reranker", lambda: mock_reranker)

    monkeypatch.setitem(sys.modules, "ats_core.evaluator.llm_evaluator", SimpleNamespace(
        evaluate_candidate=MagicMock(return_value=_make_mock_report(85.0)),
        EvaluationReport=object,
    ))

    response = match_api.post("/api/v1/match/evaluate-job", json={
        "job_title": "Dev",
        "job_description": "Python",
        "stage1_retrieve_limit": 100,
        "stage2_rerank_limit": 50,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["total_reranked_stage2"] == 50
    assert data["stage3_final_ranked"] == 50
    assert len(data["failed_candidate_ids"]) == 0
