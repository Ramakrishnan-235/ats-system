"""
rate_limiter.py
In-memory sliding window rate limiter middleware for FastAPI.
Protects ATS Core API from DoS attacks, high-frequency brute-forcing,
and unthrottled endpoint abuse with LRU-bounded memory guarantees and
two-tier IP/verified-identity bucket isolation (SEC-07).
"""

from collections import OrderedDict
import os
import threading
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


def get_client_ip(request: Request) -> str:
    """
    Extracts the client IP address strictly from trusted reverse proxy headers or socket peer.
    Evaluates 'X-Forwarded-For' (leftmost IP), 'X-Real-IP', and 'CF-Connecting-IP'
    when ATS_TRUST_PROXY_HEADERS is enabled (default true), falling back to
    the socket peer 'request.client.host', or '127.0.0.1'.
    """
    trust_proxies = os.getenv("ATS_TRUST_PROXY_HEADERS", "true").strip().lower() in ("true", "1", "yes")
    if trust_proxies:
        for header_name in ("x-forwarded-for", "x-real-ip", "cf-connecting-ip"):
            raw_val = request.headers.get(header_name)
            if raw_val:
                first = raw_val.split(",")[0].strip()
                if first:
                    return first

    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"


def _extract_user_identity(request: Request):
    """Safely extracts caller identity via ats_core.api.auth without circular imports."""
    try:
        from ats_core.api.auth import extract_user_identity
        return extract_user_identity(request)
    except Exception:
        return None


class SlidingWindowRateLimiter:
    """
    Thread-safe in-memory sliding window rate limiter with LRU capacity capping.
    Limits requests per key within a rolling window (default 60 seconds).
    Caps the maximum number of tracked keys to avoid memory exhaustion (DoS).
    """

    def __init__(
        self,
        requests_per_minute: int = 120,
        max_keys: int | None = None,
        window_seconds: float = 60.0,
    ):
        self.requests_per_minute = requests_per_minute
        self.window_seconds = window_seconds
        self.max_keys = max_keys or int(os.getenv("ATS_RATE_LIMIT_MAX_KEYS", "10000"))
        self._lock = threading.Lock()
        self._history: OrderedDict[str, list[float]] = OrderedDict()
        self._last_cleanup = time.time()

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        window_start = now - self.window_seconds

        with self._lock:
            # Periodic cleanup of keys with no recent activity
            if now - self._last_cleanup > 120.0:
                self._prune_stale(window_start)
                self._last_cleanup = now

            timestamps = self._history.get(key, [])
            # Filter timestamps outside the rolling window
            valid_timestamps = [t for t in timestamps if t > window_start]

            if len(valid_timestamps) >= self.requests_per_minute:
                self._history[key] = valid_timestamps
                self._history.move_to_end(key)
                return False

            valid_timestamps.append(now)
            self._history[key] = valid_timestamps
            self._history.move_to_end(key)

            # Cap maximum tracked keys using LRU eviction
            if len(self._history) > self.max_keys:
                self._prune_stale(window_start)
                while len(self._history) > self.max_keys:
                    self._history.popitem(last=False)

            return True

    def record(self, key: str) -> None:
        """Records an authenticated request timestamp for downstream verified identity tracking."""
        now = time.time()
        window_start = now - self.window_seconds

        with self._lock:
            timestamps = self._history.get(key, [])
            valid_timestamps = [t for t in timestamps if t > window_start]
            valid_timestamps.append(now)
            self._history[key] = valid_timestamps
            self._history.move_to_end(key)

            if len(self._history) > self.max_keys:
                self._prune_stale(window_start)
                while len(self._history) > self.max_keys:
                    self._history.popitem(last=False)

    def _prune_stale(self, window_start: float) -> None:
        """Evicts keys that have no requests in the current window."""
        stale_keys = [
            k for k, timestamps in self._history.items()
            if not timestamps or timestamps[-1] <= window_start
        ]
        for k in stale_keys:
            del self._history[k]

    def reset(self) -> None:
        """Clears all tracking history (for test isolation)."""
        with self._lock:
            self._history.clear()
            self._last_cleanup = time.time()


# Global limiter instance
_DEFAULT_RATE = int(os.getenv("ATS_RATE_LIMIT_PER_MINUTE", "120"))
_DEFAULT_MAX_KEYS = int(os.getenv("ATS_RATE_LIMIT_MAX_KEYS", "10000"))
limiter = SlidingWindowRateLimiter(
    requests_per_minute=_DEFAULT_RATE,
    max_keys=_DEFAULT_MAX_KEYS,
)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware intercepting incoming HTTP requests to enforce rate limits.
    Enforces two-tier rate limiting (SEC-07):
    - Unauthenticated requests are keyed strictly by verified client IP (ip:<client_ip>).
      Unverified client headers (X-API-Key, X-User-Id) are never used as pre-auth bucket keys.
    - Authenticated requests are keyed by verified user/session identity (user:<user_id>).
    """

    def __init__(
        self,
        app,
        requests_per_minute: int | None = None,
        max_keys: int | None = None,
    ):
        super().__init__(app)
        rpm = requests_per_minute or int(os.getenv("ATS_RATE_LIMIT_PER_MINUTE", "120"))
        mk = max_keys or int(os.getenv("ATS_RATE_LIMIT_MAX_KEYS", "10000"))
        self.limiter = SlidingWindowRateLimiter(requests_per_minute=rpm, max_keys=mk)

    async def dispatch(self, request: Request, call_next) -> Response:
        # Check if rate limiting is globally disabled
        if os.getenv("ATS_RATE_LIMIT_ENABLED", "true").strip().lower() in ("false", "0", "no"):
            return await call_next(request)

        # Exempt health checks and documentation endpoints
        path = request.url.path
        if path in ("/health", "/api/v1/health", "/docs", "/redoc", "/openapi.json"):
            return await call_next(request)

        # Exempt pre-flight CORS OPTIONS requests
        if request.method == "OPTIONS":
            return await call_next(request)

        # Derive rate-limiting key:
        # 1. Determine if caller has an existing cryptographically verified identity
        user = getattr(request.state, "user", None)
        if user is None:
            user = _extract_user_identity(request)

        if user and getattr(user, "is_verified", False) and getattr(user, "user_id", None):
            # Authenticated caller: bucket key is the verified user/session ID
            rate_key = f"user:{user.user_id}"
        else:
            # Unauthenticated caller: bucket key is strictly the verified client IP
            # Client-supplied unverified headers (X-API-Key, X-User-Id) are discarded for bucket derivation.
            client_ip = get_client_ip(request)
            rate_key = f"ip:{client_ip}"

        if not self.limiter.is_allowed(rate_key):
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Please try again later."},
                headers={"Retry-After": "60"},
            )

        response = await call_next(request)

        # Track usage for identity verified downstream after authentication completes
        post_user = getattr(request.state, "user", None)
        if post_user and getattr(post_user, "is_verified", False) and getattr(post_user, "user_id", None):
            user_key = f"user:{post_user.user_id}"
            if user_key != rate_key:
                self.limiter.record(user_key)

        return response
