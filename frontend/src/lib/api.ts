import type {
  StatMetric, WeeklyData, AIMatchRate, PipelineCandidateItem,
  JobRequisition, CandidateDetail, RankedCandidate, NewCandidatePayload,
  TeamNote, CitationLocation, InterviewRecord, OfferRecord, PaginatedResult,
} from "@/types/ats";

export const legacyBackend = process.env.NEXT_PUBLIC_ATS_BACKEND === "legacy";
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || (legacyBackend ? "http://localhost:8000/api/v1" : "/core-api/api/v1")).replace(/\/$/, "");
// A user supplies this credential for the current browser session. Never bundle a
// server credential or persist candidate PII in browser storage.
let sessionApiKey = "";
export function setSessionApiKey(key: string) { sessionApiKey = key.trim(); }
let sessionUserId = "usr-recruiter-1";
let sessionUserRole = "recruiter";
export function setSessionUser(userId: string, role = "recruiter") {
  sessionUserId = userId.trim();
  sessionUserRole = role.trim();
}
export const requiresApiKey = legacyBackend && process.env.NEXT_PUBLIC_REQUIRE_API_KEY !== "false";
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request failed. Please try again.";
}

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  if (legacyBackend) {
    if (sessionApiKey) headers.set("X-API-Key", sessionApiKey);
    if (sessionUserId) headers.set("X-User-Id", sessionUserId);
    if (sessionUserRole) headers.set("X-User-Role", sessionUserRole);
  }
  if (requiresApiKey && !sessionApiKey) {
    throw new ApiError("Enter your API key to connect to the backend.", 401);
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: "include", cache: "no-store" });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError("Cannot reach the backend. Check the API address and connection.");
  }
  if (!response.ok) {
    if (!legacyBackend && response.status === 401 && !path.startsWith("/auth/") && typeof window !== "undefined") window.dispatchEvent(new Event("ats-session-expired"));
    let detail: unknown;
    try { detail = (await response.json()).detail; } catch { /* Non-JSON error response. */ }
    const message = typeof detail === "string" ? detail : `Request failed (${response.status}).`;
    throw new ApiError(message, response.status);
  }
  return response;
}

async function json<T>(path: string, options?: RequestInit): Promise<T> {
  return (await request(path, options)).json();
}
function body(payload: unknown): RequestInit {
  return { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
}
function query(params?: Record<string, string | number | boolean | undefined>): string {
  const result = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "ALL" && value !== "all") result.set(key, String(value));
  });
  return result.size ? `?${result}` : "";
}
const id = encodeURIComponent;

export interface DashboardData {
  stats: StatMetric[];
  weekly_candidates: WeeklyData[];
  ai_match_rate: AIMatchRate;
  processing_resumes: number;
  today_evaluations: number;
  pipeline: Record<string, PipelineCandidateItem[]>;
}
export const fetchDashboardStats = (includePii = false) => json<DashboardData>(`/dashboard/stats${query({ include_pii: includePii })}`);
export const fetchJobs = (params?: { status?: string; department?: string; search?: string; page?: number; limit?: number; offset?: number; envelope?: boolean }) => json<JobRequisition[]>(`/jobs${query(params)}`);
export const fetchJobsPaginated = (params?: { status?: string; department?: string; search?: string; page?: number; limit?: number; offset?: number }) => json<PaginatedResult<JobRequisition>>(`/jobs${query({ ...params, envelope: true })}`);
export const fetchJobDetail = (jobId: string) => json<JobRequisition>(`/jobs/${id(jobId)}`);
export function createJobRequisition(payload: {
  title: string; department: string; location: string; job_description: string;
  required_skills: string[]; min_years_experience?: number; run_ai_match?: boolean; status?: "OPEN" | "PAUSED" | "CLOSED";
}) { return json<JobRequisition>("/jobs", { method: "POST", ...body(payload) }); }
export function updateJobRequisition(jobId: string, payload: {
  title?: string; department?: string; location?: string; job_description?: string; required_skills?: string[]; min_years_experience?: number; status?: "OPEN" | "PAUSED" | "CLOSED";
}) { return json<JobRequisition>(`/jobs/${id(jobId)}`, { method: "PATCH", ...body(payload) }); }
export const fetchJobCandidates = (jobId: string, includePii = false) => json<RankedCandidate[]>(`/jobs/${id(jobId)}/candidates${query({ include_pii: includePii })}`);
export function addJobCandidate(jobId: string, payload: NewCandidatePayload) {
  return json<RankedCandidate[]>(`/jobs/${id(jobId)}/candidates`, {
    method: "POST", ...body({ ...payload, headline: payload.headline || "", matchScore: payload.matchScore ?? null }),
  });
}
export const removeJobCandidate = (jobId: string, candidateId: string) => json<RankedCandidate[]>(`/jobs/${id(jobId)}/candidates/${id(candidateId)}`, { method: "DELETE" });
export const updateJobCandidateStage = (jobId: string, candidateId: string, stage: string) => json<RankedCandidate>(`/jobs/${id(jobId)}/candidates/${id(candidateId)}/stage${query({ new_stage: stage })}`, { method: "PATCH" });
export const fetchCandidates = (params?: { search?: string; stage?: string; skill?: string; include_pii?: boolean; page?: number; limit?: number; offset?: number; envelope?: boolean; job_id?: string }) => json<CandidateDetail[]>(`/candidates${query({ include_pii: false, ...params })}`);
export const fetchCandidatesPaginated = (params?: { search?: string; stage?: string; skill?: string; include_pii?: boolean; page?: number; limit?: number; offset?: number; job_id?: string }) => json<PaginatedResult<CandidateDetail>>(`/candidates${query({ include_pii: false, ...params, envelope: true })}`);
export const fetchCandidate = (candidateId: string, includePii = false, jobId?: string) => json<CandidateDetail>(`/candidates/${id(candidateId)}${query({ include_pii: includePii, job_id: jobId })}`);
export const fetchCandidateScorecard = (candidateId: string, jobId: string) => json<CandidateDetail["scorecard"]>(`/candidates/${id(candidateId)}/scorecard${query({ job_id: jobId })}`);
export const updateCandidateStage = (candidateId: string, stage: string, jobId?: string) => json<{ status: string; stage: string }>(`/candidates/${id(candidateId)}/stage${query({ new_stage: stage, job_id: jobId })}`, { method: "PATCH" });
export const addCandidateNote = (candidateId: string, content: string, author = "Recruiter", jobId?: string) => json<TeamNote>(`/candidates/${id(candidateId)}/notes${query({ job_id: jobId })}`, { method: "POST", ...body({ content, author }) });
export const fetchResumePdf = async (candidateId: string, signal?: AbortSignal) => (await request(`/candidates/${id(candidateId)}/resume-pdf`, { signal })).blob();
export const locateCandidateCitation = (candidateId: string, phrase: string) => json<{ found: boolean; location: CitationLocation | null }>(`/candidates/${id(candidateId)}/locate-citation`, { method: "POST", ...body({ search_phrase: phrase }) });

export function editCandidate(candidateId: string, payload: {
  name?: string; headline?: string; email?: string; phone?: string; location?: string;
  skills?: string[]; experience_years?: number; education?: string;
}) {
  return json<CandidateDetail>(`/candidates/${id(candidateId)}`, { method: "PATCH", ...body(payload) });
}

export function fetchCandidateInterviews(jobId: string, candidateId: string, includePii = false) {
  return json<InterviewRecord[]>(`/jobs/${id(jobId)}/candidates/${id(candidateId)}/interviews${query({ include_pii: includePii })}`);
}

export function recordCandidateInterview(jobId: string, candidateId: string, payload: {
  round?: string; round_name?: string; scheduled_at?: string; interviewer_name?: string;
  notes?: string; feedback?: string; outcome?: string; rating?: number;
}) {
  return json<InterviewRecord[]>(`/jobs/${id(jobId)}/candidates/${id(candidateId)}/interviews`, { method: "POST", ...body(payload) });
}

export function updateCandidateInterview(jobId: string, candidateId: string, interviewId: string, payload: {
  round?: string; round_name?: string; scheduled_at?: string; interviewer_name?: string;
  notes?: string; feedback?: string; outcome?: string; rating?: number;
}) {
  return json<InterviewRecord[]>(`/jobs/${id(jobId)}/candidates/${id(candidateId)}/interviews/${id(interviewId)}`, { method: "PATCH", ...body(payload) });
}

export function fetchCandidateOffer(jobId: string, candidateId: string, includePii = false) {
  return json<OfferRecord>(`/jobs/${id(jobId)}/candidates/${id(candidateId)}/offer${query({ include_pii: includePii })}`);
}

export function recordCandidateOffer(jobId: string, candidateId: string, payload: {
  status: string; salary?: number; base_salary?: number; currency?: string;
  equity?: string; sign_on_bonus?: number; start_date?: string; notes?: string;
}) {
  return json<OfferRecord>(`/jobs/${id(jobId)}/candidates/${id(candidateId)}/offer`, { method: "POST", ...body(payload) });
}

export interface UploadResponse {
  status: string; task_id: string; candidate_id: string; filename: string;
  execution_mode: string; evaluation_status: string; match_score: number | null; message: string;
  job_id?: string; applied_for_job_id?: string;
}
export interface UploadTask {
  task_id: string; state: string; execution_mode?: string; error?: string;
  progress?: number; step?: string;
  stages?: Record<string, ProcessingStage>;
  server_time?: string;
  attempt?: number;
  result?: { candidate_id: string; evaluation_status?: string; match_score?: number | null; status?: string; applied_for_job_id?: string };
}
export interface ProcessingStage {
  status: "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED" | "FALLBACK";
  started_at: string | null;
  finished_at: string | null;
  detail?: string | null;
}
export interface UploadWaitOptions {
  signal?: AbortSignal;
  pollIntervalMs?: number;
  timeoutMs?: number;
  onProgress?: (task: UploadTask) => void;
  upload?: CandidateUploadOptions;
  onAccepted?: (upload: UploadResponse) => void | Promise<void>;
}

export interface CandidateUploadOptions {
  candidateId?: string; idempotencyKey?: string; name?: string; headline?: string;
}

function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

export function uploadResumeFile(file: File, jobId?: string, signal?: AbortSignal, options?: CandidateUploadOptions) {
  const data = new FormData();
  data.append("file", file);
  if (jobId) data.append("job_id", jobId);
  if (options?.candidateId) data.append("candidate_id", options.candidateId);
  if (options?.name) data.append("name", options.name.trim());
  if (options?.headline) data.append("headline", options.headline.trim());
  return json<UploadResponse>("/candidates/upload-async", { method: "POST", body: data, signal, headers: legacyBackend ? undefined : { "Idempotency-Key": options?.idempotencyKey ?? crypto.randomUUID() } });
}
export const fetchUploadTask = (taskId: string, signal?: AbortSignal) => json<UploadTask>(`/candidates/tasks/${id(taskId)}`, { signal });

export async function uploadAndWait(
  file: File,
  jobId?: string,
  signalOrOptions?: AbortSignal | UploadWaitOptions,
  onProgressCallback?: (task: UploadTask) => void
): Promise<UploadResponse> {
  let signal: AbortSignal | undefined;
  let pollIntervalMs = 500;
  let timeoutMs = legacyBackend ? 120000 : 600000;
  let onProgress = onProgressCallback;

  if (signalOrOptions instanceof AbortSignal) {
    signal = signalOrOptions;
  } else if (signalOrOptions && typeof signalOrOptions === "object") {
    signal = signalOrOptions.signal;
    if (typeof signalOrOptions.pollIntervalMs === "number") {
      pollIntervalMs = signalOrOptions.pollIntervalMs;
    }
    if (typeof signalOrOptions.timeoutMs === "number") {
      timeoutMs = signalOrOptions.timeoutMs;
    }
    if (signalOrOptions.onProgress) {
      onProgress = signalOrOptions.onProgress;
    }
  }

  const waitOptions = signalOrOptions && !(signalOrOptions instanceof AbortSignal) ? signalOrOptions : undefined;
  const uploaded = await uploadResumeFile(file, jobId, signal, waitOptions?.upload);
  await waitOptions?.onAccepted?.(uploaded);

  if (!uploaded.task_id) {
    if (!uploaded.candidate_id) {
      throw new ApiError("Backend did not return a candidate ID or task ID.");
    }
    return uploaded;
  }

  const startTime = Date.now();
  let consecutiveErrors = 0;

  while (true) {
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException("Aborted", "AbortError");
    }

    let task: UploadTask;
    try {
      task = await fetchUploadTask(uploaded.task_id, signal);
      consecutiveErrors = 0;
    } catch (err) {
      if (signal?.aborted) throw err;
      consecutiveErrors++;
      if (consecutiveErrors >= 5 || Date.now() - startTime >= timeoutMs) {
        throw err;
      }
      await sleepWithSignal(pollIntervalMs, signal);
      continue;
    }

    try {
      onProgress?.(task);
    } catch {
      // Ignore progress listener errors
    }

    if (task.state === "SUCCESS") {
      const candidateId = task.result?.candidate_id || uploaded.candidate_id;
      if (!candidateId) {
        throw new ApiError("Backend did not return a candidate ID.");
      }
      return {
        ...uploaded,
        candidate_id: candidateId,
        status: task.result?.status || uploaded.status,
        evaluation_status: task.result?.evaluation_status || uploaded.evaluation_status,
        match_score: task.result?.match_score !== undefined ? task.result.match_score : (uploaded.match_score ?? null),
        applied_for_job_id: task.result?.applied_for_job_id || uploaded.applied_for_job_id || jobId,
      };
    }

    if (task.state === "FAILURE") {
      throw new ApiError(task.error || uploaded.message || "Resume processing failed.");
    }

    if (Date.now() - startTime >= timeoutMs) {
      throw new ApiError(`Upload task timed out after ${Math.round(timeoutMs / 1000)}s while in state ${task.state}.`);
    }

    await sleepWithSignal(pollIntervalMs, signal);
  }
}
export interface MatchResponse {
  status: string;
  job_title: string;
  job_id?: string;
  stage1_candidates_retrieved: number;
  stage2_candidates_reranked: number;
  stage3_final_ranked: number;
  latency_ms: number;
  candidates: RankedCandidate[];
}

export const queueCandidateEvaluation = (jobId: string, candidateId: string, signal?: AbortSignal) =>
  json<{ job_id: string; task_ids: string[] }>(`/jobs/${id(jobId)}/candidates/${id(candidateId)}/evaluate`, { method: "POST", signal });

async function retryProcessingRead<T>(read: () => Promise<T>, options: UploadWaitOptions): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await read(); }
    catch (error) {
      if (options.signal?.aborted || attempt >= 4 || !(error instanceof ApiError) || (error.status !== undefined && error.status < 500)) throw error;
      await sleepWithSignal(options.pollIntervalMs ?? 1500, options.signal);
    }
  }
}

export async function evaluateCandidateForJob(jobId: string, candidateId: string, options: UploadWaitOptions = {}) {
  const queued = await queueCandidateEvaluation(jobId, candidateId, options.signal);
  if (queued.job_id !== jobId || queued.task_ids?.length !== 1) throw new ApiError("The backend did not confirm a candidate evaluation task.");
  const started = Date.now();
  while (true) {
    const task = await retryProcessingRead(() => fetchUploadTask(queued.task_ids[0], options.signal), options);
    options.onProgress?.(task);
    if (task.state === "FAILURE") throw new ApiError(task.error || "AI evaluation failed. The candidate remains available for review.");
    if (task.state === "SUCCESS") {
      if (task.result?.candidate_id !== candidateId || task.result?.evaluation_status !== "COMPLETED" || typeof task.result.match_score !== "number") {
        throw new ApiError("The backend did not return a completed AI score for this candidate.");
      }
      const candidates = await retryProcessingRead(() => fetchJobCandidates(jobId), options);
      const saved = candidates.find(candidate => candidate.id === candidateId);
      if (!saved || typeof saved.matchScore !== "number" || saved.jobId !== jobId) throw new ApiError("The job-specific score has not been saved. Refresh this job to check it.");
      return candidates;
    }
    if (Date.now() - started >= (options.timeoutMs ?? 600000)) throw new ApiError("AI scoring is still processing. Refresh this job later to check the saved score.");
    await sleepWithSignal(options.pollIntervalMs ?? 1500, options.signal);
  }
}

export async function evaluateJobMatching(payload: {
  job_id?: string;
  job_title: string;
  job_description: string;
  stage1_retrieve_limit?: number;
  stage2_rerank_limit?: number;
}) {
  const response = await json<MatchResponse & { task_ids?: string[] }>("/match/evaluate-job?include_pii=true", { method: "POST", ...body({ include_pii: true, ...payload }) });
  if (!response.task_ids) return response;
  const started = Date.now();
  const waiting = new Set(response.task_ids);
  let failed = 0;
  while (waiting.size) {
    const tasks = await Promise.all([...waiting].map(async taskId => ({ taskId, task: await fetchUploadTask(taskId) })));
    for (const { taskId, task } of tasks) {
      if (task.state === "SUCCESS" || task.state === "FAILURE") { waiting.delete(taskId); if (task.state === "FAILURE") failed++; }
    }
    if (Date.now() - started > 600000) throw new ApiError("Matching is still processing. Reopen the job to check saved results.");
    if (waiting.size) await sleepWithSignal(1500);
  }
  if (response.task_ids.length && failed === response.task_ids.length) throw new ApiError("AI evaluation failed. Candidates remain available for manual review.");
  const candidates = response.job_id ? await fetchJobCandidates(response.job_id) : [];
  return { ...response, candidates, status: failed ? "PARTIAL" : "COMPLETED", stage3_final_ranked: response.task_ids.length - failed, latency_ms: Date.now() - started };
}

export interface TaxonomySkillItem {
  id: string; canonical_name: string; category: string; aliases: string[];
  is_ambiguous: boolean; status: "approved" | "pending" | "rejected";
  source: string; occurrence_count: number; taxonomy_version: string;
  created_at: string; updated_at: string; context_sample?: string;
}
export interface TaxonomyStats {
  version: string; total_skills: number; approved_count: number;
  pending_count: number; rejected_count: number; categories: Record<string, number>;
}
export const fetchTaxonomyStats = () => json<TaxonomyStats>("/taxonomy/version");
export const fetchTaxonomySkills = (params?: { category?: string; status?: string; search?: string; page?: number; limit?: number }) => json<{ items: TaxonomySkillItem[]; total: number; version: string }>(`/taxonomy/skills${query(params)}`);
export const approveTaxonomySkill = (skillId: string, payload?: { canonical_name?: string; category?: string; aliases?: string[] }) => json<TaxonomySkillItem>(`/taxonomy/skills/${id(skillId)}/approve`, { method: "PATCH", ...body(payload || {}) });
export const rejectTaxonomySkill = (skillId: string) => json<TaxonomySkillItem>(`/taxonomy/skills/${id(skillId)}/reject`, { method: "PATCH" });
export const addAliasToTaxonomySkill = (skillId: string, alias: string) => json<TaxonomySkillItem>(`/taxonomy/skills/${id(skillId)}/aliases`, { method: "POST", ...body({ alias }) });
export const createTaxonomySkill = (payload: { canonical_name: string; category: string; aliases: string[]; is_ambiguous?: boolean; source?: string }) => json<TaxonomySkillItem>("/taxonomy/skills", { method: "POST", ...body(payload) });

export interface AuditLogItem {
  id: string;
  timestamp: string;
  actor_id: string;
  actor_role: string;
  action: string;
  resource_type: string;
  resource_id: string;
  decision: "ALLOWED" | "DENIED";
  details: string;
  ip_address?: string;
  user_agent?: string;
}

export const fetchAuditLogs = (params?: { limit?: number; actor_id?: string; action?: string; resource_type?: string }) =>
  json<AuditLogItem[]>(`/audit/logs${query(params)}`);

export interface SessionIdentity { user_id: string; tenant_id: string; role: string; name: string; email: string }
export interface Workspace { id: string; name: string; kind: "corporate" | "agency"; role: string }
export interface Session { user: SessionIdentity; workspaces: Workspace[]; development_mode?: boolean }
export const fetchSession = () => json<Session>("/auth/me");
export const fetchAuthConfig = () => json<{ registration_enabled: boolean }>("/auth/config");
export const signIn = (email: string, password: string) => json("/auth/login", { method: "POST", ...body({ email, password }) });
export const registerWorkspace = (payload: { email: string; password: string; name: string; workspace_name: string; workspace_kind: string; invitation_token?: string }) => json("/auth/register", { method: "POST", ...body(payload) });
export const signOut = () => json("/auth/logout", { method: "POST" });
export const switchWorkspace = (tenantId: string) => json("/auth/workspace", { method: "POST", ...body({ tenant_id: tenantId }) });
export interface WorkspaceMember { id: string; name: string; email: string; role: string }
export interface WorkspaceInvitation {
  id: string;
  email: string;
  role: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
  inviter_name: string;
}
export interface EmailTask {
  id: string;
  tenant_id: string | null;
  recipient_email: string;
  template: string;
  payload: Record<string, unknown>;
  status: "queued" | "sent" | "failed";
  attempts: number;
  created_at: string;
}
export const fetchMembers = () => json<WorkspaceMember[]>("/settings/members");
export const addMember = (email: string, role: string) =>
  json<{ status: string; invitation_id: string; email: string; role: string; token: string }>("/settings/members", { method: "POST", ...body({ email, role }) });
export const updateMemberRole = (memberId: string, role: string) =>
  json<{ status: string; id: string; role: string }>(`/settings/members/${id(memberId)}`, { method: "PATCH", ...body({ role }) });
export const removeMember = (memberId: string) =>
  json<{ status: string; id: string }>(`/settings/members/${id(memberId)}`, { method: "DELETE" });
export const fetchInvitations = () => json<WorkspaceInvitation[]>("/settings/invitations");
export const revokeInvitation = (invitationId: string) =>
  json<{ status: string; id: string }>(`/settings/invitations/${id(invitationId)}`, { method: "DELETE" });
export const inspectInvitation = (token: string) =>
  json<{ id: string; workspace_id: string; workspace_name: string; email: string; role: string; status: string; expires_at: string }>(`/auth/invitations/${id(token)}`);
export const acceptInvitation = (token: string) =>
  json<{ status: string; workspace_id: string; role: string; invitation_id: string }>("/auth/invitations/accept", { method: "POST", ...body({ token }) });
export const requestPasswordReset = (email: string) =>
  json<{ status: string; message: string }>("/auth/password/reset-request", { method: "POST", ...body({ email }) });
export const confirmPasswordReset = (payload: { token: string; password: string }) =>
  json<{ status: string; message: string }>("/auth/password/reset", { method: "POST", ...body(payload) });
export const confirmEmailVerification = (token: string) =>
  json<{ status: string; message: string }>("/auth/verify-email", { method: "POST", ...body({ token }) });
export const fetchEmailTasks = () => json<EmailTask[]>("/auth/email-tasks");
export const updateWorkspace = (name: string) => json<{ id: string; name: string }>("/settings/workspace", {method: "PATCH", ...body({name})});
export interface AnalyticsData { stages: {stage: string; count: number; average_score: number | null}[]; processing: {state: string; count: number}[]; hires: number; average_days_to_hire: number | null; generated_at: string }
export const fetchAnalytics = () => json<AnalyticsData>("/analytics");
export interface AgencyClient {id: string; name: string}
export interface AgencySubmission {
  id: string;
  client_id?: string;
  client_name: string;
  application_id: string;
  status: string;
  snapshot?: Record<string, unknown> | null;
  created_at: string;
}
export const fetchClients = () => json<AgencyClient[]>("/clients");
export const createClient = (name: string) => json<AgencyClient>("/clients", {method: "POST", ...body({name})});
export const fetchSubmissions = () => json<AgencySubmission[]>("/submissions");
export const createSubmission = (clientId: string, applicationId: string) => json("/submissions", {method: "POST", ...body({client_id: clientId, application_id: applicationId})});

