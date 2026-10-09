import hashlib
import subprocess
import sys
from unittest.mock import Mock
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from ats_core.ai_api import app as module
from ats_core.ai_api import worker
from ats_core.ai_api.contracts import AIResult


def result():
    return AIResult(
        attempt_id=uuid4(),
        document_id=uuid4(),
        document_version=1,
        input_revision=1,
        extraction_status="COMPLETED",
        evaluation_status="SKIPPED",
        profile={"core_skills": ["Python"]},
    )


def test_private_api_requires_service_identity(monkeypatch):
    monkeypatch.setenv("ATS_SERVICE_KEY", "test-service-key-with-at-least-32-characters")
    with TestClient(module.app) as client:
        assert client.get("/health").status_code == 200
        assert (
            client.post(
                "/internal/dispatch", json={"contract_version": 1, "job_id": str(uuid4())}
            ).status_code
            == 401
        )
        assert client.get("/api/v1/candidates").status_code == 404


def test_private_parser_import_does_not_load_legacy_database():
    script = """
import sys
class DenyBusinessDatabase:
    def find_spec(self, fullname, path=None, target=None):
        if fullname.startswith(('ats_core.db', 'ats_core.models.db', 'sqlalchemy.ext.asyncio')):
            raise AssertionError('Private AI imported the legacy business database')
sys.meta_path.insert(0, DenyBusinessDatabase())
from ats_core.ai_api import worker, evaluation
from ats_core.parsers import resume_parser
assert 'ats_core.evaluator.audit_logger' not in sys.modules
"""
    subprocess.run([sys.executable, "-c", script], check=True, capture_output=True, timeout=60)


def test_dispatch_uses_celery_and_stable_job_identity(monkeypatch):
    monkeypatch.setenv("ATS_SERVICE_KEY", "test-service-key-with-at-least-32-characters")
    enqueue = Mock()
    monkeypatch.setattr(worker.process_job, "apply_async", enqueue)
    job = str(uuid4())
    with TestClient(module.app) as client:
        response = client.post(
            "/internal/dispatch",
            headers={"x-service-key": "test-service-key-with-at-least-32-characters"},
            json={"contract_version": 1, "job_id": job},
        )
    assert response.status_code == 202
    enqueue.assert_called_once_with(args=[job], task_id=job)


def test_result_contract_rejects_wrong_vectors_and_extra_identity():
    body = result().model_dump()
    with pytest.raises(ValidationError):
        AIResult(**{**body, "embedding": [1.0] * 384})
    with pytest.raises(ValidationError):
        AIResult(**{**body, "tenant_id": uuid4()})


def test_incomplete_evaluation_cannot_become_a_default_score():
    from ats_core.ai_api.evaluation import VerifiedReport

    for report in ({}, {"overall_match_score": 50, "criteria_breakdown": []},
                   {"overall_match_score": "invalid", "criteria_breakdown": []}):
        with pytest.raises(ValidationError):
            VerifiedReport.model_validate(report)
    report = VerifiedReport.model_validate({
        "overall_match_score": 65, "executive_verdict": "Some relevant API experience.",
        "criteria_breakdown": [{"category": "Tech Stack Alignment", "score": 3,
                                "assessment": "Python API experience is stated."}],
    })
    assert report.overall_match_score == 65
    body = result().model_dump()
    with pytest.raises(ValidationError):
        AIResult(**{**body, "evaluation_status": "COMPLETED", "scorecard": {
            "overall_match_score": 50, "categories": [], "model_version": "test"}})


def test_worker_keeps_incomplete_model_response_unscored(monkeypatch):
    from ats_core.ai_api import evaluation
    from ats_core.schema.evaluation import DeepCandidateEvaluationReport

    monkeypatch.setenv("ATS_AI_ENABLE_LLM", "true")
    monkeypatch.setenv("ATS_AI_ENABLE_EMBEDDINGS", "false")
    model = Mock()
    model.evaluate.return_value = {"success": True, "report": DeepCandidateEvaluationReport()}
    monkeypatch.setattr(evaluation, "evaluator", lambda: model)
    payload = result().model_dump(mode="json")
    payload.update(operation="evaluate", candidate_id=str(uuid4()),
                   profile={"core_skills": ["Python"]}, sanitized_text="Python APIs",
                   job={"title": "Developer", "job_description": "Python APIs"})
    outcome = worker.compute_result(payload, None)
    assert outcome.evaluation_status == "FAILED"
    assert outcome.scorecard is None
    assert "EVALUATION_UNAVAILABLE" in outcome.warnings


def test_worker_only_saves_through_core_and_persists_artifact_first(monkeypatch):
    job = str(uuid4())
    outcome = result()
    document = b"%PDF-1.4 test resume"
    lease = {
        "attempt_id": str(outcome.attempt_id),
        "document_id": str(outcome.document_id),
        "document_version": 1,
        "input_revision": 1,
        "job_revision": None,
        "operation": "ingest",
        "source_hash": hashlib.sha256(document).hexdigest(),
    }
    requests = []

    def respond(request):
        requests.append(request.url.path)
        if request.url.path.endswith("/lease"):
            return httpx.Response(200, json=lease)
        if request.url.path.endswith("/document"):
            return httpx.Response(200, content=document)
        return httpx.Response(200, json={"status": "acknowledged"})

    monkeypatch.setattr(
        worker,
        "core_client",
        lambda: httpx.Client(base_url="http://core", transport=httpx.MockTransport(respond)),
    )
    monkeypatch.setattr(worker, "compute_result", lambda payload, document: outcome)
    assert worker.run_job(job)["status"] == "acknowledged"
    assert requests == [
        f"/internal/jobs/{job}/lease",
        f"/internal/jobs/{job}/document",
        f"/internal/jobs/{job}/artifact",
        f"/internal/jobs/{job}/result",
    ]


def test_duplicate_delivery_does_not_recompute(monkeypatch):
    monkeypatch.setattr(
        worker,
        "core_client",
        lambda: httpx.Client(
            base_url="http://core", transport=httpx.MockTransport(lambda _: httpx.Response(409))
        ),
    )
    compute = Mock()
    monkeypatch.setattr(worker, "compute_result", compute)
    assert worker.run_job(str(uuid4()))["status"] == "duplicate_or_terminal"
    compute.assert_not_called()


def test_extraction_failures_return_safe_errors(monkeypatch):
    outcome = result()
    responses = []

    def respond(request):
        if request.url.path.endswith("/lease"):
            return httpx.Response(
                200,
                json={
                    "attempt_id": str(outcome.attempt_id),
                    "document_id": str(outcome.document_id),
                    "document_version": 1,
                    "input_revision": 1,
                    "job_revision": None,
                    "operation": "evaluate",
                },
            )
        responses.append(request.content)
        return httpx.Response(200, json={"status": "acknowledged"})

    monkeypatch.setattr(
        worker,
        "core_client",
        lambda: httpx.Client(base_url="http://core", transport=httpx.MockTransport(respond)),
    )

    def fail(*_):
        raise ValueError("private resume john@example.test")

    monkeypatch.setattr(worker, "compute_result", fail)
    worker.run_job(str(uuid4()))
    assert all(
        b"john@example.test" not in body and b"PROCESSING_FAILED" in body for body in responses
    )


def test_job_taxonomy_snapshot_never_uses_global_catalog(monkeypatch):
    from ats_core.parsers import resume_parser
    from ats_core.parsers.context_enricher import enrich_candidate_skills
    def forbidden(*args, **kwargs):
        raise AssertionError("A job snapshot must not use global taxonomy state")
    monkeypatch.setattr(resume_parser.SkillMatcher, "get_instance", forbidden)
    monkeypatch.setattr(resume_parser, "normalize_skills_list", forbidden)
    monkeypatch.setattr(resume_parser.LLMResidueExtractor, "get_instance", forbidden)
    rows=[{"id":"synthetic-skill","canonical_name":"AcmeScript","aliases":["Acme Script"],"category":"language","status":"approved","is_ambiguous":False}]
    source="SKILLS\nAcme Script, JavaScript\nEXPERIENCE\nDeveloped Acme Script services."
    assert resume_parser.extract_skills_from_text(source,taxonomy_rows=rows,allow_llm=False)==["AcmeScript"]
    enriched=enrich_candidate_skills(source,candidate_skills=["AcmeScript"],taxonomy_rows=rows)
    assert [s["canonical_name"] for s in enriched]==["AcmeScript"]
