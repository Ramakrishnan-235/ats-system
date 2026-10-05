package store

import (
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"ats-core-go/internal/models"
	"github.com/google/uuid"
)

type Store struct {
	mu            sync.RWMutex
	candidates    map[string]*models.Candidate
	jobs          map[string]*models.Job
	jobCandidates map[string][]*models.JobCandidate
	uploadTasks   map[string]*models.UploadTask
	skills        map[string]*models.TaxonomySkill
}

var (
	instance *Store
	once     sync.Once
)

func GetStore() *Store {
	once.Do(func() {
		instance = &Store{
			candidates:    make(map[string]*models.Candidate),
			jobs:          make(map[string]*models.Job),
			jobCandidates: make(map[string][]*models.JobCandidate),
			uploadTasks:   make(map[string]*models.UploadTask),
			skills:        make(map[string]*models.TaxonomySkill),
		}
		instance.seedInitialJobs()
		instance.seedInitialTaxonomy()
	})
	return instance
}

// ==================== CANDIDATE OPERATIONS ====================

func (s *Store) ListCandidates(search, stage, skill string, includePII bool) []*models.Candidate {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*models.Candidate
	sSearch := strings.ToLower(strings.TrimSpace(search))
	sStage := strings.ToLower(strings.TrimSpace(stage))
	sSkill := strings.ToLower(strings.TrimSpace(skill))

	for _, cand := range s.candidates {
		// Filter by stage
		if sStage != "" && sStage != "all" && strings.ToLower(cand.Stage) != sStage {
			continue
		}

		// Filter by skill
		if sSkill != "" {
			matchedSkill := false
			for _, sk := range cand.CoreSkills {
				if strings.Contains(strings.ToLower(sk), sSkill) {
					matchedSkill = true
					break
				}
			}
			if !matchedSkill {
				continue
			}
		}

		// Filter by search
		if sSearch != "" {
			matched := strings.Contains(strings.ToLower(cand.Name), sSearch) ||
				strings.Contains(strings.ToLower(cand.TargetHeadline), sSearch) ||
				strings.Contains(strings.ToLower(cand.Location), sSearch)
			if !matched {
				for _, sk := range cand.CoreSkills {
					if strings.Contains(strings.ToLower(sk), sSearch) {
						matched = true
						break
					}
				}
			}
			if !matched {
				continue
			}
		}

		if includePII {
			candCopy := *cand
			result = append(result, &candCopy)
		} else {
			result = append(result, s.maskCandidatePII(cand))
		}
	}
	return result
}

func (s *Store) GetCandidate(id string, includePII bool) (*models.Candidate, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	cand, ok := s.candidates[id]
	if !ok {
		// Try without "cand-" prefix or with "cand-" prefix
		if strings.HasPrefix(id, "cand-") {
			cand, ok = s.candidates[strings.TrimPrefix(id, "cand-")]
		} else {
			cand, ok = s.candidates["cand-"+id]
		}
	}

	if !ok || cand == nil {
		return nil, false
	}

	if includePII {
		candCopy := *cand
		return &candCopy, true
	}
	return s.maskCandidatePII(cand), true
}

func (s *Store) SaveCandidate(cand *models.Candidate) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.candidates[cand.ID] = cand
}

func (s *Store) UpdateCandidateStage(id, stage string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	cand, ok := s.candidates[id]
	if !ok {
		return false
	}
	cand.Stage = stage
	cand.Status = stage
	return true
}

func (s *Store) AddCandidateNote(candidateID string, author, content string) (*models.Note, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	cand, ok := s.candidates[candidateID]
	if !ok {
		return nil, fmt.Errorf("candidate %s not found", candidateID)
	}

	initials := "RA"
	parts := strings.Fields(author)
	if len(parts) >= 2 {
		initials = strings.ToUpper(string(parts[0][0]) + string(parts[1][0]))
	} else if len(parts) == 1 && len(parts[0]) > 0 {
		initials = strings.ToUpper(string(parts[0][:1]))
	}

	note := models.Note{
		ID:        "note-" + uuid.New().String()[:8],
		Author:    author,
		Initials:  initials,
		Role:      "Recruiter",
		Timestamp: "Just now",
		Content:   content,
	}

	cand.Scorecard.TeamNotes = append(cand.Scorecard.TeamNotes, note)
	return &note, nil
}

// PII Masking Implementation in Go (ultra-fast regex & field redaction)
var (
	emailRegex = regexp.MustCompile(`(?i)[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`)
	phoneRegex = regexp.MustCompile(`\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}`)
)

func (s *Store) maskCandidatePII(orig *models.Candidate) *models.Candidate {
	c := *orig // shallow copy
	c.IsPIIMasked = true

	if c.AnonymizedName != "" {
		c.Name = c.AnonymizedName
	} else {
		subID := c.ID
		if len(subID) > 8 {
			subID = subID[len(subID)-8:]
		}
		c.Name = fmt.Sprintf("Candidate #%s", subID)
	}

	c.Email = "[REDACTED_EMAIL@DOMAIN.COM]"
	c.Phone = "[REDACTED_PHONE_NUMBER]"
	c.Location = "[REDACTED_LOCATION]"
	c.LinkedIn = "[REDACTED_LINK]"
	c.Avatar = "CD"
	c.IsImageAvatar = false
	c.RawText = "" // Never expose raw text with PII

	return &c
}

// ==================== JOB OPERATIONS ====================

func (s *Store) ListJobs(statusFilter, department, search string) []*models.Job {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*models.Job
	sStatus := strings.ToUpper(strings.TrimSpace(statusFilter))
	sDept := strings.ToLower(strings.TrimSpace(department))
	sSearch := strings.ToLower(strings.TrimSpace(search))

	for _, job := range s.jobs {
		if sStatus != "" && sStatus != "ALL" && strings.ToUpper(job.Status) != sStatus {
			continue
		}

		if sDept != "" && sDept != "all" {
			if !strings.Contains(strings.ToLower(job.Department), sDept) {
				continue
			}
		}

		if sSearch != "" {
			matched := strings.Contains(strings.ToLower(job.Title), sSearch) ||
				strings.Contains(strings.ToLower(job.Department), sSearch) ||
				strings.Contains(strings.ToLower(job.Location), sSearch)
			if !matched {
				for _, sk := range job.RequiredSkills {
					if strings.Contains(strings.ToLower(sk), sSearch) {
						matched = true
						break
					}
				}
			}
			if !matched {
				continue
			}
		}

		jobCopy := *job
		result = append(result, &jobCopy)
	}
	return result
}

func (s *Store) GetJob(id string) (*models.Job, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	job, ok := s.jobs[id]
	if !ok {
		// match by lowercase title or id
		for _, j := range s.jobs {
			if strings.EqualFold(j.Title, id) || j.ID == id {
				jobCopy := *j
				return &jobCopy, true
			}
		}
		return nil, false
	}
	jobCopy := *job
	return &jobCopy, true
}

func (s *Store) SaveJob(job *models.Job) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.jobs[job.ID] = job
}

func (s *Store) UpdateJobStatus(id, newStatus string) (*models.Job, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	job, ok := s.jobs[id]
	if !ok {
		return nil, false
	}
	job.Status = newStatus
	if newStatus == "PAUSED" {
		job.TopMatch.Status = "PAUSED"
		job.TopMatch.Label = "Analysis Paused"
	} else if newStatus == "OPEN" {
		job.TopMatch.Status = "ACTIVE"
	}
	job.UpdatedAt = models.NowUTC()
	jobCopy := *job
	return &jobCopy, true
}

func (s *Store) GetJobCandidates(jobID string, includePII bool) []*models.JobCandidate {
	s.mu.RLock()
	defer s.mu.RUnlock()

	list, ok := s.jobCandidates[jobID]
	if !ok {
		return []*models.JobCandidate{}
	}

	var result []*models.JobCandidate
	for _, jc := range list {
		copyJC := *jc
		if !includePII {
			copyJC.Name = fmt.Sprintf("Candidate #%s", copyJC.ID)
			if len(copyJC.ID) > 8 {
				copyJC.Name = fmt.Sprintf("Candidate #%s", copyJC.ID[len(copyJC.ID)-8:])
			}
			copyJC.Avatar = "CD"
			copyJC.IsImageAvatar = false
		}
		result = append(result, &copyJC)
	}
	return result
}

func (s *Store) AddJobCandidate(jobID string, jc *models.JobCandidate) []*models.JobCandidate {
	s.mu.Lock()
	defer s.mu.Unlock()

	list := s.jobCandidates[jobID]
	var updated []*models.JobCandidate
	for _, item := range list {
		if item.ID != jc.ID {
			updated = append(updated, item)
		}
	}
	updated = append(updated, jc)

	// Re-rank 1..N
	for i, item := range updated {
		item.Rank = i + 1
	}

	s.jobCandidates[jobID] = updated
	if job, ok := s.jobs[jobID]; ok {
		job.CandidatesCount = len(updated)
	}
	return updated
}

func (s *Store) RemoveJobCandidate(jobID, candidateID string) []*models.JobCandidate {
	s.mu.Lock()
	defer s.mu.Unlock()

	list := s.jobCandidates[jobID]
	var updated []*models.JobCandidate
	for _, item := range list {
		if item.ID != candidateID {
			updated = append(updated, item)
		}
	}
	for i, item := range updated {
		item.Rank = i + 1
	}
	s.jobCandidates[jobID] = updated
	if job, ok := s.jobs[jobID]; ok {
		job.CandidatesCount = len(updated)
	}
	return updated
}

func (s *Store) UpdateJobCandidateStage(jobID, candidateID, newStage string) (*models.JobCandidate, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	list := s.jobCandidates[jobID]
	for _, item := range list {
		if item.ID == candidateID {
			item.Stage = newStage
			if newStage == "Qualified" || newStage == "Offer" {
				item.StageBadgeStyle = "bg-emerald-100 text-emerald-900"
			} else if newStage == "Interview" {
				item.StageBadgeStyle = "bg-[#ede8dc] text-zinc-800"
			} else {
				item.StageBadgeStyle = "bg-zinc-100 text-zinc-700"
			}
			// sync to candidates store if present
			if cand, found := s.candidates[candidateID]; found {
				cand.Stage = newStage
				cand.Status = newStage
			}
			copyItem := *item
			return &copyItem, true
		}
	}
	return nil, false
}

// ==================== TASK OPERATIONS ====================

func (s *Store) SaveTask(task *models.UploadTask) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.uploadTasks[task.TaskID] = task
}

func (s *Store) GetTask(taskID string) (*models.UploadTask, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	t, ok := s.uploadTasks[taskID]
	if !ok {
		return nil, false
	}
	copyTask := *t
	return &copyTask, true
}

// ==================== TAXONOMY OPERATIONS ====================

func (s *Store) ListSkills(category, status, search string, page, limit int) ([]models.TaxonomySkill, int) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var filtered []models.TaxonomySkill
	sCat := strings.ToLower(strings.TrimSpace(category))
	sStat := strings.ToLower(strings.TrimSpace(status))
	sSearch := strings.ToLower(strings.TrimSpace(search))

	for _, sk := range s.skills {
		if sCat != "" && strings.ToLower(sk.Category) != sCat {
			continue
		}
		if sStat != "" && sStat != "all" && strings.ToLower(sk.Status) != sStat {
			continue
		}
		if sSearch != "" {
			match := strings.Contains(strings.ToLower(sk.CanonicalName), sSearch) ||
				strings.Contains(strings.ToLower(sk.Source), sSearch)
			if !match {
				for _, a := range sk.Aliases {
					if strings.Contains(strings.ToLower(a), sSearch) {
						match = true
						break
					}
				}
			}
			if !match {
				continue
			}
		}
		filtered = append(filtered, *sk)
	}

	total := len(filtered)
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 50
	}

	start := (page - 1) * limit
	if start >= total {
		return []models.TaxonomySkill{}, total
	}
	end := start + limit
	if end > total {
		end = total
	}

	return filtered[start:end], total
}

func (s *Store) AddSkill(skill *models.TaxonomySkill) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.skills[skill.ID] = skill
}

func (s *Store) GetSkillByCanonical(name string) *models.TaxonomySkill {
	s.mu.RLock()
	defer s.mu.RUnlock()
	lower := strings.ToLower(strings.TrimSpace(name))
	for _, sk := range s.skills {
		if strings.ToLower(sk.CanonicalName) == lower {
			copySk := *sk
			return &copySk
		}
	}
	return nil
}

func (s *Store) ApproveSkill(id string, canonicalName, category *string, aliases *[]string) (*models.TaxonomySkill, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	sk, ok := s.skills[id]
	if !ok {
		return nil, false
	}
	sk.Status = "approved"
	if canonicalName != nil && *canonicalName != "" {
		sk.CanonicalName = *canonicalName
	}
	if category != nil && *category != "" {
		sk.Category = *category
	}
	if aliases != nil {
		sk.Aliases = *aliases
	}
	sk.UpdatedAt = models.NowUTC()
	copySk := *sk
	return &copySk, true
}

func (s *Store) RejectSkill(id string) (*models.TaxonomySkill, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	sk, ok := s.skills[id]
	if !ok {
		return nil, false
	}
	sk.Status = "rejected"
	sk.UpdatedAt = models.NowUTC()
	copySk := *sk
	return &copySk, true
}

func (s *Store) AddSkillAlias(canonicalName, alias string) (*models.TaxonomySkill, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	lower := strings.ToLower(strings.TrimSpace(canonicalName))
	for _, sk := range s.skills {
		if strings.ToLower(sk.CanonicalName) == lower {
			sk.Aliases = append(sk.Aliases, alias)
			sk.UpdatedAt = models.NowUTC()
			copySk := *sk
			return &copySk, true
		}
	}
	return nil, false
}

// Dashboard statistics aggregation
func (s *Store) GetDashboardStats(includePII bool) *models.DashboardStatsResponse {
	s.mu.RLock()
	defer s.mu.RUnlock()

	totalCandidates := len(s.candidates)
	activeJobs := 0
	for _, j := range s.jobs {
		if j.Status == "OPEN" {
			activeJobs++
		}
	}

	var evaluatedScores []float64
	todayEvals := 0
	todayDateStr := time.Now().UTC().Format("2006-01-02")

	for _, c := range s.candidates {
		if c.Scorecard.OverallMatchScore != nil && c.Scorecard.EvaluationStatus != "FAILED" && c.Scorecard.EvaluationStatus != "PENDING" {
			evaluatedScores = append(evaluatedScores, *c.Scorecard.OverallMatchScore)
		}
		if strings.HasPrefix(c.Scorecard.EvaluatedAt, todayDateStr) {
			todayEvals++
		}
	}

	matchPercent := 0
	if len(evaluatedScores) > 0 {
		highScores := 0
		for _, sc := range evaluatedScores {
			if sc >= 70 {
				highScores++
			}
		}
		matchPercent = int(float64(highScores) / float64(len(evaluatedScores)) * 100)
	}

	pipeline := map[string][]models.PipelineCandidate{
		"Contacted":   {},
		"Interview":   {},
		"Negotiation": {},
	}

	for _, c := range s.candidates {
		stage := c.Stage
		if stage == "" {
			stage = "Contacted"
		}
		stageKey := "Contacted"
		lowerStage := strings.ToLower(stage)
		if strings.Contains(lowerStage, "interview") {
			stageKey = "Interview"
		} else if strings.Contains(lowerStage, "negotiat") || strings.Contains(lowerStage, "offer") {
			stageKey = "Negotiation"
		}

		name := c.Name
		if !includePII {
			name = c.AnonymizedName
			if name == "" {
				name = "Candidate #" + c.ID
			}
		}

		var scoreInt *int
		if c.Scorecard.OverallMatchScore != nil {
			v := int(*c.Scorecard.OverallMatchScore)
			scoreInt = &v
		}

		summary := "Candidate profile"
		if len(c.Scorecard.Categories) > 0 && c.Scorecard.Categories[0].Quote != "" {
			summary = c.Scorecard.Categories[0].Quote
		}

		pipeline[stageKey] = append(pipeline[stageKey], models.PipelineCandidate{
			ID:          c.ID,
			Name:        name,
			Role:        c.TargetHeadline,
			Avatar:      c.Avatar,
			MatchScore:  scoreInt,
			Summary:     summary,
			Stage:       stage,
			AppliedTime: c.AppliedDate,
		})
	}

	stats := []models.StatCard{
		{
			ID:     "active_jobs",
			Label:  "ACTIVE JOBS",
			Value:  fmt.Sprintf("%d", activeJobs),
			Change: fmt.Sprintf("%d active positions", activeJobs),
			Trend:  "positive",
			Icon:   "briefcase",
			Style:  "default",
		},
		{
			ID:     "candidates",
			Label:  "CANDIDATES",
			Value:  fmt.Sprintf("%d", totalCandidates),
			Change: "Real ingested candidates",
			Trend:  "positive",
			Icon:   "users",
			Style:  "default",
		},
		{
			ID:     "avg_time_to_hire",
			Label:  "AVG TIME-TO-HIRE",
			Value:  "—",
			Unit:   "days",
			Change: "Hire dates not recorded",
			Trend:  "neutral",
			Icon:   "clock",
			Style:  "default",
		},
		{
			ID:     "open_offers",
			Label:  "OPEN OFFERS",
			Value:  fmt.Sprintf("%d", len(pipeline["Negotiation"])),
			Change: "Awaiting signatures",
			Trend:  "neutral",
			Icon:   "award",
			Style:  "highlighted_dark",
		},
	}

	weeklyVolumes := []models.WeeklyVolume{
		{Week: "W1", Count: 12, IsPeak: false},
		{Week: "W2", Count: 19, IsPeak: false},
		{Week: "W3", Count: 15, IsPeak: false},
		{Week: "W4", Count: 28, IsPeak: false},
		{Week: "W5", Count: 34, IsPeak: true},
		{Week: "W6", Count: 22, IsPeak: false},
		{Week: "W7", Count: 18, IsPeak: false},
		{Week: "W8", Count: 25, IsPeak: false},
	}

	return &models.DashboardStatsResponse{
		Stats:            stats,
		WeeklyCandidates: weeklyVolumes,
		AIMatchRate: map[string]any{
			"rate":                matchPercent,
			"precision_label":     "Evaluated candidates scoring at least 70",
			"matched_percent":     matchPercent,
			"not_matched_percent": 100 - matchPercent,
			"evaluated_count":     len(evaluatedScores),
		},
		ProcessingResumes: 0,
		TodayEvaluations:  todayEvals,
		Pipeline:          pipeline,
	}
}
