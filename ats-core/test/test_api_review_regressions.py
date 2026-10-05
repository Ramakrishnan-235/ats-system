"""Offline API regression tests: no database, broker, downloaded model, or LLM calls."""

import importlib.util
import io
import sys
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ats_core.api import auth, upload_storage
from ats_core.api.v1 import candidates, dashboard, jobs, match


@pytest.fixture
def api(monkeypatch, tmp_path):
    monkeypatch.setattr(auth, "ATS_AUTH_ENABLED", False)
    monkeypatch.setattr(candidates, "CANDIDATES_STORE", {})
    monkeypatch.setattr(candidates, "UPLOAD_TASKS_STORE", {})
    monkeypatch.setattr(candidates, "UPLOAD_STAGING_DIR", tmp_path)
    monkeypatch.setattr(upload_storage, "UPLOAD_STAGING_DIR", tmp_path)
    monkeypatch.setattr(jobs, "JOBS_STORE", {
        "job-open": {"id": "job-open", "title": "Engineer", "department": "Engineering", "status": "OPEN", "job_description": "Python", "candidates_count": 0},
        "job-paused": {"id": "job-paused", "status": "PAUSED"},
    })
    monkeypatch.setattr(jobs, "JOB_CANDIDATES_STORE", {})
    app = FastAPI()
    for router in (candidates.router, dashboard.router, jobs.router, match.router):
        app.include_router(router, prefix="/api/v1", dependencies=[Depends(auth.verify_api_key)])
    with TestClient(app) as client:
        yield client


@pytest.fixture
def fake_processing(monkeypatch):
    profile = {
        "name": "Jane Doe", "email": "jane@example.com", "phone": "555-1234", "location": "London",
        "anonymized_name": "Candidate #123", "avatar": "JD", "target_headline": "Engineer",
        "raw_text": "Jane Doe jane@example.com 555-1234", "core_skills": [], "stage": "Contacted",
        "scorecard": {"overall_match_score": None, "evaluation_status": "PENDING", "categories": [], "suggested_questions": []},
    }
    parse = MagicMock(return_value=profile)
    monkeypatch.setitem(sys.modules, "ats_core.parsers.resume_parser", SimpleNamespace(parse_resume_to_candidate=parse))
    evaluator = MagicMock()
    evaluator.evaluate.return_value = {"success": False}
    redactor = MagicMock()
    redactor.anonymize.return_value = "[redacted resume]"
    monkeypatch.setitem(sys.modules, "ats_core.parsers.anonymizer", SimpleNamespace(ResumeAnonymizer=MagicMock(return_value=redactor)))
    monkeypatch.setitem(sys.modules, "ats_core.evaluator.deep_evaluator", SimpleNamespace(LocalDeepEvaluator=MagicMock(return_value=evaluator)))
    return parse


def upload(api, name="resume.pdf", content=b"%PDF-1.4 test", mime="application/pdf", data=None):
    return api.post("/api/v1/candidates/upload-async", files={"file": (name, io.BytesIO(content), mime)}, data=data)


def test_auth_requires_explicit_development_opt_out(monkeypatch):
    monkeypatch.delenv("ATS_AUTH_ENABLED", raising=False)
    spec = importlib.util.spec_from_file_location("isolated_auth", auth.__file__)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert module.ATS_AUTH_ENABLED is True


@pytest.mark.asyncio
async def test_unicode_api_key_is_rejected_without_server_error(monkeypatch):
    monkeypatch.setattr(auth, "ATS_AUTH_ENABLED", True)
    monkeypatch.setattr(auth, "EXPECTED_API_KEY", "secure-key")
    with pytest.raises(HTTPException) as error:
        await auth.verify_api_key(header_key="not-a-key-\u00e9", bearer_creds=None)
    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_whitespace_server_key_is_misconfiguration(monkeypatch):
    monkeypatch.setattr(auth, "ATS_AUTH_ENABLED", True)
    monkeypatch.setattr(auth, "EXPECTED_API_KEY", "   ")
    with pytest.raises(HTTPException) as error:
        await auth.verify_api_key(header_key=" ", bearer_creds=None)
    assert error.value.status_code == 500


def test_upload_filename_cannot_escape_server_owned_path(api, fake_processing, tmp_path):
    response = upload(api, name=r"..\..\outside.pdf")
    assert response.status_code == 202
    result = response.json()
    assert result["status"] == "ACCEPTED"
    assert result["filename"] == "outside.pdf"
    assert result["match_score"] is None
    assert result["evaluation_status"] == "PENDING"
    assert result["execution_mode"] == "inline"
    assert [path.name for path in tmp_path.iterdir()] == [f"{result['candidate_id']}.pdf"]
    task = api.get(f"/api/v1/candidates/tasks/{result['task_id']}").json()
    assert task["state"] == "SUCCESS"
    assert task["result"]["candidate_id"] == result["candidate_id"]
    assert "traceback" not in task


@pytest.mark.parametrize("name,content,mime", [
    ("fake.pdf", b"Not a PDF", "application/pdf"),
    ("script.txt", b"%PDF-1.4", "application/pdf"),
    ("resume.pdf", b"%PDF-1.4", "text/plain"),
    ("empty.pdf", b"", "application/octet-stream"),
])
def test_invalid_document_rejected_before_parsing(api, fake_processing, tmp_path, name, content, mime):
    response = upload(api, name, content, mime)
    assert response.status_code == 415
    fake_processing.assert_not_called()
    assert list(tmp_path.iterdir()) == []


def test_upload_size_limit_is_enforced_before_parsing(api, fake_processing, monkeypatch, tmp_path):
    monkeypatch.setattr(upload_storage, "MAX_UPLOAD_BYTES", 16)
    response = upload(api, content=b"%PDF-1.4" + b"a" * 32)
    assert response.status_code == 413
    fake_processing.assert_not_called()
    assert list(tmp_path.iterdir()) == []


def test_unknown_target_job_rejected_without_staging(api, fake_processing, tmp_path):
    assert upload(api, data={"job_id": "missing"}).status_code == 404
    fake_processing.assert_not_called()
    assert list(tmp_path.iterdir()) == []


def test_parse_failure_has_real_failure_status_and_no_internal_exception(api, fake_processing, tmp_path):
    fake_processing.side_effect = RuntimeError("secret internal path and password")
    response = upload(api)
    assert response.status_code == 202
    result = response.json()
    assert result["status"] == "EVALUATION_FAILED"
    task = api.get(f"/api/v1/candidates/tasks/{result['task_id']}")
    assert task.json()["state"] == "FAILURE"
    assert "secret" not in response.text + task.text
    assert list(tmp_path.iterdir()) == []
    assert api.get("/api/v1/dashboard/stats").status_code == 200


def test_zero_score_is_a_valid_successful_upload(api, fake_processing):
    fake_processing.return_value["scorecard"]["overall_match_score"] = 0
    result = upload(api).json()
    assert result["status"] == "ACCEPTED"
    assert result["match_score"] == 0


def test_assigned_job_zero_score_has_completed_evaluation(api, fake_processing):
    evaluator = sys.modules["ats_core.evaluator.deep_evaluator"].LocalDeepEvaluator.return_value
    evaluator.model_name = "offline-test"
    evaluator.evaluate.return_value = {"success": True, "report": SimpleNamespace(
        overall_match_score=0, qualification_tier="Weak Fit", criteria_breakdown=[],
        risks_and_skill_gaps=[], suggested_improvements=[], suggested_interview_questions=[],
        executive_verdict="Requirements not satisfied.",
    )}
    response = upload(api, data={"job_id": "job-open"})
    assert response.status_code == 202
    result = response.json()
    assert result["status"] == "ACCEPTED"
    assert result["evaluation_status"] == "COMPLETED"
    assert result["match_score"] == 0
    assert candidates.CANDIDATES_STORE[result["candidate_id"]]["scorecard"]["risk_flags"] == []


def test_evaluator_receives_redacted_text_only(api, fake_processing):
    upload(api, data={"job_id": "job-open"})
    evaluator = sys.modules["ats_core.evaluator.deep_evaluator"].LocalDeepEvaluator.return_value
    assert evaluator.evaluate.call_args.kwargs["candidate_profile_text"] == "[redacted resume]"


def test_redaction_failure_prevents_evaluator_call(api, fake_processing):
    redactor = sys.modules["ats_core.parsers.anonymizer"].ResumeAnonymizer.return_value
    redactor.anonymize.side_effect = RuntimeError("redaction unavailable")
    result = upload(api, data={"job_id": "job-open"}).json()
    assert result["status"] == "ACCEPTED"
    assert result["evaluation_status"] == "PENDING"
    sys.modules["ats_core.evaluator.deep_evaluator"].LocalDeepEvaluator.assert_not_called()


def test_unassigned_upload_never_invokes_redactor_or_evaluator(api, fake_processing):
    result = upload(api).json()
    assert result["evaluation_status"] == "PENDING"
    assert result["match_score"] is None
    sys.modules["ats_core.parsers.anonymizer"].ResumeAnonymizer.assert_not_called()
    sys.modules["ats_core.evaluator.deep_evaluator"].LocalDeepEvaluator.assert_not_called()


def test_app_refuses_startup_with_missing_production_key(monkeypatch):
    import main
    monkeypatch.setattr(auth, "ATS_AUTH_ENABLED", True)
    monkeypatch.setattr(auth, "EXPECTED_API_KEY", "")
    with pytest.raises(RuntimeError, match="ATS_API_KEY"), TestClient(main.app):
        pass


def test_cors_blocks_unconfigured_browser_origins(monkeypatch):
    import main
    monkeypatch.setattr(auth, "ATS_AUTH_ENABLED", False)
    with TestClient(main.app) as client:
        response = client.options("/api/v1/candidates", headers={
            "Origin": "https://untrusted.example", "Access-Control-Request-Method": "GET",
        })
        assert response.status_code == 400
        assert "access-control-allow-origin" not in response.headers
        assert "access-control-allow-credentials" not in response.headers


def test_default_mask_removes_raw_text_and_nested_identifiers(api, fake_processing):
    result = upload(api).json()
    candidate = candidates.CANDIDATES_STORE[result["candidate_id"]]
    candidate["scorecard"]["categories"] = [{"quote": "Jane Doe contacted via jane@example.com"}]
    masked = api.get(f"/api/v1/candidates/{result['candidate_id']}")
    assert "Jane Doe" not in masked.text
    assert "jane@example.com" not in masked.text
    assert "raw_text" not in masked.json()
    assert masked.json()["avatar"] == "CD"
    assert "Jane Doe" not in api.get(f"/api/v1/candidates/{result['candidate_id']}/scorecard").text
    assert candidate["name"] == "Jane Doe"
    assert candidate["raw_text"].startswith("Jane Doe")


def test_resume_lookup_does_not_interpret_glob_in_candidate_id(api, tmp_path):
    candidates.CANDIDATES_STORE["*"] = {"id": "*"}
    (tmp_path / "victim.pdf").write_bytes(b"%PDF-1.4 secret resume")
    assert api.get("/api/v1/candidates/*/resume-pdf").status_code == 404
    assert api.get("/api/v1/candidates/unknown/resume-pdf").status_code == 404


def test_resume_pdf_uses_only_registered_owned_document(api, fake_processing):
    result = upload(api).json()
    response = api.get(f"/api/v1/candidates/{result['candidate_id']}/resume-pdf")
    assert response.status_code == 200
    assert response.content == b"%PDF-1.4 test"


def test_task_backend_failure_is_explicit_and_not_fake_progress(api, monkeypatch):
    from celery import result
    monkeypatch.setattr(result, "AsyncResult", MagicMock(side_effect=RuntimeError("secret redis URL")))
    response = api.get("/api/v1/candidates/tasks/missing-task")
    assert response.status_code == 503
    assert "secret" not in response.text
    assert "PROGRESS" not in response.text


def test_dashboard_uses_measured_values_and_handles_unevaluated_candidates(api):
    now = datetime.now(UTC).isoformat()
    candidates.CANDIDATES_STORE.update({
        "a": {"id": "a", "name": "Jane Doe", "created_at": now, "scorecard": {"overall_match_score": 90, "evaluated_at": now, "categories": []}},
        "b": {"id": "b", "name": "John Doe", "created_at": now, "scorecard": {"overall_match_score": 30, "categories": []}},
        "c": {"id": "c", "name": "Unscored", "scorecard": {"overall_match_score": None, "categories": []}},
    })
    response = api.get("/api/v1/dashboard/stats")
    assert response.status_code == 200
    result = response.json()
    assert result["stats"][0]["value"] == "1"
    assert result["today_evaluations"] == 1
    assert result["ai_match_rate"]["rate"] == 50
    assert result["ai_match_rate"]["evaluated_count"] == 2
    assert result["weekly_candidates"][-1]["count"] == 2
    assert "Jane Doe" not in response.text
    assert "John Doe" not in response.text


def test_manual_candidate_has_no_invented_skills_history_or_ai_score(api):
    response = api.post("/api/v1/jobs/job-open/candidates", json={"name": "Jane Doe", "headline": "Engineer"})
    assert response.status_code == 200
    candidate = next(iter(candidates.CANDIDATES_STORE.values()))
    assert candidate["core_skills"] == []
    assert candidate["experience"] == []
    assert candidate["years_of_experience"] is None
    assert candidate["scorecard"]["overall_match_score"] is None
    assert candidate["scorecard"]["evaluation_status"] == "PENDING"
    assert "Jane Doe" not in api.get("/api/v1/jobs/job-open/candidates").text
    assert api.post("/api/v1/jobs/missing/candidates", json={"name": "Jane", "headline": "Engineer"}).status_code == 404


def test_job_link_preserves_extracted_evaluation_and_evidence(api):
    candidates.CANDIDATES_STORE["existing"] = {
        "id": "existing", "name": "Jane", "scorecard": {"overall_match_score": 0, "evaluation_status": "COMPLETED", "categories": [{"quote": "Real evidence"}]}
    }
    response = api.post("/api/v1/jobs/job-open/candidates", json={"id": "existing", "name": "Jane", "headline": "Engineer", "matchScore": 0})
    assert response.status_code == 200
    assert candidates.CANDIDATES_STORE["existing"]["scorecard"]["evaluation_status"] == "COMPLETED"
    assert candidates.CANDIDATES_STORE["existing"]["scorecard"]["categories"] == [{"quote": "Real evidence"}]


def create_editable_job(api):
    response = api.post("/api/v1/jobs", json={
        "title": "Backend Engineer", "department": "Engineering", "location": "Remote",
        "job_description": "Build Python services", "required_skills": ["Python"],
    })
    assert response.status_code == 201
    return response.json()


def test_job_edit_updates_all_editable_fields_and_returns_full_response(api):
    original = create_editable_job(api)
    changes = {
        "title": "Platform Engineer", "department": "Cloud", "location": "Chennai",
        "job_description": "Build Kubernetes platforms", "required_skills": ["Kubernetes"],
    }
    response = api.patch(f"/api/v1/jobs/{original['id']}", json=changes)
    assert response.status_code == 200
    result = response.json()
    assert all(result[field] == value for field, value in changes.items())
    assert set(result) == set(original)
    assert result["updated_at"] != original["updated_at"]
    assert api.get(f"/api/v1/jobs/{original['id']}").json() == result


def test_partial_job_edit_preserves_omitted_and_protected_fields(api):
    original = create_editable_job(api)
    response = api.patch(f"/api/v1/jobs/{original['id']}", json={"title": "Staff Engineer", "required_skills": []})
    assert response.status_code == 200
    result = response.json()
    assert result["title"] == "Staff Engineer"
    assert result["required_skills"] == []
    assert all(result[field] == value for field, value in original.items()
               if field not in ("title", "required_skills", "updated_at"))


def test_job_edit_unknown_id_returns_not_found(api):
    response = api.patch("/api/v1/jobs/unknown", json={"title": "Staff Engineer"})
    assert response.status_code == 404


@pytest.mark.parametrize("changes", [
    {"candidates_count": 99}, {"top_match": {"score": 100}}, {"title": None},
])
def test_job_edit_rejects_server_owned_fields_and_nulls(api, changes):
    original = create_editable_job(api)
    assert api.patch(f"/api/v1/jobs/{original['id']}", json=changes).status_code == 422
    assert api.get(f"/api/v1/jobs/{original['id']}").json() == original


@pytest.mark.parametrize("fields", [
    {"stage1_retrieve_limit": -1}, {"stage2_rerank_limit": 100},
    {"stage1_retrieve_limit": 5, "stage2_rerank_limit": 20},
])
def test_match_stage_limits_are_bounded(fields):
    with pytest.raises(ValidationError):
        match.MatchRequest(job_title="Engineer", job_description="Python", **fields)


def test_match_retrieval_failure_does_not_leak_internal_errors(api, monkeypatch):
    monkeypatch.setattr(match, "get_retriever", MagicMock(side_effect=RuntimeError("private db password")))
    response = api.post("/api/v1/match/evaluate-job", json={"job_title": "Engineer", "job_description": "Python"})
    assert response.status_code == 500
    assert "password" not in response.text


def test_match_total_evaluation_failure_is_explicit(api, monkeypatch):
    retriever = MagicMock()
    retriever.hybrid_search.return_value = [{"candidate_id": "a", "text": "Python"}]
    monkeypatch.setattr(match, "get_retriever", lambda: retriever)
    monkeypatch.setattr(match, "get_reranker", MagicMock(side_effect=RuntimeError("no model")))
    monkeypatch.setitem(sys.modules, "ats_core.evaluator.llm_evaluator", SimpleNamespace(
        evaluate_candidate=MagicMock(side_effect=RuntimeError("no LLM")), EvaluationReport=object,
    ))
    response = api.post("/api/v1/match/evaluate-job", json={"job_title": "Engineer", "job_description": "Python"})
    assert response.status_code == 502


def test_rerun_ai_match_syncs_candidates_and_updates_pipeline(api, monkeypatch):
    from ats_core.search.hybrid_retriever import HybridCandidateRetriever

    class FakeEmbedder:
        def embed_documents(self, documents):
            return [[1.0, 0.0] for _ in documents]

        def embed_query(self, query):
            return [1.0, 0.0]

    test_retriever = HybridCandidateRetriever(dense_embedder=FakeEmbedder())
    monkeypatch.setattr(match, "_retriever", test_retriever)
    monkeypatch.setattr(match, "get_retriever", lambda: test_retriever)

    mock_reranker = MagicMock()
    mock_reranker.rerank.side_effect = lambda *args, **kwargs: [{**c, "score": 0.95} for c in (kwargs.get("candidates") or (args[1] if len(args) > 1 else []))]
    monkeypatch.setattr(match, "_reranker", mock_reranker)
    monkeypatch.setattr(match, "get_reranker", lambda: mock_reranker)

    cand_id = "cand-python-1"
    candidates.CANDIDATES_STORE[cand_id] = {
        "id": cand_id,
        "name": "Jane Python",
        "target_headline": "Senior Python Developer",
        "role": "Python Engineer",
        "core_skills": ["Python", "FastAPI"],
        "raw_text": "Experienced Python and FastAPI backend engineer",
        "scorecard": {"overall_match_score": None, "evaluation_status": "PENDING"},
        "stage": "Screening",
    }

    mock_report = SimpleNamespace(
        overall_match_score=92.0,
        qualification_tier="STRONG",
        criteria_breakdown=[],
        risks_and_skill_gaps=[],
        suggested_improvements=["Improve documentation"],
        suggested_interview_questions=[],
    )
    monkeypatch.setitem(sys.modules, "ats_core.evaluator.llm_evaluator", SimpleNamespace(
        evaluate_candidate=MagicMock(return_value=mock_report),
        EvaluationReport=object,
    ))

    response = api.post("/api/v1/match/evaluate-job", json={
        "job_id": "job-open",
        "job_title": "Engineer",
        "job_description": "Python backend engineer",
    })
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["stage1_candidates_retrieved"] >= 1
    assert data["stage3_final_ranked"] >= 1
    assert len(data["candidates"]) >= 1
    assert data["candidates"][0]["id"] == cand_id
    assert data["candidates"][0]["matchScore"] == 92
    assert jobs.JOBS_STORE["job-open"]["candidates_count"] >= 1
    assert jobs.JOB_CANDIDATES_STORE["job-open"][0]["id"] == cand_id
