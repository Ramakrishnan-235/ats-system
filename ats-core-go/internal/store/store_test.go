package store_test

import (
	"testing"

	"ats-core-go/internal/models"
	"ats-core-go/internal/store"
)

func TestStore_JobsAndCandidates(t *testing.T) {
	st := store.GetStore()

	// 1. Verify initial seed jobs
	jobs := st.ListJobs("", "", "")
	if len(jobs) == 0 {
		t.Fatalf("expected seed jobs, got 0")
	}

	// 2. Add Candidate
	score := 92.5
	cand := &models.Candidate{
		ID:             "cand-test-001",
		Name:           "Alice Smith",
		AnonymizedName: "Candidate #TEST01",
		TargetHeadline: "Senior Go Engineer",
		CoreSkills:     []string{"Go", "PostgreSQL", "Docker"},
		Email:          "alice@example.com",
		Phone:          "+1-555-0199",
		Scorecard: models.Scorecard{
			OverallMatchScore: &score,
			MatchTier:         "STRONG_FIT",
			EvaluationStatus:  "COMPLETED",
		},
	}
	st.SaveCandidate(cand)

	// 3. Test PII Masking
	maskedCand, found := st.GetCandidate("cand-test-001", false)
	if !found {
		t.Fatalf("candidate not found")
	}
	if maskedCand.Email != "[REDACTED_EMAIL@DOMAIN.COM]" {
		t.Errorf("expected redacted email, got %s", maskedCand.Email)
	}
	if maskedCand.Phone != "[REDACTED_PHONE_NUMBER]" {
		t.Errorf("expected redacted phone, got %s", maskedCand.Phone)
	}
	if maskedCand.Name != "Candidate #TEST01" {
		t.Errorf("expected anonymized name, got %s", maskedCand.Name)
	}

	// 4. Test unmasked PII
	rawCand, _ := st.GetCandidate("cand-test-001", true)
	if rawCand.Email != "alice@example.com" {
		t.Errorf("expected raw email, got %s", rawCand.Email)
	}

	// 5. Test notes
	note, err := st.AddCandidateNote("cand-test-001", "John Doe", "Impressive systems design background.")
	if err != nil {
		t.Fatalf("unexpected error adding note: %v", err)
	}
	if note.Author != "John Doe" || note.Initials != "JD" {
		t.Errorf("unexpected note initials: %s", note.Initials)
	}
}
