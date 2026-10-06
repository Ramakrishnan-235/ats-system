package api

import (
	"bytes"
	"fmt"
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"ats-core-go/internal/config"
	"ats-core-go/internal/models"
	"ats-core-go/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type stubParser struct {
	text  string
	err   error
	block <-chan struct{}
}

func (s stubParser) ExtractText(_ []byte) (string, error) {
	if s.block != nil {
		<-s.block
	}
	return s.text, s.err
}
func (s stubParser) LocateCitation(_ []byte, _ string) *models.PDFLocation { return nil }

type stubEvaluator struct {
	called    chan error
	summary   chan string
	scorecard *models.Scorecard
	err       error
	panic     bool
}

func (s stubEvaluator) EvaluateCandidate(ctx context.Context, summary, _ string, _ ...string) (*models.Scorecard, error) {
	if s.summary != nil {
		s.summary <- summary
	}
	if s.called != nil {
		s.called <- ctx.Err()
	}
	if s.panic {
		panic("sensitive details")
	}
	if s.scorecard != nil {
		return s.scorecard, nil
	}
	return nil, s.err
}
func testCandidateHandler(t *testing.T) *CandidatesHandler {
	t.Helper()
	return &CandidatesHandler{store: store.GetStore(), cfg: &config.Config{UploadDir: t.TempDir(), MaxUploadBytes: 128}, parser: stubParser{text: "Actual resume text"}, evaluator: stubEvaluator{err: errors.New("provider failure")}}
}
func requestParam(method, path, key, value string, body io.Reader) *http.Request {
	req := httptest.NewRequest(method, path, body)
	ctx := chi.NewRouteContext()
	ctx.URLParams.Add(key, value)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, ctx))
}
func uploadRequest(t *testing.T, filename, data, jobID string) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	file, err := writer.CreateFormFile("file", filename)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = file.Write([]byte(data))
	if jobID != "" {
		_ = writer.WriteField("job_id", jobID)
	}
	_ = writer.Close()
	req := httptest.NewRequest(http.MethodPost, "/upload", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}
func waitTask(t *testing.T, h *CandidatesHandler, id string) *models.UploadTask {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		task, ok := h.store.GetTask(id)
		if ok && (task.State == "SUCCESS" || task.State == "FAILURE") {
			return task
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("task did not terminate")
	return nil
}
func TestAuthFailsClosed(t *testing.T) {
	cases := []struct {
		key, supplied string
		expected      int
	}{{"", "", 401}, {"secret", "", 401}, {"secret", "wrong", 401}, {"secret", "secret", 204}, {"secret", "Bearer secret", 204}, {"秘密", "秘密", 204}}
	for _, tc := range cases {
		t.Run(tc.key+tc.supplied, func(t *testing.T) {
			handler := AuthMiddleware(&config.Config{AuthEnabled: true, APIKey: tc.key})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(204) }))
			req := httptest.NewRequest("GET", "/protected", nil)
			req.Header.Set("Authorization", tc.supplied)
			rr := httptest.NewRecorder()
			handler.ServeHTTP(rr, req)
			if rr.Code != tc.expected {
				t.Fatalf("status %d, expected %d", rr.Code, tc.expected)
			}
		})
	}
}
func TestUploadRejectsInvalidWithoutCreatingFiles(t *testing.T) {
	for _, tc := range []struct {
		name, data, job string
		status          int
	}{{"resume.txt", "%PDF-valid", "", 400}, {"resume.pdf", "plain text", "", 400}, {"resume.pdf", "%PDF-" + strings.Repeat("x", 129), "", 413}, {"resume.pdf", "%PDF-valid", "missing-job", 404}} {
		t.Run(tc.name+tc.job+tc.data[:5], func(t *testing.T) {
			h := testCandidateHandler(t)
			rr := httptest.NewRecorder()
			h.UploadResumeAsync(rr, uploadRequest(t, tc.name, tc.data, tc.job))
			if rr.Code != tc.status {
				t.Fatalf("status %d: %s", rr.Code, rr.Body)
			}
			files, _ := os.ReadDir(h.cfg.UploadDir)
			if len(files) != 0 {
				t.Fatal("rejected upload persisted")
			}
		})
	}
}
func TestUploadNoJobRemainsPendingWithoutInventedFacts(t *testing.T) {
	h := testCandidateHandler(t)
	rr := httptest.NewRecorder()
	h.UploadResumeAsync(rr, uploadRequest(t, `C:\private\Alice.pdf`, "%PDF-test", ""))
	if rr.Code != 202 {
		t.Fatal(rr.Body.String())
	}
	var response map[string]string
	_ = json.Unmarshal(rr.Body.Bytes(), &response)
	task := waitTask(t, h, response["task_id"])
	if task.State != "SUCCESS" {
		t.Fatal(task)
	}
	candidate, ok := h.store.GetCandidate(response["candidate_id"], true)
	if !ok {
		t.Fatal("missing candidate")
	}
	if candidate.Scorecard.OverallMatchScore != nil || candidate.Scorecard.EvaluationStatus != "PENDING" || candidate.YearsOfExperience != nil || len(candidate.CoreSkills) != 0 || candidate.Email != "" || candidate.TargetHeadline != "" {
		t.Fatalf("fabricated profile: %#v", candidate)
	}
	if candidate.ResumeFilename != "Alice.pdf" {
		t.Fatal(candidate.ResumeFilename)
	}
}
func TestUploadPersistenceFailureIsNotAccepted(t *testing.T) {
	h := testCandidateHandler(t)
	h.cfg.UploadDir = filepath.Join(h.cfg.UploadDir, "missing")
	rr := httptest.NewRecorder()
	h.UploadResumeAsync(rr, uploadRequest(t, "resume.pdf", "%PDF-test", ""))
	if rr.Code != 500 {
		t.Fatalf("status %d", rr.Code)
	}
}
func TestUploadFailureAndPanicAreTerminalAndCleanFiles(t *testing.T) {
	for _, panics := range []bool{false, true} {
		t.Run(map[bool]string{false: "error", true: "panic"}[panics], func(t *testing.T) {
			h := testCandidateHandler(t)
			jobID := "job-" + uuid.NewString()
			h.store.SaveJob(&models.Job{ID: jobID, JobDescription: "Go development"})
			h.evaluator = stubEvaluator{err: errors.New("private endpoint token"), panic: panics}
			rr := httptest.NewRecorder()
			h.UploadResumeAsync(rr, uploadRequest(t, "resume.pdf", "%PDF-test", jobID))
			var response map[string]string
			_ = json.Unmarshal(rr.Body.Bytes(), &response)
			task := waitTask(t, h, response["task_id"])
			if task.State != "FAILURE" || strings.Contains(task.Error, "token") {
				t.Fatal(task)
			}
			if _, ok := h.store.GetCandidate(response["candidate_id"], true); ok {
				t.Fatal("failed processing published candidate")
			}
			if _, err := os.Stat(filepath.Join(h.cfg.UploadDir, response["candidate_id"]+".pdf")); !os.IsNotExist(err) {
				t.Fatal("failure retained PDF")
			}
		})
	}
}
func TestAsyncEvaluatorDoesNotUseCompletedRequestContext(t *testing.T) {
	h := testCandidateHandler(t)
	block := make(chan struct{})
	calls := make(chan error, 1)
	h.parser = stubParser{text: "Actual resume", block: block}
	h.evaluator = stubEvaluator{called: calls, err: errors.New("offline")}
	jobID := "job-" + uuid.NewString()
	h.store.SaveJob(&models.Job{ID: jobID, JobDescription: "Go development"})
	req := uploadRequest(t, "resume.pdf", "%PDF-test", jobID)
	ctx, cancel := context.WithCancel(req.Context())
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()
	h.UploadResumeAsync(rr, req)
	cancel()
	close(block)
	select {
	case err := <-calls:
		if err != nil {
			t.Fatalf("request cancellation leaked into processing: %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("evaluator not called")
	}
	var response map[string]string
	_ = json.Unmarshal(rr.Body.Bytes(), &response)
	waitTask(t, h, response["task_id"])
}
func TestMissingTasksAndPDFsNeverReturnFabricatedSuccess(t *testing.T) {
	h := testCandidateHandler(t)
	rr := httptest.NewRecorder()
	h.GetTaskStatus(rr, requestParam("GET", "/tasks/missing", "task_id", "missing", nil))
	if rr.Code != 404 {
		t.Fatal(rr.Body.String())
	}
	h.store.SaveCandidate(&models.Candidate{ID: "cand-nopdf"})
	rr = httptest.NewRecorder()
	h.LocateCitation(rr, requestParam("POST", "/citation", "candidate_id", "cand-nopdf", strings.NewReader(`{"search_phrase":"anything"}`)))
	if rr.Code != 404 {
		t.Fatal(rr.Body.String())
	}
	rr = httptest.NewRecorder()
	h.ServeResumePDF(rr, requestParam("GET", "/pdf", "candidate_id", "../../private", nil))
	if rr.Code != 400 {
		t.Fatal(rr.Body.String())
	}
}
func TestJSONAndParamsRejectInvalidWrites(t *testing.T) {
	h := testCandidateHandler(t)
	for _, body := range []string{`{"content":"note"}{"content":"second"}`, `{"content":" "}`, `{"content":5}`} {
		rr := httptest.NewRecorder()
		h.AddNote(rr, requestParam("POST", "/note", "candidate_id", "missing", strings.NewReader(body)))
		if rr.Code != 400 {
			t.Fatalf("status %d: %s", rr.Code, rr.Body)
		}
	}
	rr := httptest.NewRecorder()
	h.UpdateStage(rr, requestParam("PATCH", "/stage?new_stage=Invented", "candidate_id", "missing", nil))
	if rr.Code != 400 {
		t.Fatal(rr.Code)
	}
	tax := NewTaxonomyHandler(h.store)
	rr = httptest.NewRecorder()
	tax.ListSkills(rr, httptest.NewRequest("GET", "/skills?page=999999999999999999999&limit=100000000", nil))
	if rr.Code != 400 {
		t.Fatal(rr.Code)
	}
	match := NewMatchHandler(nil)
	rr = httptest.NewRecorder()
	match.EvaluateJob(rr, httptest.NewRequest("POST", "/match", strings.NewReader(`{"job_description":"Go","stage1_retrieve_limit":99999999}`)))
	if rr.Code != 400 {
		t.Fatal(rr.Code)
	}
}
func TestJobsValidateWritesAndUpdateSkills(t *testing.T) {
	h := NewJobsHandler(store.GetStore())
	for _, body := range []string{`{"title":" "}`, `{"title":"Engineer","job_description":"Go","min_years_experience":-1}`, `{"title":"Engineer","job_description":"Go","run_ai_match":true}`} {
		rr := httptest.NewRecorder()
		h.CreateJob(rr, httptest.NewRequest("POST", "/jobs", strings.NewReader(body)))
		if rr.Code != 400 {
			t.Fatal(rr.Code, rr.Body)
		}
	}
	id := "job-" + uuid.NewString()
	h.store.SaveJob(&models.Job{ID: id, Title: "Engineer", JobDescription: "Go", Location: "Old", RequiredSkills: []string{"Go"}})
	rr := httptest.NewRecorder()
	h.UpdateJob(rr, requestParam("PATCH", "/jobs", "job_id", id, strings.NewReader(`{"required_skills":["C++"],"location":""}`)))
	if rr.Code != 200 {
		t.Fatal(rr.Body)
	}
	job, _ := h.store.GetJob(id)
	if len(job.RequiredSkills) != 1 || job.RequiredSkills[0] != "C++" || job.Location != "" {
		t.Fatal(job)
	}
	rr = httptest.NewRecorder()
	h.UpdateJob(rr, requestParam("PATCH", "/jobs", "job_id", id, strings.NewReader(`{"title":5}`)))
	if rr.Code != 400 {
		t.Fatal(rr.Code)
	}
	rr = httptest.NewRecorder()
	h.AddJobCandidate(rr, requestParam("POST", "/jobs/candidates", "job_id", id, strings.NewReader(`{"id":"missing-candidate"}`)))
	if rr.Code != 404 {
		t.Fatal(rr.Code)
	}

	candID := "cand-" + uuid.NewString()
	h.store.SaveCandidate(&models.Candidate{
		ID:             candID,
		Name:           "Alice Smith",
		AnonymizedName: "Candidate #999",
		TargetHeadline: "Principal Architect",
		CoreSkills:     []string{"Go"},
	})
	rr = httptest.NewRecorder()
	h.AddJobCandidate(rr, requestParam("POST", "/jobs/candidates", "job_id", id, strings.NewReader(fmt.Sprintf(`{"id":"%s","name":"Candidate #999","headline":"Software Engineer"}`, candID))))
	if rr.Code != 200 {
		t.Fatal(rr.Code, rr.Body)
	}
	storedCand, ok := h.store.GetCandidate(candID, true)
	if !ok || storedCand.Name != "Alice Smith" || storedCand.TargetHeadline != "Principal Architect" {
		t.Fatalf("stored candidate identity overwritten: %+v", storedCand)
	}
	jobCands := h.store.GetJobCandidates(id, true)
	if len(jobCands) != 1 || jobCands[0].Name != "Alice Smith" || jobCands[0].Headline != "Principal Architect" {
		t.Fatalf("job candidate identity overwritten: %+v", jobCands)
	}
}

func TestBoundedJSONRejectsOversizedAndNonObjectPayloads(t *testing.T) {
	for _, tc := range []struct {
		body   string
		status int
	}{{`null`, 400}, {`[]`, 400}, {`{"title":"` + strings.Repeat("x", int(maxJSONBytes)) + `"}`, 413}} {
		t.Run(tc.body[:min(4, len(tc.body))], func(t *testing.T) {
			rr := httptest.NewRecorder()
			NewJobsHandler(store.GetStore()).CreateJob(rr, httptest.NewRequest("POST", "/jobs", strings.NewReader(tc.body)))
			if rr.Code != tc.status {
				t.Fatal(rr.Code, rr.Body)
			}
		})
	}
}
func TestUploadCapacityIsBounded(t *testing.T) {
	for i := 0; i < cap(uploadSlots); i++ {
		uploadSlots <- struct{}{}
	}
	defer func() {
		for i := 0; i < cap(uploadSlots); i++ {
			<-uploadSlots
		}
	}()
	rr := httptest.NewRecorder()
	testCandidateHandler(t).UploadResumeAsync(rr, httptest.NewRequest("POST", "/upload", nil))
	if rr.Code != 429 {
		t.Fatal(rr.Code)
	}
}

func TestUploadRedactsKnownIdentifiersBeforeEvaluator(t *testing.T) {
	h := testCandidateHandler(t)
	summaries := make(chan string, 1)
	h.parser = stubParser{text: "Alice Smith alice@example.test +1 202 555 0199 Go development"}
	h.evaluator = stubEvaluator{summary: summaries, err: errors.New("offline")}
	jobID := "job-" + uuid.NewString()
	h.store.SaveJob(&models.Job{ID: jobID, JobDescription: "Go development"})
	rr := httptest.NewRecorder()
	h.UploadResumeAsync(rr, uploadRequest(t, "Alice_Smith.pdf", "%PDF-test", jobID))
	select {
	case summary := <-summaries:
		if strings.Contains(summary, "Alice") || strings.Contains(summary, "alice@example") || strings.Contains(summary, "555") || !strings.Contains(summary, "Go development") {
			t.Fatal(summary)
		}
	case <-time.After(time.Second):
		t.Fatal("evaluator not called")
	}
	var response map[string]string
	_ = json.Unmarshal(rr.Body.Bytes(), &response)
	waitTask(t, h, response["task_id"])
}

func TestUploadAsyncWithJobCompletesAndPreservesAppliedForJobID(t *testing.T) {
	h := testCandidateHandler(t)
	score := 85.0
	h.evaluator = stubEvaluator{
		scorecard: &models.Scorecard{
			OverallMatchScore: &score,
			MatchTier:         "Strong Match",
			EvaluationStatus:  "COMPLETED",
			Categories:        []models.CategoryScore{{Name: "Technical Depth", Score: 9.0, MaxScore: 10.0, Quote: "Expert Go knowledge"}},
		},
	}
	jobID := "job-" + uuid.NewString()
	h.store.SaveJob(&models.Job{ID: jobID, Title: "Senior Go Engineer", JobDescription: "Go microservices"})

	rr := httptest.NewRecorder()
	h.UploadResumeAsync(rr, uploadRequest(t, "Bob_Builder.pdf", "%PDF-valid-data", jobID))
	if rr.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d: %s", rr.Code, rr.Body)
	}

	var uploadResp map[string]any
	_ = json.Unmarshal(rr.Body.Bytes(), &uploadResp)
	taskID, _ := uploadResp["task_id"].(string)
	candidateID, _ := uploadResp["candidate_id"].(string)
	if taskID == "" || candidateID == "" {
		t.Fatalf("missing task_id or candidate_id in upload response: %v", uploadResp)
	}

	task := waitTask(t, h, taskID)
	if task.State != "SUCCESS" {
		t.Fatalf("expected SUCCESS, got %s (error: %s)", task.State, task.Error)
	}
	if task.Progress != 100 {
		t.Fatalf("expected progress 100, got %d", task.Progress)
	}

	candidate, ok := h.store.GetCandidate(candidateID, true)
	if !ok {
		t.Fatalf("candidate not found in store: %s", candidateID)
	}
	if candidate.AppliedForJobID != jobID {
		t.Fatalf("expected AppliedForJobID %q, got %q", jobID, candidate.AppliedForJobID)
	}
	if candidate.AppliedForJob != "Senior Go Engineer" {
		t.Fatalf("expected AppliedForJob %q, got %q", "Senior Go Engineer", candidate.AppliedForJob)
	}
	if candidate.Scorecard.OverallMatchScore == nil || *candidate.Scorecard.OverallMatchScore != 85.0 {
		t.Fatalf("expected scorecard score 85.0, got %v", candidate.Scorecard.OverallMatchScore)
	}

	// Verify JobsHandler.AddJobCandidate preserves evaluation when added to the same job
	jh := NewJobsHandler(h.store)
	rrAdd := httptest.NewRecorder()
	jh.AddJobCandidate(rrAdd, requestParam("POST", "/jobs/candidates", "job_id", jobID, strings.NewReader(fmt.Sprintf(`{"id":%q}`, candidateID))))
	if rrAdd.Code != http.StatusOK {
		t.Fatalf("AddJobCandidate failed: %d %s", rrAdd.Code, rrAdd.Body)
	}
	jobCands := h.store.GetJobCandidates(jobID, true)
	var found *models.JobCandidate
	for _, jc := range jobCands {
		if jc.ID == candidateID {
			found = jc
			break
		}
	}
	if found == nil {
		t.Fatalf("candidate %s not in job candidates: %+v", candidateID, jobCands)
	}
	if found.MatchScore == nil || *found.MatchScore != 85 {
		t.Fatalf("expected MatchScore 85, got %v", found.MatchScore)
	}
	if found.MatchLabel != "Strong Match" {
		t.Fatalf("expected MatchLabel 'Strong Match', got %q", found.MatchLabel)
	}
	if found.TechnicalDepthScore == nil || *found.TechnicalDepthScore != 9.0 {
		t.Fatalf("expected TechnicalDepthScore 9.0, got %v", found.TechnicalDepthScore)
	}

	// Verify adding to an unrelated job does NOT copy scores
	otherJobID := "job-" + uuid.NewString()
	h.store.SaveJob(&models.Job{ID: otherJobID, Title: "Product Manager", JobDescription: "Roadmaps"})
	rrAddOther := httptest.NewRecorder()
	jh.AddJobCandidate(rrAddOther, requestParam("POST", "/jobs/candidates", "job_id", otherJobID, strings.NewReader(fmt.Sprintf(`{"id":%q}`, candidateID))))
	if rrAddOther.Code != http.StatusOK {
		t.Fatalf("AddJobCandidate other job failed: %d %s", rrAddOther.Code, rrAddOther.Body)
	}
	otherJobCands := h.store.GetJobCandidates(otherJobID, true)
	if len(otherJobCands) != 1 || otherJobCands[0].MatchScore != nil || otherJobCands[0].MatchLabel != "Not Evaluated" {
		t.Fatalf("expected un-evaluated for other job, got: %+v", otherJobCands[0])
	}
}

func TestPIIAccessGatedByRole(t *testing.T) {
	st := store.NewStore()
	cand := &models.Candidate{
		ID:             "cand-pii-1",
		Name:           "John Doe",
		Email:          "john@example.com",
		Phone:          "555-1234",
		AnonymizedName: "Candidate #101",
	}
	st.SaveCandidate(cand)
	job := &models.Job{ID: "job-pii-1", Title: "Dev", JobDescription: "Go"}
	st.SaveJob(job)
	st.AddJobCandidate("job-pii-1", &models.JobCandidate{ID: "cand-pii-1", Name: "John Doe"})

	candH := &CandidatesHandler{store: st}
	jobH := NewJobsHandler(st)
	dashH := NewDashboardHandler(st)

	// 1. Viewer requesting include_pii=true on Candidates -> 403
	reqViewer := httptest.NewRequest(http.MethodGet, "/candidates?include_pii=true", nil)
	reqViewer.Header.Set("X-User-Id", "viewer-1")
	reqViewer.Header.Set("X-User-Role", "viewer")
	rr := httptest.NewRecorder()
	candH.ListCandidates(rr, reqViewer)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for viewer on ListCandidates, got %d", rr.Code)
	}

	// 2. Viewer requesting include_pii=true on GetCandidate -> 403
	reqViewerCand := requestParam("GET", "/candidates/cand-pii-1?include_pii=true", "candidate_id", "cand-pii-1", nil)
	reqViewerCand.Header.Set("X-User-Id", "viewer-1")
	reqViewerCand.Header.Set("X-User-Role", "viewer")
	rr = httptest.NewRecorder()
	candH.GetCandidate(rr, reqViewerCand)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for viewer on GetCandidate, got %d", rr.Code)
	}

	// 3. Viewer requesting include_pii=true on GetJobCandidates -> 403
	reqViewerJob := requestParam("GET", "/jobs/job-pii-1/candidates?include_pii=true", "job_id", "job-pii-1", nil)
	reqViewerJob.Header.Set("X-User-Id", "viewer-1")
	reqViewerJob.Header.Set("X-User-Role", "viewer")
	rr = httptest.NewRecorder()
	jobH.GetJobCandidates(rr, reqViewerJob)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for viewer on GetJobCandidates, got %d", rr.Code)
	}

	// 4. Viewer requesting include_pii=true on Dashboard -> 403
	reqViewerDash := httptest.NewRequest(http.MethodGet, "/dashboard/stats?include_pii=true", nil)
	reqViewerDash.Header.Set("X-User-Id", "viewer-1")
	reqViewerDash.Header.Set("X-User-Role", "viewer")
	rr = httptest.NewRecorder()
	dashH.GetDashboardStats(rr, reqViewerDash)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for viewer on GetDashboardStats, got %d", rr.Code)
	}

	// 5. Viewer requesting include_pii=false -> 200 with masked data
	reqViewerMasked := httptest.NewRequest(http.MethodGet, "/candidates", nil)
	reqViewerMasked.Header.Set("X-User-Id", "viewer-1")
	reqViewerMasked.Header.Set("X-User-Role", "viewer")
	rr = httptest.NewRecorder()
	candH.ListCandidates(rr, reqViewerMasked)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for viewer on masked ListCandidates, got %d", rr.Code)
	}
	var maskedList []*models.Candidate
	_ = json.Unmarshal(rr.Body.Bytes(), &maskedList)
	if len(maskedList) != 1 || maskedList[0].Name == "John Doe" {
		t.Fatalf("expected masked name, got %s", maskedList[0].Name)
	}

	// 6. Recruiter requesting include_pii=true -> 200 with unmasked data
	reqRecruiter := httptest.NewRequest(http.MethodGet, "/candidates?include_pii=true", nil)
	reqRecruiter.Header.Set("X-User-Id", "recruiter-1")
	reqRecruiter.Header.Set("X-User-Role", "recruiter")
	rr = httptest.NewRecorder()
	candH.ListCandidates(rr, reqRecruiter)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for recruiter on ListCandidates, got %d", rr.Code)
	}
	var unmaskedList []*models.Candidate
	_ = json.Unmarshal(rr.Body.Bytes(), &unmaskedList)
	if len(unmaskedList) != 1 || unmaskedList[0].Name != "John Doe" {
		t.Fatalf("expected unmasked John Doe, got %s", unmaskedList[0].Name)
	}
}

func TestResumePDFGatedByRole(t *testing.T) {
	tempDir := t.TempDir()
	st := store.NewStore()
	candID := "cand-pdf-rbac"
	st.SaveCandidate(&models.Candidate{ID: candID, ResumeFilename: "test.pdf"})
	pdfPath := filepath.Join(tempDir, candID+".pdf")
	_ = os.WriteFile(pdfPath, []byte("%PDF-1.4 mock content"), 0600)

	h := &CandidatesHandler{store: st, cfg: &config.Config{UploadDir: tempDir}}

	// Viewer -> 403
	reqViewer := requestParam("GET", "/pdf", "candidate_id", candID, nil)
	reqViewer.Header.Set("X-User-Id", "viewer-1")
	reqViewer.Header.Set("X-User-Role", "viewer")
	rr := httptest.NewRecorder()
	h.ServeResumePDF(rr, reqViewer)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for viewer downloading resume PDF, got %d", rr.Code)
	}

	// Recruiter -> 200
	reqRecruiter := requestParam("GET", "/pdf", "candidate_id", candID, nil)
	reqRecruiter.Header.Set("X-User-Id", "recruiter-1")
	reqRecruiter.Header.Set("X-User-Role", "recruiter")
	rr = httptest.NewRecorder()
	h.ServeResumePDF(rr, reqRecruiter)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for recruiter downloading resume PDF, got %d", rr.Code)
	}
}

func TestAuditTrailAndAuditHandler(t *testing.T) {
	st := store.NewStore()
	cand := &models.Candidate{ID: "cand-aud-1", Name: "Jane Doe"}
	st.SaveCandidate(cand)

	candH := &CandidatesHandler{store: st}
	auditH := NewAuditHandler(st)

	// Attempt unauthorized access
	reqViewer := requestParam("GET", "/candidates/cand-aud-1?include_pii=true", "candidate_id", "cand-aud-1", nil)
	reqViewer.Header.Set("X-User-Id", "viewer-bad")
	reqViewer.Header.Set("X-User-Role", "viewer")
	rr := httptest.NewRecorder()
	candH.GetCandidate(rr, reqViewer)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rr.Code)
	}

	// Authorized access
	reqRecruiter := requestParam("GET", "/candidates/cand-aud-1?include_pii=true", "candidate_id", "cand-aud-1", nil)
	reqRecruiter.Header.Set("X-User-Id", "recruiter-good")
	reqRecruiter.Header.Set("X-User-Role", "recruiter")
	rr = httptest.NewRecorder()
	candH.GetCandidate(rr, reqRecruiter)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	// Viewer querying audit logs -> 403
	reqViewerAudit := httptest.NewRequest(http.MethodGet, "/audit/logs", nil)
	reqViewerAudit.Header.Set("X-User-Id", "viewer-bad")
	reqViewerAudit.Header.Set("X-User-Role", "viewer")
	rr = httptest.NewRecorder()
	auditH.GetAuditLogs(rr, reqViewerAudit)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for viewer accessing audit logs, got %d", rr.Code)
	}

	// Admin querying audit logs -> 200 and sees records
	reqAdminAudit := httptest.NewRequest(http.MethodGet, "/audit/logs", nil)
	reqAdminAudit.Header.Set("X-User-Id", "admin-1")
	reqAdminAudit.Header.Set("X-User-Role", "admin")
	rr = httptest.NewRecorder()
	auditH.GetAuditLogs(rr, reqAdminAudit)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for admin accessing audit logs, got %d", rr.Code)
	}

	var logs []*models.AuditLogEntry
	_ = json.Unmarshal(rr.Body.Bytes(), &logs)
	if len(logs) < 2 {
		t.Fatalf("expected at least 2 audit entries, got %d", len(logs))
	}
	var deniedFound, allowedFound bool
	for _, l := range logs {
		if l.Decision == "DENIED" && l.ActorID == "viewer-bad" {
			deniedFound = true
		}
		if l.Decision == "ALLOWED" && l.ActorID == "recruiter-good" {
			allowedFound = true
		}
	}
	if !deniedFound || !allowedFound {
		t.Fatalf("missing expected audit entries: denied=%v, allowed=%v", deniedFound, allowedFound)
	}
}

func TestSharedKeyWithoutRoleCannotAccessPII(t *testing.T) {
	cfg := &config.Config{
		AuthEnabled: true,
		APIKey:      "secret-key-12345",
	}
	st := store.NewStore()
	st.SaveCandidate(&models.Candidate{ID: "cand-1", Name: "Alice"})

	router := NewRouter(cfg, st, nil, nil, nil)

	// Case 1: Caller holds valid API key but NO role / identity headers
	req := httptest.NewRequest(http.MethodGet, "/api/v1/candidates?include_pii=true", nil)
	req.Header.Set("X-API-Key", "secret-key-12345")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when shared key caller requests include_pii=true without role, got %d", rr.Code)
	}

	// Case 2: Caller holds valid API key with recruiter role
	req = httptest.NewRequest(http.MethodGet, "/api/v1/candidates?include_pii=true", nil)
	req.Header.Set("X-API-Key", "secret-key-12345")
	req.Header.Set("X-User-Id", "recruiter-alice")
	req.Header.Set("X-User-Role", "recruiter")
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 when recruiter requests include_pii=true, got %d", rr.Code)
	}

	// Case 3: Caller holds valid API key with viewer role -> 403
	req = httptest.NewRequest(http.MethodGet, "/api/v1/candidates?include_pii=true", nil)
	req.Header.Set("X-API-Key", "secret-key-12345")
	req.Header.Set("X-User-Id", "viewer-bob")
	req.Header.Set("X-User-Role", "viewer")
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when viewer requests include_pii=true, got %d", rr.Code)
	}
}

func TestTaxonomyRoleGatingAndCollisionPrevention(t *testing.T) {
	cfg := &config.Config{
		AuthEnabled: true,
		APIKey:      "secret-key-tax-25",
	}
	st := store.NewStore()
	st.AddSkill(&models.TaxonomySkill{
		ID:            "skill-k8s",
		CanonicalName: "Kubernetes",
		Category:      "platform",
		Aliases:       []string{"k8s"},
		Status:        "approved",
	})
	st.AddSkill(&models.TaxonomySkill{
		ID:            "skill-pending-1",
		CanonicalName: "K3sEngine",
		Category:      "platform",
		Aliases:       []string{"k3s"},
		Status:        "pending",
	})

	router := NewRouter(cfg, st, nil, nil, nil)

	// 1. Viewer role blocked from mutations (403)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/taxonomy/skills", strings.NewReader(`{"canonical_name":"CustomTool","category":"tool"}`))
	req.Header.Set("X-API-Key", "secret-key-tax-25")
	req.Header.Set("X-User-Role", "viewer")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when viewer attempts to create skill, got %d", rr.Code)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/v1/taxonomy/sync-seed", nil)
	req.Header.Set("X-API-Key", "secret-key-tax-25")
	req.Header.Set("X-User-Role", "viewer")
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when viewer attempts sync-seed, got %d", rr.Code)
	}

	// 2. Recruiter role blocked from sync-seed (admin only)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/taxonomy/sync-seed", nil)
	req.Header.Set("X-API-Key", "secret-key-tax-25")
	req.Header.Set("X-User-Role", "recruiter")
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when recruiter attempts sync-seed, got %d", rr.Code)
	}

	// 3. Recruiter can create non-conflicting skill
	req = httptest.NewRequest(http.MethodPost, "/api/v1/taxonomy/skills", strings.NewReader(`{"canonical_name":"RecruiterTool","category":"tool","aliases":["rtool"]}`))
	req.Header.Set("X-API-Key", "secret-key-tax-25")
	req.Header.Set("X-User-Role", "recruiter")
	req.Header.Set("X-User-Id", "recruiter-1")
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201 when recruiter creates skill, got %d", rr.Code)
	}

	// 4. Collision prevention: attempting to create skill with alias that already exists -> 409
	req = httptest.NewRequest(http.MethodPost, "/api/v1/taxonomy/skills", strings.NewReader(`{"canonical_name":"ConflictingTool","category":"tool","aliases":["k8s"]}`))
	req.Header.Set("X-API-Key", "secret-key-tax-25")
	req.Header.Set("X-User-Role", "recruiter")
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409 when creating skill with conflicting alias, got %d", rr.Code)
	}

	// 5. Collision prevention: approving skill with canonical name that already exists -> 409
	req = httptest.NewRequest(http.MethodPatch, "/api/v1/taxonomy/skills/skill-pending-1/approve", strings.NewReader(`{"canonical_name":"Kubernetes"}`))
	req.Header.Set("X-API-Key", "secret-key-tax-25")
	req.Header.Set("X-User-Role", "recruiter")
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409 when approving skill with conflicting canonical name, got %d", rr.Code)
	}

	// 6. Admin can access sync-seed (reaches handler, not 403)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/taxonomy/sync-seed", nil)
	req.Header.Set("X-API-Key", "secret-key-tax-25")
	req.Header.Set("X-User-Role", "admin")
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code == http.StatusForbidden {
		t.Fatalf("expected non-403 when admin accesses sync-seed, got 403")
	}

	// 7. Verify audit logs were written
	logs := st.ListAuditLogs(50, "recruiter-1", "taxonomy:create_skill", "")
	if len(logs) == 0 {
		t.Fatalf("expected audit log entry for taxonomy:create_skill")
	}
}

func TestInputValidationAndBounds(t *testing.T) {
	cfg := &config.Config{
		AuthEnabled: true,
		APIKey:      "secret-key-bounds-27",
	}
	st := store.NewStore()
	st.SaveCandidate(&models.Candidate{
		ID:        "cand-test-1",
		Name:      "Alex Mercer",
		Stage:     "Screening",
		Scorecard: models.Scorecard{TeamNotes: []models.Note{}},
	})
	st.SaveJob(&models.Job{
		ID:    "job-test-1",
		Title: "Staff Engineer",
	})

	router := NewRouter(cfg, st, nil, nil, nil)

	// 1. Note Content Length and Anti-Spoofing
	// 1a. Empty note content rejected
	req := httptest.NewRequest(http.MethodPost, "/api/v1/candidates/cand-test-1/notes", strings.NewReader(`{"content":"   ","author":"Alice"}`))
	req.Header.Set("X-API-Key", "secret-key-bounds-27")
	req.Header.Set("X-User-Role", "recruiter")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty note content, got %d", rr.Code)
	}

	// 1b. Oversized note content (>5000 chars) rejected
	hugeContent := strings.Repeat("a", 5001)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/candidates/cand-test-1/notes", strings.NewReader(fmt.Sprintf(`{"content":%q,"author":"Alice"}`, hugeContent)))
	req.Header.Set("X-API-Key", "secret-key-bounds-27")
	req.Header.Set("X-User-Role", "recruiter")
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for oversized note content, got %d", rr.Code)
	}

	// 1c. Author spoofing prevented - binds to authenticated user identity
	req = httptest.NewRequest(http.MethodPost, "/api/v1/candidates/cand-test-1/notes", strings.NewReader(`{"content":"Solid technical interview","author":"Hacker Impersonator"}`))
	req.Header.Set("X-API-Key", "secret-key-bounds-27")
	req.Header.Set("X-User-Role", "recruiter")
	req.Header.Set("X-User-Email", "real.recruiter@corp.com")
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 when adding note, got %d", rr.Code)
	}
	cand, _ := st.GetCandidate("cand-test-1", true)
	if len(cand.Scorecard.TeamNotes) == 0 {
		t.Fatalf("expected note to be saved")
	}
	savedNote := cand.Scorecard.TeamNotes[0]
	if savedNote.Author != "real.recruiter@corp.com" {
		t.Fatalf("expected author to be bound to authenticated identity 'real.recruiter@corp.com', got '%s'", savedNote.Author)
	}

	// 2. Stage Validation
	req = httptest.NewRequest(http.MethodPatch, "/api/v1/candidates/cand-test-1/stage?new_stage=ArbitraryStage", nil)
	req.Header.Set("X-API-Key", "secret-key-bounds-27")
	req.Header.Set("X-User-Role", "recruiter")
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid candidate stage, got %d", rr.Code)
	}

	// 3. Job Title and Description Validation
	// 3a. Short title (<2 chars) rejected
	req = httptest.NewRequest(http.MethodPost, "/api/v1/jobs", strings.NewReader(`{"title":"A","job_description":"Long enough valid description here"}`))
	req.Header.Set("X-API-Key", "secret-key-bounds-27")
	req.Header.Set("X-User-Role", "recruiter")
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for short job title, got %d", rr.Code)
	}

	// 3b. Short job description (<10 chars) rejected
	req = httptest.NewRequest(http.MethodPost, "/api/v1/jobs", strings.NewReader(`{"title":"Staff Engineer","job_description":"Too short"}`))
	req.Header.Set("X-API-Key", "secret-key-bounds-27")
	req.Header.Set("X-User-Role", "recruiter")
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for short job description, got %d", rr.Code)
	}

	// 4. Taxonomy Category and Source Validation
	// 4a. Invalid category rejected
	req = httptest.NewRequest(http.MethodPost, "/api/v1/taxonomy/skills", strings.NewReader(`{"canonical_name":"NovelSkill","category":"invalid_category_xyz"}`))
	req.Header.Set("X-API-Key", "secret-key-bounds-27")
	req.Header.Set("X-User-Role", "recruiter")
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid taxonomy category, got %d", rr.Code)
	}

	// 4b. Invalid source rejected
	req = httptest.NewRequest(http.MethodPost, "/api/v1/taxonomy/skills", strings.NewReader(`{"canonical_name":"NovelSkill2","category":"tool","source":"untrusted_random_src"}`))
	req.Header.Set("X-API-Key", "secret-key-bounds-27")
	req.Header.Set("X-User-Role", "recruiter")
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid taxonomy source, got %d", rr.Code)
	}

	// 5. Rate Limiting Middleware
	testLimiter := NewSlidingWindowRateLimiter(5)
	for i := 0; i < 5; i++ {
		if !testLimiter.IsAllowed("client-test-ip") {
			t.Fatalf("expected request %d to be allowed under rate limit", i+1)
		}
	}
	if testLimiter.IsAllowed("client-test-ip") {
		t.Fatalf("expected 6th request to be blocked by rate limiter")
	}

	// 6. Memory Store Capacity and Eviction
	smallStore := store.NewStore()
	// Fill candidates up to MaxCandidatesLimit
	for i := 0; i < store.MaxCandidatesLimit+5; i++ {
		smallStore.SaveCandidate(&models.Candidate{
			ID:        fmt.Sprintf("cand-bulk-%d", i),
			Name:      fmt.Sprintf("Cand %d", i),
			CreatedAt: fmt.Sprintf("2026-01-01T%02d:00:00Z", i%24),
		})
	}
	if smallStore.CandidateCount() > store.MaxCandidatesLimit {
		t.Fatalf("expected candidates count <= %d, got %d", store.MaxCandidatesLimit, smallStore.CandidateCount())
	}

	// Fill tasks up to MaxTasksLimit
	for i := 0; i < store.MaxTasksLimit+5; i++ {
		smallStore.SaveTask(&models.UploadTask{
			TaskID: fmt.Sprintf("task-bulk-%d", i),
			State:  "SUCCESS",
		})
	}
	if smallStore.TaskCount() > store.MaxTasksLimit {
		t.Fatalf("expected task count <= %d, got %d", store.MaxTasksLimit, smallStore.TaskCount())
	}
}


