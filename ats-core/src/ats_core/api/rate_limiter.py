"""
rate_limiter.py
In-memory sliding window rate limiter middleware for FastAPI.
Protects ATS Core API from DoS attacks, high-frequency brute-forcing,
and unthrottled endpoint abuse with LRU-bounded memory guarantees and
two-tier IP/verified-identity bucket isolation (SEC-07).
"""

from collections import OrderedDict
import ipaddress
import os
import threading
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


def is_trusted_proxy(peer_ip: str | None) -> bool:
    """
    Determines whether the socket peer IP is a trusted reverse proxy.
    Trusted proxies default to loopback and test client addresses,
    configurable via ATS_TRUSTED_PROXIES (comma-separated list of IPs or CIDRs).
    """
    if not peer_ip:
        return False
    trusted_raw = os.getenv("ATS_TRUSTED_PROXIES", "127.0.0.1,::1,localhost,testclient").strip()
    trusted_list = [p.strip().lower() for p in trusted_raw.split(",") if p.strip()]
    peer_lower = peer_ip.strip().lower()
    if peer_lower in trusted_list:
        return True
    try:
        addr = ipaddress.ip_address(peer_lower)
        for trusted in trusted_list:
            try:
                if "/" in trusted and addr in ipaddress.ip_network(trusted, strict=False):
                    return True
                elif addr == ipaddress.ip_address(trusted):
                    return True
            except ValueError:
                continue
    except ValueError:
        pass
    return False


def get_client_ip(request: Request) -> str:
    """
    Extracts the client IP address strictly from trusted reverse proxy headers or socket peer.
    Proxy headers ('X-Forwarded-For', 'X-Real-IP', 'CF-Connecting-IP') are only evaluated
    if the direct socket peer (request.client.host) is an identified trusted reverse proxy.
    When trusted, extracts the rightmost IP appended by the trusted proxy (ips[-1]),
    preventing client-spoofed leftmost headers from poisoning the rate-limit bucket.
    If the socket peer is not trusted or proxy trusting is disabled, returns request.client.host.
    """
    socket_peer = request.client.host if request.client and request.client.host else None
    trust_proxies = os.getenv("ATS_TRUST_PROXY_HEADERS", "true").strip().lower() in ("true", "1", "yes")

    if trust_proxies and socket_peer and is_trusted_proxy(socket_peer):
        raw_xff = request.headers.get("x-forwarded-for")
        if raw_xff:
            ips = [x.strip() for x in raw_xff.split(",") if x.strip()]
            if ips:
                return ips[-1]

        for header_name in ("cf-connecting-ip", "x-real-ip"):
            raw_val = request.headers.get(header_name)
            if raw_val and raw_val.strip():
                return raw_val.strip()

    if socket_peer:
        return socket_peer

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
