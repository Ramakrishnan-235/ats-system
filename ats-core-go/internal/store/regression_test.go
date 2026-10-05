package store_test

import (
	"encoding/json"
	"math"
	"strings"
	"sync"
	"testing"
	"time"

	"ats-core-go/internal/models"
	"ats-core-go/internal/store"
)

func TestCandidateSnapshotsOwnNestedData(t *testing.T) {
	s := store.NewStore()
	score := 80.0
	candidate := &models.Candidate{ID: "cand-1", CoreSkills: []string{"Go"}, Experience: []any{map[string]any{"role": "Engineer"}}, Scorecard: models.Scorecard{OverallMatchScore: &score, Categories: []models.CategoryScore{{Quote: "Original"}}, TeamNotes: []models.Note{{Content: "Original"}}}}
	s.SaveCandidate(candidate)
	candidate.CoreSkills[0] = "Changed input"
	*candidate.Scorecard.OverallMatchScore = 1
	candidate.Experience[0].(map[string]any)["role"] = "Changed input"
	first, _ := s.GetCandidate(candidate.ID, true)
	if first.CoreSkills[0] != "Go" || *first.Scorecard.OverallMatchScore != 80 || first.Experience[0].(map[string]any)["role"] != "Engineer" {
		t.Fatal("saved candidate aliases caller data")
	}
	first.Scorecard.Categories[0].Quote = "Changed result"
	first.Scorecard.TeamNotes[0].Content = "Changed result"
	first.CoreSkills[0] = "Changed result"
	first.Experience[0].(map[string]any)["role"] = "Changed result"
	second := s.ListCandidates("", "", "", true)[0]
	if second.CoreSkills[0] != "Go" || second.Scorecard.Categories[0].Quote != "Original" || second.Scorecard.TeamNotes[0].Content != "Original" || second.Experience[0].(map[string]any)["role"] != "Engineer" {
		t.Fatal("returned candidate aliases store data")
	}
}

func TestOtherSnapshotsOwnNestedData(t *testing.T) {
	s := store.NewStore()
	score := 90
	job := &models.Job{ID: "job-1", RequiredSkills: []string{"Go"}, TopMatch: models.TopMatchInfo{Score: &score}}
	s.SaveJob(job)
	job.RequiredSkills[0] = "Caller mutation"
	gotJob, _ := s.GetJob(job.ID)
	gotJob.RequiredSkills[0] = "Read mutation"
	*gotJob.TopMatch.Score = 1
	if second, _ := s.GetJob(job.ID); second.RequiredSkills[0] != "Go" || *second.TopMatch.Score != 90 {
		t.Fatal("job snapshot aliases store")
	}
	s.SaveCandidate(&models.Candidate{ID: "cand-1"})
	application := &models.JobCandidate{ID: "cand-1", Skills: []string{"Go"}, MatchScore: &score}
	result := s.AddJobCandidate(job.ID, application)
	application.Skills[0] = "Caller mutation"
	result[0].Skills[0] = "Read mutation"
	*result[0].MatchScore = 1
	if second := s.GetJobCandidates(job.ID, true); second[0].Skills[0] != "Go" || *second[0].MatchScore != 90 {
		t.Fatal("application snapshot aliases store")
	}
	task := &models.UploadTask{TaskID: "task-1", Result: map[string]any{"nested": map[string]any{"value": "original"}}}
	s.SaveTask(task)
	task.Result["nested"].(map[string]any)["value"] = "Caller mutation"
	gotTask, _ := s.GetTask(task.TaskID)
	gotTask.Result["nested"].(map[string]any)["value"] = "Read mutation"
	if second, _ := s.GetTask(task.TaskID); second.Result["nested"].(map[string]any)["value"] != "original" {
		t.Fatal("task snapshot aliases store")
	}
	skill := &models.TaxonomySkill{ID: "skill-1", CanonicalName: "Go", Aliases: []string{"Golang"}}
	s.AddSkill(skill)
	skill.Aliases[0] = "Caller mutation"
	gotSkill := s.GetSkillByCanonical("Go")
	gotSkill.Aliases[0] = "Read mutation"
	if second := s.GetSkillByCanonical("Go"); second.Aliases[0] != "Golang" {
		t.Fatal("skill snapshot aliases store")
	}
}

func TestApplicationStagesAreJobSpecificAndLinksRequireRecords(t *testing.T) {
	s := store.NewStore()
	s.SaveCandidate(&models.Candidate{ID: "cand-1", Stage: "Screening"})
	for _, id := range []string{"job-1", "job-2"} {
		s.SaveJob(&models.Job{ID: id})
		s.AddJobCandidate(id, &models.JobCandidate{ID: "cand-1", Stage: "Screening"})
	}
	if _, ok := s.UpdateJobCandidateStage("job-1", "cand-1", "Interview"); !ok {
		t.Fatal("stage update failed")
	}
	if candidate, _ := s.GetCandidate("cand-1", true); candidate.Stage != "Screening" {
		t.Fatal("job stage corrupted global candidate stage")
	}
	if s.GetJobCandidates("job-2", true)[0].Stage != "Screening" {
		t.Fatal("job stage leaked into other application")
	}
	if len(s.AddJobCandidate("missing", &models.JobCandidate{ID: "cand-1"})) != 0 || len(s.AddJobCandidate("job-1", &models.JobCandidate{ID: "missing"})) != 1 {
		t.Fatal("invalid link retained")
	}
	if job, _ := s.GetJob("job-1"); job.CandidatesCount != 1 {
		t.Fatal("incorrect application count")
	}
}

func TestMaskedNestedFieldsDoNotModifyOriginal(t *testing.T) {
	s := store.NewStore()
	text := "Alice Smith alice@example.com +91 9876543210 https://example.com/profile"
	s.SaveCandidate(&models.Candidate{ID: "cand-1", Name: "Alice Smith", Email: "alice@example.com", Phone: "+91 9876543210", Avatar: "https://example.com/photo", ResumeFilename: "Alice Smith.pdf", RawText: text, Experience: []any{map[string]any{"summary": text}}, Scorecard: models.Scorecard{Categories: []models.CategoryScore{{Quote: text}}, TeamNotes: []models.Note{{Content: text}}}})
	masked, _ := s.GetCandidate("cand-1", false)
	encoded, err := json.Marshal(masked)
	if err != nil {
		t.Fatal(err)
	}
	for _, private := range []string{"Alice Smith", "alice@example.com", "9876543210", "https://example.com"} {
		if strings.Contains(string(encoded), private) {
			t.Fatalf("masked profile leaks %s", private)
		}
	}
	if raw, _ := s.GetCandidate("cand-1", true); raw.Scorecard.Categories[0].Quote != text {
		t.Fatal("masking changed stored original")
	}
	s.SaveJob(&models.Job{ID: "job-1"})
	s.AddJobCandidate("job-1", &models.JobCandidate{ID: "cand-1", Name: "Alice Smith", Quote: text})
	application, _ := json.Marshal(s.GetJobCandidates("job-1", false))
	if strings.Contains(string(application), "alice@example.com") {
		t.Fatal("application quote leaks PII")
	}
	dashboard, _ := json.Marshal(s.GetDashboardStats(false))
	if strings.Contains(string(dashboard), "alice@example.com") || strings.Contains(string(dashboard), "https://example.com") {
		t.Fatal("dashboard quote/avatar leaks PII")
	}
}

func TestDashboardReportsObservedCountsAndValidScores(t *testing.T) {
	s := store.NewStore()
	completed, pending, invalid := 80.0, 99.0, math.NaN()
	for _, candidate := range []*models.Candidate{
		{ID: "completed", CreatedAt: models.NowUTC(), Scorecard: models.Scorecard{OverallMatchScore: &completed, EvaluationStatus: "COMPLETED", EvaluatedAt: models.NowUTC()}},
		{ID: "pending", CreatedAt: models.NowUTC(), Scorecard: models.Scorecard{OverallMatchScore: &pending, EvaluationStatus: "PENDING", EvaluatedAt: models.NowUTC()}},
		{ID: "invalid", CreatedAt: "invalid-date", Scorecard: models.Scorecard{OverallMatchScore: &invalid, EvaluationStatus: "COMPLETED", EvaluatedAt: models.NowUTC()}},
	} {
		s.SaveCandidate(candidate)
	}
	s.SaveTask(&models.UploadTask{TaskID: "working", State: "PROGRESS"})
	stats := s.GetDashboardStats(false)
	count := 0
	for _, week := range stats.WeeklyCandidates {
		count += week.Count
	}
	if count != 2 || stats.TodayEvaluations != 1 || stats.ProcessingResumes != 1 || stats.AIMatchRate["evaluated_count"] != 1 {
		t.Fatalf("unexpected observed statistics: %+v", stats)
	}
	for _, list := range stats.Pipeline {
		for _, candidate := range list {
			if candidate.ID != "completed" && candidate.MatchScore != nil {
				t.Fatal("invalid/pending score displayed as real evaluation")
			}
		}
	}
}

func TestTaxonomyPaginationStableAndOverflowSafe(t *testing.T) {
	s := store.NewStore()
	for _, id := range []string{"c", "a", "b"} {
		s.AddSkill(&models.TaxonomySkill{ID: id})
	}
	for i := 0; i < 10; i++ {
		result, total := s.ListSkills("", "", "", 2, 1)
		if total != 3 || result[0].ID != "b" {
			t.Fatal("pagination is nondeterministic")
		}
	}
	maxInt := int(^uint(0) >> 1)
	result, total := s.ListSkills("", "", "", maxInt, maxInt)
	if total != 3 || len(result) != 0 {
		t.Fatal("overflow page accepted")
	}
	result, _ = s.ListSkills("", "", "", 1, maxInt)
	if len(result) != 3 {
		t.Fatal("large limit invalid")
	}
}

func TestEvaluationUpdatePreservesNotesAndStage(t *testing.T) {
	s := store.NewStore()
	s.SaveCandidate(&models.Candidate{ID: "cand-1", Stage: "Screening"})
	note, err := s.AddCandidateNote("cand-1", "Émile 王", "Keep this note")
	if err != nil || note.Initials != "É王" {
		t.Fatalf("invalid Unicode initials: %+v, %v", note, err)
	}
	if _, err := time.Parse(time.RFC3339, note.Timestamp); err != nil {
		t.Fatal("note timestamp is not durable")
	}
	s.UpdateCandidateStage("cand-1", "Interview")
	score := 90.0
	if !s.UpdateCandidateScorecard("cand-1", models.Scorecard{OverallMatchScore: &score, EvaluationStatus: "COMPLETED"}) {
		t.Fatal("evaluation update failed")
	}
	candidate, _ := s.GetCandidate("cand-1", true)
	if candidate.Stage != "Interview" || len(candidate.Scorecard.TeamNotes) != 1 || candidate.Scorecard.TeamNotes[0].Content != "Keep this note" {
		t.Fatal("evaluation overwrote concurrent recruiter changes")
	}
}

func TestConcurrentReadsAndWritesUseIndependentSnapshots(t *testing.T) {
	s := store.NewStore()
	s.SaveCandidate(&models.Candidate{ID: "cand-1", CoreSkills: []string{"Go"}, Experience: []any{map[string]any{"role": "Engineer"}}})
	var group sync.WaitGroup
	for i := 0; i < 8; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			for j := 0; j < 50; j++ {
				s.UpdateCandidateStage("cand-1", "Interview")
				candidate, _ := s.GetCandidate("cand-1", true)
				candidate.CoreSkills[0] = "Caller mutation"
				candidate.Experience[0].(map[string]any)["role"] = "Caller mutation"
				s.ListCandidates("", "", "", false)
			}
		}()
	}
	group.Wait()
	candidate, _ := s.GetCandidate("cand-1", true)
	if candidate.CoreSkills[0] != "Go" {
		t.Fatal("concurrent snapshot mutation affected store")
	}
}

func TestPartialJobUpdatesPreserveConcurrentFields(t *testing.T) {
	s := store.NewStore()
	s.SaveJob(&models.Job{ID: "job-1", Title: "Original", Department: "Original department", Status: "OPEN"})
	// Both PATCH callers previously obtained the same old snapshot. Status and
	// application counts changed before either submitted their editable fields.
	s.UpdateJobStatus("job-1", "PAUSED")
	s.SaveCandidate(&models.Candidate{ID: "cand-1"})
	s.AddJobCandidate("job-1", &models.JobCandidate{ID: "cand-1"})
	title, department := "New title", "New department"
	if _, ok := s.UpdateJob("job-1", store.JobUpdate{Title: &title}); !ok {
		t.Fatal("title PATCH failed")
	}
	skills := []string{"Go"}
	result, ok := s.UpdateJob("job-1", store.JobUpdate{Department: &department, RequiredSkills: &skills})
	if !ok || result.Title != title || result.Department != department || result.Status != "PAUSED" || result.CandidatesCount != 1 {
		t.Fatalf("partial update lost existing changes: %+v", result)
	}
	skills[0] = "Changed input"
	result.RequiredSkills[0] = "Changed result"
	stored, _ := s.GetJob("job-1")
	if stored.RequiredSkills[0] != "Go" {
		t.Fatal("partial update retained mutable aliases")
	}
	if _, err := time.Parse(time.RFC3339, stored.UpdatedAt); err != nil {
		t.Fatal("missing update timestamp")
	}
	if _, ok := s.UpdateJob("missing", store.JobUpdate{Title: &title}); ok {
		t.Fatal("partial update created missing job")
	}
}
