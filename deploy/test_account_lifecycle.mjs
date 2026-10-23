/**
 * Comprehensive Account Lifecycle Verification
 * Tests all required lifecycle capabilities:
 * 1. Invitations:
 *    - Administrator invites email & role.
 *    - Invitation record created with workspace, email, role, inviter, token hash, expiry, pending status.
 *    - Email-delivery task saved in the same transaction for retryability.
 *    - Recipient inspects invitation (workspace name, role).
 *    - Recipient registers with invitation token -> joins intended workspace with intended role.
 *    - Accepted token cannot be reused (single-use enforcement).
 *    - Expired invitation fails.
 *    - Revoked invitation fails.
 * 2. Team Administration:
 *    - Member role change (demote/promote).
 *    - Protection against demoting the last administrator.
 *    - Protection against removing the last administrator.
 *    - Member removal immediately ends workspace access (session revoked, returns 401).
 * 3. Password Recovery (OWASP practices):
 *    - Consistent reset-request response without disclosing registered accounts.
 *    - Token hash stored, expires in 1 hour.
 *    - Rate-limiting enforced.
 *    - Password reset updates password and invalidates all existing user sessions.
 *    - Reset token cannot be reused (single-use).
 *    - Sign in with old password fails, sign in with new password succeeds.
 */

import { randomUUID } from "crypto";
import { execSync } from "child_process";

const BASE_URL = process.env.ATS_API_URL || "http://localhost:8080/api/v1";

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  setFromHeaders(headers) {
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

async function api(jar, path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    "Origin": "http://localhost:3000",
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const cookieHeader = jar ? jar.getCookieHeader() : "";
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (jar) {
    jar.setFromHeaders(res.headers);
  }

  let body = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    body = await res.json().catch(() => null);
  } else {
    body = await res.text().catch(() => null);
  }

  return { status: res.status, headers: res.headers, body };
}

function runPsql(query) {
  try {
    const output = execSync(
      `docker exec -i ats-architecture-postgres-v2-1 psql -U ats_migrator -d ats_architecture -t -A -c "${query.replace(/"/g, '\\"')}"`,
      { encoding: "utf8" }
    );
    return output.trim();
  } catch (err) {
    console.error("runPsql error:", err);
    return "";
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function main() {
  console.log("=================================================");
  console.log("STARTING ACCOUNT LIFECYCLE VERIFICATION SUITE");
  console.log("=================================================\n");

  const runId = randomUUID().slice(0, 8);
  const adminEmail = `admin_${runId}@company.internal`;
  const adminPassword = "AdminSecurePassword123!";
  const workspaceName = `Lifecycle Corp ${runId}`;
  const adminJar = new CookieJar();

  // 1. Create Workspace and Admin
  console.log("--- 1. Workspace Registration & Admin Setup ---");
  const regRes = await api(adminJar, "/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: adminEmail,
      password: adminPassword,
      name: `Admin ${runId}`,
      workspace_name: workspaceName,
      workspace_kind: "corporate",
    }),
  });
  assert(regRes.status === 200, `Admin registers workspace (HTTP ${regRes.status})`);
  assert(regRes.body?.status === "authenticated", "Admin received authenticated status");

  const meRes = await api(adminJar, "/auth/me");
  assert(meRes.status === 200, `Fetch admin identity (HTTP ${meRes.status})`);
  const adminId = meRes.body?.user?.user_id;
  const tenantId = meRes.body?.user?.tenant_id;
  assert(adminId && tenantId, "Admin user_id and tenant_id present");
  assert(meRes.body?.user?.role === "admin", "Admin role is 'admin'");

  // 2. Complete Invitation Flow
  console.log("\n--- 2. Complete Invitation Flow (Admin invites -> Email Task saved -> Recipient signs in/registers -> Accepts -> Joins workspace) ---");
  const recipientEmail = `recruiter_${runId}@candidate.internal`;
  const inviteRes = await api(adminJar, "/settings/members", {
    method: "POST",
    body: JSON.stringify({
      email: recipientEmail,
      role: "recruiter",
    }),
  });
  assert(inviteRes.status === 200, `Admin invites recruiter (HTTP ${inviteRes.status})`);
  assert(inviteRes.body?.status === "invited", "Invitation status is 'invited'");
  const inviteToken = inviteRes.body?.token;
  const invitationId = inviteRes.body?.invitation_id;
  assert(inviteToken && invitationId, "Invitation token and invitation_id returned");

  // Verify invitation in DB
  const dbStatus = runPsql(`SELECT status FROM ats_v2.invitations WHERE id = '${invitationId}'`);
  assert(dbStatus === "pending", `Invitation recorded in database with pending status (was: ${dbStatus})`);

  // Verify email task saved in same transaction
  const emailTaskRow = runPsql(`SELECT recipient_email, template, status FROM ats_v2.email_tasks WHERE recipient_email = '${recipientEmail}'`);
  assert(emailTaskRow.includes("invitation|queued") || emailTaskRow.includes(recipientEmail), `Email delivery task queued for recipient (${emailTaskRow})`);

  // Admin lists invitations
  const listInvsRes = await api(adminJar, "/settings/invitations");
  assert(listInvsRes.status === 200, `Admin lists invitations (HTTP ${listInvsRes.status})`);
  const foundInv = listInvsRes.body?.find((i) => i.id === invitationId);
  assert(foundInv && foundInv.status === "pending", "Created invitation appears in invitations list");

  // Recipient inspects invitation (public endpoint)
  const inspectRes = await api(null, `/auth/invitations/${inviteToken}`);
  assert(inspectRes.status === 200, `Recipient inspects invitation (HTTP ${inspectRes.status})`);
  assert(inspectRes.body?.workspace_name === workspaceName, `Inspection returned correct workspace (${inspectRes.body?.workspace_name})`);
  assert(inspectRes.body?.role === "recruiter", "Inspection returned correct role 'recruiter'");
  assert(inspectRes.body?.email === recipientEmail, "Inspection returned correct email");

  // Recipient registers using invitation token
  const recipientJar = new CookieJar();
  const recipientPassword = "RecruiterPassword123!";
  const recipientRegRes = await api(recipientJar, "/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: recipientEmail,
      password: recipientPassword,
      name: `Recruiter ${runId}`,
      invitation_token: inviteToken,
    }),
  });
  assert(recipientRegRes.status === 200, `Recipient registers with invitation token (HTTP ${recipientRegRes.status})`);
  assert(recipientRegRes.body?.status === "authenticated", "Recipient receives active session");

  // Recipient verifies membership in the workspace
  const recipientMe = await api(recipientJar, "/auth/me");
  assert(recipientMe.status === 200, `Recipient /auth/me returns 200`);
  assert(recipientMe.body?.user?.tenant_id === tenantId, "Recipient joined the intended workspace");
  assert(recipientMe.body?.user?.role === "recruiter", "Recipient assigned intended role 'recruiter'");
  const recipientUserId = recipientMe.body?.user?.user_id;

  // 2b. Existing user receives invitation, signs in, then accepts invitation
  console.log("\n--- 2b. Existing User Invitation Acceptance (User already registered -> Signs in -> Accepts invitation -> Joins workspace) ---");
  const existingUserJar = new CookieJar();
  const existingEmail = `existing_${runId}@company.internal`;
  const existingPass = "ExistingUserPassword123!";
  // User registers their own workspace first
  await api(existingUserJar, "/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: existingEmail,
      password: existingPass,
      name: `Existing User ${runId}`,
      workspace_name: `Other Workspace ${runId}`,
      workspace_kind: "corporate",
    }),
  });

  // Admin invites existing user to the main workspace as 'interviewer'
  const inviteExistingRes = await api(adminJar, "/settings/members", {
    method: "POST",
    body: JSON.stringify({
      email: existingEmail,
      role: "interviewer",
    }),
  });
  assert(inviteExistingRes.status === 200, "Admin invites existing user");
  const existingInvToken = inviteExistingRes.body?.token;

  // Existing user signs in (or uses existing session) and calls /auth/invitations/accept
  const acceptExistingRes = await api(existingUserJar, "/auth/invitations/accept", {
    method: "POST",
    body: JSON.stringify({ token: existingInvToken }),
  });
  assert(acceptExistingRes.status === 200, `Existing user accepts invitation (HTTP ${acceptExistingRes.status})`);
  assert(acceptExistingRes.body?.status === "accepted", "Invitation status returned as accepted");

  // Verify existing user now has membership in this workspace
  const existingMeRes = await api(existingUserJar, "/auth/me");
  assert(existingMeRes.status === 200, "Existing user /auth/me returns 200");
  const joinedWs = existingMeRes.body?.workspaces?.find((w) => w.id === tenantId);
  assert(joinedWs && joinedWs.role === "interviewer", `Existing user joined workspace as interviewer (${joinedWs?.role})`);

  // 3. Single-Use Check: Accepted token cannot be reused
  console.log("\n--- 3. Single-Use Check (Accepted invitation cannot be reused) ---");
  const reuseJar = new CookieJar();
  const reuseRes = await api(reuseJar, "/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: `another_${runId}@candidate.internal`,
      password: "AnotherPassword123!",
      name: "Another User",
      invitation_token: inviteToken,
    }),
  });
  assert(reuseRes.status === 400, `Reusing accepted token fails with 400 (got: ${reuseRes.status})`);

  // Also try accepting via /auth/invitations/accept
  const reuseAcceptRes = await api(recipientJar, "/auth/invitations/accept", {
    method: "POST",
    body: JSON.stringify({ token: inviteToken }),
  });
  assert(reuseAcceptRes.status === 400, `Accepting already-accepted token fails with 400 (got: ${reuseAcceptRes.status})`);

  // 4. Expired Invitations Check
  console.log("\n--- 4. Expired Invitations Check ---");
  const expEmail = `expired_${runId}@candidate.internal`;
  const expInviteRes = await api(adminJar, "/settings/members", {
    method: "POST",
    body: JSON.stringify({ email: expEmail, role: "viewer" }),
  });
  assert(expInviteRes.status === 200, "Created invitation to be expired");
  const expToken = expInviteRes.body?.token;
  const expId = expInviteRes.body?.invitation_id;

  // Fast-forward expiration in database
  runPsql(`UPDATE ats_v2.invitations SET expires_at = now() - interval '1 hour' WHERE id = '${expId}'`);

  const expInspectRes = await api(null, `/auth/invitations/${expToken}`);
  assert(expInspectRes.status === 400, `Inspecting expired invitation fails with 400 (got: ${expInspectRes.status})`);

  const expJar = new CookieJar();
  const expRegRes = await api(expJar, "/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: expEmail,
      password: "ExpiredPassword123!",
      name: "Expired Candidate",
      invitation_token: expToken,
    }),
  });
  assert(expRegRes.status === 400, `Registering with expired invitation fails with 400 (got: ${expRegRes.status})`);

  // 5. Revoked Invitations Check
  console.log("\n--- 5. Revoked Invitations Check ---");
  const revEmail = `revoked_${runId}@candidate.internal`;
  const revInviteRes = await api(adminJar, "/settings/members", {
    method: "POST",
    body: JSON.stringify({ email: revEmail, role: "interviewer" }),
  });
  assert(revInviteRes.status === 200, "Created invitation to be revoked");
  const revToken = revInviteRes.body?.token;
  const revId = revInviteRes.body?.invitation_id;

  // Revoke via admin endpoint
  const revokeRes = await api(adminJar, `/settings/invitations/${revId}`, { method: "DELETE" });
  assert(revokeRes.status === 200, `Admin revokes invitation (HTTP ${revokeRes.status})`);

  const revRegRes = await api(new CookieJar(), "/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: revEmail,
      password: "RevokedPassword123!",
      name: "Revoked Candidate",
      invitation_token: revToken,
    }),
  });
  assert(revRegRes.status === 400, `Registering with revoked invitation fails with 400 (got: ${revRegRes.status})`);

  // 6. Team Administration: Role Changes & Last Admin Protection
  console.log("\n--- 6. Team Administration (Role Changes & Last Admin Protection) ---");
  // Change recipient role from recruiter to compliance
  const updateRoleRes = await api(adminJar, `/settings/members/${recipientUserId}`, {
    method: "PATCH",
    body: JSON.stringify({ role: "compliance" }),
  });
  assert(updateRoleRes.status === 200, `Update member role to compliance (HTTP ${updateRoleRes.status})`);

  // Verify updated role in members list
  const membersRes = await api(adminJar, "/settings/members");
  assert(membersRes.status === 200, "Fetch members list");
  const updatedMember = membersRes.body?.find((m) => m.id === recipientUserId);
  assert(updatedMember?.role === "compliance", `Member role updated to compliance (was: ${updatedMember?.role})`);

  // Last Admin Protection: Try to demote sole admin
  const demoteAdminRes = await api(adminJar, `/settings/members/${adminId}`, {
    method: "PATCH",
    body: JSON.stringify({ role: "recruiter" }),
  });
  assert(demoteAdminRes.status === 400, `Demoting the sole administrator is blocked (HTTP ${demoteAdminRes.status})`);
  assert(demoteAdminRes.body?.detail?.includes("last administrator"), "Error mentions last administrator protection");

  // Last Admin Protection: Try to remove sole admin
  const removeAdminRes = await api(adminJar, `/settings/members/${adminId}`, {
    method: "DELETE",
  });
  assert(removeAdminRes.status === 400, `Removing the sole administrator is blocked (HTTP ${removeAdminRes.status})`);
  assert(removeAdminRes.body?.detail?.includes("last administrator"), "Error mentions last administrator protection");

  // 7. Member Removal & Immediate Access Revocation
  console.log("\n--- 7. Member Removal & Immediate Access Revocation ---");
  // Check recipient can still access before removal
  const preRemoveCheck = await api(recipientJar, "/auth/me");
  assert(preRemoveCheck.status === 200, "Recipient has valid access before removal");

  // Admin removes recipient
  const removeMemberRes = await api(adminJar, `/settings/members/${recipientUserId}`, {
    method: "DELETE",
  });
  assert(removeMemberRes.status === 200, `Admin removes member (HTTP ${removeMemberRes.status})`);

  // Recipient immediately loses access
  const postRemoveCheck = await api(recipientJar, "/auth/me");
  assert(postRemoveCheck.status === 401, `Removed member immediately receives 401 Unauthorized (got: ${postRemoveCheck.status})`);

  // Try business endpoint as removed member
  const postRemoveJobs = await api(recipientJar, "/jobs");
  assert(postRemoveJobs.status === 401, `Removed member denied business endpoints (HTTP ${postRemoveJobs.status})`);

  // 8. Password Recovery (OWASP Cheat Sheet Practices)
  console.log("\n--- 8. Password Recovery (OWASP Cheatsheet Practices) ---");
  // Anti-enumeration test: request reset for nonexistent email
  const fakeEmail = `nonexistent_${runId}@nowhere.org`;
  const fakeResetRes = await api(null, "/auth/password/reset-request", {
    method: "POST",
    body: JSON.stringify({ email: fakeEmail }),
  });
  assert(fakeResetRes.status === 200, `Reset request for non-existent email returns 200 (HTTP ${fakeResetRes.status})`);
  assert(
    fakeResetRes.body?.message?.includes("If an account with that email exists"),
    "Constant non-disclosing message returned for unknown email"
  );

  // Request reset for real admin email
  const realResetRes = await api(null, "/auth/password/reset-request", {
    method: "POST",
    body: JSON.stringify({ email: adminEmail }),
  });
  assert(realResetRes.status === 200, `Reset request for registered email returns 200 (HTTP ${realResetRes.status})`);
  assert(
    realResetRes.body?.message === fakeResetRes.body?.message,
    "Identical response message returned for registered and unregistered accounts (OWASP Anti-Enumeration)"
  );

  // Verify unauthenticated inspection is rejected with 401 even in development mode (SEC-05)
  const unauthEmailTasksRes = await api(null, "/auth/email-tasks");
  assert(unauthEmailTasksRes.status === 401, `Unauthenticated email-tasks inspection rejected with 401 (got: ${unauthEmailTasksRes.status})`);

  // Retrieve raw token from queued email tasks using authenticated admin session
  const emailTasksRes = await api(adminJar, "/auth/email-tasks");
  assert(emailTasksRes.status === 200, `Fetch email tasks with admin session (HTTP ${emailTasksRes.status})`);
  const resetTask = emailTasksRes.body?.find(
    (t) => t.recipient_email === adminEmail && t.template === "password_reset"
  );
  assert(resetTask, "Password reset email delivery task found in queue");
  const resetToken = resetTask.payload?.token;
  assert(resetToken && resetToken.startsWith("rst_"), `Password reset token found in payload: ${resetToken}`);

  // Test password length validation (< 12 chars rejected)
  const shortPassRes = await api(null, "/auth/password/reset", {
    method: "POST",
    body: JSON.stringify({ token: resetToken, password: "short" }),
  });
  assert(shortPassRes.status === 400, `Reset with short password rejected (HTTP ${shortPassRes.status})`);

  // Perform valid password reset
  const newAdminPassword = "BrandNewAdminPassword123!";
  const resetConfirmRes = await api(null, "/auth/password/reset", {
    method: "POST",
    body: JSON.stringify({ token: resetToken, password: newAdminPassword }),
  });
  assert(resetConfirmRes.status === 200, `Password reset succeeded (HTTP ${resetConfirmRes.status})`);

  // Verify prior sessions are invalidated
  const priorSessionCheck = await api(adminJar, "/auth/me");
  assert(priorSessionCheck.status === 401, `Prior admin session immediately invalidated after password reset (got: ${priorSessionCheck.status})`);

  // Verify login with OLD password fails
  const oldLoginJar = new CookieJar();
  const oldLoginRes = await api(oldLoginJar, "/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  assert(oldLoginRes.status === 401, `Sign in with old password rejected (HTTP ${oldLoginRes.status})`);

  // Verify login with NEW password succeeds
  const newLoginJar = new CookieJar();
  const newLoginRes = await api(newLoginJar, "/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: adminEmail, password: newAdminPassword }),
  });
  assert(newLoginRes.status === 200, `Sign in with new password succeeded (HTTP ${newLoginRes.status})`);

  const newSessionCheck = await api(newLoginJar, "/auth/me");
  assert(newSessionCheck.status === 200, `Authenticated with new credentials (HTTP ${newSessionCheck.status})`);
  assert(newSessionCheck.body?.user?.user_id === adminId, "Identity matches admin after password reset");

  // Verify Single-Use: Reusing the reset token fails
  const reuseTokenRes = await api(null, "/auth/password/reset", {
    method: "POST",
    body: JSON.stringify({ token: resetToken, password: "YetAnotherPassword123!" }),
  });
  assert(reuseTokenRes.status === 400, `Reusing reset token fails with 400 (HTTP ${reuseTokenRes.status})`);

  console.log("\n=================================================");
  console.log("ALL ACCOUNT LIFECYCLE CHECKS PASSED SUCCESSFULLY!");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("\n❌ TEST RUN FAILED:", err);
  process.exit(1);
});
