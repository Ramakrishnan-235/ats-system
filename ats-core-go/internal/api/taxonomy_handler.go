package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"ats-core-go/internal/models"
	"ats-core-go/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type TaxonomyHandler struct {
	store *store.Store
}

func NewTaxonomyHandler(st *store.Store) *TaxonomyHandler {
	return &TaxonomyHandler{store: st}
}

func (h *TaxonomyHandler) GetVersion(w http.ResponseWriter, r *http.Request) {
	skills, total := h.store.ListSkills("", "all", "", 1, 1000)
	for page := 2; len(skills) < total; page++ {
		batch, _ := h.store.ListSkills("", "all", "", page, 1000)
		if len(batch) == 0 {
			break
		}
		skills = append(skills, batch...)
	}
	approvedCount := 0
	pendingCount := 0
	for _, sk := range skills {
		if sk.Status == "approved" {
			approvedCount++
		} else if sk.Status == "pending" {
			pendingCount++
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"version":          "2026.1",
		"total_skills":     total,
		"approved_skills":  approvedCount,
		"pending_flywheel": pendingCount,
		"status":           "active",
	})
}

func (h *TaxonomyHandler) ListSkills(w http.ResponseWriter, r *http.Request) {
	cat := r.URL.Query().Get("category")
	stat := r.URL.Query().Get("status")
	search := r.URL.Query().Get("search")
	page, pageErr := strconv.Atoi(r.URL.Query().Get("page"))
	limit, limitErr := strconv.Atoi(r.URL.Query().Get("limit"))
	if (r.URL.Query().Get("page") != "" && (pageErr != nil || page < 1 || page > 1000000)) || (r.URL.Query().Get("limit") != "" && (limitErr != nil || limit < 1 || limit > 1000)) {
		writeError(w, http.StatusBadRequest, "Invalid page or limit")
		return
	}

	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 50
	}

	items, total := h.store.ListSkills(cat, stat, search, page, limit)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"items":   items,
		"total":   total,
		"page":    page,
		"limit":   limit,
		"version": "2026.1",
	})
}

type CreateSkillPayload struct {
	CanonicalName string   `json:"canonical_name"`
	Category      string   `json:"category"`
	Aliases       []string `json:"aliases"`
	IsAmbiguous   bool     `json:"is_ambiguous"`
	Source        string   `json:"source"`
}

func (h *TaxonomyHandler) CreateSkill(w http.ResponseWriter, r *http.Request) {
	user := GetUserIdentity(r)
	if !user.CanManageTaxonomy() {
		writeError(w, http.StatusForbidden, "Forbidden: role unauthorized to create taxonomy skills")
		return
	}

	var payload CreateSkillPayload
	if !decodeJSON(w, r, &payload) {
		return
	}

	payload.CanonicalName = strings.TrimSpace(payload.CanonicalName)
	if payload.CanonicalName == "" {
		writeError(w, http.StatusBadRequest, "Canonical skill name is required")
		return
	}

	if conflict, reason := h.store.CheckSkillCollision(payload.CanonicalName, payload.Aliases, ""); conflict {
		writeError(w, http.StatusConflict, reason)
		return
	}

	skill := &models.TaxonomySkill{
		ID:              fmt.Sprintf("skill-custom-%s", uuid.New().String()[:8]),
		CanonicalName:   strings.TrimSpace(payload.CanonicalName),
		Category:        strings.ToLower(strings.TrimSpace(payload.Category)),
		Aliases:         payload.Aliases,
		IsAmbiguous:     payload.IsAmbiguous,
		Status:          "approved",
		Source:          payload.Source,
		OccurrenceCount: 1,
		TaxonomyVersion: "2026.1",
		CreatedAt:       models.NowUTC(),
		UpdatedAt:       models.NowUTC(),
	}
	h.store.AddSkill(skill)

	h.store.RecordAuditLog(&models.AuditLogEntry{
		ID:           uuid.New().String(),
		Timestamp:    models.NowUTC(),
		ActorID:      user.UserID,
		ActorRole:    string(user.Role),
		Action:       "taxonomy:create_skill",
		ResourceType: "skill",
		ResourceID:   skill.ID,
		Decision:     "allow",
		Details:      fmt.Sprintf("Created canonical skill '%s'", skill.CanonicalName),
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(skill)
}

func (h *TaxonomyHandler) ApproveSkill(w http.ResponseWriter, r *http.Request) {
	user := GetUserIdentity(r)
	if !user.CanManageTaxonomy() {
		writeError(w, http.StatusForbidden, "Forbidden: role unauthorized to approve taxonomy skills")
		return
	}

	id := chi.URLParam(r, "skill_id")
	var payload struct {
		CanonicalName *string   `json:"canonical_name"`
		Category      *string   `json:"category"`
		Aliases       *[]string `json:"aliases"`
	}
	if r.ContentLength != 0 && !decodeJSON(w, r, &payload) {
		return
	}

	if payload.CanonicalName != nil && strings.TrimSpace(*payload.CanonicalName) == "" {
		writeError(w, http.StatusBadRequest, "Canonical skill name is required")
		return
	}
	skill, ok := h.store.ApproveSkill(id, payload.CanonicalName, payload.Category, payload.Aliases)
	if !ok {
		if h.store.GetSkillByID(id) == nil {
			writeError(w, http.StatusNotFound, "Skill not found")
		} else {
			writeError(w, http.StatusConflict, "Canonical name or alias conflicts with an existing skill")
		}
		return
	}

	h.store.RecordAuditLog(&models.AuditLogEntry{
		ID:           uuid.New().String(),
		Timestamp:    models.NowUTC(),
		ActorID:      user.UserID,
		ActorRole:    string(user.Role),
		Action:       "taxonomy:approve_skill",
		ResourceType: "skill",
		ResourceID:   skill.ID,
		Decision:     "allow",
		Details:      fmt.Sprintf("Approved skill '%s'", skill.CanonicalName),
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(skill)
}

func (h *TaxonomyHandler) RejectSkill(w http.ResponseWriter, r *http.Request) {
	user := GetUserIdentity(r)
	if !user.CanManageTaxonomy() {
		writeError(w, http.StatusForbidden, "Forbidden: role unauthorized to reject taxonomy skills")
		return
	}

	id := chi.URLParam(r, "skill_id")
	skill, ok := h.store.RejectSkill(id)
	if !ok {
		writeError(w, http.StatusNotFound, "Skill not found")
		return
	}

	h.store.RecordAuditLog(&models.AuditLogEntry{
		ID:           uuid.New().String(),
		Timestamp:    models.NowUTC(),
		ActorID:      user.UserID,
		ActorRole:    string(user.Role),
		Action:       "taxonomy:reject_skill",
		ResourceType: "skill",
		ResourceID:   skill.ID,
		Decision:     "allow",
		Details:      fmt.Sprintf("Rejected skill '%s'", skill.CanonicalName),
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(skill)
}

func (h *TaxonomyHandler) AddAlias(w http.ResponseWriter, r *http.Request) {
	user := GetUserIdentity(r)
	if !user.CanManageTaxonomy() {
		writeError(w, http.StatusForbidden, "Forbidden: role unauthorized to add taxonomy aliases")
		return
	}

	id := chi.URLParam(r, "skill_id")
	var payload struct {
		Alias string `json:"alias"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	if strings.TrimSpace(payload.Alias) == "" {
		writeError(w, http.StatusBadRequest, "Invalid alias")
		return
	}

	skill, ok := h.store.AddSkillAlias(id, payload.Alias)
	if !ok {
		if h.store.GetSkillByID(id) == nil {
			writeError(w, http.StatusNotFound, "Skill not found")
		} else {
			writeError(w, http.StatusConflict, "Alias conflicts with an existing skill")
		}
		return
	}

	h.store.RecordAuditLog(&models.AuditLogEntry{
		ID:           uuid.New().String(),
		Timestamp:    models.NowUTC(),
		ActorID:      user.UserID,
		ActorRole:    string(user.Role),
		Action:       "taxonomy:add_alias",
		ResourceType: "skill",
		ResourceID:   skill.ID,
		Decision:     "allow",
		Details:      fmt.Sprintf("Added alias '%s' to skill '%s'", payload.Alias, skill.CanonicalName),
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(skill)
}

func (h *TaxonomyHandler) SyncSeed(w http.ResponseWriter, r *http.Request) {
	user := GetUserIdentity(r)
	if !user.CanAdminTaxonomy() {
		writeError(w, http.StatusForbidden, "Forbidden: role unauthorized to administer taxonomy")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotImplemented)
	json.NewEncoder(w).Encode(map[string]any{
		"status":  "UNSUPPORTED",
		"message": "Runtime seed synchronization is not implemented.",
	})
}
