package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"ats-core-go/internal/config"
	"ats-core-go/internal/models"
	"ats-core-go/internal/services"
	"ats-core-go/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type candidateEvaluator interface {
	EvaluateCandidate(context.Context, string, string) (*models.Scorecard, error)
}
type resumeParser interface {
	ExtractText([]byte) (string, error)
	LocateCitation([]byte, string) *models.PDFLocation
}

type CandidatesHandler struct {
	store     *store.Store
	evaluator candidateEvaluator
	parser    resumeParser
	cfg       *config.Config
}

func NewCandidatesHandler(st *store.Store, eval *services.LLMEvaluator, parser *services.PDFParser, cfg *config.Config) *CandidatesHandler {
	return &CandidatesHandler{store: st, evaluator: eval, parser: parser, cfg: cfg}
}
func (h *CandidatesHandler) ListCandidates(w http.ResponseWriter, r *http.Request) {
	candidates := h.store.ListCandidates(r.URL.Query().Get("search"), r.URL.Query().Get("stage"), r.URL.Query().Get("skill"), r.URL.Query().Get("include_pii") == "true")
	if candidates == nil {
		candidates = []*models.Candidate{}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(candidates)
}
func (h *CandidatesHandler) GetCandidate(w http.ResponseWriter, r *http.Request) {
	cand, ok := h.store.GetCandidate(chi.URLParam(r, "candidate_id"), r.URL.Query().Get("include_pii") == "true")
	if !ok {
		writeError(w, http.StatusNotFound, "Candidate not found")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(cand)
}
func (h *CandidatesHandler) GetScorecard(w http.ResponseWriter, r *http.Request) {
	cand, ok := h.store.GetCandidate(chi.URLParam(r, "candidate_id"), false)
	if !ok {
		writeError(w, http.StatusNotFound, "Candidate not found")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(cand.Scorecard)
}

type NoteRequest struct {
	Content string `json:"content"`
	Author  string `json:"author"`
}

func (h *CandidatesHandler) AddNote(w http.ResponseWriter, r *http.Request) {
	var req NoteRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if strings.TrimSpace(req.Content) == "" {
		writeError(w, http.StatusBadRequest, "Note content is required")
		return
	}
	if req.Author == "" {
		req.Author = "Recruiter"
	}
	note, err := h.store.AddCandidateNote(chi.URLParam(r, "candidate_id"), req.Author, req.Content)
	if err != nil {
		writeError(w, http.StatusNotFound, "Candidate not found")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(note)
}
func (h *CandidatesHandler) UpdateStage(w http.ResponseWriter, r *http.Request) {
	id, stage := chi.URLParam(r, "candidate_id"), r.URL.Query().Get("new_stage")
	if !validStage(stage) {
		writeError(w, http.StatusBadRequest, "Invalid candidate stage")
		return
	}
	if !h.store.UpdateCandidateStage(id, stage) {
		writeError(w, http.StatusNotFound, "Candidate not found")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "SUCCESS", "candidate_id": id, "stage": stage})
}

var uploadSlots = make(chan struct{}, 8)

// UploadResumeAsync validates and persists a bounded PDF before starting processing.
// Tasks and profiles are process-local; a restart cannot resume this work.
func (h *CandidatesHandler) UploadResumeAsync(w http.ResponseWriter, r *http.Request) {
	select {
	case uploadSlots <- struct{}{}:
	default:
		writeError(w, http.StatusTooManyRequests, "Upload processing capacity is full")
		return
	}
	transferred := false
	defer func() {
		if !transferred {
			<-uploadSlots
		}
	}()
	limit := h.cfg.MaxUploadBytes
	if limit <= 0 {
		limit = 10 << 20
	}
	r.Body = http.MaxBytesReader(w, r.Body, limit+(1<<20))
	if err := r.ParseMultipartForm(1 << 20); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeError(w, http.StatusRequestEntityTooLarge, "Upload exceeds size limit")
		} else {
			writeError(w, http.StatusBadRequest, "Invalid multipart form")
		}
		return
	}
	defer r.MultipartForm.RemoveAll()
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "No resume file provided")
		return
	}
	defer file.Close()
	filename := filepath.Base(strings.ReplaceAll(header.Filename, "\\", "/"))
	if !strings.EqualFold(filepath.Ext(filename), ".pdf") {
		writeError(w, http.StatusBadRequest, "A PDF file is required")
		return
	}
	data, err := io.ReadAll(io.LimitReader(file, limit+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Failed to read upload")
		return
	}
	if int64(len(data)) > limit {
		writeError(w, http.StatusRequestEntityTooLarge, "PDF exceeds size limit")
		return
	}
	if len(data) < 5 || string(data[:5]) != "%PDF-" {
		writeError(w, http.StatusBadRequest, "Invalid PDF signature")
		return
	}
	jobID := r.FormValue("job_id")
	var job *models.Job
	if jobID != "" {
		var ok bool
		job, ok = h.store.GetJob(jobID)
		if !ok {
			writeError(w, http.StatusNotFound, "Job not found")
			return
		}
	}
	candidateID, taskID := "cand-"+uuid.New().String(), uuid.New().String()
	pdfPath := filepath.Join(h.cfg.UploadDir, candidateID+".pdf")
	output, err := os.OpenFile(pdfPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Unable to persist PDF")
		return
	}
	_, writeErr := output.Write(data)
	closeErr := output.Close()
	if writeErr != nil || closeErr != nil {
		_ = os.Remove(pdfPath)
		writeError(w, http.StatusInternalServerError, "Unable to persist PDF")
		return
	}
	h.store.SaveTask(&models.UploadTask{TaskID: taskID, State: "PROGRESS", ExecutionMode: "async_goroutine", Step: "Extracting PDF"})
	transferred = true
	go func() {
		defer func() { <-uploadSlots }()
		h.processUpload(taskID, candidateID, filename, pdfPath, data, job)
	}()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(map[string]any{"status": "ACCEPTED", "task_id": taskID, "candidate_id": candidateID, "filename": filename, "job_id": jobID, "execution_mode": "async_goroutine", "evaluation_status": "PROCESSING"})
}
func (h *CandidatesHandler) processUpload(taskID, candidateID, filename, pdfPath string, data []byte, job *models.Job) {
	complete := false
	defer func() {
		if recovered := recover(); recovered != nil {
			log.Printf("Upload processing panic for task %s", taskID)
		}
		if !complete {
			_ = os.Remove(pdfPath)
			h.store.SaveTask(&models.UploadTask{TaskID: taskID, State: "FAILURE", ExecutionMode: "async_goroutine", Error: "Resume processing failed"})
		}
	}()
	text, err := h.parser.ExtractText(data)
	if err != nil || strings.TrimSpace(text) == "" {
		return
	}
	scorecard := &models.Scorecard{EvaluationStatus: "PENDING", MatchTier: "Not Evaluated", Categories: []models.CategoryScore{}, TeamNotes: []models.Note{}}
	if job != nil {
		h.store.SaveTask(&models.UploadTask{TaskID: taskID, State: "PROGRESS", Progress: 40, Step: "Evaluating Match", ExecutionMode: "async_goroutine"})
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		name := strings.TrimSuffix(filename, filepath.Ext(filename))
		normalizedName := strings.NewReplacer("_", " ", "-", " ").Replace(name)
		summary := services.RedactKnownPII(text, name, normalizedName)
		scorecard, err = h.evaluator.EvaluateCandidate(ctx, summary, job.JobDescription)
		if err != nil || scorecard == nil {
			return
		}
	}
	name := strings.TrimSuffix(filename, filepath.Ext(filename))
	anonymous := "Candidate #" + candidateID[len(candidateID)-6:]
	candidate := &models.Candidate{ID: candidateID, Name: name, AnonymizedName: anonymous, Avatar: "CD", Stage: "Screening", Status: "Screening", CreatedAt: models.NowUTC(), AppliedDate: time.Now().UTC().Format("2006-01-02"), CoreSkills: []string{}, Experience: []any{}, Scorecard: *scorecard, ResumeFilename: filename, RawText: text}
	if job != nil {
		candidate.AppliedForJob = job.Title
		candidate.AppliedForJobID = job.ID
	}
	h.store.SaveCandidate(candidate)
	if job != nil {
		var score *int
		if scorecard.OverallMatchScore != nil {
			value := int(*scorecard.OverallMatchScore)
			score = &value
		}
		h.store.AddJobCandidate(job.ID, &models.JobCandidate{ID: candidateID, Name: name, Avatar: "CD", MatchScore: score, MatchLabel: scorecard.MatchTier, Skills: []string{}, Stage: "Screening", SourceResumeLink: fmt.Sprintf("/candidates/%s", candidateID)})
	}
	h.store.SaveTask(&models.UploadTask{TaskID: taskID, State: "SUCCESS", Progress: 100, Step: "Completed", ExecutionMode: "async_goroutine", Result: map[string]any{"status": "COMPLETED", "candidate_id": candidateID, "match_score": scorecard.OverallMatchScore, "evaluation_status": scorecard.EvaluationStatus}})
	complete = true
}
func (h *CandidatesHandler) GetTaskStatus(w http.ResponseWriter, r *http.Request) {
	task, ok := h.store.GetTask(chi.URLParam(r, "task_id"))
	if !ok {
		writeError(w, http.StatusNotFound, "Task not found")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(task)
}

var safeCandidateID = regexp.MustCompile(`^cand-[A-Za-z0-9-]+$`)

func (h *CandidatesHandler) candidatePDFPath(w http.ResponseWriter, candidateID string) (string, bool) {
	if !safeCandidateID.MatchString(candidateID) {
		writeError(w, http.StatusBadRequest, "Invalid candidate ID")
		return "", false
	}
	if _, ok := h.store.GetCandidate(candidateID, false); !ok {
		writeError(w, http.StatusNotFound, "Candidate not found")
		return "", false
	}
	return filepath.Join(h.cfg.UploadDir, candidateID+".pdf"), true
}
func (h *CandidatesHandler) LocateCitation(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "candidate_id")
	path, ok := h.candidatePDFPath(w, id)
	if !ok {
		return
	}
	var req models.LocateCitationRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if strings.TrimSpace(req.SearchPhrase) == "" {
		writeError(w, http.StatusBadRequest, "Search phrase is required")
		return
	}
	data, err := os.ReadFile(path)
	if err != nil {
		writeError(w, http.StatusNotFound, "PDF not found")
		return
	}
	location := h.parser.LocateCitation(data, req.SearchPhrase)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"found": location != nil, "candidate_id": id, "search_phrase": req.SearchPhrase, "location": location})
}
func (h *CandidatesHandler) ServeResumePDF(w http.ResponseWriter, r *http.Request) {
	path, ok := h.candidatePDFPath(w, chi.URLParam(r, "candidate_id"))
	if !ok {
		return
	}
	file, err := os.Open(path)
	if err != nil {
		writeError(w, http.StatusNotFound, "PDF not found")
		return
	}
	defer file.Close()
	stat, err := file.Stat()
	if err != nil || !stat.Mode().IsRegular() {
		writeError(w, http.StatusNotFound, "PDF not found")
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, "resume.pdf", stat.ModTime(), file)
}
