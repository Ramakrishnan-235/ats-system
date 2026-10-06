package api

import (
	"encoding/json"
	"github.com/go-chi/chi/v5/middleware"
	"net/http"
	"runtime"

	"ats-core-go/internal/config"
	"ats-core-go/internal/services"
	"ats-core-go/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
)

func NewRouter(cfg *config.Config, st *store.Store, eval *services.LLMEvaluator, matchSvc *services.MatchService, parser *services.PDFParser) http.Handler {
	r := chi.NewRouter()

	// 1. Logging & Recovery Middleware
	r.Use(LoggerMiddleware)
	r.Use(middleware.Recoverer)

	// 2. CORS Middleware
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-API-Key", "X-User-Id", "X-User-Role", "X-User-Email"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// 3. Rate Limit Middleware
	r.Use(RateLimitMiddleware)

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "OK", "runtime": runtime.Version(), "engine": "ATS Core Go"})
	})
	r.Get("/api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "OK", "runtime": runtime.Version(), "engine": "ATS Core Go"})
	})

	// Handlers
	candHandler := NewCandidatesHandler(st, eval, parser, cfg)
	jobsHandler := NewJobsHandler(st)
	dashHandler := NewDashboardHandler(st)
	matchHandler := NewMatchHandler(matchSvc)
	taxHandler := NewTaxonomyHandler(st)
	auditHandler := NewAuditHandler(st)

	// API v1 group with optional Auth Middleware
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(AuthMiddleware(cfg))

		// Candidates
		r.Route("/candidates", func(r chi.Router) {
			r.Get("/", candHandler.ListCandidates)
			r.Post("/upload-async", candHandler.UploadResumeAsync)
			r.Get("/tasks/{task_id}", candHandler.GetTaskStatus)
			r.Get("/{candidate_id}", candHandler.GetCandidate)
			r.Get("/{candidate_id}/scorecard", candHandler.GetScorecard)
			r.Post("/{candidate_id}/notes", candHandler.AddNote)
			r.Patch("/{candidate_id}/stage", candHandler.UpdateStage)
			r.Post("/{candidate_id}/locate-citation", candHandler.LocateCitation)
			r.Get("/{candidate_id}/resume-pdf", candHandler.ServeResumePDF)
		})

		// Jobs
		r.Route("/jobs", func(r chi.Router) {
			r.Get("/", jobsHandler.ListJobs)
			r.Post("/", jobsHandler.CreateJob)
			r.Get("/{job_id}", jobsHandler.GetJob)
			r.Patch("/{job_id}", jobsHandler.UpdateJob)
			r.Patch("/{job_id}/status", jobsHandler.UpdateJobStatus)
			r.Get("/{job_id}/candidates", jobsHandler.GetJobCandidates)
			r.Post("/{job_id}/candidates", jobsHandler.AddJobCandidate)
			r.Delete("/{job_id}/candidates/{candidate_id}", jobsHandler.RemoveJobCandidate)
			r.Patch("/{job_id}/candidates/{candidate_id}/stage", jobsHandler.UpdateJobCandidateStage)
		})

		// Dashboard
		r.Route("/dashboard", func(r chi.Router) {
			r.Get("/stats", dashHandler.GetDashboardStats)
		})

		// Match
		r.Route("/match", func(r chi.Router) {
			r.Post("/evaluate-job", matchHandler.EvaluateJob)
		})

		// Taxonomy
		r.Route("/taxonomy", func(r chi.Router) {
			r.Get("/version", taxHandler.GetVersion)
			r.Get("/skills", taxHandler.ListSkills)
			r.Post("/skills", taxHandler.CreateSkill)
			r.Patch("/skills/{skill_id}/approve", taxHandler.ApproveSkill)
			r.Patch("/skills/{skill_id}/reject", taxHandler.RejectSkill)
			r.Post("/skills/{skill_id}/aliases", taxHandler.AddAlias)
			r.Post("/sync-seed", taxHandler.SyncSeed)
		})

		// Audit
		r.Route("/audit", func(r chi.Router) {
			r.Get("/logs", auditHandler.GetAuditLogs)
		})
	})

	return r
}
