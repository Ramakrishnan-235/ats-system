package api

import (
	"bytes"
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
	called  chan error
	summary chan string
	err     error
	panic   bool
}

func (s stubEvaluator) EvaluateCandidate(ctx context.Context, summary, _ string) (*models.Scorecard, error) {
	if s.summary != nil {
		s.summary <- summary
	}
	if s.called != nil {
		s.called <- ctx.Err()
	}
	if s.panic {
		panic("sensitive details")
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
