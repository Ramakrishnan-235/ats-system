package services

import "testing"

func TestProfileDoesNotInventExperienceOrMatchSkillSubstrings(t *testing.T) {
	p := ExtractCandidateProfile("Summary\nWe go through ongoing progress and JavaScript frameworks.\nEducation\nCollege 2018 - 2022")
	if p.Name != "Candidate" || len(p.Experience) != 0 || p.YearsOfExperience != nil {
		t.Fatalf("invented profile: %#v", p)
	}
	if len(p.CoreSkills) != 1 || p.CoreSkills[0] != "JavaScript" {
		t.Fatalf("substring skills: %v", p.CoreSkills)
	}
}

func TestProfileSupportsUnicodeNamesAndSkillAliases(t *testing.T) {
	p := ExtractCandidateProfile("José García\nSkills\nGolang, K8s, Postgres, NodeJS, ReactJS, C++, C#")
	if p.Name != "José García" {
		t.Fatal(p.Name)
	}
	for _, skill := range []string{"Go", "Kubernetes", "PostgreSQL", "Node.js", "React", "C++", "C#"} {
		found := false
		for _, got := range p.CoreSkills {
			if got == skill {
				found = true
			}
		}
		if !found {
			t.Fatalf("missing %s: %v", skill, p.CoreSkills)
		}
	}
	for _, got := range p.CoreSkills {
		if got == "C" {
			t.Fatal("C++ or C# matched C")
		}
	}
}
