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
  const targetJob = jobInfo || MOCK_JOBS.find((j) => j.id === jobId) || {
    title: "Cloud Architect",
    department: "Cloud & Infrastructure",
    required_skills: ["AWS", "Terraform", "Kubernetes", "Microservices"],
  };

  const skills = targetJob.required_skills || ["Python", "Cloud", "Kubernetes"];

  if (jobId === "job-009" || targetJob.title?.toLowerCase().includes("cloud")) {
    return [
      {
        id: "cand-pool-001",
        rank: 1,
        name: "Dr. Marcus Vance",
        headline: "Staff Distributed Systems Architect @ Meta",
        avatar:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        isImageAvatar: true,
        matchScore: 96,
        matchLabel: "Top Match",
        skills: ["AWS", "Terraform", "Kubernetes", "Cloud Architecture", "Go"],
        stage: "Interview",
        stageBadgeStyle: "bg-[#ede8dc] text-zinc-800",
        technicalDepthScore: 9.6,
        systemDesignScore: 9.4,
        quote:
          "Engineered multi-region event streaming fabric processing 200k RPS with sub-millisecond p99 latency.",
        sourceResumeLink: "/candidates/cand-pool-001",
        potentialGap: "High focus on proprietary Meta hyper-scale tooling; verify familiarity with standard Terraform modules.",
        suggestedQuestions: [
          "Can you describe how you managed cross-region network partition scenarios in your cloud fabric?",
          "How do you approach zero-downtime multi-cloud failover architectures?",
        ],
        jobId,
      },
      {
        id: "cand-pool-002",
        rank: 2,
        name: "Samantha Reed",
        headline: "Senior Backend & Platform Dev @ Datadog",
        avatar:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        isImageAvatar: true,
        matchScore: 93,
        matchLabel: "Top Match",
        skills: ["AWS", "Terraform", "Docker", "PostgreSQL", "FastAPI"],
        stage: "Qualified",
        stageBadgeStyle: "bg-emerald-100 text-emerald-900",
        technicalDepthScore: 9.2,
        systemDesignScore: 9.0,
        quote:
          "Architected distributed observability ingest services handling 15M metrics/minute with zero packet drop.",
        sourceResumeLink: "/candidates/cand-pool-002",
        potentialGap: "Fewer years leading multi-region Azure / GCP hybrid migrations.",
        suggestedQuestions: [
          "How do you scale Redis clusters and FastAPI worker pools to sustain peak telemetry spikes?",
          "What is your strategy for automated Terraform drift detection?",
        ],
        jobId,
      },
      {
        id: "cand-pool-003",
        rank: 3,
        name: "Kai Nakamura",
        headline: "Cloud Software Engineer @ Shopify",
        avatar: "KN",
        isImageAvatar: false,
        matchScore: 89,
        matchLabel: "Strong Match",
        skills: ["GCP", "Kubernetes", "Terraform", "Docker", "Go"],
        stage: "Screening",
        stageBadgeStyle: "bg-zinc-100 text-zinc-700",
        technicalDepthScore: 8.8,
        systemDesignScore: 8.5,
        quote:
          "Maintained Kubernetes cluster orchestration and developed automated canary deployment operators across multi-cloud regions.",
        sourceResumeLink: "/candidates/cand-pool-003",
        potentialGap: "Primary expertise in GCP rather than AWS core network peering.",
        suggestedQuestions: [
          "How do you design Kubernetes RBAC policies for isolated multi-tenant services?",
        ],
        jobId,
      },
      {
        id: "cand-5",
        rank: 4,
        name: "Alex Rivera",
        headline: "Senior Cloud Engineer @ Netflix",
        avatar: "AR",
        isImageAvatar: false,
        matchScore: 85,
        matchLabel: "Match",
        skills: ["AWS", "Terraform", "Well-Architected Framework", "Go"],
        stage: "Applied",
        stageBadgeStyle: "bg-zinc-100 text-zinc-600",
        technicalDepthScore: 8.3,
        systemDesignScore: 8.1,
        quote:
          "Automated cloud infrastructure provisioning across 12 AWS regions using Terraform and custom Go operators.",
        sourceResumeLink: "/candidates/cand-5",
        potentialGap: "Focus is largely on DevOps and Cloud IaC rather than overarching enterprise application architecture.",
        suggestedQuestions: [
          "What are your strategies for managing complex multi-environment Terraform state files?",
        ],
        jobId,
      },
      {
        id: "cand-pool-005",
        rank: 5,
        name: "David Ross",
        headline: "Distributed Systems Developer @ Block",
        avatar: "DR",
        isImageAvatar: false,
        matchScore: 81,
        matchLabel: "Potential Match",
        skills: ["Microservices", "Kafka", "PostgreSQL", "Go"],
        stage: "Screening",
        stageBadgeStyle: "bg-zinc-100 text-zinc-700",
        technicalDepthScore: 8.0,
        systemDesignScore: 7.8,
        quote:
          "Built financial ledger consistency check services validating 50k transactions/sec with zero race conditions.",
        sourceResumeLink: "/candidates/cand-pool-005",
        potentialGap: "More application level experience than cloud infrastructure governance.",
        suggestedQuestions: [
          "How do you ensure data integrity during cross-region failover?",
        ],
        jobId,
      },
    ];
  }

  // Generic fallback for any other job requisition
  return [
    {
      id: `cand-${jobId}-1`,
      rank: 1,
      name: "Priya Sharma",
      headline: `Staff Engineer @ Stripe`,
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
      isImageAvatar: true,
      matchScore: 95,
      matchLabel: "Top Match",
      skills: skills.slice(0, 3).concat(["Python", "Kubernetes"]),
      stage: "Interview",
      stageBadgeStyle: "bg-[#ede8dc] text-zinc-800",
      technicalDepthScore: 9.2,
      systemDesignScore: 8.5,
      quote: `Led core architecture and microservices for ${targetJob.title}, reducing p99 latency by 40%.`,
      sourceResumeLink: `/candidates/cand-${jobId}-1`,
      potentialGap: "Heavy reliance on managed PaaS historically; probe raw infrastructure depth.",
      suggestedQuestions: [
        `Can you describe the microservices architecture you designed for ${skills[0] || "core platform"}?`,
      ],
      jobId,
    },
    {
      id: `cand-${jobId}-2`,
      rank: 2,
      name: "Jane Doe",
      headline: `Senior Specialist @ Square`,
      avatar: "JD",
      isImageAvatar: false,
      matchScore: 92,
      matchLabel: "Strong Match",
      skills: skills.slice(0, 2).concat(["SQL", "AWS"]),
      stage: "Qualified",
      stageBadgeStyle: "bg-zinc-100 text-zinc-700",
      technicalDepthScore: 8.9,
      systemDesignScore: 8.7,
      quote: "Architected real-time processing pipelines handling 50k transactions/sec with zero loss.",
      sourceResumeLink: `/candidates/cand-${jobId}-2`,
      potentialGap: "Limited direct experience with event streaming at high volume.",
      suggestedQuestions: [
        "How did you ensure transactional consistency across your distributed services?",
      ],
      jobId,
    },
    {
      id: `cand-${jobId}-3`,
      rank: 3,
      name: "Mark Tan",
      headline: `Platform Engineer @ Robinhood`,
      avatar: "MT",
      isImageAvatar: false,
      matchScore: 87,
      matchLabel: "Match",
      skills: skills.slice(1, 3).concat(["Go", "Docker"]),
      stage: "Screening",
      stageBadgeStyle: "bg-zinc-100 text-zinc-700",
      technicalDepthScore: 8.4,
      systemDesignScore: 8.6,
      quote: "Maintained multi-cluster infrastructure running 200+ core microservices with 99.99% availability.",
      sourceResumeLink: `/candidates/cand-${jobId}-3`,
      potentialGap: "Primary expertise is in Go infrastructure rather than application layer.",
      suggestedQuestions: [
        "How do you approach automated canary deployments with Kubernetes?",
      ],
      jobId,
    },
  ];
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
      if (Array.isArray(data) && data.length > 0) {
        setStoredItem(storageKey, data);
        return data;
      }
    }
  } catch (err) {
    console.warn(`Backend fetch for job candidates (${jobId}) failed:`, err);
  }

  // Local storage fallback
  const stored = getStoredItem<RankedCandidate[] | null>(storageKey, null);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored;
  }

  // Initialize and persist default pool for this job
  const defaultPool = getDefaultCandidatesForJob(jobId, jobInfo);
  setStoredItem(storageKey, defaultPool);

  // Register default candidates in profile store
  defaultPool.forEach((c) => {
    registerOrSyncCandidateProfile(c, jobInfo?.title || "Target Requisition", jobId);
  });

  return defaultPool;
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
  candidate: RankedCandidate | Partial<RankedCandidate> & { name: string },
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
    setStoredItem("ats_candidate_profiles", profiles);
    return profiles[candId];
  }

  const skills = candidate.skills || ["Cloud Architecture", "AWS", "Python", "Docker"];
  const matchScore = candidate.matchScore || 92;
  const techDepth = candidate.technicalDepthScore || parseFloat((matchScore / 10.2).toFixed(1));
  const sysDesign = candidate.systemDesignScore || parseFloat(((matchScore - 3.5) / 10.1).toFixed(1));

  const candName = candidate.name || "Candidate";
  const safeEmail = `${candName.toLowerCase().replace(/[^a-z0-9]/g, ".")}@example.com`;
  const safeLinkedin = `linkedin.com/in/${candName.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const safeInitials = candName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "CD";

  const newProfile: CandidateDetail = {
    id: candId,
    name: candName,
    anonymized_name: `Candidate #${Math.floor(7000 + Math.random() * 2000)}`,
    avatar: candidate.avatar || safeInitials,
    target_headline: candidate.headline || "Senior Engineering Specialist",
    role: candidate.headline || "Senior Engineering Specialist",
    location: "San Francisco, CA / Remote",
    email: safeEmail,
    phone: "(415) 555-0182",
    linkedin: safeLinkedin,
    status: candidate.stage || "Interview",
    stage: candidate.stage || "Interview",
    applied_date: "Recently",
    applied_for_job: jobTitle,
    applied_for_job_id: jobId,
    years_of_experience: 7.0,
    highest_education: "M.S. in Computer Science / Engineering",
    core_skills: skills,
    experience: [
      {
        role: candidate.headline?.split("@")[0]?.trim() || "Senior Engineer",
        company: candidate.headline?.split("@")[1]?.trim() || "Technology Corp",
        period: "2021 — Present",
        description:
          candidate.quote ||
          `Led architecture of scalable systems, microservices, and automated pipelines with high reliability.`,
      },
      {
        role: "Software Engineer",
        company: "Platform Innovations Inc.",
        period: "2018 — 2021",
        description:
          "Developed core backend APIs, distributed caching layers, and CI/CD pipelines.",
      },
    ],
    scorecard: {
      overall_match_score: matchScore,
      match_tier:
        matchScore >= 93
          ? "Exceptional Match"
          : matchScore >= 87
          ? "Strong Match"
          : "Match",
      model_version: "Model gemma4:e2b",
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

export async function fetchCandidate(id: string): Promise<CandidateDetail> {
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

  // 3. Fallback: check if matches built-in Priya or synthesize rich profile
  if (id === "cand-001" || id === "cand-1") {
    return { ...MOCK_CANDIDATE_PRIYA, id };
  }

  // Synthesize realistic profile for this candidate ID
  const synthesized = registerOrSyncCandidateProfile(
    {
      id,
      name: id.includes("pool")
        ? "Dr. Marcus Vance"
        : `Candidate ${id.replace(/[^0-9]/g, "") || "Specialist"}`,
      headline: "Cloud & Distributed Systems Architect",
      skills: ["AWS", "Terraform", "Kubernetes", "Cloud Architecture", "Python"],
      matchScore: 94,
    },
    "Cloud Architect",
    "job-009"
  );

  return synthesized;
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
    const candId = `cand-${Math.floor(1000 + Math.random() * 9000)}`;
    return {
      status: "ACCEPTED",
      task_id: `TSK-${Math.floor(1000 + Math.random() * 9000)}`,
      candidate_id: candId,
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
