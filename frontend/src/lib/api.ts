import {
  MOCK_STATS,
  MOCK_WEEKLY_DATA,
  MOCK_AI_MATCH_RATE,
  MOCK_PIPELINE,
  MOCK_JOBS,
  MOCK_CANDIDATE_PRIYA,
} from "./mock-data";
import {
  StatMetric,
  WeeklyData,
  AIMatchRate,
  PipelineCandidateItem,
  JobRequisition,
  CandidateDetail,
} from "@/types/ats";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function fetchDashboardStats(): Promise<{
  stats: StatMetric[];
  weekly_candidates: WeeklyData[];
  ai_match_rate: AIMatchRate;
  processing_resumes: number;
  today_evaluations: number;
  pipeline: Record<string, PipelineCandidateItem[]>;
}> {
  try {
    const res = await fetch(`${API_BASE_URL}/dashboard/stats`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch dashboard stats");
    return await res.json();
  } catch (err) {
    console.warn(
      "Backend not reached for dashboard stats, using mock fallback:",
      err
    );
    return {
      stats: MOCK_STATS,
      weekly_candidates: MOCK_WEEKLY_DATA,
      ai_match_rate: MOCK_AI_MATCH_RATE,
      processing_resumes: 5,
      today_evaluations: 94,
      pipeline: MOCK_PIPELINE,
    };
  }
}

export async function fetchJobs(params?: {
  status?: string;
  department?: string;
  search?: string;
}): Promise<JobRequisition[]> {
  try {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.department) query.set("department", params.department);
    if (params?.search) query.set("search", params.search);

    const res = await fetch(`${API_BASE_URL}/jobs?${query.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch jobs");
    return await res.json();
  } catch (err) {
    console.warn("Backend not reached for jobs, using mock fallback:", err);
    let jobs = [...MOCK_JOBS];
    if (params?.status && params.status.toUpperCase() !== "ALL") {
      jobs = jobs.filter(
        (j) => j.status.toUpperCase() === params.status?.toUpperCase()
      );
    }
    if (params?.department && params.department.toUpperCase() !== "ALL") {
      jobs = jobs.filter(
        (j) => j.department.toLowerCase() === params.department?.toLowerCase()
      );
    }
    if (params?.search) {
      const s = params.search.toLowerCase();
      jobs = jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(s) ||
          j.department.toLowerCase().includes(s) ||
          j.location.toLowerCase().includes(s)
      );
    }
    return jobs;
  }
}

export async function fetchJobDetail(jobId: string): Promise<JobRequisition | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch job detail");
    return await res.json();
  } catch (err) {
    console.warn("Backend not reached for job detail, using fallback:", err);
    return MOCK_JOBS.find((j) => j.id === jobId) || MOCK_JOBS[0];
  }
}

export async function createJobRequisition(payload: {
  title: string;
  department: string;
  location: string;
  job_description: string;
  required_skills: string[];
  min_years_experience?: number;
  run_ai_match?: boolean;
}): Promise<JobRequisition> {
  try {
    const res = await fetch(`${API_BASE_URL}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create job");
    return await res.json();
  } catch (err) {
    console.warn("Backend create job failed, creating local mockup job:", err);
    const newJob: JobRequisition = {
      id: `job-${Date.now()}`,
      title: payload.title,
      department: payload.department,
      location: payload.location,
      status: "OPEN",
      posted_date: "Just now",
      candidates_count: 0,
      avatars: [],
      top_match: {
        score: payload.run_ai_match ? 95 : 0,
        label: payload.run_ai_match ? "95 Top Match" : "Pending Match",
        last_run: "Just now",
        status: "ACTIVE",
      },
      icon_type: "code",
      job_description: payload.job_description,
      min_years_experience: payload.min_years_experience || 3.0,
      required_skills: payload.required_skills,
    };
    return newJob;
  }
}

export async function fetchCandidates(params?: {
  search?: string;
  stage?: string;
  skill?: string;
}): Promise<any[]> {
  try {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.stage) query.set("stage", params.stage);
    if (params?.skill) query.set("skill", params.skill);

    const res = await fetch(`${API_BASE_URL}/candidates?${query.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch candidates");
    return await res.json();
  } catch (err) {
    console.warn("Backend not reached for candidates list:", err);
    return [];
  }
}

export async function fetchCandidate(id: string): Promise<CandidateDetail> {
  try {
    const res = await fetch(`${API_BASE_URL}/candidates/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch candidate");
    return await res.json();
  } catch (err) {
    console.warn("Backend not reached for candidate, using mock fallback:", err);
    return { ...MOCK_CANDIDATE_PRIYA, id };
  }
}

export async function updateCandidateStage(
  candidateId: string,
  newStage: string
) {
  try {
    const res = await fetch(
      `${API_BASE_URL}/candidates/${candidateId}/stage?new_stage=${encodeURIComponent(
        newStage
      )}`,
      {
        method: "PATCH",
      }
    );
    if (!res.ok) throw new Error("Failed to update stage");
    return await res.json();
  } catch (err) {
    console.warn("Backend not reached for stage update:", err);
    return { status: "SUCCESS", candidate_id: candidateId, stage: newStage };
  }
}

export async function addCandidateNote(
  candidateId: string,
  content: string,
  author = "Recruiter Admin"
) {
  try {
    const res = await fetch(`${API_BASE_URL}/candidates/${candidateId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, author }),
    });
    if (!res.ok) throw new Error("Failed to add note");
    return await res.json();
  } catch (err) {
    console.warn("Backend not reached for note, returning local note:", err);
    return {
      id: `note-${Date.now()}`,
      author,
      initials: "RA",
      role: "Recruiter",
      timestamp: "Just now",
      content,
    };
  }
}

export async function uploadResumeFile(file: File, jobId?: string) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    if (jobId) {
      formData.append("job_id", jobId);
    }
    const res = await fetch(`${API_BASE_URL}/candidates/upload-async`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Failed to upload resume");
    return await res.json();
  } catch (err) {
    console.warn(
      "Backend not reached for upload, simulating success response:",
      err
    );
    return {
      status: "ACCEPTED",
      task_id: `TSK-${Math.floor(1000 + Math.random() * 9000)}`,
      candidate_id: `cand-${Math.floor(1000 + Math.random() * 9000)}`,
      filename: file.name,
      job_id: jobId,
      match_score: 94,
      message: "Resume queued for processing.",
    };
  }
}

export async function evaluateJobMatching(payload: {
  job_title: string;
  job_description: string;
  stage1_retrieve_limit?: number;
  stage2_rerank_limit?: number;
}) {
  try {
    const res = await fetch(`${API_BASE_URL}/match/evaluate-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to run matching evaluation");
    return await res.json();
  } catch (err) {
    console.warn("Backend matching call failed:", err);
    return null;
  }
}
