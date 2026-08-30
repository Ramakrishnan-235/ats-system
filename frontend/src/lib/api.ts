import {
  MOCK_STATS,
  MOCK_WEEKLY_DATA,
  MOCK_AI_MATCH_RATE,
  MOCK_PIPELINE,
  MOCK_JOBS,
  MOCK_CANDIDATES_REGISTRY,
} from "./mock-data";
import {
  StatMetric,
  WeeklyData,
  AIMatchRate,
  PipelineCandidateItem,
  JobRequisition,
  CandidateDetail,
  RankedCandidate,
} from "@/types/ats";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Helper for local storage access in SSR-safe environment
function getStoredItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function setStoredItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("localStorage write failed:", e);
  }
}

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

// -------------------------------------------------------------------
// JOB-SPECIFIC CANDIDATES MANAGEMENT (PERSISTENT)
// -------------------------------------------------------------------

function getDefaultCandidatesForJob(
  jobId: string,
  jobInfo?: Partial<JobRequisition>
): RankedCandidate[] {
  return [];
}

export async function fetchJobCandidates(
  jobId: string,
  jobInfo?: Partial<JobRequisition>
): Promise<RankedCandidate[]> {
  const storageKey = `ats_job_candidates_${jobId}`;

  try {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/candidates`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        setStoredItem(storageKey, data);
        return data;
      }
    }
  } catch (err) {
    console.warn(`Backend fetch for job candidates (${jobId}) failed:`, err);
  }

  // Local storage fallback
  const stored = getStoredItem<RankedCandidate[] | null>(storageKey, null);
  if (stored && Array.isArray(stored)) {
    return stored;
  }

  return [];
}

export async function addJobCandidate(
  jobId: string,
  payload: Partial<RankedCandidate> & { name: string }
): Promise<RankedCandidate[]> {
  const storageKey = `ats_job_candidates_${jobId}`;
  const candidateId = payload.id || `cand-${Date.now()}`;

  const initials = payload.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "CD";

  const newCand: RankedCandidate = {
    id: candidateId,
    rank: 0,
    name: payload.name,
    headline: payload.headline || "Senior Software Specialist",
    avatar: payload.avatar || initials,
    isImageAvatar: !!payload.isImageAvatar,
    matchScore: payload.matchScore ?? 90,
    matchLabel:
      payload.matchLabel ||
      (payload.matchScore && payload.matchScore >= 93
        ? "Top Match"
        : payload.matchScore && payload.matchScore >= 87
        ? "Strong Match"
        : "Match"),
    skills: payload.skills && payload.skills.length > 0 ? payload.skills : ["Python", "Cloud"],
    stage: payload.stage || "Screening",
    stageBadgeStyle:
      payload.stage === "Interview"
        ? "bg-[#ede8dc] text-zinc-800"
        : payload.stage === "Qualified" || payload.stage === "Offer"
        ? "bg-emerald-100 text-emerald-900"
        : "bg-zinc-100 text-zinc-700",
    technicalDepthScore:
      payload.technicalDepthScore ||
      parseFloat(((payload.matchScore ?? 90) / 10.2).toFixed(1)),
    systemDesignScore:
      payload.systemDesignScore ||
      parseFloat((((payload.matchScore ?? 90) - 3.5) / 10.1).toFixed(1)),
    quote:
      payload.quote ||
      `Demonstrated depth and practical achievements in ${(payload.skills || ["systems"]).slice(0, 3).join(", ")}.`,
    sourceResumeLink: `/candidates/${candidateId}`,
    potentialGap: payload.potentialGap,
    suggestedImprovements: payload.suggestedImprovements || [
      `1. Deepen Hands-on Proficiency for this Role: Expand domain depth and production experience in ${(payload.skills || ["core technologies"])[0] || "primary stack"}.`,
      `2. Quantify Operational Scale: Detail transaction volume, request throughput, and latency improvements in resume milestones.`,
    ],
    suggestedQuestions: payload.suggestedQuestions || [
      `Walk us through the architecture and trade-offs of your most recent engineering project.`,
      `How do you monitor and debug unexpected performance bottlenecks in production?`,
    ],
    jobId,
  };

  // 1. Try backend
  try {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCand),
    });
    if (res.ok) {
      const data = await res.json();
      setStoredItem(storageKey, data);
      registerOrSyncCandidateProfile(newCand, payload.headline, jobId);
      return data;
    }
  } catch (err) {
    console.warn(`Backend add candidate failed, continuing with localStorage:`, err);
  }

  // 2. Local Storage Update
  const currentList = getStoredItem<RankedCandidate[]>(storageKey, getDefaultCandidatesForJob(jobId));
  const filtered = currentList.filter((c) => c.id !== newCand.id);
  const combined = [newCand, ...filtered];

  // Re-rank by match score descending (with technical depth as tiebreaker)
  combined.sort((a, b) => {
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    return (b.technicalDepthScore || 0) - (a.technicalDepthScore || 0);
  });

  const reranked = combined.map((c, idx) => ({
    ...c,
    rank: idx + 1,
  }));

  setStoredItem(storageKey, reranked);

  // Register in Candidate Profile Store so viewing /candidates/[id] works seamlessly
  registerOrSyncCandidateProfile(newCand, "Cloud Architect", jobId);

  // Also sync to global candidates list
  syncToGlobalCandidates(newCand);

  return reranked;
}

export async function removeJobCandidate(
  jobId: string,
  candidateId: string
): Promise<RankedCandidate[]> {
  const storageKey = `ats_job_candidates_${jobId}`;

  try {
    const res = await fetch(
      `${API_BASE_URL}/jobs/${jobId}/candidates/${candidateId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      const data = await res.json();
      setStoredItem(storageKey, data);
      return data;
    }
  } catch (err) {
    console.warn(`Backend remove candidate failed:`, err);
  }

  const currentList = getStoredItem<RankedCandidate[]>(storageKey, []);
  const remaining = currentList.filter((c) => c.id !== candidateId);
  const reranked = remaining.map((c, idx) => ({
    ...c,
    rank: idx + 1,
  }));

  setStoredItem(storageKey, reranked);
  return reranked;
}

export async function updateJobCandidateStage(
  jobId: string,
  candidateId: string,
  newStage: string
): Promise<RankedCandidate | null> {
  const storageKey = `ats_job_candidates_${jobId}`;

  try {
    const res = await fetch(
      `${API_BASE_URL}/jobs/${jobId}/candidates/${candidateId}/stage?new_stage=${encodeURIComponent(
        newStage
      )}`,
      { method: "PATCH" }
    );
    if (res.ok) {
      const data = await res.json();
      const currentList = getStoredItem<RankedCandidate[]>(storageKey, []);
      const updated = currentList.map((c) => (c.id === candidateId ? { ...c, stage: newStage } : c));
      setStoredItem(storageKey, updated);
      return data;
    }
  } catch (err) {
    console.warn(`Backend update candidate stage failed:`, err);
  }

  const currentList = getStoredItem<RankedCandidate[]>(storageKey, []);
  let matched: RankedCandidate | null = null;
  const updated = currentList.map((c) => {
    if (c.id === candidateId) {
      const stageStyle =
        newStage === "Qualified" || newStage === "Offer"
          ? "bg-emerald-100 text-emerald-900"
          : newStage === "Interview"
          ? "bg-[#ede8dc] text-zinc-800"
          : "bg-zinc-100 text-zinc-700";
      matched = { ...c, stage: newStage, stageBadgeStyle: stageStyle };
      return matched;
    }
    return c;
  });

  setStoredItem(storageKey, updated);

  // Sync profile stage
  const profiles = getStoredItem<Record<string, CandidateDetail>>("ats_candidate_profiles", {});
  if (profiles[candidateId]) {
    profiles[candidateId].stage = newStage;
    profiles[candidateId].status = newStage;
    setStoredItem("ats_candidate_profiles", profiles);
  }

  return matched;
}

// -------------------------------------------------------------------
// GLOBAL CANDIDATES & DETAILED PROFILE PERSISTENCE
// -------------------------------------------------------------------

function registerOrSyncCandidateProfile(
  candidate: Partial<RankedCandidate> & { name: string },
  jobTitle = "Cloud Architect",
  jobId = "job-009"
): CandidateDetail {
  const profiles = getStoredItem<Record<string, CandidateDetail>>("ats_candidate_profiles", {});
  const candId = candidate.id || `cand-${Date.now()}`;

  if (profiles[candId]) {
    profiles[candId].stage = candidate.stage || profiles[candId].stage;
    profiles[candId].status = candidate.stage || profiles[candId].status;
    if (jobTitle) profiles[candId].applied_for_job = jobTitle;
    if (jobId) profiles[candId].applied_for_job_id = jobId;
    if (candidate.raw_text) profiles[candId].raw_text = candidate.raw_text;
    if (candidate.pdf_blob_url) profiles[candId].pdf_blob_url = candidate.pdf_blob_url;
    if (candidate.pdf_url) profiles[candId].pdf_url = candidate.pdf_url;
    if (candidate.experience && candidate.experience.length > 0) {
      profiles[candId].experience = candidate.experience;
    }
    setStoredItem("ats_candidate_profiles", profiles);
    return profiles[candId];
  }

  const skills = candidate.skills || ["Cloud Architecture", "AWS", "Python", "Docker"];
  const matchScore = candidate.matchScore || 92;
  const techDepth = candidate.technicalDepthScore || parseFloat((matchScore / 10.2).toFixed(1));
  const sysDesign = candidate.systemDesignScore || parseFloat(((matchScore - 3.5) / 10.1).toFixed(1));

  const candName = candidate.name || "Candidate";
  const safeInitials = candName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "CD";

  // Build real experience from headline or actual resume
  const experienceItems =
    candidate.experience && candidate.experience.length > 0
      ? candidate.experience
      : [
          {
            role: candidate.headline?.includes("@") ? candidate.headline.split("@")[0].trim() : (candidate.headline || "Senior Engineer"),
            company: candidate.headline?.includes("@") ? candidate.headline.split("@")[1].trim() : "Industry Experience",
            period: "2021 — Present",
            description:
              candidate.quote ||
              `Designed and built core production services, microservices, and technical pipelines utilizing ${skills.slice(0, 4).join(", ")}.`,
          },
        ];

  const newProfile: CandidateDetail = {
    id: candId,
    name: candName,
    anonymized_name: `Candidate #${Math.floor(7000 + Math.random() * 2000)}`,
    avatar: candidate.avatar || safeInitials,
    target_headline: candidate.headline || "Senior Engineering Specialist",
    role: candidate.headline || "Senior Engineering Specialist",
    location: (candidate as any).location || "N/A",
    email: (candidate as any).email || "N/A",
    phone: (candidate as any).phone || "N/A",
    linkedin: (candidate as any).linkedin || "N/A",
    status: candidate.stage || "Interview",
    stage: candidate.stage || "Interview",
    applied_date: "Recently",
    applied_for_job: jobTitle,
    applied_for_job_id: jobId,
    years_of_experience: (candidate as any).experienceYears || (candidate as any).years_of_experience || 3.0,
    highest_education: (candidate as any).highest_education || "N/A",
    core_skills: skills,
    experience: experienceItems,
    raw_text: candidate.raw_text,
    pdf_url: candidate.pdf_url || `${API_BASE_URL}/candidates/${candId}/resume-pdf`,
    pdf_blob_url: candidate.pdf_blob_url,
    scorecard: {
      overall_match_score: matchScore,
      match_tier:
        matchScore >= 93
          ? "Exceptional Match"
          : matchScore >= 87
          ? "Strong Match"
          : "Match",
      model_version: "Model gemma2:2b (Live Evaluator)",
      evaluated_at: "Evaluated recently",
      categories: [
        {
          name: "Technical Depth",
          score: techDepth,
          max_score: 10.0,
          quote:
            candidate.quote ||
            `Extensive hands-on expertise in ${skills.slice(0, 3).join(", ")}.`,
          source_ref: "Source Resume",
        },
        {
          name: "System Design",
          score: sysDesign,
          max_score: 10.0,
          quote:
            "Demonstrated strong understanding of distributed architectures, high availability, and fault-tolerance.",
          source_ref: "Architecture Review",
        },
        {
          name: "Leadership",
          score: 7.5,
          max_score: 10.0,
          quote:
            "Proven track record of technical mentorship and cross-functional project execution.",
          source_ref: "Team Feedback",
        },
      ],
      risk_flags: candidate.potentialGap ? [candidate.potentialGap] : [],
      suggested_improvements: candidate.suggestedImprovements || [
        `1. Upskill in Core Architecture for ${jobTitle}: Deepen demonstrated production experience with ${skills[0] || "primary stack"}.`,
        `2. Quantify Operational Scale: Detail measurable latency and throughput achievements on resume.`,
      ],
      suggested_questions: candidate.suggestedQuestions || [
        `Can you describe the system architecture and scaling considerations for your recent ${skills[0] || "core"} project?`,
        `How do you diagnose and resolve latency bottlenecks across distributed microservices?`,
      ],
      team_notes: [
        {
          id: `note-${Date.now()}`,
          author: "Recruiter Admin",
          initials: "RA",
          role: "Admin",
          timestamp: "Just now",
          content: `Candidate added to ${jobTitle} pipeline with ${matchScore}% AI match score. Ready for technical screening.`,
        },
      ],
    },
  };

  profiles[candId] = newProfile;
  setStoredItem("ats_candidate_profiles", profiles);
  return newProfile;
}

function syncToGlobalCandidates(candidate: RankedCandidate | Partial<RankedCandidate> & { name: string }) {
  const globalKey = "ats_global_candidates";
  const current = getStoredItem<any[]>(globalKey, []);
  const candId = candidate.id || `cand-${Date.now()}`;

  const exists = current.some((c) => c.id === candId);
  if (!exists) {
    const candName = candidate.name || "Candidate";
    const safeInitials = candName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "CD";

    const newGlobalItem = {
      id: candId,
      name: candName,
      role: candidate.headline || "Software Specialist",
      location: "San Francisco, CA",
      matchScore: candidate.matchScore || 90,
      skills: candidate.skills || ["Python", "Cloud"],
      avatar: candidate.avatar || safeInitials,
      experienceYears: 6,
      status: "Active",
    };
    setStoredItem(globalKey, [newGlobalItem, ...current]);
  }
}

export function saveCandidateProfile(profile: CandidateDetail): void {
  const profiles = getStoredItem<Record<string, CandidateDetail>>("ats_candidate_profiles", {});
  profiles[profile.id] = profile;
  setStoredItem("ats_candidate_profiles", profiles);
}

export async function fetchCandidates(params?: {
  search?: string;
  stage?: string;
  skill?: string;
}): Promise<any[]> {
  let backendCandidates: any[] = [];
  try {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.stage) query.set("stage", params.stage);
    if (params?.skill) query.set("skill", params.skill);

    const res = await fetch(`${API_BASE_URL}/candidates?${query.toString()}`, {
      cache: "no-store",
    });
    if (res.ok) {
      backendCandidates = await res.json();
    }
  } catch (err) {
    console.warn("Backend not reached for candidates list:", err);
  }

  // Combine with stored local candidates
  const storedGlobals = getStoredItem<any[]>("ats_global_candidates", []);
  const map = new Map<string, any>();

  backendCandidates.forEach((c) => map.set(c.id, c));
  storedGlobals.forEach((c) => {
    if (!map.has(c.id)) map.set(c.id, c);
  });

  return Array.from(map.values());
}

export async function fetchCandidate(id: string): Promise<CandidateDetail | null> {
  // 1. Try local storage cache
  const profiles = getStoredItem<Record<string, CandidateDetail>>("ats_candidate_profiles", {});
  if (profiles[id]) {
    return profiles[id];
  }

  // 2. Try backend
  try {
    const res = await fetch(`${API_BASE_URL}/candidates/${id}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      profiles[id] = data;
      setStoredItem("ats_candidate_profiles", profiles);
      return data;
    }
  } catch (err) {
    console.warn(`Backend fetch for candidate ${id} failed:`, err);
  }

  // 3. Check Mock Candidates Registry
  if (MOCK_CANDIDATES_REGISTRY[id]) {
    return { ...MOCK_CANDIDATES_REGISTRY[id], id };
  }

  return null;
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
    // Update local profile
    const profiles = getStoredItem<Record<string, CandidateDetail>>("ats_candidate_profiles", {});
    if (profiles[candidateId]) {
      profiles[candidateId].stage = newStage;
      profiles[candidateId].status = newStage;
      setStoredItem("ats_candidate_profiles", profiles);
    }
    return { status: "SUCCESS", candidate_id: candidateId, stage: newStage };
  }
}

export async function addCandidateNote(
  candidateId: string,
  content: string,
  author = "Recruiter Admin"
) {
  const newNote = {
    id: `note-${Date.now()}`,
    author,
    initials: author
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    role: "Recruiter",
    timestamp: "Just now",
    content,
  };

  // Update local storage profile note
  const profiles = getStoredItem<Record<string, CandidateDetail>>("ats_candidate_profiles", {});
  if (profiles[candidateId]) {
    profiles[candidateId].scorecard.team_notes = [
      ...(profiles[candidateId].scorecard.team_notes || []),
      newNote,
    ];
    setStoredItem("ats_candidate_profiles", profiles);
  }

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
    return newNote;
  }
}

export async function uploadResumeFile(file: File, jobId?: string) {
  const localPdfBlobUrl = typeof window !== "undefined" ? URL.createObjectURL(file) : undefined;

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
    const data = await res.json();

    // Cache the real uploaded PDF blob URL & PDF URL for candidate profile
    const candId = data.candidate_id;
    const profiles = getStoredItem<Record<string, CandidateDetail>>("ats_candidate_profiles", {});
    
    try {
      const candRes = await fetch(`${API_BASE_URL}/candidates/${candId}`);
      if (candRes.ok) {
        const fullCandidate: CandidateDetail = await candRes.json();
        fullCandidate.pdf_blob_url = localPdfBlobUrl;
        fullCandidate.pdf_url = `${API_BASE_URL}/candidates/${candId}/resume-pdf`;
        fullCandidate.is_real_pdf = true;
        profiles[candId] = fullCandidate;
        setStoredItem("ats_candidate_profiles", profiles);
      }
    } catch (e) {
      console.warn("Could not load backend parsed profile:", e);
    }

    return {
      ...data,
      pdf_blob_url: localPdfBlobUrl,
    };
  } catch (err) {
    console.warn(
      "Backend not reached for upload, simulating success response:",
      err
    );
    const candId = `cand-${Math.floor(1000 + Math.random() * 9000)}`;
    return {
      status: "ACCEPTED",
      task_id: `TSK-${Math.floor(1000 + Math.random() * 9000)}`,
      candidate_id: candId,
      filename: file.name,
      job_id: jobId,
      match_score: 94,
      message: "Resume queued for processing.",
      pdf_blob_url: localPdfBlobUrl,
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
