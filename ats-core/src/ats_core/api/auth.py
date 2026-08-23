import os
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
EXPECTED_API_KEY = os.getenv("ATS_API_KEY", "ats-secret-key-dev-mode")


async def verify_api_key(
    header_key: Optional[str] = Security(api_key_header),
    bearer_creds: Optional[HTTPAuthorizationCredentials] = Security(bearer_scheme),
) -> str:
    """
    Validates client authentication via X-API-Key header or Authorization: Bearer token.
    If ATS_AUTH_ENABLED is False (development default), requests without keys are allowed.
    """
    token = header_key or (bearer_creds.credentials if bearer_creds else None)

    # Allow unauthenticated requests in explicit dev mode if no key configured
    if not ATS_AUTH_ENABLED:
        return token or "anonymous_dev_user"

    if not token:
        logger.warning("Unauthenticated request blocked (missing credentials)")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing required authentication credentials. Provide X-API-Key or Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if token != EXPECTED_API_KEY:
        logger.warning("Unauthorized request with invalid API key attempted")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid authentication credentials.",
        )

    return token
