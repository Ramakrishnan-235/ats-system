package api

import (
	"ats-core-go/internal/models"
	"ats-core-go/internal/store"
	"strings"
	"testing"
)

func TestUploadExtractsProfileWithAndWithoutJob(t *testing.T) {
	for _, withJob := range []bool{false, true} {
		t.Run(map[bool]string{false: "no job", true: "with job"}[withJob], func(t *testing.T) {
			h := testCandidateHandler(t)
			h.store = store.NewStore()
			h.parser = stubParser{text: "Alice Smith\nSenior Software Engineer\nalice@example.test\nLocation: Chennai\nSkills\nGo, Golang, PostgreSQL, Docker, C++, C#, .NET\nWork Experience\nSoftware Engineer | Acme\nJan 2021 - Dec 2023\n- Built Go services\nSenior Engineer at Beta | Jan 2024 - Present\n- Deployed Docker\nEducation\nUniversity 2017 - 2021"}
			summaries := make(chan string, 1)
			h.evaluator = stubEvaluator{summary: summaries, scorecard: &models.Scorecard{EvaluationStatus: "COMPLETED"}}
			var job *models.Job
			if withJob {
				job = &models.Job{ID: "job-profile", Title: "Engineer", JobDescription: "Go services"}
				h.store.SaveJob(job)
			}
			h.processUpload("profile-task", "cand-profile123", "unrelated-file.pdf", "", nil, job)
			task, _ := h.store.GetTask("profile-task")
			if task.State != "SUCCESS" {
				t.Fatal(task)
			}
			c, ok := h.store.GetCandidate("cand-profile123", true)
			if !ok || c.Name != "Alice Smith" || c.Email != "alice@example.test" || c.Location != "Chennai" || c.TargetHeadline != "Senior Software Engineer" {
				t.Fatalf("profile: %#v", c)
			}
			for _, skill := range []string{"Go", "PostgreSQL", "Docker", "C++", "C#", ".NET"} {
				found := false
				for _, got := range c.CoreSkills {
					if got == skill {
						found = true
					}
				}
				if !found {
					t.Fatalf("missing %s: %v", skill, c.CoreSkills)
				}
			}
			if len(c.Experience) != 2 {
				t.Fatalf("experience: %#v", c.Experience)
			}
			first := c.Experience[0].(map[string]any)
			if first["role"] != "Software Engineer" || first["company"] != "Acme" || first["period"] != "Jan 2021 - Dec 2023" || first["description"] != "- Built Go services" {
				t.Fatal(first)
			}
			second := c.Experience[1].(map[string]any)
			if second["company"] != "Beta" || second["is_current_role"] != true {
				t.Fatal(second)
			}
			if len(h.store.ListCandidates("", "", "PostgreSQL", true)) != 1 {
				t.Fatal("skill filter did not find upload")
			}
			masked, _ := h.store.GetCandidate(c.ID, false)
			if strings.Contains(masked.Name, "Alice") || masked.Email == c.Email {
				t.Fatal("PII not masked")
			}
			if withJob {
				summary := <-summaries
				for _, identifier := range []string{"Alice Smith", "alice@example.test", "Chennai"} {
					if strings.Contains(summary, identifier) {
						t.Fatalf("identifier in evaluation: %s", identifier)
					}
				}
				candidates := h.store.GetJobCandidates(job.ID, true)
				if len(candidates) != 1 || candidates[0].Name != c.Name || len(candidates[0].Skills) != len(c.CoreSkills) {
					t.Fatalf("job candidates: %#v", candidates)
				}
			} else if c.Scorecard.EvaluationStatus != "PENDING" {
				t.Fatal("no-job upload evaluated")
			}
		})
	}
}
