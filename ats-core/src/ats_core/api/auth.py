import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from dataclasses import dataclass
from enum import Enum

from fastapi import HTTPException, Request, Security, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger("ats.api.auth")

API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)
bearer_scheme = HTTPBearer(auto_error=False)

# Configuration from environment
ATS_AUTH_ENABLED = os.getenv("ATS_AUTH_ENABLED", "true").strip().lower() not in ("false", "0", "no", "off")
EXPECTED_API_KEY = os.getenv("ATS_API_KEY", "")


class Role(str, Enum):
    ADMIN = "admin"
    RECRUITER = "recruiter"
    COMPLIANCE = "compliance"
    INTERVIEWER = "interviewer"
    VIEWER = "viewer"


PII_ROLES: set[str] = {Role.ADMIN.value, Role.RECRUITER.value, Role.COMPLIANCE.value}
AUDIT_ROLES: set[str] = {Role.ADMIN.value, Role.RECRUITER.value, Role.COMPLIANCE.value}
TAXONOMY_MANAGE_ROLES: set[str] = {Role.ADMIN.value, Role.RECRUITER.value}
TAXONOMY_ADMIN_ROLES: set[str] = {Role.ADMIN.value}
WRITE_ROLES: set[str] = {Role.ADMIN.value, Role.RECRUITER.value}
NOTE_ROLES: set[str] = {Role.ADMIN.value, Role.RECRUITER.value, Role.INTERVIEWER.value}


@dataclass
class UserIdentity:
    user_id: str
    role: str
    email: str | None = None
    is_verified: bool = False

    def can_view_pii(self) -> bool:
        if not self.is_verified:
            return False
        if not self.user_id or not self.role:
            return False
        return self.role.strip().lower() in PII_ROLES

    def can_view_audit(self) -> bool:
        if not self.is_verified:
            return False
        if not self.role:
            return False
        return self.role.strip().lower() in AUDIT_ROLES

    def can_manage_taxonomy(self) -> bool:
        if not self.is_verified:
            return False
        if not self.role:
            return False
        return self.role.strip().lower() in TAXONOMY_MANAGE_ROLES

    def can_admin_taxonomy(self) -> bool:
        if not self.is_verified:
            return False
        if not self.role:
            return False
        return self.role.strip().lower() in TAXONOMY_ADMIN_ROLES

    def can_write(self) -> bool:
        if not self.is_verified:
            return False
        if not self.role:
            return False
        return self.role.strip().lower() in WRITE_ROLES

    def can_add_notes(self) -> bool:
        if not self.is_verified:
            return False
        if not self.role:
            return False
        return self.role.strip().lower() in NOTE_ROLES


def get_signing_secret() -> str:
    secret = os.getenv("ATS_TOKEN_SECRET", "").strip()
    ats_env = os.getenv("ATS_ENV", "").strip().lower()
    if not secret:
        if ATS_AUTH_ENABLED and ats_env == "production":
            raise RuntimeError("ATS_TOKEN_SECRET must be configured with >=32 chars in production.")
        logger.warning("ATS_TOKEN_SECRET is not configured; using insecure dev signing secret.")
        return "ats-insecure-dev-signing-secret-key-32b"
    if ATS_AUTH_ENABLED and ats_env == "production" and len(secret) < 32:
        raise RuntimeError("ATS_TOKEN_SECRET must be configured with >=32 chars in production.")
    return secret


def create_signed_token(
    user_id: str,
    role: str,
    email: str | None = None,
    secret_key: str | None = None,
    expires_in_seconds: int = 3600 * 12,
) -> str:
    secret = (secret_key or get_signing_secret()).strip()
    now = int(time.time())
    payload = {
        "uid": str(user_id).strip(),
        "rol": str(role).strip().lower(),
        "eml": str(email).strip() if email else None,
        "iat": now,
        "exp": now + expires_in_seconds,
    }
    raw_payload = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(raw_payload).decode("ascii").rstrip("=")
    sig = hmac.new(secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode("ascii").rstrip("=")
    return f"{payload_b64}.{sig_b64}"


def verify_signed_token(token: str, secret_key: str | None = None) -> UserIdentity | None:
    if not token or "." not in token:
        return None
    parts = token.strip().split(".")
    if len(parts) != 2:
        return None
    payload_b64, sig_b64 = parts

    candidates: list[str] = []
    if secret_key:
        candidates.append(secret_key.strip())
    token_secret = os.getenv("ATS_TOKEN_SECRET", "").strip()
    if token_secret and token_secret not in candidates:
        candidates.append(token_secret)
    else:
        try:
            signing_sec = get_signing_secret()
            if signing_sec and signing_sec not in candidates:
                candidates.append(signing_sec)
        except Exception:
            pass
    service_key = os.getenv("ATS_SERVICE_KEY", "").strip()
    if service_key and service_key not in candidates:
        candidates.append(service_key)

    for sec in candidates:
        expected_sig = hmac.new(sec.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256).digest()
        expected_sig_b64 = base64.urlsafe_b64encode(expected_sig).decode("ascii").rstrip("=")
        if secrets.compare_digest(sig_b64, expected_sig_b64):
            try:
                pad = len(payload_b64) % 4
                padded = payload_b64 + ("=" * (4 - pad) if pad else "")
                data = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
                if not isinstance(data, dict):
                    return None
                exp = data.get("exp")
                if exp and isinstance(exp, (int, float)) and time.time() > exp:
                    logger.warning("Expired signed token presented for user %s", data.get("uid"))
                    return None
                user_id = str(data.get("uid", "")).strip()
                role = str(data.get("rol", "")).strip().lower()
                email = data.get("eml")
                if user_id and role:
                    return UserIdentity(user_id=user_id, role=role, email=email, is_verified=True)
            except Exception as e:
                logger.debug("Failed decoding signed token payload: %s", e)
                return None
    return None


def sign_user_headers(user_id: str, role: str, email: str | None = None, secret_key: str | None = None) -> str:
    secret = (secret_key or get_signing_secret()).strip()
    msg = f"{user_id.strip()}:{role.strip().lower()}:{(email or '').strip()}"
    return hmac.new(secret.encode("utf-8"), msg.encode("utf-8"), hashlib.sha256).hexdigest()


def verify_user_signature(user_id: str, role: str, email: str | None, signature: str, secret_key: str | None = None) -> bool:
    if not signature:
        return False
    candidates: list[str] = []
    if secret_key:
        candidates.append(secret_key.strip())
    token_secret = os.getenv("ATS_TOKEN_SECRET", "").strip()
    if token_secret and token_secret not in candidates:
        candidates.append(token_secret)
    else:
        try:
            signing_sec = get_signing_secret()
            if signing_sec and signing_sec not in candidates:
                candidates.append(signing_sec)
        except Exception:
            pass
    service_key = os.getenv("ATS_SERVICE_KEY", "").strip()
    if service_key and service_key not in candidates:
        candidates.append(service_key)
    msg = f"{user_id.strip()}:{role.strip().lower()}:{(email or '').strip()}"
    for sec in candidates:
        expected = hmac.new(sec.encode("utf-8"), msg.encode("utf-8"), hashlib.sha256).hexdigest()
        if secrets.compare_digest(signature.strip().lower(), expected.lower()):
            return True
    return False


def verify_database_session(token_str: str) -> UserIdentity | None:
    if not token_str:
        return None
    try:
        from ats_core.db.store_sync import is_db_available
        if not is_db_available():
            return None
        from sqlalchemy import text
        from ats_core.workers.tasks import get_session_factory
        session_factory = get_session_factory()
        with session_factory() as session:
            tok_hash = hashlib.sha256(token_str.strip().encode("utf-8")).hexdigest()
            query = text(
                "SELECT s.user_id, m.role, u.email "
                "FROM ats_v2.sessions s "
                "JOIN ats_v2.memberships m ON m.user_id = s.user_id AND m.tenant_id = s.tenant_id "
                "JOIN ats_v2.users u ON u.id = s.user_id "
                "WHERE s.token_hash = :tok_hash AND s.expires_at > now()"
            )
            row = session.execute(query, {"tok_hash": tok_hash}).first()
            if row:
                return UserIdentity(
                    user_id=str(row[0]),
                    role=str(row[1]).lower(),
                    email=str(row[2]) if row[2] else None,
                    is_verified=True,
                )
    except Exception as e:
        logger.debug("Database session lookup skipped or failed: %s", e)
    return None


def is_trusted_service(request: Request | None) -> bool:
    if request is None:
        return False
    service_key_hdr = request.headers.get("X-Service-Key", "").strip()
    expected_service_key = os.getenv("ATS_SERVICE_KEY", "").strip()
    if expected_service_key and service_key_hdr:
        return secrets.compare_digest(service_key_hdr.encode("utf-8"), expected_service_key.encode("utf-8"))
    return False


def extract_user_identity(request: Request | None = None) -> UserIdentity:
    """
    Extracts caller identity.
    In secure mode (ATS_AUTH_ENABLED=True), caller identity and role MUST be
    cryptographically signed or bound to a server session. Client-supplied
    unsigned X-User-* headers are never trusted to grant privileged roles.
    """
    if not ATS_AUTH_ENABLED:
        role = os.getenv("ATS_DEFAULT_ROLE", Role.RECRUITER.value).lower()
        user_id = "dev-user"
        email = None
        if request is not None:
            user_id = (
                request.headers.get("X-User-Id")
                or request.headers.get("X-Actor-Id")
                or request.headers.get("X-User")
                or "dev-user"
            ).strip()
            email = request.headers.get("X-User-Email") or None
        return UserIdentity(user_id=user_id, role=role, email=email, is_verified=True)

    if request is None:
        return UserIdentity(
            user_id="anonymous",
            role=os.getenv("ATS_DEFAULT_USER_ROLE", Role.VIEWER.value).lower(),
            is_verified=False,
        )

    # 1. Check for cryptographically signed Bearer token or DB session token
    auth_header = request.headers.get("Authorization", "").strip()
    bearer_token = None
    if auth_header.lower().startswith("bearer "):
        bearer_token = auth_header[7:].strip()

    if bearer_token:
        signed_user = verify_signed_token(bearer_token)
        if signed_user:
            return signed_user

        db_user = verify_database_session(bearer_token)
        if db_user:
            return db_user

    # 2. Check cookie for DB session token
    ats_cookie = request.cookies.get("ats_session")
    if ats_cookie:
        db_user = verify_database_session(ats_cookie)
        if db_user:
            return db_user

    # 3. Check for trusted internal service gateway (X-Service-Key)
    raw_user_id = (
        request.headers.get("X-User-Id")
        or request.headers.get("X-Actor-Id")
        or request.headers.get("X-User")
        or ""
    ).strip()
    raw_role = (
        request.headers.get("X-User-Role")
        or request.headers.get("X-Role")
        or ""
    ).strip().lower()
    raw_email = request.headers.get("X-User-Email") or None

    if is_trusted_service(request):
        role = raw_role or os.getenv("ATS_DEFAULT_ROLE", Role.RECRUITER.value).lower()
        user_id = raw_user_id or "service-caller"
        return UserIdentity(user_id=user_id, role=role, email=raw_email, is_verified=True)

    # 4. Check for cryptographically signed user headers (X-User-Signature)
    signature = request.headers.get("X-User-Signature", "").strip()
    if signature and raw_user_id and raw_role:
        if verify_user_signature(raw_user_id, raw_role, raw_email, signature):
            return UserIdentity(user_id=raw_user_id, role=raw_role, email=raw_email, is_verified=True)
        logger.warning("Invalid X-User-Signature provided for actor '%s'", raw_user_id)

    # 5. Shared API key with unverified client headers
    # Client-supplied headers cannot grant privileged roles or spoof identities.
    default_role = os.getenv("ATS_DEFAULT_USER_ROLE", Role.VIEWER.value).lower()
    if raw_role and raw_role != default_role:
        logger.warning(
            "Security: Rejected unverified client header X-User-Role='%s' from caller '%s'. Downgraded to '%s'.",
            raw_role, raw_user_id or "unspecified", default_role
        )

    user_id = f"unverified:{raw_user_id}" if raw_user_id else "api-client"
    return UserIdentity(user_id=user_id, role=default_role, email=None, is_verified=False)


def get_current_user(request: Request) -> UserIdentity:
    if request is not None and hasattr(request, "state") and hasattr(request.state, "user") and request.state.user:
        return request.state.user
    user = extract_user_identity(request)
    if request is not None and hasattr(request, "state"):
        request.state.user = user
    return user


def require_write_role(request: Request) -> UserIdentity:
    user = get_current_user(request)
    if not user.can_write():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden: Role '{user.role}' is not authorized to perform write operations.",
        )
    return user


def validate_auth_configuration() -> None:
    if ATS_AUTH_ENABLED and not EXPECTED_API_KEY.strip():
        raise RuntimeError("ATS_API_KEY must be configured when ATS authentication is enabled.")


async def verify_api_key(
    request: Request = None,
    header_key: str | None = Security(api_key_header),
    bearer_creds: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
) -> str:
    """
    Validates client authentication via X-API-Key header or Authorization: Bearer token.
    Uses constant-time comparison (secrets.compare_digest) to prevent timing side-channel attacks.
    Binds caller identity (user ID, role, permissions) to request state.
    """
    token = header_key or (bearer_creds.credentials if bearer_creds else None)

    # Establish caller identity
    user = extract_user_identity(request)
    if request is not None and hasattr(request, "state"):
        request.state.user = user

    # Allow unauthenticated requests in explicit dev mode
    if not ATS_AUTH_ENABLED:
        return token or "anonymous_dev_user"

    # Allow trusted service requests with valid X-Service-Key
    if is_trusted_service(request):
        return request.headers.get("X-Service-Key", "")

    # If the user presented a valid signed token or database session, accept it
    if user.is_verified and bearer_creds and bearer_creds.credentials:
        return bearer_creds.credentials

    if not EXPECTED_API_KEY.strip():
        logger.error("Authentication is enabled (ATS_AUTH_ENABLED=true) but ATS_API_KEY is not configured.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server authentication misconfiguration. Please contact administrator.",
        )

    if not token or not token.strip():
        logger.warning("Unauthenticated request blocked (missing credentials)")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing required authentication credentials. Provide X-API-Key or Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Constant-time comparison to prevent timing attacks
    if not secrets.compare_digest(token.strip().encode("utf-8"), EXPECTED_API_KEY.strip().encode("utf-8")):
        logger.warning("Unauthorized request with invalid API key attempted")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token
