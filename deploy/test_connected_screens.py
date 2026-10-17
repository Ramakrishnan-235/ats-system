"""Automated verification for completion check:
1. Change workspace name
2. Reload / re-fetch and verify changed name
3. Sign out and back in, confirm saved name remains
4. Empty workspace verification (returns empty lists, not mock data)
5. Failed request error verification (returns error details)
"""

import sys
from uuid import uuid4
import httpx

BASE_URL = "http://localhost:3000/core-api"

def main():
    print(f"Connecting to ATS frontend proxy at {BASE_URL}...")
    headers = {"origin": "http://localhost:3000"}

    with httpx.Client(base_url=BASE_URL, headers=headers, timeout=30) as client:
        # Step 1: Sign in with dev recruiter
        print("\n[Step 1] Signing in with dev recruiter...")
        login_res = client.post("/api/v1/auth/login", json={
            "email": "recruiter@example.com",
            "password": "password"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        session_data = login_res.json()
        print(f"  Logged in as: {session_data['user']['email']}, Tenant ID: {session_data['user']['tenant_id']}")

        # Step 2: Fetch current workspace settings
        ws_res = client.get("/api/v1/settings/workspace")
        assert ws_res.status_code == 200, f"Fetch workspace failed: {ws_res.text}"
        old_ws = ws_res.json()
        print(f"  Current workspace name: '{old_ws['name']}'")

        # Step 3: Change workspace name
        suffix = str(uuid4())[:6]
        new_name = f"Acme Global Talent {suffix}"
        print(f"\n[Step 2] Changing workspace name to '{new_name}'...")
        patch_res = client.patch("/api/v1/settings/workspace", json={"name": new_name})
        assert patch_res.status_code == 200, f"Workspace patch failed: {patch_res.text}"
        patch_data = patch_res.json()
        assert patch_data["name"] == new_name, f"Expected {new_name}, got {patch_data['name']}"
        print(f"  Server confirmed workspace name updated to: '{patch_data['name']}'")

        # Step 4: Reload / re-fetch settings
        print("\n[Step 3] Simulating page reload (re-fetching /settings/workspace)...")
        reload_res = client.get("/api/v1/settings/workspace")
        assert reload_res.status_code == 200, f"Reload failed: {reload_res.text}"
        assert reload_res.json()["name"] == new_name, f"Reload mismatch: {reload_res.text}"
        print(f"  Reload verified: workspace name is '{new_name}'")

        # Step 5: Sign out
        print("\n[Step 4] Signing out...")
        logout_res = client.post("/api/v1/auth/logout")
        assert logout_res.status_code == 200, f"Logout failed: {logout_res.text}"
        print("  Logged out successfully.")

        # Step 6: Sign back in
        print("\n[Step 5] Signing back in...")
        login2_res = client.post("/api/v1/auth/login", json={
            "email": "recruiter@example.com",
            "password": "password"
        })
        assert login2_res.status_code == 200, f"Second login failed: {login2_res.text}"
        print("  Signed back in successfully.")

        # Step 7: Confirm saved value remains
        print("\n[Step 6] Confirming saved value remains after re-login...")
        ws2_res = client.get("/api/v1/settings/workspace")
        assert ws2_res.status_code == 200, f"Fetch after login failed: {ws2_res.text}"
        persisted_name = ws2_res.json()["name"]
        assert persisted_name == new_name, f"Persisted name mismatch! Expected '{new_name}', got '{persisted_name}'"
        print(f"  Confirmed! Persisted workspace name remains: '{persisted_name}'")

        # Step 8: Empty workspace verification
        print("\n[Step 7] Testing empty workspace state...")
        empty_suffix = str(uuid4())[:8]
        empty_email = f"empty-{empty_suffix}@example.com"
        empty_ws_name = f"Empty Enterprise {empty_suffix}"
        reg_empty_res = client.post("/api/v1/auth/register", json={
            "email": empty_email,
            "password": "password123!",
            "name": "Empty User",
            "workspace_name": empty_ws_name,
            "workspace_kind": "corporate"
        })
        assert reg_empty_res.status_code == 200, f"Empty user register failed: {reg_empty_res.text}"
        print(f"  Registered new isolated empty workspace: '{empty_ws_name}'")

        empty_cands = client.get("/api/v1/candidates")
        assert empty_cands.status_code == 200, f"Candidates query failed: {empty_cands.text}"
        cands_json = empty_cands.json()
        assert len(cands_json) == 0, f"Expected 0 candidates in empty workspace, found {len(cands_json)}"
        print(f"  Verified candidates count in empty workspace: {len(cands_json)}")

        empty_jobs = client.get("/api/v1/jobs")
        assert empty_jobs.status_code == 200, f"Jobs query failed: {empty_jobs.text}"
        jobs_json = empty_jobs.json()
        assert len(jobs_json) == 0, f"Expected 0 jobs in empty workspace, found {len(jobs_json)}"
        print(f"  Verified jobs count in empty workspace: {len(jobs_json)}")

        empty_analytics = client.get("/api/v1/analytics/dashboard")
        assert empty_analytics.status_code == 200, f"Analytics query failed: {empty_analytics.text}"
        analytics_json = empty_analytics.json()
        assert analytics_json.get("queued_tasks") == 0, f"Expected 0 queued tasks, got {analytics_json.get('queued_tasks')}"
        print("  Verified analytics in empty workspace returns zeroed metrics (no mock data).")

        # Step 9: Error handling verification
        print("\n[Step 8] Testing error handling on failed requests...")
        # 1. Invite non-existent user should fail with useful error
        invite_fail_res = client.post("/api/v1/settings/members", json={
            "email": "nonexistent-user-123456@example.com",
            "role": "recruiter"
        })
        assert invite_fail_res.status_code == 400, f"Expected 400, got {invite_fail_res.status_code}: {invite_fail_res.text}"
        err_msg = invite_fail_res.json().get("error", "")
        assert "must first create an account" in err_msg, f"Unexpected error message: {err_msg}"
        print(f"  Verified server error response on member invite: '{err_msg}'")

        # 2. Accessing client submission endpoints in corporate mode fails with 403
        client_fail_res = client.get("/api/v1/clients")
        assert client_fail_res.status_code == 403, f"Expected 403 for corporate tenant, got {client_fail_res.status_code}: {client_fail_res.text}"
        client_err = client_fail_res.json().get("error", "")
        print(f"  Verified server error response on corporate client access: '{client_err}'")

    print("\n========================================================")
    print("ALL CONNECTED SCREENS & COMPLETION CHECKS PASSED!")
    print("========================================================\n")

if __name__ == "__main__":
    main()
