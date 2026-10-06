package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"ats-core-go/internal/models"
	"ats-core-go/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type JobsHandler struct {
	store *store.Store
}

func NewJobsHandler(st *store.Store) *JobsHandler {
	return &JobsHandler{store: st}
}

func (h *JobsHandler) ListJobs(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	dept := r.URL.Query().Get("department")
	search := r.URL.Query().Get("search")

	jobs := h.store.ListJobs(status, dept, search)
	w.Header().Set("Content-Type", "application/json")
	if jobs == nil {
		jobs = []*models.Job{}
	}
	json.NewEncoder(w).Encode(jobs)
}

func (h *JobsHandler) GetJob(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "job_id")
	job, ok := h.store.GetJob(id)
	if !ok {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(job)
}

type CreateJobPayload struct {
	Title              string   `json:"title"`
	Department         string   `json:"department"`
	Location           string   `json:"location"`
	JobDescription     string   `json:"job_description"`
	RequiredSkills     []string `json:"required_skills"`
	MinYearsExperience float64  `json:"min_years_experience"`
	RunAIMatch         bool     `json:"run_ai_match"`
}

func (h *JobsHandler) CreateJob(w http.ResponseWriter, r *http.Request) {
	var payload CreateJobPayload
	if !decodeJSON(w, r, &payload) {
		return
	}

	newID := fmt.Sprintf("job-%s", uuid.New().String()[:8])
	nowStr := time.Now().UTC().Format("2006-01-02")
	nowISO := time.Now().UTC().Format(time.RFC3339)

	payload.Title = strings.TrimSpace(payload.Title)
	if payload.Title == "" || strings.TrimSpace(payload.JobDescription) == "" || payload.MinYearsExperience < 0 {
		writeError(w, http.StatusBadRequest, "Title, job description, and non-negative experience are required")
		return
	}
	if payload.RunAIMatch {
		writeError(w, http.StatusBadRequest, "Use the match endpoint to run evaluations")
		return
	}
	if payload.RequiredSkills == nil {
		payload.RequiredSkills = []string{}
	}
	deptLower := strings.ToLower(payload.Department)
	iconType := "code"
	if strings.Contains(deptLower, "ai") || strings.Contains(deptLower, "machine learning") {
		iconType = "ai"
	} else if strings.Contains(deptLower, "cloud") || strings.Contains(deptLower, "infrastructure") {
		iconType = "cloud"
	} else if strings.Contains(deptLower, "security") {
		iconType = "security"
	}

	job := &models.Job{
		ID:              newID,
		Title:           payload.Title,
		Department:      payload.Department,
		Location:        payload.Location,
		Status:          "OPEN",
		PostedDate:      nowStr,
		CandidatesCount: 0,
		Avatars:         []string{},
		TopMatch: models.TopMatchInfo{
			Score:   nil,
			Label:   "Pending Match",
			LastRun: "-",
			Status:  "PENDING",
		},
		IconType:           iconType,
		JobDescription:     payload.JobDescription,
		MinYearsExperience: payload.MinYearsExperience,
		RequiredSkills:     payload.RequiredSkills,
		StructuredCriteria: models.StructuredCriteria{
			TechnicalDepthWeight:  0.4,
			DomainExpertiseWeight: 0.4,
			ExecutionWeight:       0.2,
		},
		CreatedAt: nowISO,
		UpdatedAt: nowISO,
	}

	h.store.SaveJob(job)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(job)
}

func (h *JobsHandler) UpdateJob(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "job_id")
	_, ok := h.store.GetJob(id)
	if !ok {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}

	var updates struct {
		Title              *string   `json:"title"`
		Department         *string   `json:"department"`
		Location           *string   `json:"location"`
		JobDescription     *string   `json:"job_description"`
		RequiredSkills     *[]string `json:"required_skills"`
		MinYearsExperience *float64  `json:"min_years_experience"`
	}
	if !decodeJSON(w, r, &updates) {
		return
	}
	if (updates.Title != nil && strings.TrimSpace(*updates.Title) == "") || (updates.JobDescription != nil && strings.TrimSpace(*updates.JobDescription) == "") || (updates.MinYearsExperience != nil && *updates.MinYearsExperience < 0) {
		writeError(w, http.StatusBadRequest, "Invalid job fields")
		return
	}
	if updates.Title != nil {
		title := strings.TrimSpace(*updates.Title)
		updates.Title = &title
	}
	job, ok := h.store.UpdateJob(id, store.JobUpdate{Title: updates.Title, Department: updates.Department, Location: updates.Location, JobDescription: updates.JobDescription, RequiredSkills: updates.RequiredSkills, MinYearsExperience: updates.MinYearsExperience})
	if !ok {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(job)
}

func (h *JobsHandler) UpdateJobStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "job_id")
	newStatus := r.URL.Query().Get("new_status")
	if newStatus == "" {
		newStatus = r.URL.Query().Get("status")
	}
	if newStatus == "" {
		writeError(w, http.StatusBadRequest, "Missing new_status")
		return
	}

	newStatus = strings.ToUpper(newStatus)
	if newStatus != "OPEN" && newStatus != "CLOSED" && newStatus != "DRAFT" && newStatus != "PAUSED" {
		writeError(w, http.StatusBadRequest, "Invalid job status")
		return
	}
	job, ok := h.store.UpdateJobStatus(id, newStatus)
	if !ok {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(job)
}

func (h *JobsHandler) GetJobCandidates(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "job_id")
	includePII := strings.ToLower(r.URL.Query().Get("include_pii")) == "true"
	user := GetUserIdentity(r)
	if includePII {
		if !user.CanViewPII() {
			h.store.RecordAuditLog(&models.AuditLogEntry{
				ActorID:      user.UserID,
				ActorRole:    string(user.Role),
				Action:       "VIEW_JOB_CANDIDATES_PII_DENIED",
				ResourceType: "job_candidates",
				ResourceID:   jobID,
				Decision:     "DENIED",
				Details:      "Role unauthorized to view personal data (PII)",
				IPAddress:    r.RemoteAddr,
				UserAgent:    r.UserAgent(),
			})
			writeError(w, http.StatusForbidden, "Forbidden: role unauthorized to view personal data (PII)")
			return
		}
		h.store.RecordAuditLog(&models.AuditLogEntry{
			ActorID:      user.UserID,
			ActorRole:    string(user.Role),
			Action:       "VIEW_JOB_CANDIDATES_PII",
			ResourceType: "job_candidates",
			ResourceID:   jobID,
			Decision:     "ALLOWED",
			Details:      "Authorized job candidates unmasked PII access",
			IPAddress:    r.RemoteAddr,
			UserAgent:    r.UserAgent(),
		})
	}

	if _, ok := h.store.GetJob(jobID); !ok {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}
	candidates := h.store.GetJobCandidates(jobID, includePII)
	w.Header().Set("Content-Type", "application/json")
	if candidates == nil {
		candidates = []*models.JobCandidate{}
	}
	json.NewEncoder(w).Encode(candidates)
}

func (h *JobsHandler) AddJobCandidate(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "job_id")
	includePII := strings.ToLower(r.URL.Query().Get("include_pii")) == "true"
	user := GetUserIdentity(r)
	if includePII {
		if !user.CanViewPII() {
			h.store.RecordAuditLog(&models.AuditLogEntry{
				ActorID:      user.UserID,
				ActorRole:    string(user.Role),
				Action:       "ADD_JOB_CANDIDATE_PII_DENIED",
				ResourceType: "job_candidates",
				ResourceID:   jobID,
				Decision:     "DENIED",
				Details:      "Role unauthorized to view personal data (PII)",
				IPAddress:    r.RemoteAddr,
				UserAgent:    r.UserAgent(),
			})
			writeError(w, http.StatusForbidden, "Forbidden: role unauthorized to view personal data (PII)")
			return
		}
		h.store.RecordAuditLog(&models.AuditLogEntry{
			ActorID:      user.UserID,
			ActorRole:    string(user.Role),
			Action:       "ADD_JOB_CANDIDATE_PII",
			ResourceType: "job_candidates",
			ResourceID:   jobID,
			Decision:     "ALLOWED",
			Details:      "Authorized add job candidate with unmasked PII",
			IPAddress:    r.RemoteAddr,
			UserAgent:    r.UserAgent(),
		})
	}

	var jc models.JobCandidate
	if !decodeJSON(w, r, &jc) {
		return
	}

	job, ok := h.store.GetJob(jobID)
	if !ok {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}
	candidate, ok := h.store.GetCandidate(jc.ID, true)
	if !ok {
		writeError(w, http.StatusNotFound, "Candidate not found")
		return
	}
	jc.Avatar = candidate.Avatar
	jc.IsImageAvatar = candidate.IsImageAvatar
	jc.SourceResumeLink = fmt.Sprintf("/candidates/%s", jc.ID)
	jc.Name = candidate.Name
	jc.Headline = candidate.TargetHeadline
	jc.Skills = candidate.CoreSkills
	jobTitleLower := strings.ToLower(job.Title)
	appliedJobLower := strings.ToLower(candidate.AppliedForJob)
	matchesJob := candidate.AppliedForJobID == "" || candidate.AppliedForJobID == jobID || (jobTitleLower != "" && strings.Contains(appliedJobLower, jobTitleLower))
	if candidate.Scorecard.EvaluationStatus == "COMPLETED" && matchesJob {
		if candidate.Scorecard.OverallMatchScore != nil {
			val := int(*candidate.Scorecard.OverallMatchScore)
			jc.MatchScore = &val
		}
		jc.MatchLabel = candidate.Scorecard.MatchTier
		for _, cat := range candidate.Scorecard.Categories {
			catLower := strings.ToLower(cat.Name)
			if strings.Contains(catLower, "technical") && jc.TechnicalDepthScore == nil {
				score := cat.Score
				jc.TechnicalDepthScore = &score
			} else if strings.Contains(catLower, "system") && jc.SystemDesignScore == nil {
				score := cat.Score
				jc.SystemDesignScore = &score
			}
			if jc.Quote == "" && cat.Quote != "" {
				jc.Quote = cat.Quote
			}
		}
	} else {
		jc.MatchScore = nil
		jc.MatchLabel = "Not Evaluated"
		jc.TechnicalDepthScore = nil
		jc.SystemDesignScore = nil
		jc.Quote = ""
	}
	if jc.Stage != "" && !validStage(jc.Stage) {
		writeError(w, http.StatusBadRequest, "Invalid candidate stage")
		return
	}
	if jc.Avatar == "" {
		jc.Avatar = "CD"
	}
	if jc.SourceResumeLink == "" {
		jc.SourceResumeLink = fmt.Sprintf("/candidates/%s", jc.ID)
	}
	if jc.Stage == "" {
		jc.Stage = "Screening"
	}
	if jc.StageBadgeStyle == "" {
		jc.StageBadgeStyle = "bg-zinc-100 text-zinc-700"
	}
	if candidate.AppliedForJobID == "" {
		candidate.AppliedForJobID = jobID
		if candidate.AppliedForJob == "" {
			candidate.AppliedForJob = job.Title
		}
		h.store.SaveCandidate(candidate)
	}

	updated := h.store.AddJobCandidate(jobID, &jc)
	w.Header().Set("Content-Type", "application/json")
	if !includePII {
		candidates := h.store.GetJobCandidates(jobID, false)
		json.NewEncoder(w).Encode(candidates)
		return
	}
	json.NewEncoder(w).Encode(updated)
}

func (h *JobsHandler) RemoveJobCandidate(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "job_id")
	candID := chi.URLParam(r, "candidate_id")
	includePII := strings.ToLower(r.URL.Query().Get("include_pii")) == "true"
	user := GetUserIdentity(r)
	if includePII {
		if !user.CanViewPII() {
			h.store.RecordAuditLog(&models.AuditLogEntry{
				ActorID:      user.UserID,
				ActorRole:    string(user.Role),
				Action:       "REMOVE_JOB_CANDIDATE_PII_DENIED",
				ResourceType: "job_candidates",
				ResourceID:   jobID,
				Decision:     "DENIED",
				Details:      "Role unauthorized to view personal data (PII)",
				IPAddress:    r.RemoteAddr,
				UserAgent:    r.UserAgent(),
			})
			writeError(w, http.StatusForbidden, "Forbidden: role unauthorized to view personal data (PII)")
			return
		}
		h.store.RecordAuditLog(&models.AuditLogEntry{
			ActorID:      user.UserID,
			ActorRole:    string(user.Role),
			Action:       "REMOVE_JOB_CANDIDATE_PII",
			ResourceType: "job_candidates",
			ResourceID:   jobID,
			Decision:     "ALLOWED",
			Details:      "Authorized remove job candidate with unmasked PII",
			IPAddress:    r.RemoteAddr,
			UserAgent:    r.UserAgent(),
		})
	}

	if _, ok := h.store.GetJob(jobID); !ok {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}
	found := false
	for _, candidate := range h.store.GetJobCandidates(jobID, true) {
		if candidate.ID == candID {
			found = true
			break
		}
	}
	if !found {
		writeError(w, http.StatusNotFound, "Candidate not found on job")
		return
	}
	updated := h.store.RemoveJobCandidate(jobID, candID)
	w.Header().Set("Content-Type", "application/json")
	if !includePII {
		candidates := h.store.GetJobCandidates(jobID, false)
		json.NewEncoder(w).Encode(candidates)
		return
	}
	json.NewEncoder(w).Encode(updated)
}

func (h *JobsHandler) UpdateJobCandidateStage(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "job_id")
	candID := chi.URLParam(r, "candidate_id")
	newStage := r.URL.Query().Get("new_stage")
	if !validStage(newStage) {
		writeError(w, http.StatusBadRequest, "Missing new_stage")
		return
	}

	jc, ok := h.store.UpdateJobCandidateStage(jobID, candID, newStage)
	if !ok {
		writeError(w, http.StatusNotFound, "Candidate not found on job")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	candidates := h.store.GetJobCandidates(jobID, false)
	for _, candidate := range candidates {
		if candidate.ID == jc.ID {
			json.NewEncoder(w).Encode(candidate)
			return
		}
	}
	writeError(w, http.StatusNotFound, "Candidate not found on job")
}
