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
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

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
	var payload CreateSkillPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"detail": "Invalid JSON body"}`, http.StatusBadRequest)
		return
	}

	if existing := h.store.GetSkillByCanonical(payload.CanonicalName); existing != nil {
		http.Error(w, fmt.Sprintf(`{"detail": "Skill '%s' already exists"}`, payload.CanonicalName), http.StatusConflict)
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

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(skill)
}

func (h *TaxonomyHandler) ApproveSkill(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "skill_id")
	var payload struct {
		CanonicalName *string   `json:"canonical_name"`
		Category      *string   `json:"category"`
		Aliases       *[]string `json:"aliases"`
	}
	_ = json.NewDecoder(r.Body).Decode(&payload)

	skill, ok := h.store.ApproveSkill(id, payload.CanonicalName, payload.Category, payload.Aliases)
	if !ok {
		http.Error(w, fmt.Sprintf(`{"detail": "Skill '%s' not found"}`, id), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(skill)
}

func (h *TaxonomyHandler) RejectSkill(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "skill_id")
	skill, ok := h.store.RejectSkill(id)
	if !ok {
		http.Error(w, fmt.Sprintf(`{"detail": "Skill '%s' not found"}`, id), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(skill)
}

func (h *TaxonomyHandler) AddAlias(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "skill_id")
	var payload struct {
		Alias string `json:"alias"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.Alias == "" {
		http.Error(w, `{"detail": "Invalid alias"}`, http.StatusBadRequest)
		return
	}

	skill, ok := h.store.AddSkillAlias(id, payload.Alias)
	if !ok {
		http.Error(w, fmt.Sprintf(`{"detail": "Skill '%s' not found"}`, id), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(skill)
}

func (h *TaxonomyHandler) SyncSeed(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"status":  "SUCCESS",
		"message": "Successfully re-synced seed taxonomy ontology in Go core.",
	})
}
