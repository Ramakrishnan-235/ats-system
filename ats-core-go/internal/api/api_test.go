package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"ats-core-go/internal/api"
	"ats-core-go/internal/config"
	"ats-core-go/internal/services"
	"ats-core-go/internal/store"
)

func TestAPI_Endpoints(t *testing.T) {
	cfg := config.Load()
	cfg.AuthEnabled = false
	st := store.GetStore()
	eval := services.NewLLMEvaluator(cfg)
	matchSvc := services.NewMatchService(st, eval)
	parser := services.NewPDFParser()

	router := api.NewRouter(cfg, st, eval, matchSvc, parser)

	// 1. Healthcheck
	req, _ := http.NewRequest("GET", "/health", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK for /health, got %d", rr.Code)
	}

	// 2. List Jobs
	req, _ = http.NewRequest("GET", "/api/v1/jobs", nil)
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK for /api/v1/jobs, got %d", rr.Code)
	}

	var jobs []map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &jobs); err != nil {
		t.Fatalf("failed to decode jobs JSON: %v", err)
	}
	if len(jobs) == 0 {
		t.Errorf("expected jobs list to have entries, got 0")
	}

	// 3. Dashboard Stats
	req, _ = http.NewRequest("GET", "/api/v1/dashboard/stats", nil)
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK for /api/v1/dashboard/stats, got %d", rr.Code)
	}

	var stats map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &stats); err != nil {
		t.Fatalf("failed to decode dashboard stats JSON: %v", err)
	}
	if stats["stats"] == nil || stats["pipeline"] == nil {
		t.Errorf("expected stats and pipeline keys in dashboard response")
	}
}
