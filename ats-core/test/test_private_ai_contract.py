import hashlib
import subprocess
import sys
from types import SimpleNamespace
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
        "screening_decision": "REVIEW", "decision_explanation": "Python API experience is relevant, but other requirements need verification.",
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


def test_scoring_uses_technical_evidence_without_privacy_artifacts(monkeypatch):
    from ats_core.ai_api import evaluation

    monkeypatch.setenv("ATS_AI_ENABLE_LLM", "true")
    monkeypatch.setenv("ATS_AI_ENABLE_EMBEDDINGS", "false")
    model = Mock()
    model.evaluate.return_value = {"success": False}
    monkeypatch.setattr(evaluation, "evaluator", lambda: model)
    text = "[CANDIDATE_NAME]\n[EMAIL_ADDRESS]\n[PROFILE_URL]\nDeveloped Python APIs and optimized SQL queries by 30%.\nPython, SQL, [CANDIDATE_NAME]"
    payload = result().model_dump(mode="json")
    payload.update(operation="evaluate", candidate_id=str(uuid4()),
                   profile={"core_skills": ["Python", "SQL", "Docker"]}, sanitized_text=text,
                   job={"title": "Developer", "job_description": "Python APIs"})
    outcome = worker.compute_result(payload, None)
    sent = model.evaluate.call_args.kwargs["candidate_profile_text"]
    assert "[CANDIDATE_NAME]" not in sent and "[EMAIL_ADDRESS]" not in sent
    assert "[PROFILE_URL]" not in sent
    assert "optimized SQL queries by 30%." in sent and "Docker" in sent
    assert outcome.sanitized_text == text
    assert model.evaluate.call_args.kwargs["citation_source_text"] == text
    assert outcome.evaluation_status == "FAILED" and outcome.scorecard is None


@pytest.mark.parametrize("marker", [
    "CANDIDATE_NAME", "EMAIL_ADDRESS", "PHONE_NUMBER", "LOCATION", "PROFILE_URL", "REDACTED",
])
def test_citations_crossing_privacy_markers_remain_grounded(marker):
    from ats_core.ai_api.evaluation import VerifiedReport
    from ats_core.evaluator.deep_evaluator import LocalDeepEvaluator
    from ats_core.evaluator.langsmith_tracker import compute_citation_validity

    source = f"Built Python APIs. [{marker}]\nOptimized SQL queries."
    quote = worker.scoring_dossier(source, {})
    model = LocalDeepEvaluator(api_key="test-key", base_url="https://openrouter.ai/api/v1")
    model.chain = Mock()
    model.chain.invoke.return_value = VerifiedReport.model_validate({
        "screening_decision": "ACCEPT", "decision_explanation": "Python and SQL evidence meets the stated requirements.",
        "overall_match_score": 75, "executive_verdict": "Relevant Python evidence.",
        "criteria_breakdown": [{"category": "Tech Stack Alignment", "score": 4,
            "assessment": "Python and SQL are demonstrated.", "verbatim_citation": quote}],
    })

    evaluated = model.evaluate("synthetic", quote, "Developer", "Python APIs",
                               citation_source_text=source)

    assert evaluated["success"]
    criteria = evaluated["report"].criteria_breakdown
    assert criteria[0].verbatim_citation == quote
    assert criteria[0].citation_location is None
    assert compute_citation_validity(criteria, source)["grounded_citations"] == 1


@pytest.mark.parametrize("quote", ["[CANDIDATE_NAME]", "[PROFILE_URL]", "Invented quantum storage"])
def test_privacy_normalization_does_not_ground_empty_or_invented_quotes(quote):
    from ats_core.evaluator.langsmith_tracker import compute_citation_validity
    from ats_core.evidence import is_grounded_quote

    source = "Python APIs [CANDIDATE_NAME] [PROFILE_URL]"
    assert not is_grounded_quote(quote, source)
    assert compute_citation_validity([{"verbatim_citation": quote}], source)["grounded_citations"] == 0


@pytest.mark.parametrize("operation,enabled", [
    ("ingest", "true"), ("ingest", "false"), ("evaluate", "true"), ("evaluate", "false"),
])
def test_document_embeddings_are_generated_only_on_enabled_ingest(monkeypatch, operation, enabled):
    monkeypatch.setenv("ATS_AI_ENABLE_LLM", "false")
    monkeypatch.setenv("ATS_AI_ENABLE_EMBEDDINGS", enabled)
    document = b"%PDF-1.4 synthetic resume"
    text = "Developed Python APIs."
    parse = Mock(return_value={"raw_text": text, "core_skills": ["Python"]})
    monkeypatch.setitem(sys.modules, "ats_core.parsers.resume_parser", SimpleNamespace(
        parse_resume_to_candidate=parse,
    ))
    redactor = Mock()
    redactor.anonymize.return_value = text
    redactor.scrub_residual_pii.side_effect = lambda value, **kwargs: value
    monkeypatch.setattr(worker, "anonymizer", lambda: redactor)
    vectors = Mock()
    vectors.embed_documents.return_value = [[0.25] * 768]
    factory = Mock(return_value=vectors)
    monkeypatch.setattr(module, "embedder", factory)
    payload = result().model_dump(mode="json")
    payload.update(operation=operation, filename="resume.pdf",
                   source_hash=hashlib.sha256(document).hexdigest(), taxonomy=[], taxonomy_version=1,
                   sanitized_text=text)

    outcome = worker.compute_result(payload, document if operation == "ingest" else None)

    if operation == "ingest" and enabled == "true":
        factory.assert_called_once_with()
        vectors.embed_documents.assert_called_once_with([text])
        assert outcome.embedding == [0.25] * 768
        assert outcome.embedding_model == "google/embeddinggemma-2"
    else:
        factory.assert_not_called()
        assert outcome.embedding is None
        assert outcome.embedding_model is None
        assert outcome.preprocessing_version is None
    assert "EMBEDDING_UNAVAILABLE" not in outcome.warnings


def test_added_skill_summary_cannot_become_a_verbatim_resume_quote():
    from ats_core.ai_api.evaluation import VerifiedReport
    from ats_core.evaluator.deep_evaluator import LocalDeepEvaluator

    model = LocalDeepEvaluator(api_key="test-key", base_url="https://openrouter.ai/api/v1")
    model.chain = Mock()
    model.chain.invoke.return_value = VerifiedReport.model_validate({
        "screening_decision": "REVIEW", "decision_explanation": "Python APIs are relevant; Docker requires verification in the original resume.",
        "overall_match_score": 75, "executive_verdict": "Relevant Python evidence.",
        "criteria_breakdown": [{"category": "Tech Stack Alignment", "score": 4,
            "assessment": "Python and Docker are extracted skills.",
            "verbatim_citation": "Skills extracted from the resume: Python, Docker"}],
    })
    evaluated = model.evaluate("synthetic", "Python APIs\nSkills extracted from the resume: Python, Docker",
                               "Developer", "Python APIs", citation_source_text="Python APIs")
    assert evaluated["success"]
    assert evaluated["report"].criteria_breakdown[0].verbatim_citation is None


@pytest.mark.parametrize("cloud", [False, True])
def test_scoring_reserves_output_budget_without_reasoning(monkeypatch, cloud):
    from ats_core.ai_api import evaluation
    from ats_core.evaluator import deep_evaluator
    from ats_core.llm import client

    factory = Mock()
    monkeypatch.setattr(deep_evaluator, "LocalDeepEvaluator", factory)
    monkeypatch.setattr(client, "get_llm_config", lambda: {"is_openrouter": cloud})
    evaluation.evaluator.cache_clear()
    try:
        evaluation.evaluator()
        options = factory.call_args.kwargs["model_options"]
        assert options["max_tokens"] == 4096
        assert options["request_timeout"] == 180
        if cloud:
            assert options["extra_body"]["reasoning"]["enabled"] is False
        else:
            assert options["reasoning_effort"] == "none"
    finally:
        evaluation.evaluator.cache_clear()


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
    monkeypatch.setattr(worker, "compute_result", lambda payload, document, on_progress=None: outcome)
    assert worker.run_job(job)["status"] == "acknowledged"
    assert requests == [
        f"/internal/jobs/{job}/lease",
        f"/internal/jobs/{job}/progress",
        f"/internal/jobs/{job}/document",
        f"/internal/jobs/{job}/progress",
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
        responses.append((request.url.path, request.content))
        return httpx.Response(200, json={"status": "acknowledged"})

    monkeypatch.setattr(
        worker,
        "core_client",
        lambda: httpx.Client(base_url="http://core", transport=httpx.MockTransport(respond)),
    )

    def fail(*_, **kwargs):
        raise ValueError("private resume john@example.test")

    monkeypatch.setattr(worker, "compute_result", fail)
    worker.run_job(str(uuid4()))
    assert all(
        b"john@example.test" not in body for _, body in responses
    )
    assert all(b"PROCESSING_FAILED" in body for path, body in responses if not path.endswith("/progress"))


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
