"""
rate_limiter.py
In-memory sliding window rate limiter middleware for FastAPI.
Protects ATS Core API from DoS attacks, high-frequency brute-forcing,
and unthrottled endpoint abuse.
"""

import os
import time
import threading
from typing import Dict, List, Optional
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


class SlidingWindowRateLimiter:
    """
    Thread-safe in-memory sliding window rate limiter.
    Limits requests per key within a rolling 60-second window.
    """

    def __init__(self, requests_per_minute: int = 120):
        self.requests_per_minute = requests_per_minute
        self.window_seconds = 60.0
        self._lock = threading.Lock()
        self._history: Dict[str, List[float]] = {}
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
                return False

            valid_timestamps.append(now)
            self._history[key] = valid_timestamps
            return True

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
limiter = SlidingWindowRateLimiter(requests_per_minute=_DEFAULT_RATE)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware intercepting incoming HTTP requests to enforce rate limits.
    """

    def __init__(self, app, requests_per_minute: Optional[int] = None):
        super().__init__(app)
        rpm = requests_per_minute or int(os.getenv("ATS_RATE_LIMIT_PER_MINUTE", "120"))
        self.limiter = SlidingWindowRateLimiter(requests_per_minute=rpm)

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

        # Derive rate-limiting key: Prefer API key or User ID; fallback to client IP
        client_key = (
            request.headers.get("X-API-Key")
            or request.headers.get("X-User-Id")
            or (request.client.host if request.client else "unknown-client")
        )

        if not self.limiter.is_allowed(client_key):
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Please try again later."},
                headers={"Retry-After": "60"},
            )

        return await call_next(request)
