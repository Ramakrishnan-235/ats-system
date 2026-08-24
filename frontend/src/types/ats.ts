export interface StatMetric {
  id: string;
  label: string;
  value: string;
  unit?: string;
  change: string;
  trend: "positive" | "negative" | "neutral";
  icon: string;
  style: "default" | "highlighted_dark";
}

export interface WeeklyData {
  week: string;
  count: number;
  is_peak?: boolean;
}

export interface AIMatchRate {
  rate: number;
  precision_label: string;
  matched_percent: number;
  not_matched_percent: number;
}

export interface PipelineCandidateItem {
  id: string;
  name: string;
  role: string;
  avatar: string;
  match_score: number;
  summary: string;
  stage: "Contacted" | "Interview" | "Negotiation" | "Offered" | "Rejected";
  probability?: number | null;
  applied_time: string;
}

export interface CriteriaWeights {
  technical_depth: number;
  system_design: number;
  experience_seniority: number;
  leadership_culture: number;
  domain_expertise: number;
}

export interface CriteriaScoreMap {
  technical_depth: number;
  system_design: number;
  experience_seniority: number;
  leadership_culture: number;
  domain_expertise: number;
}

export interface JobRequisition {
  id: string;
  title: string;
  department: string;
  location: string;
  status: "OPEN" | "PAUSED" | "CLOSED";
  posted_date: string;
  candidates_count: number;
  avatars: string[];
  top_match: {
    score: number;
    label: string;
    last_run: string;
    status: "ACTIVE" | "PAUSED";
  };
  icon_type:
    | "code"
    | "database"
    | "design"
    | "product"
    | "ai"
    | "cloud"
    | "security"
    | "qa"
    | "leadership"
    | "emerging";
  job_description: string;
  min_years_experience: number;
  required_skills: string[];
  structured_criteria?: Record<string, number>;
  criteria_weights?: CriteriaWeights;
  created_at?: string;
  updated_at?: string;
}

export interface ExperienceItem {
  role: string;
  company: string;
  period: string;
  description: string;
}

export interface ScorecardCategory {
  name: string;
  score: number;
  max_score: number;
  quote?: string;
  source_ref?: string;
}

export interface TeamNote {
  id: string;
  author: string;
  initials: string;
  role: string;
  timestamp: string;
  content: string;
}

export interface CandidateDetail {
  id: string;
  name: string;
  anonymized_name: string;
  avatar: string;
  target_headline: string;
  role: string;
  location: string;
  email: string;
  phone: string;
  linkedin: string;
  status: string;
  stage: string;
  applied_date: string;
  applied_for_job: string;
  applied_for_job_id?: string;
  years_of_experience: number;
  highest_education: string;
  core_skills: string[];
  criteriaScores?: CriteriaScoreMap;
  experience: ExperienceItem[];
  scorecard: {
    overall_match_score: number;
    match_tier: string;
    model_version: string;
    evaluated_at: string;
    criteria_scores?: CriteriaScoreMap;
    categories: ScorecardCategory[];
    risk_flags: string[];
    suggested_improvements?: string[];
    suggested_questions: string[];
    team_notes: TeamNote[];
  };
  raw_text?: string;
}

export interface RankedCandidate {
  id: string;
  rank: number;
  previousRank?: number;
  rankDelta?: number;
  name: string;
  headline: string;
  avatar: string;
  isImageAvatar: boolean;
  matchScore: number;
  matchScoreExact?: number;
  matchLabel?: string;
  skills: string[];
  stage: string;
  stageBadgeStyle?: string;
  technicalDepthScore?: number;
  systemDesignScore?: number;
  criteriaScores?: CriteriaScoreMap;
  quote?: string;
  sourceResumeLink?: string;
  potentialGap?: string;
  suggestedImprovements?: string[];
  suggestedQuestions?: string[];
  jobId?: string;
}


export interface ActiveUpload {
  id: string;
  filename: string;
  taskId: string;
  statusLabel: string;
  progress: number;
  currentStep: "Parsing" | "PII Scrub" | "LLM Extract" | "Indexing" | "Done";
}

export interface CompletedUpload {
  id: string;
  filename: string;
  taskId: string;
  duration: string;
  candidateId: string;
}

export interface UploadIssue {
  id: string;
  filename: string;
  status: "retrying" | "failed";
  message: string;
  attempt?: string;
  nextRetryIn?: string;
}
