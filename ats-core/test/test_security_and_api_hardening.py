"""
test_security_and_api_hardening.py
Verification suite for Security & API Hardening fixes:
1. Authentication & HMAC signing decoupling from EXPECTED_API_KEY and production enforcement.
2. Rate limiter client IP spoofing prevention via trusted proxy socket-peer validation.
3. Role authorization (require_write_role) and fail-closed candidate PII redaction in match.py.
4. Concurrency semaphore acquisition during inline upload processing.
5. Removal of test mock reflection, and propagation of risk flags, improvements, and interview questions.
"""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from starlette.requests import Request

from ats_core.api import auth
from ats_core.api.auth import Role, extract_user_identity, get_signing_secret, verify_signed_token, verify_user_signature
from ats_core.api.rate_limiter import get_client_ip, is_trusted_proxy
from ats_core.api.v1 import candidates, jobs, match
from ats_core.evaluator.deep_evaluator import SYSTEM_EVALUATION_MESSAGE


# ==============================================================================
# 1. AUTHENTICATION & HMAC SIGNING DECOUPLING
# ==============================================================================

def test_get_signing_secret_production_enforcement(monkeypatch):
    """In production with auth enabled, ATS_TOKEN_SECRET must be configured with >=32 chars."""
    monkeypatch.setenv("ATS_ENV", "production")
    monkeypatch.delenv("ATS_TOKEN_SECRET", raising=False)
    auth.ATS_AUTH_ENABLED = True
    auth.EXPECTED_API_KEY = "dummy-shared-api-key"

    # Unset token secret in production raises RuntimeError and NEVER falls back to EXPECTED_API_KEY
    with pytest.raises(RuntimeError, match="ATS_TOKEN_SECRET must be configured with >=32 chars in production"):
        get_signing_secret()

    # Secret < 32 chars in production also raises RuntimeError
    monkeypatch.setenv("ATS_TOKEN_SECRET", "short-secret-less-than-32-chars")
    with pytest.raises(RuntimeError, match="ATS_TOKEN_SECRET must be configured with >=32 chars in production"):
        get_signing_secret()

    # Secret >= 32 chars in production succeeds
    valid_secret = "a" * 32
    monkeypatch.setenv("ATS_TOKEN_SECRET", valid_secret)
    assert get_signing_secret() == valid_secret


def test_get_signing_secret_dev_fallback(monkeypatch):
    """In development, an unset ATS_TOKEN_SECRET falls back to dev secret and NOT EXPECTED_API_KEY."""
    monkeypatch.setenv("ATS_ENV", "development")
    monkeypatch.delenv("ATS_TOKEN_SECRET", raising=False)
    auth.ATS_AUTH_ENABLED = False
    auth.EXPECTED_API_KEY = "my-dev-api-key"

    secret = get_signing_secret()
    assert secret == "ats-insecure-dev-signing-secret-key-32b"
    assert secret != auth.EXPECTED_API_KEY


def test_shared_api_key_cannot_forge_hmac_bearer_tokens(monkeypatch):
    """Clients holding the shared API key cannot forge HMAC Bearer tokens or user signatures."""
    shared_api_key = "shared-api-key-for-clients-12345"
    token_secret = "ats-secure-token-signing-secret-key-32b"
    monkeypatch.setenv("ATS_TOKEN_SECRET", token_secret)
    auth.EXPECTED_API_KEY = shared_api_key

    # Attempt to forge token using shared API key
    forged_token = auth.create_signed_token("attacker", "admin", secret_key=shared_api_key)
    # verify_signed_token without explicit secret_key must reject the forged token
    assert verify_signed_token(forged_token) is None

    # Attempt to forge header signature using shared API key
    forged_sig = auth.sign_user_headers("attacker", "admin", secret_key=shared_api_key)
    assert verify_user_signature("attacker", "admin", None, forged_sig) is False

    # Valid token signed with ATS_TOKEN_SECRET is accepted
    valid_token = auth.create_signed_token("real-admin", "admin", secret_key=token_secret)
    verified = verify_signed_token(valid_token)
    assert verified is not None
    assert verified.user_id == "real-admin"
    assert verified.role == "admin"
    assert verified.is_verified is True


def test_extract_user_identity_unverified_shared_key_never_verified(monkeypatch):
    """When a caller presents a shared API key with unverified headers, is_verified must ALWAYS be False."""
    monkeypatch.setenv("ATS_DEFAULT_USER_ROLE", "recruiter")
    auth.ATS_AUTH_ENABLED = True

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/candidates",
        "headers": [(b"x-api-key", b"test-key"), (b"x-user-role", b"admin")],
    }
    req = Request(scope)
    identity = extract_user_identity(req)
    assert identity.role == "recruiter"
    assert identity.is_verified is False

    # Even if default role is admin
    monkeypatch.setenv("ATS_DEFAULT_USER_ROLE", "admin")
    identity_admin = extract_user_identity(req)
    assert identity_admin.is_verified is False


# ==============================================================================
# 2. RATE LIMITER CLIENT IP SPOOFING
# ==============================================================================

def test_rate_limiter_ip_spoofing_untrusted_peer_ignores_xff():
    """An untrusted socket peer cannot spoof its IP via X-Forwarded-For."""
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/test",
        "headers": [(b"x-forwarded-for", b"203.0.113.195, 10.0.0.1")],
        "client": ("198.51.100.22", 12345),
    }
    req = Request(scope)
    assert is_trusted_proxy("198.51.100.22") is False
    assert get_client_ip(req) == "198.51.100.22"


def test_rate_limiter_ip_spoofing_trusted_proxy_extracts_rightmost_ip():
    """A trusted reverse proxy extracts the rightmost IP appended by the proxy (ips[-1])."""
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/test",
        "headers": [(b"x-forwarded-for", b"spoofed.client.ip, 203.0.113.42")],
        "client": ("127.0.0.1", 12345),
    }
    req = Request(scope)
    assert is_trusted_proxy("127.0.0.1") is True
    # Takes 203.0.113.42 (rightmost), NOT spoofed.client.ip (leftmost)
    assert get_client_ip(req) == "203.0.113.42"


# ==============================================================================
# 3. ROLE AUTHORIZATION & FAIL-CLOSED REDACTION IN MATCH.PY
# ==============================================================================

def test_match_evaluate_job_role_authorization(monkeypatch):
    """POST /api/v1/match/evaluate-job requires write role; viewer is denied with 403."""
    auth.ATS_AUTH_ENABLED = True
    token_secret = "test-token-secret-32-chars-long-1234"
    monkeypatch.setenv("ATS_TOKEN_SECRET", token_secret)

    app = FastAPI()
    app.include_router(match.router, prefix="/api/v1", dependencies=[Depends(auth.verify_api_key)])

    client = TestClient(app)

    # 1. Viewer token -> 403 Forbidden
    viewer_token = auth.create_signed_token("viewer-1", "viewer", secret_key=token_secret)
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}
    resp = client.post("/api/v1/match/evaluate-job", headers=viewer_headers, json={
        "job_title": "Backend Engineer",
        "job_description": "Python, FastAPI",
    })
    assert resp.status_code == 403
    assert "not authorized to perform write operations" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_match_evaluate_candidate_pii_redaction_fail_closed(monkeypatch):
    """Candidate evaluation must fail-closed if anonymization throws or fails preflight check."""
    from ats_core.parsers.anonymizer import get_shared_anonymizer

    mock_anonymizer = MagicMock()
    # Simulate pre-flight check finding residual PII leak that cannot be scrubbed
    mock_anonymizer.anonymize.return_value = "Candidate with leaked email: secret@evil.com"
    mock_anonymizer.check_preflight_leak.return_value = (False, ["email"])
    mock_anonymizer.scrub_residual_pii.return_value = "Still leaked secret@evil.com"

    monkeypatch.setattr("ats_core.parsers.anonymizer.get_shared_anonymizer", lambda: mock_anonymizer)

    # Calling match_and_evaluate_candidates with a candidate whose redaction fails
    cand = {
        "candidate_id": "cand-leak-test",
        "text": "Secret Resume of Leaked Candidate",
        "metadata": {"name": "Leaked Candidate", "email": "secret@evil.com"},
    }

    # Verify that _evaluate_single_candidate catches the exception and returns (None, cand_id)
    # without transmitting to external LLM
    match_req = match.MatchRequest(
        job_title="Engineer",
        job_description="Python",
    )

    # Trigger via match_and_evaluate_candidates mock flow
    mock_retriever = MagicMock()
    mock_retriever.hybrid_search.return_value = [cand]
    monkeypatch.setattr(match, "get_retriever", lambda: mock_retriever)
    monkeypatch.setattr(match, "sync_candidates_to_retriever", lambda *args, **kwargs: 0)

    mock_reranker = MagicMock()
    mock_reranker.rerank.return_value = [cand]
    monkeypatch.setattr(match, "get_reranker", lambda: mock_reranker)

    mock_llm_eval = AsyncMock()
    monkeypatch.setitem(sys.modules if "sys" in locals() else __import__("sys").modules,
                        "ats_core.evaluator.llm_evaluator",
                        SimpleNamespace(evaluate_candidate=mock_llm_eval, EvaluationReport=object))

    # All candidates fail preflight redaction -> raises 502 Bad Gateway (fail closed)
    with pytest.raises(Exception) as exc_info:
        await match.match_and_evaluate_candidates(match_req)
    assert exc_info.value.status_code == 502
    # Ensure LLM was NEVER called with unredacted text
    mock_llm_eval.assert_not_called()


# ==============================================================================
# 4. CONCURRENCY SEMAPHORE IN INLINE RESUME UPLOAD
# ==============================================================================

@pytest.mark.asyncio
async def test_upload_resume_inline_acquires_upload_semaphore(monkeypatch):
    """When execution_mode='inline', _upload_semaphore is acquired asynchronously."""
    semaphore_acquired = False

    orig_semaphore = candidates._upload_semaphore

    class MonitoredSemaphore:
        async def __aenter__(self):
            nonlocal semaphore_acquired
            semaphore_acquired = True
            return await orig_semaphore.acquire()

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            orig_semaphore.release()

        def locked(self):
            return orig_semaphore.locked()

    monkeypatch.setattr(candidates, "_upload_semaphore", MonitoredSemaphore())
    monkeypatch.setattr(candidates, "_process_resume_pipeline", AsyncMock())
    monkeypatch.setattr(candidates, "stage_pdf_upload", AsyncMock(return_value=(b"%PDF-1.4", "resume.pdf", "tmp.pdf")))

    mock_request = MagicMock()
    mock_request.headers = {"X-Execution-Mode": "inline"}
    mock_bg = MagicMock()
    mock_file = MagicMock()

    # Stub require_write_role to avoid auth check failure
    monkeypatch.setattr(candidates, "require_write_role", lambda req: None)

    await candidates.upload_resume_async(
        request=mock_request,
        background_tasks=mock_bg,
        file=mock_file,
        job_id=None,
        execution_mode="inline",
    )

    assert semaphore_acquired is True


# ==============================================================================
# 5. TEST MOCK REMOVAL & EVALUATION FIELDS PROPAGATION
# ==============================================================================

def test_system_evaluation_message_no_suppression_directive():
    """SYSTEM_EVALUATION_MESSAGE must not forbid risk flags, interview questions, or improvements."""
    assert "Do NOT generate risk flags" not in SYSTEM_EVALUATION_MESSAGE
    assert "CRITICAL REQUIREMENT: Rate the candidate with numerical scores only" not in SYSTEM_EVALUATION_MESSAGE


def test_deep_evaluator_preserves_evaluation_fields():
    """deep_evaluator.py must not wipe risks_and_skill_gaps, suggested_improvements, or suggested_questions."""
    import inspect
    from ats_core.evaluator import deep_evaluator
    src = inspect.getsource(deep_evaluator.LocalDeepEvaluator.evaluate)
    assert "report.risks_and_skill_gaps = []" not in src
    assert "report.suggested_improvements = []" not in src
    assert "report.suggested_interview_questions = []" not in src


def test_candidates_api_clean_parser_resolution():
    """candidates.py must not inspect sys.modules for Mock, MagicMock, AsyncMock, or SimpleNamespace."""
    import inspect
    src = inspect.getsource(candidates._process_resume_pipeline)
    assert "MagicMock" not in src
    assert "AsyncMock" not in src
    assert "SimpleNamespace" not in src
    assert "sys.modules" not in src
