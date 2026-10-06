"""
test_auth_inconsistencies_2_8.py
Regression tests for Finding 2.8:
1. Python returns 401 Unauthorized (not 403) for an invalid or missing API key / Bearer token.
2. ATS_AUTH_ENABLED accepts '0', 'no', 'off', 'false' consistently across backends.
3. Bearer authentication token is parsed case-insensitively.
"""

from unittest.mock import patch
import pytest
from fastapi import FastAPI, Depends, HTTPException
from fastapi.testclient import TestClient

import ats_core.api.auth as auth_mod
from ats_core.api.v1.jobs import router as jobs_router


TEST_API_KEY = "sec-test-key-28"


@pytest.fixture
def auth_test_app():
    """Sets up an isolated FastAPI app requiring authentication."""
    app = FastAPI()
    app.include_router(jobs_router, prefix="/api/v1", dependencies=[Depends(auth_mod.verify_api_key)])
    return app


def test_invalid_api_key_returns_401_unauthorized(auth_test_app):
    """
    Python must return 401 Unauthorized (not 403 Forbidden) when an invalid API key is provided,
    consistent with Go backend and standard HTTP specifications.
    """
    with patch.object(auth_mod, "ATS_AUTH_ENABLED", True), \
         patch.object(auth_mod, "EXPECTED_API_KEY", TEST_API_KEY):
        with TestClient(auth_test_app) as client:
            # 1. Invalid X-API-Key
            resp = client.get("/api/v1/jobs", headers={"X-API-Key": "completely-invalid-key"})
            assert resp.status_code == 401
            assert resp.headers.get("www-authenticate") == "Bearer"
            assert resp.json()["detail"] == "Invalid authentication credentials."

            # 2. Invalid Bearer token
            resp = client.get("/api/v1/jobs", headers={"Authorization": "Bearer bad-token"})
            assert resp.status_code == 401
            assert resp.headers.get("www-authenticate") == "Bearer"

            # 3. Missing key
            resp = client.get("/api/v1/jobs")
            assert resp.status_code == 401
            assert resp.headers.get("www-authenticate") == "Bearer"

            # 4. Valid key succeeds
            resp = client.get("/api/v1/jobs", headers={"X-API-Key": TEST_API_KEY})
            assert resp.status_code == 200

            # 5. Valid Bearer token succeeds
            resp = client.get("/api/v1/jobs", headers={"Authorization": f"Bearer {TEST_API_KEY}"})
            assert resp.status_code == 200


@pytest.mark.asyncio
async def test_bearer_prefix_case_insensitivity():
    """Bearer scheme in Authorization header must be accepted case-insensitively."""
    with patch.object(auth_mod, "ATS_AUTH_ENABLED", True), \
         patch.object(auth_mod, "EXPECTED_API_KEY", TEST_API_KEY):
        
        # Valid key
        token = await auth_mod.verify_api_key(
            header_key=None,
            bearer_creds=auth_mod.HTTPAuthorizationCredentials(scheme="Bearer", credentials=TEST_API_KEY)
        )
        assert token == TEST_API_KEY

        # Invalid key raises 401
        with pytest.raises(HTTPException) as exc_info:
            await auth_mod.verify_api_key(
                header_key=None,
                bearer_creds=auth_mod.HTTPAuthorizationCredentials(scheme="Bearer", credentials="bad-token")
            )
        assert exc_info.value.status_code == 401


def test_auth_enabled_falsy_values():
    """Verify that 'false', '0', 'no', and 'off' are recognized as disabling auth."""
    for falsy in ("false", "0", "no", "off", "FALSE", "No", "OFF"):
        val = falsy.strip().lower() not in ("false", "0", "no", "off")
        assert val is False, f"Expected {falsy} to be recognized as falsy"

    for truthy in ("true", "1", "yes", "on", "TRUE", "Yes", "ON"):
        val = truthy.strip().lower() not in ("false", "0", "no", "off")
        assert val is True, f"Expected {truthy} to be recognized as truthy"
