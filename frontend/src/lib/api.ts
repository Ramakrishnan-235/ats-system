import type {
  StatMetric, WeeklyData, AIMatchRate, PipelineCandidateItem,
  JobRequisition, CandidateDetail, RankedCandidate, NewCandidatePayload,
  TeamNote, CitationLocation,
} from "@/types/ats";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
// A user supplies this credential for the current browser session. Never bundle a
// server credential or persist candidate PII in browser storage.
let sessionApiKey = "";
export function setSessionApiKey(key: string) { sessionApiKey = key.trim(); }
export const requiresApiKey = process.env.NEXT_PUBLIC_REQUIRE_API_KEY !== "false";
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
  if (sessionApiKey) headers.set("X-API-Key", sessionApiKey);
  if (requiresApiKey && !sessionApiKey) {
    throw new ApiError("Enter your API key to connect to the backend.", 401);
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, cache: "no-store" });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError("Cannot reach the backend. Check the API address and connection.");
  }
  if (!response.ok) {
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
export const updateCandidateStage = (candidateId: string, stage: string) => json<{ status: string; stage: string }>(`/candidates/${id(candidateId)}/stage${query({ new_stage: stage })}`, { method: "PATCH" });
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

export function uploadResumeFile(file: File, jobId?: string, signal?: AbortSignal) {
  const data = new FormData();
  data.append("file", file);
  if (jobId) data.append("job_id", jobId);
  return json<UploadResponse>("/candidates/upload-async", { method: "POST", body: data, signal });
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
  let timeoutMs = 120000;
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

export function evaluateJobMatching(payload: {
  job_id?: string;
  job_title: string;
  job_description: string;
  stage1_retrieve_limit?: number;
  stage2_rerank_limit?: number;
}) {
  return json<MatchResponse>("/match/evaluate-job", { method: "POST", ...body(payload) });
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
