import os
import secrets
import logging
from enum import Enum
from dataclasses import dataclass
from typing import Optional, Set
from fastapi import Request, Security, HTTPException, status
from fastapi.security import APIKeyHeader, HTTPBearer, HTTPAuthorizationCredentials

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


PII_ROLES: Set[str] = {Role.ADMIN.value, Role.RECRUITER.value, Role.COMPLIANCE.value}
AUDIT_ROLES: Set[str] = {Role.ADMIN.value, Role.RECRUITER.value, Role.COMPLIANCE.value}
TAXONOMY_MANAGE_ROLES: Set[str] = {Role.ADMIN.value, Role.RECRUITER.value}
TAXONOMY_ADMIN_ROLES: Set[str] = {Role.ADMIN.value}


@dataclass
class UserIdentity:
    user_id: str
    role: str
    email: Optional[str] = None

    def can_view_pii(self) -> bool:
        if not self.user_id or not self.role:
            return False
        return self.role.strip().lower() in PII_ROLES

    def can_view_audit(self) -> bool:
        if not self.role:
            return False
        return self.role.strip().lower() in AUDIT_ROLES

    def can_manage_taxonomy(self) -> bool:
        if not self.role:
            return False
        return self.role.strip().lower() in TAXONOMY_MANAGE_ROLES

    def can_admin_taxonomy(self) -> bool:
        if not self.role:
            return False
        return self.role.strip().lower() in TAXONOMY_ADMIN_ROLES


def extract_user_identity(request: Optional[Request] = None) -> UserIdentity:
    user_id = ""
    role_header = ""
    email = None

    if request is not None:
        user_id = (
            request.headers.get("X-User-Id")
            or request.headers.get("X-Actor-Id")
            or request.headers.get("X-User")
            or ""
        ).strip()
        role_header = (
            request.headers.get("X-User-Role")
            or request.headers.get("X-Role")
            or ""
        ).strip()
        email = request.headers.get("X-User-Email") or None

    role = role_header.lower() if role_header else ""

    if not role:
        if not ATS_AUTH_ENABLED:
            role = os.getenv("ATS_DEFAULT_ROLE", Role.RECRUITER.value).lower()
            if not user_id:
                user_id = "dev-user"
        else:
            role = os.getenv("ATS_DEFAULT_USER_ROLE", Role.VIEWER.value).lower()

    return UserIdentity(user_id=user_id, role=role, email=email)


def get_current_user(request: Request) -> UserIdentity:
    if request is not None and hasattr(request, "state") and hasattr(request.state, "user") and request.state.user:
        return request.state.user
    user = extract_user_identity(request)
    if request is not None and hasattr(request, "state"):
        request.state.user = user
    return user


def validate_auth_configuration() -> None:
    if ATS_AUTH_ENABLED and not EXPECTED_API_KEY.strip():
        raise RuntimeError("ATS_API_KEY must be configured when ATS authentication is enabled.")


async def verify_api_key(
    request: Request = None,
    header_key: Optional[str] = Security(api_key_header),
    bearer_creds: Optional[HTTPAuthorizationCredentials] = Security(bearer_scheme),
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
