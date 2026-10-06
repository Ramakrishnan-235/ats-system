package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"ats-core-go/internal/store"
)

type AuditHandler struct {
	store *store.Store
}

func NewAuditHandler(st *store.Store) *AuditHandler {
	return &AuditHandler{store: st}
}

func (h *AuditHandler) GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	user := GetUserIdentity(r)
	if !user.CanViewAudit() {
		writeError(w, http.StatusForbidden, "Forbidden: role unauthorized to view audit logs")
		return
	}

	limit := 50
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 {
			limit = l
		}
	}

	actorFilter := r.URL.Query().Get("actor_id")
	actionFilter := r.URL.Query().Get("action")
	resourceFilter := r.URL.Query().Get("resource_type")

	logs := h.store.ListAuditLogs(limit, actorFilter, actionFilter, resourceFilter)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(logs)
}
