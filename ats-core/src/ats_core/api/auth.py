import os
import secrets
import logging
from typing import Optional
from fastapi import Security, HTTPException, status
from fastapi.security import APIKeyHeader, HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger("ats.api.auth")

API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)
bearer_scheme = HTTPBearer(auto_error=False)

# Configuration from environment
ATS_AUTH_ENABLED = os.getenv("ATS_AUTH_ENABLED", "false").lower() in ("true", "1", "yes")
EXPECTED_API_KEY = os.getenv("ATS_API_KEY", "")


async def verify_api_key(
    header_key: Optional[str] = Security(api_key_header),
    bearer_creds: Optional[HTTPAuthorizationCredentials] = Security(bearer_scheme),
) -> str:
    """
    Validates client authentication via X-API-Key header or Authorization: Bearer token.
    Uses constant-time comparison (secrets.compare_digest) to prevent timing side-channel attacks.
    If ATS_AUTH_ENABLED is False (development default), requests without keys are allowed.
    """
    token = header_key or (bearer_creds.credentials if bearer_creds else None)

    # Allow unauthenticated requests in explicit dev mode
    if not ATS_AUTH_ENABLED:
        return token or "anonymous_dev_user"

    if not EXPECTED_API_KEY:
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
    if not secrets.compare_digest(token.strip(), EXPECTED_API_KEY.strip()):
        logger.warning("Unauthorized request with invalid API key attempted")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid authentication credentials.",
        )

    return token
