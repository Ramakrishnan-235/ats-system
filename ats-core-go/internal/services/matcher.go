package services

import (
	"context"
	"math"
	"sort"
	"strings"
	"sync"

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
	evals, s1, s2, failed, fallback, _ := m.MatchJobForRequisition(ctx, "", jobTitle, jobDescription, stage1Limit, stage2Limit)
	return evals, s1, s2, failed, fallback
}

func (m *MatchService) MatchJobForRequisition(ctx context.Context, jobID, jobTitle, jobDescription string, stage1Limit, stage2Limit int) ([]map[string]any, int, int, []string, bool, []*models.JobCandidate) {
	if ctx.Err() != nil || stage1Limit <= 0 || stage2Limit <= 0 {
		return []map[string]any{}, 0, 0, []string{}, true, []*models.JobCandidate{}
	}
	candidates := m.store.ListCandidates("", "", "", true)
	if len(candidates) == 0 {
		return []map[string]any{}, 0, 0, []string{}, false, []*models.JobCandidate{}
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

	// Stage 3: Deep LLM Evaluation for Top Candidates (Concurrent with bounded concurrency)
	type evalResult struct {
		scorecard *models.Scorecard
		failedID  string
	}

	results := make([]evalResult, len(stage2List))
	maxConcurrency := 10
	if len(stage2List) < maxConcurrency {
		maxConcurrency = len(stage2List)
	}
	if maxConcurrency < 1 {
		maxConcurrency = 1
	}

	sem := make(chan struct{}, maxConcurrency)
	var wg sync.WaitGroup

	for rank, item := range stage2List {
		wg.Add(1)
		go func(idx int, it CandidateScored) {
			defer wg.Done()
			select {
			case sem <- struct{}{}:
			case <-ctx.Done():
				results[idx] = evalResult{failedID: it.Candidate.ID}
				return
			}
			defer func() { <-sem }()

			if ctx.Err() != nil {
				results[idx] = evalResult{failedID: it.Candidate.ID}
				return
			}

			cand := it.Candidate
			candSummary := cand.TargetHeadline + ". Skills: " + strings.Join(cand.CoreSkills, ", ")
			if cand.RawText != "" {
				candSummary += "\n" + cand.RawText
			}

			candSummary = RedactKnownPII(candSummary, cand.Name, cand.Email, cand.Phone, cand.LinkedIn)
			scorecard, err := m.evaluator.EvaluateCandidate(ctx, candSummary, jobDescription)
			if err != nil || scorecard == nil || scorecard.OverallMatchScore == nil {
				results[idx] = evalResult{failedID: cand.ID}
				return
			}
			results[idx] = evalResult{scorecard: scorecard}
		}(rank, item)
	}

	wg.Wait()

	finalEvals := []map[string]any{}
	failedIDs := []string{}

	for rank, item := range stage2List {
		cand := item.Candidate
		res := results[rank]
		if res.failedID != "" {
			failedIDs = append(failedIDs, res.failedID)
			continue
		}
		if res.scorecard == nil || res.scorecard.OverallMatchScore == nil {
			failedIDs = append(failedIDs, cand.ID)
			continue
		}

		scorecard := res.scorecard
		// Store updated scorecard in store
		m.store.UpdateCandidateScorecard(cand.ID, *scorecard)

		matchScoreVal := *scorecard.OverallMatchScore

		if jobID != "" {
			var techScore, sysScore *float64
			for _, cat := range scorecard.Categories {
				if strings.Contains(strings.ToLower(cat.Name), "technical") {
					ts := cat.Score
					techScore = &ts
				} else if strings.Contains(strings.ToLower(cat.Name), "system") {
					ss := cat.Score
					sysScore = &ss
				}
			}
			var potGap string
			if len(scorecard.RiskFlags) > 0 {
				potGap = scorecard.RiskFlags[0]
			}
			scoreInt := int(math.Round(matchScoreVal))
			jc := &models.JobCandidate{
				ID:                  cand.ID,
				Name:                cand.Name,
				Headline:            cand.TargetHeadline,
				Avatar:              "CD",
				IsImageAvatar:       false,
				MatchScore:          &scoreInt,
				MatchLabel:          scorecard.MatchTier,
				Skills:              cand.CoreSkills,
				Stage:               cand.Stage,
				StageBadgeStyle:     "bg-emerald-50 text-emerald-700 border-emerald-200",
				TechnicalDepthScore: techScore,
				SystemDesignScore:   sysScore,
				Quote:               "Evaluated against requisition requirements",
				SourceResumeLink:    "/candidates/" + cand.ID,
				PotentialGap:        potGap,
				SuggestedQuestions:  scorecard.SuggestedQuestions,
			}
			m.store.AddJobCandidate(jobID, jc)
		}

		evalMap := map[string]any{
			"candidate_id": cand.ID,
			"rerank_score": item.RerankScore,
			"rerank_rank":  rank + 1,
			"evaluation": map[string]any{
				"match_score":            matchScoreVal,
				"qualification_tier":     scorecard.MatchTier,
				"executive_verdict":      "Evaluated against requisition requirements",
				"key_strengths":          scorecard.KeyStrengths,
				"suggested_improvements": scorecard.SuggestedImprovements,
				"risks_or_red_flags":     scorecard.RiskFlags,
				"suggested_questions":    scorecard.SuggestedQuestions,
				"categories":             scorecard.Categories,
			},
		}
		finalEvals = append(finalEvals, evalMap)
	}

	var jobCandidates []*models.JobCandidate
	if jobID != "" {
		jobCandidates = m.store.GetJobCandidates(jobID, false)
	} else {
		jobCandidates = []*models.JobCandidate{}
	}

	// This implementation uses lexical reranking, not a model-backed reranker.
	return finalEvals, len(scoredList), len(stage2List), failedIDs, true, jobCandidates
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
