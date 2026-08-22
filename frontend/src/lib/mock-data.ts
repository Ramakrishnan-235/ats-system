import {
  StatMetric,
  WeeklyData,
  AIMatchRate,
  PipelineCandidateItem,
  JobRequisition,
  CandidateDetail,
  ActiveUpload,
  CompletedUpload,
  UploadIssue,
} from "@/types/ats";

export const MOCK_STATS: StatMetric[] = [
  {
    id: "active_jobs",
    label: "ACTIVE JOBS",
    value: "12",
    change: "+2 this week",
    trend: "positive",
    icon: "briefcase",
    style: "default",
  },
  {
    id: "candidates",
    label: "CANDIDATES",
    value: "1,247",
    change: "+89 vs last month",
    trend: "positive",
    icon: "users",
    style: "default",
  },
  {
    id: "avg_time_to_hire",
    label: "AVG TIME-TO-HIRE",
    value: "18",
    unit: "days",
    change: "-2 days improved",
    trend: "positive",
    icon: "clock",
    style: "default",
  },
  {
    id: "open_offers",
    label: "OPEN OFFERS",
    value: "3",
    change: "Awaiting signatures",
    trend: "neutral",
    icon: "award",
    style: "highlighted_dark",
  },
];

export const MOCK_WEEKLY_DATA: WeeklyData[] = [
  { week: "W1", count: 42, is_peak: false },
  { week: "W2", count: 58, is_peak: false },
  { week: "W3", count: 39, is_peak: false },
  { week: "W4", count: 82, is_peak: false },
  { week: "W5", count: 64, is_peak: false },
  { week: "W6", count: 90, is_peak: false },
  { week: "W7", count: 128, is_peak: true },
  { week: "W8", count: 73, is_peak: false },
];

export const MOCK_AI_MATCH_RATE: AIMatchRate = {
  rate: 68,
  precision_label: "Candidate fit score precision",
  matched_percent: 68,
  not_matched_percent: 32,
};

export const MOCK_PIPELINE: Record<string, PipelineCandidateItem[]> = {
  Contacted: [
    {
      id: "cand-001",
      name: "Priya Sharma",
      role: "Senior Backend Engineer",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
      match_score: 92,
      summary: "Strong system design skills. Ex-Stripe, scalable microservices...",
      stage: "Contacted",
      applied_time: "2 days ago",
    },
    {
      id: "cand-002",
      name: "David Chen",
      role: "Product Manager",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
      match_score: 88,
      summary: "Focus on user-centric fintech products. Messaged on LinkedIn,...",
      stage: "Contacted",
      applied_time: "3 days ago",
    },
  ],
  Interview: [
    {
      id: "cand-004",
      name: "Marcus Adebayo",
      role: "Lead UX Researcher",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
      match_score: 95,
      summary: "Nailed the cultural fit round. Technical presentation schedule...",
      stage: "Interview",
      applied_time: "5 days ago",
    },
    {
      id: "cand-005",
      name: "Elena Jimenez",
      role: "Data Scientist",
      avatar: "EJ",
      match_score: 84,
      summary: "Passed initial coding screen. Needs deeper evaluation on...",
      stage: "Interview",
      applied_time: "1 week ago",
    },
  ],
  Negotiation: [
    {
      id: "cand-006",
      name: "Robert Vance",
      role: "VP of Engineering",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80",
      match_score: 98,
      summary: "Offer sent out yesterday. Discussing equity structure and...",
      stage: "Negotiation",
      probability: 80,
      applied_time: "2 weeks ago",
    },
  ],
};

export const MOCK_JOBS: JobRequisition[] = [
  {
    id: "job-001",
    title: "Senior Backend Engineer",
    department: "Engineering",
    location: "Remote",
    status: "OPEN",
    posted_date: "Jan 15",
    candidates_count: 34,
    avatars: [
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80",
    ],
    top_match: {
      score: 95,
      label: "95 Top Match",
      last_run: "2h ago",
      status: "ACTIVE",
    },
    icon_type: "code",
    job_description:
      "We are seeking an experienced Senior Backend Engineer to join our core platform team. You will be responsible for designing, building, and maintaining scalable microservices that power our primary application.\n\nKey Responsibilities:\n• Architect high-performance APIs\n• Optimize database queries and schema design\n• Lead migration of legacy services to distributed cloud microservices",
    min_years_experience: 5.0,
    required_skills: ["Python", "FastAPI", "PostgreSQL", "Kubernetes", "AWS", "Go"],
  },
  {
    id: "job-002",
    title: "Data Platform Architect",
    department: "Data",
    location: "New York / Hybrid",
    status: "OPEN",
    posted_date: "Jan 12",
    candidates_count: 12,
    avatars: [
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
    ],
    top_match: {
      score: 91,
      label: "91 Top Match",
      last_run: "1d ago",
      status: "ACTIVE",
    },
    icon_type: "database",
    job_description:
      "Lead the modernization of our data lakehouse, real-time analytics streaming pipelines, and vector database infrastructure supporting enterprise AI applications.",
    min_years_experience: 7.0,
    required_skills: ["Apache Spark", "Kafka", "PostgreSQL", "Snowflake", "dbt", "Python"],
  },
  {
    id: "job-003",
    title: "Lead Product Designer",
    department: "Design",
    location: "London / Remote",
    status: "PAUSED",
    posted_date: "Dec 01",
    candidates_count: 8,
    avatars: [
      "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80",
    ],
    top_match: {
      score: 0,
      label: "Analysis Paused",
      last_run: "-",
      status: "PAUSED",
    },
    icon_type: "design",
    job_description:
      "Shape end-to-end user experiences for complex enterprise dashboards and intelligent analytics workflows. Define design systems and lead UX research.",
    min_years_experience: 6.0,
    required_skills: ["Figma", "Design Systems", "User Research", "Prototyping", "Design Ops"],
  },
];

export const MOCK_CANDIDATE_PRIYA: CandidateDetail = {
  id: "cand-001",
  name: "Priya Sharma",
  anonymized_name: "Candidate #7712",
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
  target_headline: "Senior Backend Engineer",
  role: "Senior Backend Engineer",
  location: "San Francisco, CA",
  email: "priya.s@example.com",
  phone: "(415) 555-0192",
  linkedin: "linkedin.com/in/priyas",
  status: "Interviewing",
  stage: "Interviewing",
  applied_date: "2 days ago",
  applied_for_job: "Senior Interface Designer",
  years_of_experience: 8.0,
  highest_education: "M.S. Computer Science, Stanford University",
  core_skills: ["Python", "Kubernetes", "PostgreSQL", "FastAPI", "AWS", "Go"],
  experience: [
    {
      role: "Staff Engineer",
      company: "Stripe",
      period: "2021 — Present",
      description:
        "Led core payments idempotency microservices and latency optimization for global transaction routing.",
    },
    {
      role: "Senior Engineer",
      company: "Uber",
      period: "2018 — 2021",
      description:
        "Designed real-time geospatial driver dispatch ingestion microservices with Go and Kafka.",
    },
  ],
  scorecard: {
    overall_match_score: 95,
    match_tier: "Exceptional Match",
    model_version: "Model gemma2:2b",
    evaluated_at: "Evaluated 2h ago",
    categories: [
      {
        name: "Technical Depth",
        score: 9.2,
        max_score: 10.0,
        quote:
          "Led migration of monolith to FastAPI microservices, reducing p99 latency by 40%. Implemented robust idempotency keys for distributed payments...",
        source_ref: "View source ¶12",
      },
      {
        name: "System Design",
        score: 8.5,
        max_score: 10.0,
        quote:
          "Strong evidence of distributed systems design, specifically regarding eventual consistency and partitioned PostgreSQL shards.",
        source_ref: "View source ¶8",
      },
      {
        name: "Leadership",
        score: 7.0,
        max_score: 10.0,
        quote:
          "Mentored 3 junior engineers. Solid team contributor, but less evidence of cross-functional strategic planning.",
        source_ref: "View source ¶19",
      },
    ],
    risk_flags: [
      "No explicit evidence of managing Kubernetes clusters at enterprise scale (mentions usage, not administration).",
    ],
    suggested_questions: [
      "Can you describe a specific time you had to debug a failing Kubernetes pod in production?",
      "How do you handle schema migrations across multiple deployed microservices?",
    ],
    team_notes: [
      {
        id: "note-1",
        author: "Alex Rivet",
        initials: "AR",
        role: "Admin",
        timestamp: "Yesterday at 2:14 PM",
        content:
          "Looks like a very strong technical fit. @Sarah can you drill into the Kubernetes experience during the system design loop?",
      },
    ],
  },
};

export const MOCK_ACTIVE_UPLOADS: ActiveUpload[] = [
  {
    id: "up-1",
    filename: "jdoe_resume_2024.pdf",
    taskId: "TSK-8829",
    statusLabel: "PROCESSING • 70%",
    progress: 70,
    currentStep: "LLM Extract",
  },
  {
    id: "up-2",
    filename: "asmith_cv_final.pdf",
    taskId: "TSK-8830",
    statusLabel: "SCRUBBING PII • 40%",
    progress: 40,
    currentStep: "PII Scrub",
  },
];

export const MOCK_COMPLETED_UPLOADS: CompletedUpload[] = [
  {
    id: "comp-1",
    filename: "mjohnson_marketing.pdf",
    taskId: "TSK-8828",
    duration: "12.4s",
    candidateId: "cand-001",
  },
];

export const MOCK_ISSUES: UploadIssue[] = [
  {
    id: "iss-1",
    filename: "corrupt.pdf",
    status: "retrying",
    message: "Retrying... attempt 2/5",
    attempt: "2/5",
    nextRetryIn: "8s",
  },
  {
    id: "iss-2",
    filename: "scan_issue.pdf",
    status: "failed",
    message: "Failed after 5 attempts. Unreadable text layer.",
    attempt: "5/5",
  },
];
