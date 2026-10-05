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
		http.Error(w, `{"detail": "Job not found"}`, http.StatusNotFound)
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
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"detail": "Invalid JSON"}`, http.StatusBadRequest)
		return
	}

	newID := fmt.Sprintf("job-%s", uuid.New().String()[:8])
	nowStr := time.Now().UTC().Format("2006-01-02")
	nowISO := time.Now().UTC().Format(time.RFC3339)

	if len(payload.RequiredSkills) == 0 {
		commonKeywords := []string{"Go", "Python", "PostgreSQL", "Docker", "Kubernetes", "AWS", "React", "TypeScript"}
		for _, kw := range commonKeywords {
			if strings.Contains(strings.ToLower(payload.JobDescription), strings.ToLower(kw)) {
				payload.RequiredSkills = append(payload.RequiredSkills, kw)
			}
		}
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
		ID:                 newID,
		Title:              payload.Title,
		Department:         payload.Department,
		Location:           payload.Location,
		Status:             "OPEN",
		PostedDate:         nowStr,
		CandidatesCount:    0,
		Avatars:            []string{},
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
	job, ok := h.store.GetJob(id)
	if !ok {
		http.Error(w, `{"detail": "Job not found"}`, http.StatusNotFound)
		return
	}

	var updates map[string]any
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, `{"detail": "Invalid JSON"}`, http.StatusBadRequest)
		return
	}

	if title, ok := updates["title"].(string); ok && title != "" {
		job.Title = title
	}
	if dept, ok := updates["department"].(string); ok && dept != "" {
		job.Department = dept
	}
	if loc, ok := updates["location"].(string); ok && loc != "" {
		job.Location = loc
	}
	if desc, ok := updates["job_description"].(string); ok && desc != "" {
		job.JobDescription = desc
	}
	job.UpdatedAt = models.NowUTC()
	h.store.SaveJob(job)

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
		http.Error(w, `{"detail": "Missing new_status"}`, http.StatusBadRequest)
		return
	}

	job, ok := h.store.UpdateJobStatus(id, strings.ToUpper(newStatus))
	if !ok {
		http.Error(w, `{"detail": "Job not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(job)
}

func (h *JobsHandler) GetJobCandidates(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "job_id")
	includePII := strings.ToLower(r.URL.Query().Get("include_pii")) == "true"

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

	var jc models.JobCandidate
	if err := json.NewDecoder(r.Body).Decode(&jc); err != nil {
		http.Error(w, `{"detail": "Invalid JSON"}`, http.StatusBadRequest)
		return
	}

	if jc.ID == "" {
		jc.ID = fmt.Sprintf("cand-%s", uuid.New().String()[:12])
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
	if newStage == "" {
		http.Error(w, `{"detail": "Missing new_stage"}`, http.StatusBadRequest)
		return
	}

	jc, ok := h.store.UpdateJobCandidateStage(jobID, candID, newStage)
	if !ok {
		http.Error(w, `{"detail": "Candidate not found on job"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(jc)
}
