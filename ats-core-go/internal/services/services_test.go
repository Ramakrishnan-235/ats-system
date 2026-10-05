package services

import (
	"ats-core-go/internal/config"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

type transportFunc func(*http.Request) (*http.Response, error)

func (f transportFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func fakeEvaluator(t *testing.T, status int, result string) *LLMEvaluator {
	t.Helper()
	e := NewLLMEvaluator(&config.Config{LLMEnabled: true, OllamaURL: "http://model.invalid/v1", OllamaModel: "test-model"})
	e.httpClient.Transport = transportFunc(func(r *http.Request) (*http.Response, error) {
		var request OpenRouterRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		if strings.Contains(request.Messages[1].Content, "alex@example.com") || strings.Contains(request.Messages[1].Content, "linkedin.com/alex") {
			t.Fatal("PII reached model transport")
		}
		encoded, _ := json.Marshal(OpenRouterResponse{Choices: []OpenRouterChoice{{Message: OpenRouterMessage{Content: result}}}})
		return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(string(encoded))), Header: make(http.Header)}, nil
	})
	return e
}
func TestEvaluationValidation(t *testing.T) {
	cases := []struct {
		name, result string
		status       int
		wantError    bool
	}{
		{"missing", "{}", 200, true}, {"negative", `{"overall_match_score":-1}`, 200, true}, {"over100", `{"overall_match_score":101}`, 200, true},
		{"zero", `{"overall_match_score":0}`, 200, false}, {"valid", `{"overall_match_score":81,"qualification_tier":"NOT_FIT","criteria_breakdown":[{"score":8,"max_score":10,"quote":"Go systems","source_ref":"Page 99"}]}`, 200, false},
		{"invented evidence", `{"overall_match_score":81,"criteria_breakdown":[{"score":8,"max_score":10,"quote":"Expert in Mars"}]}`, 200, true},
		{"bad criterion", `{"overall_match_score":81,"criteria_breakdown":[{"score":11,"max_score":10}]}`, 200, true},
		{"HTTP failure", `{"overall_match_score":85}`, 503, true}, {"malformed", "bad JSON", 200, true},
		{"fenced", "```json\n{\"overall_match_score\":81}\n```", 200, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := fakeEvaluator(t, tc.status, tc.result)
			score, err := e.EvaluateCandidate(context.Background(), "Go systems alex@example.com linkedin.com/alex", "Go systems")
			if (err != nil) != tc.wantError {
				t.Fatalf("score=%+v err=%v", score, err)
			}
			if !tc.wantError {
				if score.OverallMatchScore == nil {
					t.Fatal("missing score")
				}
				if *score.OverallMatchScore == 81 && score.MatchTier != "Strong Fit Match" {
					t.Fatal("tier trusted from provider")
				}
				for _, c := range score.Categories {
					if c.SourceRef != "" {
						t.Fatal("invented page accepted")
					}
				}
			}
		})
	}
}
func TestDisabledAndCanceledEvaluationDoesNotCallProvider(t *testing.T) {
	e := NewLLMEvaluator(&config.Config{OllamaURL: "http://model.invalid"})
	e.httpClient.Transport = transportFunc(func(*http.Request) (*http.Response, error) { t.Fatal("unexpected network call"); return nil, nil })
	if score, err := e.EvaluateCandidate(context.Background(), "Go", "Go"); err == nil || score != nil {
		t.Fatal("disabled evaluation fabricated success")
	}
	e.cfg.LLMEnabled = true
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := e.EvaluateCandidate(ctx, "Go", "Go"); err == nil {
		t.Fatal("canceled call succeeded")
	}
}
func TestOversizedProviderResponse(t *testing.T) {
	e := fakeEvaluator(t, 200, "{}")
	e.httpClient.Transport = transportFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(strings.Repeat("x", (1<<20)+1)))}, nil
	})
	if _, err := e.EvaluateCandidate(context.Background(), "Go", "Go"); err == nil {
		t.Fatal("oversized response accepted")
	}
}
func TestKnownIdentifiersRedacted(t *testing.T) {
	safe := RedactKnownPII("Alex Smith alex@example.com +1 555 123 4567 https://linkedin.com/alex", "Alex Smith")
	for _, value := range []string{"Alex Smith", "alex@example.com", "555", "linkedin.com"} {
		if strings.Contains(safe, value) {
			t.Fatalf("identifier retained: %s", safe)
		}
	}
}
func TestLiteralPDFAndUnsupportedPDF(t *testing.T) {
	p := NewPDFParser()
	text, err := p.ExtractText([]byte("%PDF-1.4\nstream\nBT (Go systems) Tj [(cloud ) (work)] TJ ET\nendstream\n%%EOF"))
	if err != nil || !strings.Contains(text, "Go systems") || !strings.Contains(text, "cloud work") {
		t.Fatalf("text=%q err=%v", text, err)
	}
	for _, pdf := range []string{"Not a PDF", "%PDF-1.4 Metadata Resume Name", "%PDF-1.4 /Filter /FlateDecode\nstream\n(binary) Tj\nendstream"} {
		if _, err := p.ExtractText([]byte(pdf)); err == nil {
			t.Fatal("unsupported PDF returned resume text")
		}
	}
	if p.LocateCitation([]byte("%PDF-1.4 Go systems"), "Go systems") != nil || p.LocateCitation(nil, "") != nil {
		t.Fatal("fabricated citation geometry")
	}
}
func TestExactLexicalScores(t *testing.T) {
	for _, query := range []string{"Java", "SQL", "C"} {
		if score := computeLexicalScore(tokenize(query), "JavaScript NoSQL C++"); score != 0 {
			t.Fatalf("substring match %s: %v", query, score)
		}
	}
	for _, query := range []string{"Go", "C#", "C++", ".NET", "CI/CD"} {
		if score := computeLexicalScore(tokenize(query), query); score <= 0 {
			t.Fatalf("technical token lost %s", query)
		}
	}
	if score := computeLexicalScore(nil, "Go"); score != 0 {
		t.Fatal("empty query scored")
	}
	if computeLexicalScore(tokenize("Go Go"), "Go") != computeLexicalScore(tokenize("Go"), "Go") {
		t.Fatal("duplicate query inflated score")
	}
}

func TestRedirectDoesNotForwardCandidateData(t *testing.T) {
	e := fakeEvaluator(t, 200, `{"overall_match_score":85}`)
	calls := 0
	e.httpClient.Transport = transportFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		return &http.Response{StatusCode: 302, Header: http.Header{"Location": []string{"https://other.invalid/infer"}}, Body: io.NopCloser(strings.NewReader("")), Request: r}, nil
	})
	if _, err := e.EvaluateCandidate(context.Background(), "Go", "Go"); err == nil {
		t.Fatal("redirect accepted")
	}
	if calls != 1 {
		t.Fatal("candidate data forwarded to redirect")
	}
}

func TestEvaluationFeedbackAndTierContract(t *testing.T) {
	for _, tc := range []struct {
		score int
		tier  string
	}{
		{0, "Low Match"}, {59, "Low Match"}, {60, "Potential Fit Match"},
		{79, "Potential Fit Match"}, {80, "Strong Fit Match"}, {100, "Strong Fit Match"},
	} {
		payload, _ := json.Marshal(map[string]any{"overall_match_score": tc.score, "key_strengths": []string{"Go systems experience"}, "suggested_improvements": []string{"Add production scale metrics"}})
		e := fakeEvaluator(t, 200, string(payload))
		score, err := e.EvaluateCandidate(context.Background(), "Go systems", "Go systems")
		if err != nil {
			t.Fatal(err)
		}
		if score.MatchTier != tc.tier {
			t.Fatalf("score %d: tier %q, want %q", tc.score, score.MatchTier, tc.tier)
		}
		if len(score.KeyStrengths) != 1 || score.KeyStrengths[0] != "Go systems experience" {
			t.Fatalf("strengths lost: %+v", score)
		}
		if len(score.SuggestedImprovements) != 1 || score.SuggestedImprovements[0] != "Add production scale metrics" {
			t.Fatalf("improvements mixed with strengths: %+v", score)
		}
	}
	e := fakeEvaluator(t, 200, `{"overall_match_score":81,"key_strengths":["Go systems experience"]}`)
	score, err := e.EvaluateCandidate(context.Background(), "Go systems", "Go systems")
	if err != nil {
		t.Fatal(err)
	}
	if score.SuggestedImprovements == nil || len(score.SuggestedImprovements) != 0 {
		t.Fatalf("missing improvements must be empty: %+v", score)
	}
}
