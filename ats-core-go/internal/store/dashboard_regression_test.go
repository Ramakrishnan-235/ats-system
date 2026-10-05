package store

import (
	"ats-core-go/internal/models"
	"strconv"
	"testing"
)

func TestDashboardPreservesStagesAndCountsOffers(t *testing.T) {
	for _, includePII := range []bool{false, true} {
		s := NewStore()
		stages := []string{"Screening", "Qualified", "Review Required", "Contacted", "Interview", "Negotiation", "Offer", "Hired", "Rejected", "Offer Accepted", "Offer Rejected", "Custom Stage", "", " offer "}
		for i, stage := range stages {
			s.SaveCandidate(&models.Candidate{ID: strconv.Itoa(i), Name: "Jane Doe", Stage: stage})
		}
		stats := s.GetDashboardStats(includePII)
		for i, stage := range stages {
			expected := stage
			if stage == "" {
				expected = "Unassigned"
			}
			if stage == " offer " {
				expected = "Offer"
			}
			found := false
			for _, c := range stats.Pipeline[expected] {
				if c.ID == strconv.Itoa(i) {
					found = true
				}
			}
			if !found {
				t.Fatalf("%s not in %s", stage, expected)
			}
		}
		if len(stats.Pipeline["Contacted"]) != 1 {
			t.Fatal("incorrect Contacted candidates")
		}
		count := 0
		for _, items := range stats.Pipeline {
			count += len(items)
		}
		if count != len(stages) {
			t.Fatal("lost or duplicated candidates")
		}
		found := false
		for _, card := range stats.Stats {
			if card.ID == "open_offers" {
				found = true
				if card.Value != "2" {
					t.Fatal(card.Value)
				}
			}
		}
		if !found {
			t.Fatal("missing offer stat")
		}
	}
}
