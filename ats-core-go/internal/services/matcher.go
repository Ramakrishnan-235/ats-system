package services

import (
	"context"
	"math"
	"sort"
	"strings"

	"ats-core-go/internal/models"
	"ats-core-go/internal/store"
)

type MatchService struct {
	store     *store.Store
	evaluator *LLMEvaluator
}

func NewMatchService(st *store.Store, eval *LLMEvaluator) *MatchService {
	return &MatchService{
		store:     st,
		evaluator: eval,
	}
}

type CandidateScored struct {
	Candidate   *models.Candidate
	Score       float64
	Rank        int
	RerankScore float64
}

// Reciprocal Rank Fusion constant
const kRRF = 60.0

func (m *MatchService) MatchJob(ctx context.Context, jobTitle, jobDescription string, stage1Limit, stage2Limit int) ([]map[string]any, int, int, []string, bool) {
	if ctx.Err() != nil || stage1Limit <= 0 || stage2Limit <= 0 {
		return []map[string]any{}, 0, 0, []string{}, true
	}
	candidates := m.store.ListCandidates("", "", "", true)
	if len(candidates) == 0 {
		return []map[string]any{}, 0, 0, []string{}, false
	}

	queryTokens := tokenize(jobTitle + " " + jobDescription)

	// Stage 1: Lexical BM25 / Frequency Ranking
	var scoredList []CandidateScored
	for _, cand := range candidates {
		candText := cand.TargetHeadline + " " + strings.Join(cand.CoreSkills, " ") + " " + cand.RawText
		score := computeLexicalScore(queryTokens, candText)
		if score <= 0 {
			continue
		}
		scoredList = append(scoredList, CandidateScored{
			Candidate: cand,
			Score:     score,
		})
	}

	// Sort Stage 1 by score descending
	sort.Slice(scoredList, func(i, j int) bool {
		if scoredList[i].Score == scoredList[j].Score {
			return scoredList[i].Candidate.ID < scoredList[j].Candidate.ID
		}
		return scoredList[i].Score > scoredList[j].Score
	})

	if len(scoredList) > stage1Limit {
		scoredList = scoredList[:stage1Limit]
	}

	// Stage 2: Reranking / RRF Fusion
	for i := range scoredList {
		scoredList[i].Rank = i + 1
		// RRF Score: 1 / (k + rank)
		rrf := 1.0 / (kRRF + float64(i+1))
		scoredList[i].RerankScore = scoredList[i].Score*0.7 + rrf*100.0*0.3
	}

	sort.Slice(scoredList, func(i, j int) bool {
		return scoredList[i].RerankScore > scoredList[j].RerankScore
	})

	stage2List := scoredList
	if len(stage2List) > stage2Limit {
		stage2List = stage2List[:stage2Limit]
	}

	// Stage 3: Deep LLM Evaluation for Top Candidates
	finalEvals := []map[string]any{}
	failedIDs := []string{}

	for rank, item := range stage2List {
		cand := item.Candidate
		if ctx.Err() != nil {
			for _, remaining := range stage2List[rank:] {
				failedIDs = append(failedIDs, remaining.Candidate.ID)
			}
			break
		}
		candSummary := cand.TargetHeadline + ". Skills: " + strings.Join(cand.CoreSkills, ", ")
		if cand.RawText != "" {
			candSummary += "\n" + cand.RawText
		}

		candSummary = RedactKnownPII(candSummary, cand.Name, cand.Email, cand.Phone, cand.LinkedIn)
		scorecard, err := m.evaluator.EvaluateCandidate(ctx, candSummary, jobDescription)
		if err != nil || scorecard == nil || scorecard.OverallMatchScore == nil {
			failedIDs = append(failedIDs, cand.ID)
			continue
		}

		// Store updated scorecard in store
		m.store.UpdateCandidateScorecard(cand.ID, *scorecard)

		matchScoreVal := *scorecard.OverallMatchScore

		evalMap := map[string]any{
			"candidate_id": cand.ID,
			"rerank_score": item.RerankScore,
			"rerank_rank":  rank + 1,
			"evaluation": map[string]any{
				"match_score":         matchScoreVal,
				"qualification_tier":  scorecard.MatchTier,
				"executive_verdict":   "Evaluated against requisition requirements",
				"key_strengths":       scorecard.SuggestedImprovements,
				"risks_or_red_flags":  scorecard.RiskFlags,
				"suggested_questions": scorecard.SuggestedQuestions,
				"categories":          scorecard.Categories,
			},
		}
		finalEvals = append(finalEvals, evalMap)
	}

	// This implementation uses lexical reranking, not a model-backed reranker.
	return finalEvals, len(scoredList), len(stage2List), failedIDs, true
}

func tokenize(text string) []string {
	words := strings.Fields(strings.ToLower(text))
	var clean []string
	for _, w := range words {
		w = strings.Trim(w, ",!?:;\"'()[]{}")
		w = strings.TrimSuffix(w, ".")
		if len(w) > 0 {
			clean = append(clean, w)
		}
	}
	return clean
}

func computeLexicalScore(queryTokens []string, docText string) float64 {
	docTokens := tokenize(docText)
	if len(docTokens) == 0 || len(queryTokens) == 0 {
		return 0
	}

	score := 0.0
	matchedMap := make(map[string]bool)
	counts := make(map[string]int)
	for _, token := range docTokens {
		counts[token]++
	}
	uniqueQuery := make(map[string]bool)

	for _, token := range queryTokens {
		if uniqueQuery[token] {
			continue
		}
		uniqueQuery[token] = true
		count := counts[token]
		if count > 0 {
			// TF component with logarithmic dampening
			tf := 1.0 + math.Log(float64(count))
			score += tf
			matchedMap[token] = true
		}
	}

	// Keyword coverage bonus
	coverage := float64(len(matchedMap)) / float64(len(uniqueQuery))
	return score * (1.0 + coverage*2.0)
}
