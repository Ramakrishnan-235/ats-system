package store

import (
	"fmt"
	"math"
	"regexp"
	"sort"
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
	auditLogs     []*models.AuditLogEntry
}

var (
	instance *Store
	once     sync.Once
)

func GetStore() *Store {
	once.Do(func() {
		instance = NewStore()
		instance.seedInitialJobs()
		instance.seedInitialTaxonomy()
	})
	return instance
}

// NewStore creates an isolated empty store, without demo jobs or shared state.
func NewStore() *Store {
	return &Store{
		candidates:    make(map[string]*models.Candidate),
		jobs:          make(map[string]*models.Job),
		jobCandidates: make(map[string][]*models.JobCandidate),
		uploadTasks:   make(map[string]*models.UploadTask),
		skills:        make(map[string]*models.TaxonomySkill),
		auditLogs:     make([]*models.AuditLogEntry, 0),
	}
}

// ==================== CANDIDATE OPERATIONS ====================

func (s *Store) ListCandidates(search, stage, skill string, includePII bool) []*models.Candidate {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*models.Candidate, 0)
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
			candCopy := cloneCandidate(cand)
			result = append(result, candCopy)
		} else {
			result = append(result, s.maskCandidatePII(cand))
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].ID < result[j].ID })
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
		candCopy := cloneCandidate(cand)
		return candCopy, true
	}
	return s.maskCandidatePII(cand), true
}

func (s *Store) SaveCandidate(cand *models.Candidate) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if cand != nil {
		s.candidates[cand.ID] = cloneCandidate(cand)
	}
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

// UpdateCandidateScorecard preserves concurrently added recruiter notes and
// candidate stage while replacing evaluation data atomically.
func (s *Store) UpdateCandidateScorecard(id string, scorecard models.Scorecard) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	candidate, ok := s.candidates[id]
	if !ok {
		return false
	}
	copy := cloneCandidate(&models.Candidate{Scorecard: scorecard})
	copy.Scorecard.TeamNotes = candidate.Scorecard.TeamNotes
	candidate.Scorecard = copy.Scorecard
	return true
}

func (s *Store) AddCandidateNote(candidateID string, author, content string) (*models.Note, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	cand, ok := s.candidates[candidateID]
	if !ok {
		return nil, fmt.Errorf("candidate %s not found", candidateID)
	}

	initials := ""
	parts := strings.Fields(author)
	if len(parts) >= 2 {
		initials = strings.ToUpper(string([]rune(parts[0])[0]) + string([]rune(parts[1])[0]))
	} else if len(parts) == 1 && len(parts[0]) > 0 {
		initials = strings.ToUpper(string([]rune(parts[0])[0]))
	}

	note := models.Note{
		ID:        "note-" + uuid.New().String()[:8],
		Author:    author,
		Initials:  initials,
		Role:      "Recruiter",
		Timestamp: models.NowUTC(),
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
	c := *cloneCandidate(orig)
	redactCandidateStrings(&c, orig)
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
	c.ResumeFilename = ""

	return &c
}

// ==================== JOB OPERATIONS ====================

func (s *Store) ListJobs(statusFilter, department, search string) []*models.Job {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*models.Job, 0)
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

		jobCopy := cloneJob(job)
		result = append(result, jobCopy)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].ID < result[j].ID })
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
				jobCopy := cloneJob(j)
				return jobCopy, true
			}
		}
		return nil, false
	}
	jobCopy := cloneJob(job)
	return jobCopy, true
}

func (s *Store) SaveJob(job *models.Job) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if job != nil {
		s.jobs[job.ID] = cloneJob(job)
	}
}

// JobUpdate describes editable fields without replacing application counts or
// status. Pointer fields distinguish omitted values from explicit empty values.
type JobUpdate struct {
	Title              *string
	Department         *string
	Location           *string
	JobDescription     *string
	RequiredSkills     *[]string
	MinYearsExperience *float64
}

func (s *Store) UpdateJob(id string, updates JobUpdate) (*models.Job, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	job, ok := s.jobs[id]
	if !ok {
		return nil, false
	}
	if updates.Title != nil {
		job.Title = *updates.Title
	}
	if updates.Department != nil {
		job.Department = *updates.Department
	}
	if updates.Location != nil {
		job.Location = *updates.Location
	}
	if updates.JobDescription != nil {
		job.JobDescription = *updates.JobDescription
	}
	if updates.RequiredSkills != nil {
		job.RequiredSkills = append([]string{}, (*updates.RequiredSkills)...)
	}
	if updates.MinYearsExperience != nil {
		job.MinYearsExperience = *updates.MinYearsExperience
	}
	job.UpdatedAt = models.NowUTC()
	return cloneJob(job), true
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
	} else if newStatus == "OPEN" {
		if job.TopMatch.Score == nil {
			job.TopMatch.Status = "PENDING"
		} else {
			job.TopMatch.Status = "ACTIVE"
		}
	}
	job.UpdatedAt = models.NowUTC()
	jobCopy := cloneJob(job)
	return jobCopy, true
}

func (s *Store) GetJobCandidates(jobID string, includePII bool) []*models.JobCandidate {
	s.mu.RLock()
	defer s.mu.RUnlock()

	list, ok := s.jobCandidates[jobID]
	if !ok {
		return []*models.JobCandidate{}
	}

	result := make([]*models.JobCandidate, 0)
	for _, jc := range list {
		copyJC := *cloneJobCandidate(jc)
		if !includePII {
			if candidate := s.candidates[jc.ID]; candidate != nil {
				redactProfileStrings(&copyJC, candidate)
			}
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
	if jc == nil || s.jobs[jobID] == nil || s.candidates[jc.ID] == nil {
		return cloneApplications(list)
	}
	var updated []*models.JobCandidate
	for _, item := range list {
		if item.ID != jc.ID {
			updated = append(updated, item)
		}
	}
	updated = append(updated, cloneJobCandidate(jc))

	// Re-rank 1..N
	for i, item := range updated {
		item.Rank = i + 1
	}

	s.jobCandidates[jobID] = updated
	if job, ok := s.jobs[jobID]; ok {
		job.CandidatesCount = len(updated)
	}
	return cloneApplications(updated)
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
	return cloneApplications(updated)
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
			// An application stage belongs only to this job.
			copyItem := cloneJobCandidate(item)
			return copyItem, true
		}
	}
	return nil, false
}

// ==================== TASK OPERATIONS ====================

func (s *Store) SaveTask(task *models.UploadTask) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if task != nil {
		s.uploadTasks[task.TaskID] = cloneTask(task)
	}
}

func (s *Store) GetTask(taskID string) (*models.UploadTask, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	t, ok := s.uploadTasks[taskID]
	if !ok {
		return nil, false
	}
	copyTask := cloneTask(t)
	return copyTask, true
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
		filtered = append(filtered, *cloneSkill(sk))
	}

	sort.Slice(filtered, func(i, j int) bool { return filtered[i].ID < filtered[j].ID })
	total := len(filtered)
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 50
	}

	if total == 0 || page-1 > (total-1)/limit {
		return []models.TaxonomySkill{}, total
	}
	start := (page - 1) * limit
	if start >= total {
		return []models.TaxonomySkill{}, total
	}
	end := total
	if limit < total-start {
		end = start + limit
	}

	return filtered[start:end], total
}

func (s *Store) AddSkill(skill *models.TaxonomySkill) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if skill != nil {
		s.skills[skill.ID] = cloneSkill(skill)
	}
}

func (s *Store) GetSkillByCanonical(name string) *models.TaxonomySkill {
	s.mu.RLock()
	defer s.mu.RUnlock()
	lower := strings.ToLower(strings.TrimSpace(name))
	for _, sk := range s.skills {
		if strings.ToLower(sk.CanonicalName) == lower {
			copySk := cloneSkill(sk)
			return copySk
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
		sk.Aliases = append([]string(nil), (*aliases)...)
	}
	sk.UpdatedAt = models.NowUTC()
	copySk := cloneSkill(sk)
	return copySk, true
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
	copySk := cloneSkill(sk)
	return copySk, true
}

func (s *Store) AddSkillAlias(canonicalName, alias string) (*models.TaxonomySkill, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	lower := strings.ToLower(strings.TrimSpace(canonicalName))
	for _, sk := range s.skills {
		if strings.ToLower(sk.CanonicalName) == lower {
			alias = strings.TrimSpace(alias)
			if alias == "" {
				return cloneSkill(sk), true
			}
			for _, existing := range sk.Aliases {
				if strings.EqualFold(strings.TrimSpace(existing), alias) {
					return cloneSkill(sk), true
				}
			}
			sk.Aliases = append(sk.Aliases, alias)
			sk.UpdatedAt = models.NowUTC()
			copySk := cloneSkill(sk)
			return copySk, true
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
		if validEvaluationScore(c.Scorecard) {
			evaluatedScores = append(evaluatedScores, *c.Scorecard.OverallMatchScore)
		}
		if validEvaluationScore(c.Scorecard) && strings.HasPrefix(c.Scorecard.EvaluatedAt, todayDateStr) {
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
		"Screening": {}, "Review Required": {}, "Qualified": {}, "Contacted": {},
		"Interview": {}, "Negotiation": {}, "Offer": {}, "Hired": {}, "Rejected": {},
	}

	for _, storedCandidate := range s.candidates {
		c := cloneCandidate(storedCandidate)
		if !includePII {
			c = s.maskCandidatePII(storedCandidate)
		}
		stageKey := strings.TrimSpace(c.Stage)
		if stageKey == "" {
			stageKey = "Unassigned"
		}
		for _, known := range []string{"Screening", "Review Required", "Qualified", "Contacted", "Interview", "Negotiation", "Offer", "Hired", "Rejected"} {
			if strings.EqualFold(stageKey, known) {
				stageKey = known
				break
			}
		}

		name := c.Name
		if !includePII {
			name = c.AnonymizedName
			if name == "" {
				name = "Candidate #" + c.ID
			}
		}

		var scoreInt *int
		if validEvaluationScore(c.Scorecard) {
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
			Stage:       stageKey,
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
			Value:  fmt.Sprintf("%d", len(pipeline["Offer"])),
			Change: "Candidates in Offer stage",
			Trend:  "neutral",
			Icon:   "award",
			Style:  "highlighted_dark",
		},
	}

	weeklyVolumes := make([]models.WeeklyVolume, 8)
	now := time.Now().UTC()
	// Eight UTC calendar weeks ending in the current week, Monday to Sunday.
	weekStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	weekStart = weekStart.AddDate(0, 0, -(int(now.Weekday())+6)%7)
	firstWeek := weekStart.AddDate(0, 0, -49)
	for i := range weeklyVolumes {
		weeklyVolumes[i].Week = firstWeek.AddDate(0, 0, i*7).Format("2006-01-02")
	}
	for _, candidate := range s.candidates {
		created, err := time.Parse(time.RFC3339, candidate.CreatedAt)
		if err != nil {
			continue
		}
		if created.Before(firstWeek) || created.After(now) {
			continue
		}
		index := int(created.Sub(firstWeek).Hours() / (24 * 7))
		if index < len(weeklyVolumes) {
			weeklyVolumes[index].Count++
		}
	}
	peak := 0
	for _, week := range weeklyVolumes {
		if week.Count > peak {
			peak = week.Count
		}
	}
	for i := range weeklyVolumes {
		weeklyVolumes[i].IsPeak = peak > 0 && weeklyVolumes[i].Count == peak
	}
	for _, list := range pipeline {
		sort.Slice(list, func(i, j int) bool { return list[i].ID < list[j].ID })
	}
	processing := 0
	for _, task := range s.uploadTasks {
		if task.State == "PENDING" || task.State == "PROGRESS" {
			processing++
		}
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
		ProcessingResumes: processing,
		TodayEvaluations:  todayEvals,
		Pipeline:          pipeline,
	}
}

func validEvaluationScore(scorecard models.Scorecard) bool {
	status := strings.ToUpper(scorecard.EvaluationStatus)
	if status != "COMPLETED" && status != "SUCCESS" && status != "MANUAL" {
		return false
	}
	if scorecard.OverallMatchScore == nil {
		return false
	}
	score := *scorecard.OverallMatchScore
	return !math.IsNaN(score) && !math.IsInf(score, 0) && score >= 0 && score <= 100
}

// ==================== AUDIT LOG OPERATIONS ====================

func (s *Store) RecordAuditLog(entry *models.AuditLogEntry) {
	if entry == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	item := *entry
	if item.ID == "" {
		item.ID = "aud-" + uuid.NewString()[:12]
	}
	if item.Timestamp == "" {
		item.Timestamp = models.NowUTC()
	}
	s.auditLogs = append(s.auditLogs, &item)
	if len(s.auditLogs) > 10000 {
		s.auditLogs = s.auditLogs[len(s.auditLogs)-10000:]
	}
}

func (s *Store) ListAuditLogs(limit int, actorFilter, actionFilter, resourceFilter string) []*models.AuditLogEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if limit <= 0 {
		limit = 50
	}
	if limit > 1000 {
		limit = 1000
	}

	actorFilter = strings.ToLower(strings.TrimSpace(actorFilter))
	actionFilter = strings.ToLower(strings.TrimSpace(actionFilter))
	resourceFilter = strings.ToLower(strings.TrimSpace(resourceFilter))

	result := make([]*models.AuditLogEntry, 0)
	for i := len(s.auditLogs) - 1; i >= 0; i-- {
		entry := s.auditLogs[i]
		if actorFilter != "" && strings.ToLower(entry.ActorID) != actorFilter {
			continue
		}
		if actionFilter != "" && strings.ToLower(entry.Action) != actionFilter {
			continue
		}
		if resourceFilter != "" && strings.ToLower(entry.ResourceType) != resourceFilter {
			continue
		}
		copied := *entry
		result = append(result, &copied)
		if len(result) >= limit {
			break
		}
	}
	return result
}

