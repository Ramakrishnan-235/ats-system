package models

import "time"

// CategoryScore represents one criterion in the candidate scorecard
type CategoryScore struct {
	Name      string  `json:"name"`
	Score     float64 `json:"score"`
	MaxScore  float64 `json:"max_score"`
	Quote     string  `json:"quote,omitempty"`
	SourceRef string  `json:"source_ref,omitempty"`
}

// Note represents an evaluator/recruiter team note
type Note struct {
	ID        string `json:"id"`
	Author    string `json:"author"`
	Initials  string `json:"initials"`
	Role      string `json:"role"`
	Timestamp string `json:"timestamp"`
	Content   string `json:"content"`
}

// Scorecard represents the structured evaluation scorecard
type Scorecard struct {
	OverallMatchScore     *float64        `json:"overall_match_score"`
	MatchTier             string          `json:"match_tier"`
	EvaluationStatus      string          `json:"evaluation_status"`
	ModelVersion          string          `json:"model_version,omitempty"`
	EvaluatedAt           string          `json:"evaluated_at,omitempty"`
	Categories            []CategoryScore `json:"categories"`
	RiskFlags             []string        `json:"risk_flags"`
	KeyStrengths          []string        `json:"key_strengths"`
	SuggestedImprovements []string        `json:"suggested_improvements"`
	SuggestedQuestions    []string        `json:"suggested_questions"`
	TeamNotes             []Note          `json:"team_notes"`
}

// Candidate represents a candidate profile
type Candidate struct {
	ID                string    `json:"id"`
	Name              string    `json:"name"`
	AnonymizedName    string    `json:"anonymized_name"`
	Avatar            string    `json:"avatar"`
	IsImageAvatar     bool      `json:"isImageAvatar"`
	TargetHeadline    string    `json:"target_headline"`
	Role              string    `json:"role"`
	Status            string    `json:"status"`
	Stage             string    `json:"stage"`
	AppliedDate       string    `json:"applied_date"`
	CreatedAt         string    `json:"created_at"`
	AppliedForJob     string    `json:"applied_for_job"`
	AppliedForJobID   string    `json:"applied_for_job_id,omitempty"`
	YearsOfExperience *float64  `json:"years_of_experience"`
	CoreSkills        []string  `json:"core_skills"`
	Experience        []any     `json:"experience"`
	Scorecard         Scorecard `json:"scorecard"`
	Email             string    `json:"email"`
	Phone             string    `json:"phone"`
	Location          string    `json:"location"`
	LinkedIn          string    `json:"linkedin"`
	HighestEducation  string    `json:"highest_education"`
	IsPIIMasked       bool      `json:"is_pii_masked"`
	ResumeFilename    string    `json:"resume_filename,omitempty"`
	RawText           string    `json:"raw_text,omitempty"`
}

// TopMatchInfo represents the top match summary for a job
type TopMatchInfo struct {
	Score   *int   `json:"score"`
	Label   string `json:"label"`
	LastRun string `json:"last_run"`
	Status  string `json:"status"`
}

// StructuredCriteria holds evaluation weights for a job
type StructuredCriteria struct {
	TechnicalDepthWeight  float64 `json:"technical_depth_weight"`
	DomainExpertiseWeight float64 `json:"domain_expertise_weight"`
	ExecutionWeight       float64 `json:"execution_weight"`
}

// Job represents a job posting / requisition
type Job struct {
	ID                 string             `json:"id"`
	Title              string             `json:"title"`
	Department         string             `json:"department"`
	Location           string             `json:"location"`
	Status             string             `json:"status"`
	PostedDate         string             `json:"posted_date"`
	CandidatesCount    int                `json:"candidates_count"`
	Avatars            []string           `json:"avatars"`
	TopMatch           TopMatchInfo       `json:"top_match"`
	IconType           string             `json:"icon_type"`
	JobDescription     string             `json:"job_description"`
	MinYearsExperience float64            `json:"min_years_experience"`
	RequiredSkills     []string           `json:"required_skills"`
	StructuredCriteria StructuredCriteria `json:"structured_criteria"`
	CreatedAt          string             `json:"created_at"`
	UpdatedAt          string             `json:"updated_at"`
}

// JobCandidate represents a candidate associated with a specific job
type JobCandidate struct {
	ID                  string   `json:"id"`
	Rank                int      `json:"rank"`
	Name                string   `json:"name"`
	Headline            string   `json:"headline"`
	Avatar              string   `json:"avatar"`
	IsImageAvatar       bool     `json:"isImageAvatar"`
	MatchScore          *int     `json:"matchScore"`
	MatchLabel          string   `json:"matchLabel,omitempty"`
	Skills              []string `json:"skills"`
	Stage               string   `json:"stage"`
	StageBadgeStyle     string   `json:"stageBadgeStyle"`
	TechnicalDepthScore *float64 `json:"technicalDepthScore"`
	SystemDesignScore   *float64 `json:"systemDesignScore"`
	Quote               string   `json:"quote"`
	SourceResumeLink    string   `json:"sourceResumeLink"`
	PotentialGap        string   `json:"potentialGap,omitempty"`
	SuggestedQuestions  []string `json:"suggestedQuestions,omitempty"`
}

// UploadTask represents an asynchronous processing task
type UploadTask struct {
	TaskID        string         `json:"task_id"`
	State         string         `json:"state"` // PENDING, PROGRESS, SUCCESS, FAILURE
	ExecutionMode string         `json:"execution_mode"`
	Progress      int            `json:"progress,omitempty"`
	Step          string         `json:"step,omitempty"`
	Error         string         `json:"error,omitempty"`
	Result        map[string]any `json:"result,omitempty"`
}

// LocateCitationRequest
type LocateCitationRequest struct {
	SearchPhrase string `json:"search_phrase"`
	Filename     string `json:"filename,omitempty"`
}

// PDFLocation holds citation bounding box info
type PDFLocation struct {
	PageNumber int       `json:"page_number"`
	BBox       []float64 `json:"bbox"` // [x0, y0, x1, y1]
	Snippet    string    `json:"snippet"`
}

// Dashboard models
type StatCard struct {
	ID     string `json:"id"`
	Label  string `json:"label"`
	Value  string `json:"value"`
	Change string `json:"change"`
	Trend  string `json:"trend"` // positive, negative, neutral
	Icon   string `json:"icon"`
	Style  string `json:"style"` // default or highlighted_dark
	Unit   string `json:"unit,omitempty"`
}

type WeeklyVolume struct {
	Week   string `json:"week"`
	Count  int    `json:"count"`
	IsPeak bool   `json:"is_peak"`
}

type PipelineCandidate struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Role        string `json:"role"`
	Avatar      string `json:"avatar"`
	MatchScore  *int   `json:"match_score"`
	Summary     string `json:"summary"`
	Stage       string `json:"stage"`
	Probability *int   `json:"probability"`
	AppliedTime string `json:"applied_time"`
}

type DashboardStatsResponse struct {
	Stats             []StatCard                     `json:"stats"`
	WeeklyCandidates  []WeeklyVolume                 `json:"weekly_candidates"`
	AIMatchRate       map[string]any                 `json:"ai_match_rate"`
	ProcessingResumes int                            `json:"processing_resumes"`
	TodayEvaluations  int                            `json:"today_evaluations"`
	Pipeline          map[string][]PipelineCandidate `json:"pipeline"`
}

// Taxonomy models
type TaxonomySkill struct {
	ID              string   `json:"id"`
	CanonicalName   string   `json:"canonical_name"`
	Category        string   `json:"category"`
	Aliases         []string `json:"aliases"`
	IsAmbiguous     bool     `json:"is_ambiguous"`
	Status          string   `json:"status"` // approved, pending, rejected
	Source          string   `json:"source"`
	OccurrenceCount int      `json:"occurrence_count"`
	TaxonomyVersion string   `json:"taxonomy_version"`
	CreatedAt       string   `json:"created_at"`
	UpdatedAt       string   `json:"updated_at"`
}

func NowUTC() string {
	return time.Now().UTC().Format(time.RFC3339)
}
