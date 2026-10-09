import type {
  StatMetric, WeeklyData, AIMatchRate, PipelineCandidateItem,
  JobRequisition, CandidateDetail, RankedCandidate, NewCandidatePayload,
  TeamNote, CitationLocation,
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
export const fetchDashboardStats = () => json<DashboardData>("/dashboard/stats");
export const fetchJobs = (params?: { status?: string; department?: string; search?: string }) => json<JobRequisition[]>(`/jobs${query(params)}`);
export const fetchJobDetail = (jobId: string) => json<JobRequisition>(`/jobs/${id(jobId)}`);
export function createJobRequisition(payload: {
  title: string; department: string; location: string; job_description: string;
  required_skills: string[]; min_years_experience?: number; run_ai_match?: boolean;
}) { return json<JobRequisition>("/jobs", { method: "POST", ...body(payload) }); }
export function updateJobRequisition(jobId: string, payload: {
  title: string; department: string; location: string; job_description: string; required_skills: string[];
}) { return json<JobRequisition>(`/jobs/${id(jobId)}`, { method: "PATCH", ...body(payload) }); }
export const fetchJobCandidates = (jobId: string) => json<RankedCandidate[]>(`/jobs/${id(jobId)}/candidates`);
export function addJobCandidate(jobId: string, payload: NewCandidatePayload) {
  return json<RankedCandidate[]>(`/jobs/${id(jobId)}/candidates`, {
    method: "POST", ...body({ ...payload, headline: payload.headline || "", matchScore: payload.matchScore ?? null }),
  });
}
export const removeJobCandidate = (jobId: string, candidateId: string) => json<RankedCandidate[]>(`/jobs/${id(jobId)}/candidates/${id(candidateId)}`, { method: "DELETE" });
export const updateJobCandidateStage = (jobId: string, candidateId: string, stage: string) => json<RankedCandidate>(`/jobs/${id(jobId)}/candidates/${id(candidateId)}/stage${query({ new_stage: stage })}`, { method: "PATCH" });
export const fetchCandidates = (params?: { search?: string; stage?: string; skill?: string; include_pii?: boolean }) => json<CandidateDetail[]>(`/candidates${query(params)}`);
export const fetchCandidate = (candidateId: string, includePii = false) => json<CandidateDetail>(`/candidates/${id(candidateId)}?include_pii=${includePii}`);
export const fetchCandidateScorecard = (candidateId: string, jobId: string) => json<CandidateDetail["scorecard"]>(`/candidates/${id(candidateId)}/scorecard${query({ job_id: jobId })}`);
export const updateCandidateStage = (candidateId: string, stage: string, jobId?: string) => json<{ status: string; stage: string }>(`/candidates/${id(candidateId)}/stage${query({ new_stage: stage, job_id: jobId })}`, { method: "PATCH" });
export const addCandidateNote = (candidateId: string, content: string, author = "Recruiter") => json<TeamNote>(`/candidates/${id(candidateId)}/notes`, { method: "POST", ...body({ content, author }) });
export const fetchResumePdf = async (candidateId: string, signal?: AbortSignal) => (await request(`/candidates/${id(candidateId)}/resume-pdf`, { signal })).blob();
export const locateCandidateCitation = (candidateId: string, phrase: string) => json<{ found: boolean; location: CitationLocation | null }>(`/candidates/${id(candidateId)}/locate-citation`, { method: "POST", ...body({ search_phrase: phrase }) });

export interface UploadResponse {
  status: string; task_id: string; candidate_id: string; filename: string;
  execution_mode: string; evaluation_status: string; match_score: number | null; message: string;
  job_id?: string; applied_for_job_id?: string;
}
export interface UploadTask {
  task_id: string; state: string; execution_mode?: string; error?: string;
  progress?: number; step?: string;
  result?: { candidate_id: string; evaluation_status?: string; match_score?: number | null; status?: string; applied_for_job_id?: string };
}
export interface UploadWaitOptions {
  signal?: AbortSignal;
  pollIntervalMs?: number;
  timeoutMs?: number;
  onProgress?: (task: UploadTask) => void;
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

export function uploadResumeFile(file: File, jobId?: string, signal?: AbortSignal, options?: {candidateId?: string; idempotencyKey?: string}) {
  const data = new FormData();
  data.append("file", file);
  if (jobId) data.append("job_id", jobId);
  if (options?.candidateId) data.append("candidate_id", options.candidateId);
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

  const uploaded = await uploadResumeFile(file, jobId, signal);

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

export async function evaluateJobMatching(payload: {
  job_id?: string;
  job_title: string;
  job_description: string;
  stage1_retrieve_limit?: number;
  stage2_rerank_limit?: number;
}) {
  const response = await json<MatchResponse & { task_ids?: string[] }>("/match/evaluate-job", { method: "POST", ...body(payload) });
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
export const registerWorkspace = (payload: { email: string; password: string; name: string; workspace_name: string; workspace_kind: string }) => json("/auth/register", { method: "POST", ...body(payload) });
export const signOut = () => json("/auth/logout", { method: "POST" });
export const switchWorkspace = (tenantId: string) => json("/auth/workspace", { method: "POST", ...body({ tenant_id: tenantId }) });
export interface WorkspaceMember { id: string; name: string; email: string; role: string }
export const fetchMembers = () => json<WorkspaceMember[]>("/settings/members");
export const addMember = (email: string, role: string) => json("/settings/members", { method: "POST", ...body({ email, role }) });
export const updateWorkspace = (name: string) => json("/settings/workspace", {method: "PATCH", ...body({name})});
export interface AnalyticsData { stages: {stage: string; count: number; average_score: number | null}[]; processing: {state: string; count: number}[]; hires: number; average_days_to_hire: number | null; generated_at: string }
export const fetchAnalytics = () => json<AnalyticsData>("/analytics");
export interface AgencyClient {id: string; name: string}
export interface AgencySubmission {id: string; client_name: string; application_id: string; status: string; created_at: string}
export const fetchClients = () => json<AgencyClient[]>("/clients");
export const createClient = (name: string) => json<AgencyClient>("/clients", {method: "POST", ...body({name})});
export const fetchSubmissions = () => json<AgencySubmission[]>("/submissions");
export const createSubmission = (clientId: string, applicationId: string) => json("/submissions", {method: "POST", ...body({client_id: clientId, application_id: applicationId})});

