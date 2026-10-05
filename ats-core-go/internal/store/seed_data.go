package store

import (
	"fmt"
	"ats-core-go/internal/models"
)

func (s *Store) seedInitialJobs() {
	rawJobs := []struct {
		ID             string
		Title          string
		Department     string
		Location       string
		Description    string
		MinYears       float64
		Skills         []string
		IconType       string
		TopMatchScore  int
		PostedDate     string
	}{
		{
			ID: "job-001", Title: "Generative AI Developer", Department: "AI & Intelligent Systems",
			Location: "Remote / San Francisco",
			Description: "Builds applications using LLMs, prompt frameworks, and vector databases. Designs retrieval-augmented generation (RAG) pipelines, fine-tunes embeddings, and integrates cutting-edge foundation models.",
			MinYears: 3.0, Skills: []string{"LLMs", "LangChain", "Vector Databases", "Prompt Engineering", "Python", "RAG", "Embeddings"},
			IconType: "ai", TopMatchScore: 96, PostedDate: "2026-02-10",
		},
		{
			ID: "job-002", Title: "AI/ML Engineer", Department: "AI & Intelligent Systems",
			Location: "New York / Hybrid",
			Description: "Designs and develops core machine learning models and predictive algorithms. Trains, optimizes, and evaluates deep learning architectures for enterprise workloads.",
			MinYears: 4.0, Skills: []string{"PyTorch", "TensorFlow", "Scikit-learn", "Python", "Machine Learning", "MLOps"},
			IconType: "ai", TopMatchScore: 94, PostedDate: "2026-02-08",
		},
		{
			ID: "job-003", Title: "MLOps Engineer", Department: "AI & Intelligent Systems",
			Location: "Remote",
			Description: "Deploys, monitors, and manages the lifecycle of machine learning pipelines. Establishes automated CI/CD for ML models, drift detection, and GPU serving.",
			MinYears: 4.0, Skills: []string{"MLflow", "Kubeflow", "Docker", "Kubernetes", "CI/CD", "Model Monitoring", "Python"},
			IconType: "ai", TopMatchScore: 91, PostedDate: "2026-02-05",
		},
		{
			ID: "job-004", Title: "Cloud Architect", Department: "Cloud & Infrastructure",
			Location: "Remote / Austin, TX",
			Description: "Designs overarching cloud strategy, migration plans, and multi-cloud architectures. Optimizes cloud cost, reliability, security, and hybrid-cloud topologies.",
			MinYears: 7.0, Skills: []string{"AWS", "Azure", "GCP", "Cloud Architecture", "Terraform", "Microservices"},
			IconType: "cloud", TopMatchScore: 95, PostedDate: "2026-02-12",
		},
		{
			ID: "job-005", Title: "Site Reliability Engineer (SRE)", Department: "Cloud & Infrastructure",
			Location: "Remote / New York",
			Description: "Focuses on system availability, automation, and large-scale infrastructure resilience. Implements SLOs/SLAs, distributed tracing, and automated incident remediation.",
			MinYears: 5.0, Skills: []string{"SRE", "Prometheus", "Grafana", "Distributed Systems", "Incident Management", "Go", "Python"},
			IconType: "cloud", TopMatchScore: 92, PostedDate: "2026-02-02",
		},
		{
			ID: "job-006", Title: "Senior Backend Engineer (Go / Distributed)", Department: "Core Engineering",
			Location: "Remote",
			Description: "Architects and maintains ultra-high-throughput microservices, streaming event buses, and distributed database clusters.",
			MinYears: 5.0, Skills: []string{"Go", "gRPC", "PostgreSQL", "Kafka", "Redis", "Distributed Systems"},
			IconType: "code", TopMatchScore: 98, PostedDate: "2026-02-15",
		},
		{
			ID: "job-007", Title: "Lead Frontend Engineer (Next.js / React)", Department: "Product Engineering",
			Location: "San Francisco / Remote",
			Description: "Builds responsive, accessible, and delightful web applications. Drives frontend architecture, component design systems, and Web Vital optimization.",
			MinYears: 5.0, Skills: []string{"React", "Next.js", "TypeScript", "TailwindCSS", "State Management"},
			IconType: "code", TopMatchScore: 93, PostedDate: "2026-02-14",
		},
		{
			ID: "job-008", Title: "Staff Security Engineer", Department: "Cybersecurity & Governance",
			Location: "Remote / Washington DC",
			Description: "Leads zero-trust architecture, threat modeling, vulnerability management, and automated security scanning across the enterprise stack.",
			MinYears: 6.0, Skills: []string{"Zero Trust", "Application Security", "Threat Modeling", "Penetration Testing", "OAuth2", "SOC2"},
			IconType: "security", TopMatchScore: 90, PostedDate: "2026-02-01",
		},
	}

	for _, j := range rawJobs {
		topScore := j.TopMatchScore
		job := &models.Job{
			ID:                 j.ID,
			Title:              j.Title,
			Department:         j.Department,
			Location:           j.Location,
			Status:             "OPEN",
			PostedDate:         j.PostedDate,
			CandidatesCount:    0,
			Avatars:            []string{},
			TopMatch: models.TopMatchInfo{
				Score:   &topScore,
				Label:   "AI Screened",
				LastRun: j.PostedDate,
				Status:  "ACTIVE",
			},
			IconType:           j.IconType,
			JobDescription:     j.Description,
			MinYearsExperience: j.MinYears,
			RequiredSkills:     j.Skills,
			StructuredCriteria: models.StructuredCriteria{
				TechnicalDepthWeight:  0.4,
				DomainExpertiseWeight: 0.4,
				ExecutionWeight:       0.2,
			},
			CreatedAt: fmt.Sprintf("%sT09:00:00Z", j.PostedDate),
			UpdatedAt: fmt.Sprintf("%sT09:00:00Z", j.PostedDate),
		}
		s.jobs[job.ID] = job
	}
}

func (s *Store) seedInitialTaxonomy() {
	seedSkills := []struct {
		Canonical string
		Category  string
		Aliases   []string
	}{
		{"Go", "language", []string{"Golang"}},
		{"Python", "language", []string{"Py", "Python3"}},
		{"TypeScript", "language", []string{"TS"}},
		{"JavaScript", "language", []string{"JS", "ES6"}},
		{"Rust", "language", []string{}},
		{"PostgreSQL", "database", []string{"Postgres", "psql"}},
		{"Redis", "database", []string{}},
		{"Docker", "platform", []string{"Containers"}},
		{"Kubernetes", "platform", []string{"k8s"}},
		{"FastAPI", "framework", []string{}},
		{"Next.js", "framework", []string{"NextJS", "Next"}},
		{"React", "framework", []string{"React.js"}},
		{"PyTorch", "library", []string{"Torch"}},
		{"LangChain", "library", []string{}},
		{"Vector Databases", "database", []string{"pgvector", "milvus", "qdrant", "chroma"}},
		{"Terraform", "tool", []string{"IAC"}},
		{"AWS", "platform", []string{"Amazon Web Services"}},
	}

	for i, sk := range seedSkills {
		id := fmt.Sprintf("skill-seed-%03d", i+1)
		s.skills[id] = &models.TaxonomySkill{
			ID:              id,
			CanonicalName:   sk.Canonical,
			Category:        sk.Category,
			Aliases:         sk.Aliases,
			IsAmbiguous:     false,
			Status:          "approved",
			Source:          "curated",
			OccurrenceCount: 1,
			TaxonomyVersion: "2026.1",
			CreatedAt:       models.NowUTC(),
			UpdatedAt:       models.NowUTC(),
		}
	}
}
