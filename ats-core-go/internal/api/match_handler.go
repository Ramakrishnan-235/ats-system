package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"ats-core-go/internal/services"
)

type MatchHandler struct {
	matchService *services.MatchService
}

func NewMatchHandler(ms *services.MatchService) *MatchHandler {
	return &MatchHandler{matchService: ms}
}

type MatchRequest struct {
	JobTitle            string `json:"job_title"`
	JobDescription      string `json:"job_description"`
	Stage1RetrieveLimit int    `json:"stage1_retrieve_limit"`
	Stage2RerankLimit   int    `json:"stage2_rerank_limit"`
}

type MatchResponse struct {
	JobTitle             string           `json:"job_title"`
	TotalRetrievedStage1 int              `json:"total_retrieved_stage1"`
	TotalRerankedStage2  int              `json:"total_reranked_stage2"`
	FinalEvaluations     []map[string]any `json:"final_evaluations"`
	FailedCandidateIDs   []string         `json:"failed_candidate_ids"`
	RerankerFallback     bool             `json:"reranker_fallback"`
}

func (h *MatchHandler) EvaluateJob(w http.ResponseWriter, r *http.Request) {
	var req MatchRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if strings.TrimSpace(req.JobDescription) == "" {
		writeError(w, http.StatusBadRequest, "Job description is required")
		return
	}
	if req.Stage1RetrieveLimit < 0 || req.Stage1RetrieveLimit > 1000 || req.Stage2RerankLimit < 0 || req.Stage2RerankLimit > 100 {
		writeError(w, http.StatusBadRequest, "Retrieval limits are out of range")
		return
	}
	if req.Stage1RetrieveLimit == 0 {
		req.Stage1RetrieveLimit = 100
	}
	if req.Stage2RerankLimit == 0 {
		req.Stage2RerankLimit = 20
	}

	evals, totalS1, totalS2, failedIDs, fallback := h.matchService.MatchJob(
		r.Context(),
		req.JobTitle,
		req.JobDescription,
		req.Stage1RetrieveLimit,
		req.Stage2RerankLimit,
	)

	if len(evals) == 0 && len(failedIDs) > 0 {
		writeError(w, http.StatusBadGateway, "All candidate evaluations failed")
		return
	}
	if evals == nil {
		evals = []map[string]any{}
	}
	if failedIDs == nil {
		failedIDs = []string{}
	}
	resp := MatchResponse{
		JobTitle:             req.JobTitle,
		TotalRetrievedStage1: totalS1,
		TotalRerankedStage2:  totalS2,
		FinalEvaluations:     evals,
		FailedCandidateIDs:   failedIDs,
		RerankerFallback:     fallback,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
