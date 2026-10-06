package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"ats-core-go/internal/models"
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
	user := GetUserIdentity(r)
	if includePII {
		if !user.CanViewPII() {
			h.store.RecordAuditLog(&models.AuditLogEntry{
				ActorID:      user.UserID,
				ActorRole:    string(user.Role),
				Action:       "VIEW_DASHBOARD_PII_DENIED",
				ResourceType: "dashboard",
				ResourceID:   "stats",
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
			Action:       "VIEW_DASHBOARD_PII",
			ResourceType: "dashboard",
			ResourceID:   "stats",
			Decision:     "ALLOWED",
			Details:      "Authorized dashboard unmasked PII access",
			IPAddress:    r.RemoteAddr,
			UserAgent:    r.UserAgent(),
		})
	}
	stats := h.store.GetDashboardStats(includePII)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}
