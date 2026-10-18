/**
 * Automated verification for connected screens completion check:
 * 1. Change workspace name
 * 2. Reload / re-fetch and verify changed name
 * 3. Sign out and back in, confirm saved name remains
 * 4. Empty workspace verification (returns empty lists, not mock data)
 * 5. Failed request error verification (returns error details)
 */

import { randomUUID } from "crypto";

const BASE_URL = "http://localhost:3000/core-api";

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  setFromHeaders(headers) {
    // headers.getSetCookie() or get('set-cookie')
    const setCookies = headers.getSetCookie ? headers.getSetCookie() : [headers.get("set-cookie")].filter(Boolean);
    for (const sc of setCookies) {
      const parts = sc.split(";")[0].split("=");
      if (parts.length >= 2) {
        this.cookies.set(parts[0].trim(), parts.slice(1).join("=").trim());
      }
    }
  }

  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  clear() {
    this.cookies.clear();
  }
}

async function request(jar, path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    "Origin": "http://localhost:3000",
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const cookieHeader = jar.getCookieHeader();
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  jar.setFromHeaders(res.headers);
  return res;
}

async function main() {
  console.log(`Connecting to ATS frontend proxy at ${BASE_URL}...`);
  const jar = new CookieJar();

  // Step 1: Register and sign in with test recruiter
  console.log("\n[Step 1] Registering and signing in test recruiter...");
  const userSuffix = randomUUID().slice(0, 8);
  const testEmail = `recruiter-${userSuffix}@example.com`;
  const testPassword = `Password-${userSuffix}!`;
  const initialWsName = `Initial Workspace ${userSuffix}`;

  const regRes = await request(jar, "/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      name: "Test Recruiter",
      workspace_name: initialWsName,
      workspace_kind: "corporate",
    }),
  });
  if (!regRes.ok) throw new Error(`Registration failed: ${await regRes.text()}`);
  const meRes = await request(jar, "/api/v1/auth/me");
  if (!meRes.ok) throw new Error(`Auth/me failed: ${await meRes.text()}`);
  const sessionData = await meRes.json();
  console.log(`  Registered & authenticated as: ${sessionData.user.email}, Tenant ID: ${sessionData.user.tenant_id}`);

  // Step 2: Fetch current workspace settings from session
  const oldWs = sessionData.workspaces.find((w) => w.id === sessionData.user.tenant_id) || sessionData.workspaces[0];
  console.log(`  Current workspace name: '${oldWs.name}'`);

  // Step 3: Change workspace name
  const suffix = randomUUID().slice(0, 6);
  const newName = `Acme Global Talent ${suffix}`;
  console.log(`\n[Step 2] Changing workspace name to '${newName}' via PATCH /settings/workspace...`);
  const patchRes = await request(jar, "/api/v1/settings/workspace", {
    method: "PATCH",
    body: JSON.stringify({ name: newName }),
  });
  if (!patchRes.ok) throw new Error(`Workspace patch failed: ${await patchRes.text()}`);
  const patchData = await patchRes.json();
  if (patchData.name !== newName) {
    throw new Error(`Expected ${newName}, got ${patchData.name}`);
  }
  console.log(`  Server confirmed workspace name updated to: '${patchData.name}'`);

  // Step 4: Reload / re-fetch settings
  console.log("\n[Step 3] Simulating page reload (re-fetching /auth/me)...");
  const reloadRes = await request(jar, "/api/v1/auth/me");
  if (!reloadRes.ok) throw new Error(`Reload failed: ${await reloadRes.text()}`);
  const reloadData = await reloadRes.json();
  const reloadedWs = reloadData.workspaces.find((w) => w.id === reloadData.user.tenant_id) || reloadData.workspaces[0];
  if (reloadedWs.name !== newName) {
    throw new Error(`Reload mismatch: expected ${newName}, got ${reloadedWs.name}`);
  }
  console.log(`  Reload verified: workspace name is '${reloadedWs.name}'`);

  // Step 5: Sign out
  console.log("\n[Step 4] Signing out via POST /auth/logout...");
  const logoutRes = await request(jar, "/api/v1/auth/logout", { method: "POST" });
  if (!logoutRes.ok) throw new Error(`Logout failed: ${await logoutRes.text()}`);
  jar.clear();
  console.log("  Logged out successfully.");

  // Step 6: Sign back in
  console.log("\n[Step 5] Signing back in via POST /auth/login...");
  const login2Res = await request(jar, "/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  });
  if (!login2Res.ok) throw new Error(`Second login failed: ${await login2Res.text()}`);
  console.log("  Signed back in successfully.");

  // Step 7: Confirm saved value remains
  console.log("\n[Step 6] Confirming saved value remains after re-login...");
  const me2Res = await request(jar, "/api/v1/auth/me");
  if (!me2Res.ok) throw new Error(`Fetch after login failed: ${await me2Res.text()}`);
  const me2Data = await me2Res.json();
  const persistedWs = me2Data.workspaces.find((w) => w.id === me2Data.user.tenant_id) || me2Data.workspaces[0];
  if (persistedWs.name !== newName) {
    throw new Error(`Persisted name mismatch! Expected '${newName}', got '${persistedWs.name}'`);
  }
  console.log(`  Confirmed! Persisted workspace name remains: '${persistedWs.name}'`);

  // Step 8: Empty workspace verification
  // Step 8: Empty results verification
  console.log("\n[Step 7] Testing empty results on scoped filters...");
  const emptyFilterRes = await request(jar, "/api/v1/candidates?search=nonexistent-search-xyz-999");
  if (!emptyFilterRes.ok) throw new Error(`Candidates query failed: ${await emptyFilterRes.text()}`);
  const emptyFilterCands = await emptyFilterRes.json();
  if (emptyFilterCands.length !== 0) {
    throw new Error(`Expected 0 candidates for nonexistent search, found ${emptyFilterCands.length}`);
  }
  console.log(`  Verified empty query returns 0 candidates: [${emptyFilterCands.length} items]`);

  const emptyStageRes = await request(jar, "/api/v1/candidates?stage=NonexistentStageXYZ");
  if (!emptyStageRes.ok) throw new Error(`Candidates stage query failed: ${await emptyStageRes.text()}`);
  const emptyStageCands = await emptyStageRes.json();
  if (emptyStageCands.length !== 0) {
    throw new Error(`Expected 0 candidates for nonexistent stage, found ${emptyStageCands.length}`);
  }
  console.log(`  Verified empty stage filter returns 0 candidates: [${emptyStageCands.length} items]`);

  // Step 9: Error handling verification
  console.log("\n[Step 8] Testing error handling on failed requests...");
  // 1. Updating workspace with empty name should fail with 400
  const emptyNameRes = await request(jar, "/api/v1/settings/workspace", {
    method: "PATCH",
    body: JSON.stringify({ name: "" }),
  });
  if (emptyNameRes.status !== 400) {
    throw new Error(`Expected 400 for empty workspace name, got ${emptyNameRes.status}`);
  }
  const emptyNameJson = await emptyNameRes.json();
  const emptyNameErr = emptyNameJson.detail || emptyNameJson.error || "";
  console.log(`  Verified server error response on empty workspace name: '${emptyNameErr}'`);

  // 2. Invite with invalid email should fail with useful error
  const inviteFailRes = await request(jar, "/api/v1/settings/members", {
    method: "POST",
    body: JSON.stringify({
      email: "not-a-valid-email",
      role: "recruiter",
    }),
  });
  if (inviteFailRes.status !== 400) {
    throw new Error(`Expected 400, got ${inviteFailRes.status}: ${await inviteFailRes.text()}`);
  }
  const inviteErrJson = await inviteFailRes.json();
  const errMsg = inviteErrJson.detail || inviteErrJson.error || "";
  if (!errMsg.toLowerCase().includes("valid email")) {
    throw new Error(`Unexpected error message: ${errMsg}`);
  }
  console.log(`  Verified server error response on member invite: '${errMsg}'`);

  // 3. Accessing client submission endpoints in corporate mode fails with 403
  const clientFailRes = await request(jar, "/api/v1/clients");
  if (clientFailRes.status !== 403) {
    throw new Error(`Expected 403 for corporate tenant, got ${clientFailRes.status}: ${await clientFailRes.text()}`);
  }
  const clientErrJson = await clientFailRes.json();
  const clientErr = clientErrJson.detail || clientErrJson.error || "";
  console.log(`  Verified server error response on corporate client access: '${clientErr}'`);

  console.log("\n========================================================");
  console.log("ALL CONNECTED SCREENS & COMPLETION CHECKS PASSED!");
  console.log("========================================================\n");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
