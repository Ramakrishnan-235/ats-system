"""Real operation boundaries, including unavailable optional models, without provider calls."""
import hashlib
import sys
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import httpx
import pytest

from ats_core.ai_api import worker, evaluation


@pytest.mark.parametrize("model_success", [False, True])
def test_progress_tracks_operations_and_does_not_claim_failed_models_completed(monkeypatch, model_success):
    document = b"%PDF-1.4 entirely fictional test"
    events = []

    def emit(stage, status, detail=None):
        events.append((stage, status, detail))

    def parse(*args, on_progress, **kwargs):
        for stage in ("pdf_parsing", "pii_redaction", "profile_extraction", "skill_normalization"):
            on_progress(stage, "RUNNING")
            on_progress(stage, "COMPLETED")
        return {"raw_text": "Built fictional Python APIs.", "core_skills": ["Python"]}

    monkeypatch.setitem(sys.modules, "ats_core.parsers.llm_embedding_resume_parser", SimpleNamespace(parse_resume_with_llm_and_embeddings=parse))
    redactor = Mock()
    redactor.anonymize.side_effect = lambda text, **kwargs: text
    redactor.scrub_residual_pii.side_effect = lambda text, **kwargs: text
    monkeypatch.setattr(worker, "anonymizer", lambda: redactor)
    model = Mock(model_name="synthetic-model")

    def evaluate(**kwargs):
        assert events[-1] == ("llm_evaluation", "RUNNING", None)
        return {"success": model_success, "report": {
            "screening_decision": "REVIEW", "decision_explanation": "Relevant evidence needs review.",
            "overall_match_score": 55, "executive_verdict": "Review relevant evidence.",
            "criteria_breakdown": [{"category": "Tech Stack Alignment", "score": 3, "assessment": "Python APIs are stated."}],
        }}

    model.evaluate.side_effect = evaluate
    monkeypatch.setattr(evaluation, "evaluator", lambda: model)
    monkeypatch.setenv("ATS_AI_ENABLE_LLM", "true")
    monkeypatch.setenv("ATS_AI_ENABLE_EMBEDDINGS", "false")
    result = worker.compute_result({"operation": "ingest", "attempt_id": str(uuid4()),
        "document_id": str(uuid4()), "document_version": 1, "input_revision": 1,
        "job_revision": 1, "candidate_id": str(uuid4()), "filename": "synthetic.pdf",
        "source_hash": hashlib.sha256(document).hexdigest(), "taxonomy": [], "taxonomy_version": 1,
        "job": {"title": "Engineer", "job_description": "Python APIs"}}, document, emit)
    assert events[0] == ("document_verification", "COMPLETED", None)
    assert ("document_embedding", "SKIPPED", "EMBEDDINGS_DISABLED") in events
    assert events[-1][0:2] == ("llm_evaluation", "COMPLETED" if model_success else "FAILED")
    assert result.evaluation_status == ("COMPLETED" if model_success else "FAILED")


def test_worker_reports_lease_scoped_safe_events_and_saving_before_artifact(monkeypatch):
    from ats_core.ai_api.contracts import AIResult
    attempt, document = str(uuid4()), str(uuid4())
    requests = []
    payload = {"attempt_id": attempt, "document_id": document, "document_version": 1,
               "input_revision": 1, "operation": "evaluate"}

    def respond(request):
        import json
        body = json.loads(request.content or b"{}")
        requests.append((request.url.path, body))
        return httpx.Response(200, json=payload if request.url.path.endswith("/lease") else {"status": "acknowledged"})

    monkeypatch.setattr(worker, "core_client", lambda: httpx.Client(base_url="http://core", transport=httpx.MockTransport(respond)))

    def compute(payload, document, on_progress):
        on_progress("llm_evaluation", "RUNNING")
        on_progress("llm_evaluation", "FAILED", "MODEL_UNAVAILABLE")
        return AIResult(attempt_id=attempt, document_id=payload["document_id"], document_version=1,
                        input_revision=1, extraction_status="SKIPPED", evaluation_status="FAILED")

    monkeypatch.setattr(worker, "compute_result", compute)
    worker.run_job(str(uuid4()))
    events = [(path, body) for path, body in requests if path.endswith("/progress")]
    assert [body["stage"] for _, body in events] == ["llm_evaluation", "llm_evaluation", "saving_results"]
    assert all(body["attempt_id"] == attempt and set(body) == {"attempt_id", "stage", "status", "detail"} for _, body in events)
    assert requests[-3][1]["stage"] == "saving_results"
    assert requests[-2][0].endswith("/artifact")
    assert requests[-1][0].endswith("/result")
