"""
test_sec07_rate_limiter_spoofing.py
Comprehensive verification tests for SEC-07:
1. Header spoofing prevention: Rotating unverified X-API-Key and X-User-Id headers does not bypass IP rate limit.
2. Contention prevention: Callers sharing the same X-API-Key from different IPs receive separate rate limit buckets.
3. Verified identity keying: Authenticated callers with cryptographically signed tokens are keyed by verified user ID.
4. LRU memory bounding: SlidingWindowRateLimiter strictly caps the number of tracked keys to max_keys.
5. Trusted reverse proxy IP resolution: Correctly parses leftmost X-Forwarded-For, X-Real-IP, CF-Connecting-IP, or socket peer.
"""

import time
import pytest
from starlette.requests import Request
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from ats_core.api import auth
from ats_core.api.rate_limiter import (
    RateLimitMiddleware,
    SlidingWindowRateLimiter,
    get_client_ip,
)
from ats_core.api.v1.candidates import router as candidates_router


TEST_SECRET = "sec07-test-secret-key-12345"
AUTH_USER_ID = "verified-user-777"
AUTH_TOKEN = auth.create_signed_token(AUTH_USER_ID, "recruiter", "recruiter@ats.local", secret_key=TEST_SECRET)
AUTH_HEADERS = {"Authorization": f"Bearer {AUTH_TOKEN}"}


@pytest.fixture
def rate_limited_app():
    """Sets up an isolated FastAPI app with a low rate limit (5 req/min) for testing."""
    orig_auth = auth.ATS_AUTH_ENABLED
    orig_key = auth.EXPECTED_API_KEY
    orig_secret = auth.get_signing_secret()

    auth.ATS_AUTH_ENABLED = True
    auth.EXPECTED_API_KEY = TEST_SECRET

    app = FastAPI()
    # Configure low rate limit for testing: 5 requests per minute
    app.add_middleware(RateLimitMiddleware, requests_per_minute=5, max_keys=10)
    app.include_router(candidates_router, prefix="/api/v1", dependencies=[Depends(auth.verify_api_key)])

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/public-ping")
    def public_ping():
        return {"status": "pong"}

    with TestClient(app) as client:
        yield client

    auth.ATS_AUTH_ENABLED = orig_auth
    auth.EXPECTED_API_KEY = orig_key


# ==================== 1. LRU MEMORY BOUNDING ====================

def test_lru_rate_limiter_strict_max_keys_cap():
    """SlidingWindowRateLimiter strictly enforces max_keys and evicts least recently used keys."""
    max_capacity = 4
    limiter = SlidingWindowRateLimiter(requests_per_minute=10, max_keys=max_capacity)

    # Insert 4 keys
    for i in range(1, 5):
        assert limiter.is_allowed(f"key-{i}") is True

    assert len(limiter._history) == 4
    # All keys 1..4 are present
    assert list(limiter._history.keys()) == ["key-1", "key-2", "key-3", "key-4"]

    # Access key-1 so it becomes the most recently used
    assert limiter.is_allowed("key-1") is True
    # Order should now have key-1 at the end: key-2, key-3, key-4, key-1
    assert list(limiter._history.keys()) == ["key-2", "key-3", "key-4", "key-1"]

    # Insert a 5th key: key-2 (least recently used) must be evicted
    assert limiter.is_allowed("key-5") is True
    assert len(limiter._history) == max_capacity
    assert "key-2" not in limiter._history
    assert "key-1" in limiter._history
    assert "key-5" in limiter._history


# ==================== 2. TRUSTED REVERSE PROXY IP EXTRACTION ====================

def test_get_client_ip_trusted_proxy_headers():
    """Validates IP extraction across X-Forwarded-For, X-Real-IP, and CF-Connecting-IP."""
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/test",
        "headers": [],
        "client": ("10.0.0.99", 54321),
    }

    # 1. Fallback to socket peer when no proxy headers
    req = Request(scope)
    assert get_client_ip(req) == "10.0.0.99"

    # 2. X-Forwarded-For with multiple IPs takes the first (client) IP
    scope_xff = dict(scope)
    scope_xff["headers"] = [
        (b"x-forwarded-for", b"203.0.113.42, 198.51.100.1, 10.0.0.1")
    ]
    assert get_client_ip(Request(scope_xff)) == "203.0.113.42"

    # 3. X-Real-IP fallback
    scope_xreal = dict(scope)
    scope_xreal["headers"] = [(b"x-real-ip", b"198.51.100.55")]
    assert get_client_ip(Request(scope_xreal)) == "198.51.100.55"

    # 4. CF-Connecting-IP
    scope_cf = dict(scope)
    scope_cf["headers"] = [(b"cf-connecting-ip", b"192.0.2.77")]
    assert get_client_ip(Request(scope_cf)) == "192.0.2.77"


# ==================== 3. PRE-AUTH HEADER SPOOFING BYPASS PREVENTION ====================

def test_header_spoofing_does_not_bypass_rate_limit(rate_limited_app):
    """
    Unauthenticated caller attempting to bypass rate limits by rotating
    X-API-Key and X-User-Id headers on each request must still be throttled
    by client IP.
    """
    client = rate_limited_app
    ip = "198.51.100.100"

    # Send 5 requests from the same IP with different spoofed headers
    for i in range(5):
        spoofed_headers = {
            "x-forwarded-for": ip,
            "X-API-Key": f"spoofed-key-{i}",
            "X-User-Id": f"spoofed-user-{i}",
        }
        res = client.get("/public-ping", headers=spoofed_headers)
        assert res.status_code == 200

    # 6th request with yet another random spoofed header must be blocked with HTTP 429
    blocked_headers = {
        "x-forwarded-for": ip,
        "X-API-Key": "spoofed-key-bypass-attempt",
        "X-User-Id": "spoofed-user-bypass-attempt",
    }
    blocked_res = client.get("/public-ping", headers=blocked_headers)
    assert blocked_res.status_code == 429
    assert blocked_res.headers.get("retry-after") == "60"
    assert "Rate limit exceeded" in blocked_res.json()["detail"]


# ==================== 4. SHARED API-KEY CONTENTION PREVENTION ====================

def test_shared_api_key_independent_buckets_per_ip(rate_limited_app):
    """
    Two distinct client IPs sharing the same X-API-Key receive separate rate-limit buckets.
    Client A reaching the limit does NOT block Client B.
    """
    client = rate_limited_app
    shared_key = TEST_SECRET
    ip_a = "203.0.113.10"
    ip_b = "203.0.113.20"

    headers_a = {"x-forwarded-for": ip_a, "X-API-Key": shared_key}
    headers_b = {"x-forwarded-for": ip_b, "X-API-Key": shared_key}

    # Exhaust quota for Client A (5 requests)
    for _ in range(5):
        res = client.get("/public-ping", headers=headers_a)
        assert res.status_code == 200

    # 6th request from Client A is rate-limited
    res_a_blocked = client.get("/public-ping", headers=headers_a)
    assert res_a_blocked.status_code == 429

    # Client B on a different IP using the SAME shared key must still be allowed
    res_b_ok = client.get("/public-ping", headers=headers_b)
    assert res_b_ok.status_code == 200


# ==================== 5. AUTHENTICATED USER IDENTITY KEYING ====================

def test_authenticated_user_rate_limited_by_verified_identity(rate_limited_app):
    """
    Verified authenticated user is tracked by user:<user_id>.
    Rotating client IP does not bypass their authenticated user rate limit.
    """
    client = rate_limited_app

    # Make 5 requests under verified credentials from different simulated client IPs
    for i in range(5):
        headers = {
            **AUTH_HEADERS,
            "x-forwarded-for": f"192.0.2.{i + 1}",
        }
        res = client.get("/api/v1/candidates", headers=headers)
        assert res.status_code == 200

    # 6th request from another new IP under the same verified token must be throttled
    blocked_headers = {
        **AUTH_HEADERS,
        "x-forwarded-for": "192.0.2.99",
    }
    blocked_res = client.get("/api/v1/candidates", headers=blocked_headers)
    assert blocked_res.status_code == 429
    assert blocked_res.headers.get("retry-after") == "60"
