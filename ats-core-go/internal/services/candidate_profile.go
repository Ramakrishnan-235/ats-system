package services

import (
	"ats-core-go/internal/models"
	"regexp"
	"strings"
	"unicode"
)

var profileEmail = regexp.MustCompile(`(?i)[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}`)
var profilePhone = regexp.MustCompile(`(?m)(?:\+\d{1,3}[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}\b`)
var profileLinkedIn = regexp.MustCompile(`(?i)(?:https?://)?(?:www\.)?linkedin\.com/in/[a-z0-9_\-/%]+`)
var profileRole = regexp.MustCompile(`(?i)\b(engineer|developer|architect|designer|manager|lead|scientist|analyst|specialist|consultant|intern)\b`)
var profileNameNoise = regexp.MustCompile(`(?i)\b(resume|cv|curriculum|vitae|profile|summary|experience|education|skills|projects|objective|contact|actual|text|phone|email|linkedin|location|address)\b`)
var profileNameWord = regexp.MustCompile(`^[\pL][\pL.'’\-]*$`)
var profileColumns = regexp.MustCompile(`\s{2,}|\t+|\s*\|\s*`)
var profileDateRange = regexp.MustCompile(`(?i)(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+|\d{1,2}[/.-])?(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+|\d{1,2}[/.-])?(?:19|20)\d{2}|present|current|now)`)

// ExtractCandidateProfile extracts document facts independently of match scoring.
// Missing evidence stays empty; headings and job requirements are not profile facts.
func ExtractCandidateProfile(text string) *models.Candidate {
	p := &models.Candidate{Name: "Candidate", CoreSkills: []string{}, Experience: []any{}}
	p.Email = profileEmail.FindString(text)
	p.Phone = profilePhone.FindString(text)
	p.LinkedIn = profileLinkedIn.FindString(text)
	lines := strings.Split(strings.ReplaceAll(text, "\r", ""), "\n")
	for i, line := range lines {
		if i >= 8 {
			break
		}
		for _, part := range profileColumns.Split(strings.TrimSpace(line), -1) {
			part = strings.TrimSpace(strings.TrimPrefix(part, "Name:"))
			words := strings.Fields(part)
			if len(words) < 2 || len(words) > 4 || profileNameNoise.MatchString(part) || profileRole.MatchString(part) {
				continue
			}
			valid := true
			for _, word := range words {
				if !profileNameWord.MatchString(word) {
					valid = false
				}
			}
			if valid {
				p.Name = part
				break
			}
		}
		if p.Name != "Candidate" {
			break
		}
	}
	for _, line := range lines {
		line = strings.TrimSpace(line)
		lower := strings.ToLower(line)
		if strings.HasPrefix(lower, "location:") {
			p.Location = strings.TrimSpace(line[len("location:"):])
		}
		if p.TargetHeadline == "" && profileRole.MatchString(line) && len(line) < 90 && !profileDateRange.MatchString(line) && !strings.HasPrefix(line, "-") && !strings.HasPrefix(line, "•") {
			p.TargetHeadline = line
			p.Role = line
		}
	}
	// Use explicit skill sections as well as mentions in work/project descriptions.
	// Punctuation-aware boundaries preserve C++, C#, .NET and dotted framework names.
	catalog := []string{"Python", "JavaScript", "TypeScript", "Go", "Rust", "Java", "C++", "C#", "C", "Ruby", "PHP", "Swift", "Kotlin", "Scala", "SQL", "HTML", "CSS", "Bash", "React", "Next.js", "Vue.js", "Angular", "Tailwind CSS", "Bootstrap", "Redux", "Figma", "FastAPI", "Django", "Flask", "Node.js", "Express", "NestJS", "Spring Boot", "GraphQL", "REST APIs", "gRPC", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "DynamoDB", "SQLite", "Snowflake", "BigQuery", "Neo4j", "Firebase", "pgvector", "AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform", "CI/CD", "GitHub Actions", "Jenkins", "Ansible", "Linux", "Nginx", "Kafka", "RabbitMQ", "Celery", "Machine Learning", "Deep Learning", "PyTorch", "TensorFlow", "scikit-learn", "Pandas", "NumPy", "OpenCV", "Apache Spark", "Airflow", "Hadoop", "LangChain", "LlamaIndex", "NLP", "Computer Vision", "LLM", "Git", "Jira", "Agile", "Scrum", "Microservices", "System Design", "Distributed Systems", "TDD", "Postman", ".NET"}
	aliases := map[string][]string{"Go": {"Golang"}, "Kubernetes": {"K8s"}, "AWS": {"Amazon Web Services"}, "GCP": {"Google Cloud"}, "PostgreSQL": {"Postgres"}, "Node.js": {"NodeJS"}, "React": {"React.js", "ReactJS"}}
	skillText := text
	if p.Name != "Candidate" {
		skillText = strings.ReplaceAll(skillText, p.Name, "")
	}
	skillText = profileEmail.ReplaceAllString(skillText, "")
	skillText = profileLinkedIn.ReplaceAllString(skillText, "")
	for _, skill := range catalog {
		terms := append([]string{skill}, aliases[skill]...)
		for _, term := range terms {
			flags := "(?i)"
			// Short language names need exact case to avoid ordinary prose such as 'go'.
			if term == "Go" || term == "C" {
				flags = ""
			}
			pattern := regexp.MustCompile(flags + `(?:^|[^\pL\pN_+#.])` + regexp.QuoteMeta(term) + `(?:$|[^\pL\pN_+#.])`)
			if pattern.MatchString(skillText) {
				p.CoreSkills = append(p.CoreSkills, skill)
				break
			}
		}
	}
	extractEmployment(p, lines)
	return p
}

func profileSection(line string) string {
	key := strings.ToLower(strings.Trim(strings.TrimSpace(line), ":"))
	switch key {
	case "experience", "work experience", "professional experience", "employment", "employment history", "work history", "internships":
		return "experience"
	case "education", "academic background", "skills", "technical skills", "core skills", "projects", "personal projects", "certifications", "summary", "professional summary", "objective", "achievements", "awards", "languages", "interests", "references":
		return "other"
	}
	return ""
}

func extractEmployment(p *models.Candidate, lines []string) {
	active := false
	var pending []string
	var entry map[string]any
	var description []string
	flush := func() {
		if entry != nil {
			entry["description"] = strings.Join(description, "\n")
			p.Experience = append(p.Experience, entry)
		}
		entry = nil
		description = nil
	}
	for _, raw := range lines {
		line := strings.TrimSpace(raw)
		if line == "" {
			continue
		}
		if section := profileSection(line); section != "" {
			flush()
			pending = nil
			active = section == "experience"
			continue
		}
		if !active {
			continue
		}
		period := profileDateRange.FindString(line)
		bullet := strings.HasPrefix(line, "•") || strings.HasPrefix(line, "-") || strings.HasPrefix(line, "*")
		if period == "" {
			if bullet && entry != nil {
				description = append(description, line)
				continue
			}
			// Keep non-bullet lines until a date boundary confirms the next role.
			pending = append(pending, line)
			continue
		}
		flush()
		header := strings.Trim(strings.Replace(line, period, "", 1), " |,–—-:")
		headers := append(pending, header)
		role, company := "", ""
		for _, h := range headers {
			for _, part := range regexp.MustCompile(`\s+at\s+|\s+@\s+|\s*\|\s*|\s+[–—-]\s+`).Split(h, -1) {
				part = strings.TrimSpace(part)
				if part == "" {
					continue
				}
				if profileRole.MatchString(part) {
					role = part
				} else if company == "" {
					company = part
				}
			}
		}
		pending = nil
		dates := regexp.MustCompile(`(?i)\s*(?:–|—|\s+to\s+|\s+-\s+)\s*`).Split(period, 2)
		// Bare year ranges use a hyphen without spaces.
		if len(dates) < 2 {
			dates = strings.SplitN(period, "-", 2)
		}
		entry = map[string]any{"role": role, "company": company, "period": period, "is_current_role": strings.Contains(strings.ToLower(period), "present") || strings.Contains(strings.ToLower(period), "current") || strings.Contains(strings.ToLower(period), "now")}
		if len(dates) == 2 {
			entry["start_date"] = strings.TrimSpace(dates[0])
			entry["end_date"] = strings.TrimSpace(dates[1])
		}
	}
	if entry != nil {
		description = append(description, pending...)
	}
	flush()
}

// ProfileIdentifiers returns explicit identifiers to remove before scoring.
func ProfileIdentifiers(p *models.Candidate) []string {
	if p == nil {
		return []string{}
	}
	identifiers := []string{}
	if strings.TrimSpace(p.Email) != "" && !strings.EqualFold(p.Email, "N/A") {
		identifiers = append(identifiers, strings.TrimSpace(p.Email))
	}
	if strings.TrimSpace(p.Phone) != "" && !strings.EqualFold(p.Phone, "N/A") {
		identifiers = append(identifiers, strings.TrimSpace(p.Phone))
	}
	if strings.TrimSpace(p.Location) != "" && !strings.EqualFold(p.Location, "N/A") && !strings.EqualFold(p.Location, "Remote") {
		identifiers = append(identifiers, strings.TrimSpace(p.Location))
	}
	if strings.TrimSpace(p.LinkedIn) != "" && !strings.EqualFold(p.LinkedIn, "N/A") {
		identifiers = append(identifiers, strings.TrimSpace(p.LinkedIn))
	}
	if p.Name != "" && !strings.EqualFold(p.Name, "Candidate") && strings.IndexFunc(p.Name, unicode.IsLetter) >= 0 {
		cleanName := strings.TrimSpace(p.Name)
		identifiers = append(identifiers, cleanName)
		// Also add individual name tokens (length >= 3) to redact first/last name occurrences
		for _, token := range strings.Fields(cleanName) {
			token = strings.Trim(token, ".,()[]")
			if len(token) >= 3 && !profileNameNoise.MatchString(token) && !profileRole.MatchString(token) {
				identifiers = append(identifiers, token)
			}
		}
	}
	return identifiers
}
