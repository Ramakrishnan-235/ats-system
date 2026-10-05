package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"ats-core-go/internal/store"
)

type DashboardHandler struct {
	store *store.Store
}

func NewDashboardHandler(st *store.Store) *DashboardHandler {
	return &DashboardHandler{store: st}
}

func (h *DashboardHandler) GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	includePII := strings.ToLower(r.URL.Query().Get("include_pii")) == "true"
	stats := h.store.GetDashboardStats(includePII)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}
