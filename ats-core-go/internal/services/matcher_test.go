package services

import (
	"ats-core-go/internal/config"
	"ats-core-go/internal/models"
	"ats-core-go/internal/store"
	"context"
	"net/http"
	"testing"
)

func TestMatchPreservesConcurrentRecruiterChanges(t *testing.T) {
	st := store.NewStore()
	st.SaveCandidate(&models.Candidate{ID: "cand-one", Name: "Alex Smith", CoreSkills: []string{"Go"}, RawText: "Go systems"})
	e := fakeEvaluator(t, 200, `{"overall_match_score":81}`)
	original := e.httpClient.Transport
	e.httpClient.Transport = transportFunc(func(r *http.Request) (*http.Response, error) {
		if _, err := st.AddCandidateNote("cand-one", "Recruiter", "Added during evaluation"); err != nil {
			t.Fatal(err)
		}
		st.UpdateCandidateStage("cand-one", "Interview")
		return original.RoundTrip(r)
	})
	matches, _, _, failed, _ := NewMatchService(st, e).MatchJob(context.Background(), "Go", "Go systems", 10, 10)
	if len(matches) != 1 || len(failed) != 0 {
		t.Fatalf("matches=%v failed=%v", matches, failed)
	}
	cand, _ := st.GetCandidate("cand-one", true)
	if cand.Stage != "Interview" || len(cand.Scorecard.TeamNotes) != 1 {
		t.Fatal("evaluation overwrote recruiter changes")
	}
}
func TestUnavailableEvaluationIsNotSuccessfulMatch(t *testing.T) {
	st := store.NewStore()
	st.SaveCandidate(&models.Candidate{ID: "cand-one", CoreSkills: []string{"Go"}})
	e := NewLLMEvaluator(&config.Config{})
	matches, _, _, failed, _ := NewMatchService(st, e).MatchJob(context.Background(), "Go", "Go", 10, 10)
	if len(matches) != 0 || len(failed) != 1 {
		t.Fatalf("matches=%v failed=%v", matches, failed)
	}
	matches, _, _, _, _ = NewMatchService(st, e).MatchJob(context.Background(), "Rust", "Rust", 10, 10)
	if len(matches) != 0 {
		t.Fatal("zero-overlap candidate evaluated")
	}
}
