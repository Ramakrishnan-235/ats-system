package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log"
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
)

type delayedParser struct {
	delay time.Duration
	text  string
}

func (p *delayedParser) ExtractText(b []byte) (string, error) {
	time.Sleep(p.delay)
	return p.text, nil
}

func (p *delayedParser) LocateCitation(b []byte, s string) *models.PDFLocation {
	return nil
}

type panickingParser struct {
	panicVal any
}

func (p *panickingParser) ExtractText(b []byte) (string, error) {
	panic(p.panicVal)
}

func (p *panickingParser) LocateCitation(b []byte, s string) *models.PDFLocation {
	return nil
}

func createMultipartPDF(t *testing.T, filename, content string) (*bytes.Buffer, string) {
	t.Helper()
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	if _, err := part.Write([]byte(content)); err != nil {
		t.Fatalf("failed to write part: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close writer: %v", err)
	}
	return body, writer.FormDataContentType()
}

func TestUploadGoroutinesDrainedOnShutdown(t *testing.T) {
	ResetUploadState()
	defer ResetUploadState()

	uploadDir := t.TempDir()
	cfg := &config.Config{
		UploadDir:      uploadDir,
		MaxUploadBytes: 10 << 20,
	}
	st := store.NewStore()
	parser := &delayedParser{
		delay: 50 * time.Millisecond,
		text:  "Jane Doe jane@example.com Software Engineer with Go and Distributed Systems",
	}

	h := &CandidatesHandler{store: st, cfg: cfg, parser: parser}

	body, contentType := createMultipartPDF(t, "resume.pdf", "%PDF-1.4 mock content for drainage test")
	req := httptest.NewRequest(http.MethodPost, "/api/v1/candidates/upload-async", body)
	req.Header.Set("Content-Type", contentType)
	w := httptest.NewRecorder()

	h.UploadResumeAsync(w, req)
	if w.Code != http.StatusAccepted {
		t.Fatalf("expected status 202, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	taskID := resp["task_id"]
	candidateID := resp["candidate_id"]

	// Drain uploads with sufficient timeout
	drainCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := DrainUploads(drainCtx); err != nil {
		t.Fatalf("DrainUploads failed: %v", err)
	}

	// Verify task completed and candidate persisted
	task, ok := st.GetTask(taskID)
	if !ok || task.State != "SUCCESS" {
		t.Fatalf("expected task SUCCESS after drain, got ok=%v, task=%+v", ok, task)
	}

	cand, ok := st.GetCandidate(candidateID, true)
	if !ok || cand == nil {
		t.Fatalf("expected candidate to be persisted after drain, got ok=%v", ok)
	}

	// Verify PDF is preserved (not orphaned or prematurely removed)
	pdfPath := filepath.Join(uploadDir, candidateID+".pdf")
	if _, err := os.Stat(pdfPath); err != nil {
		t.Fatalf("expected PDF file to exist after successful upload, got err: %v", err)
	}
}

func TestUploadRejectedDuringDrain(t *testing.T) {
	ResetUploadState()
	defer ResetUploadState()

	uploadDir := t.TempDir()
	cfg := &config.Config{UploadDir: uploadDir, MaxUploadBytes: 10 << 20}
	st := store.NewStore()
	h := &CandidatesHandler{store: st, cfg: cfg, parser: &delayedParser{delay: 0, text: "Simple"}}

	// Set draining state
	drainCtx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	_ = DrainUploads(drainCtx)

	body, contentType := createMultipartPDF(t, "resume.pdf", "%PDF-1.4 test")
	req := httptest.NewRequest(http.MethodPost, "/api/v1/candidates/upload-async", body)
	req.Header.Set("Content-Type", contentType)
	w := httptest.NewRecorder()

	h.UploadResumeAsync(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 Service Unavailable during drain, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUploadPanicLogsValueAndCleansUpPDF(t *testing.T) {
	ResetUploadState()
	defer ResetUploadState()

	uploadDir := t.TempDir()
	cfg := &config.Config{UploadDir: uploadDir, MaxUploadBytes: 10 << 20}
	st := store.NewStore()
	expectedPanicMsg := "custom parser catastrophic failure #12345"
	parser := &panickingParser{panicVal: expectedPanicMsg}
	h := &CandidatesHandler{store: st, cfg: cfg, parser: parser}

	// Capture log output to verify panic value is logged
	var logBuf bytes.Buffer
	origOutput := log.Writer()
	log.SetOutput(&logBuf)
	defer log.SetOutput(origOutput)

	body, contentType := createMultipartPDF(t, "resume.pdf", "%PDF-1.4 test panic")
	req := httptest.NewRequest(http.MethodPost, "/api/v1/candidates/upload-async", body)
	req.Header.Set("Content-Type", contentType)
	w := httptest.NewRecorder()

	h.UploadResumeAsync(w, req)
	if w.Code != http.StatusAccepted {
		t.Fatalf("expected 202 Accepted, got %d", w.Code)
	}

	var resp map[string]string
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	taskID := resp["task_id"]
	candidateID := resp["candidate_id"]

	// Wait for goroutine to recover
	drainCtx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()
	_ = DrainUploads(drainCtx)

	// Check log output for panic message
	logStr := logBuf.String()
	if !strings.Contains(logStr, expectedPanicMsg) {
		t.Fatalf("expected panic log to contain %q, but got: %s", expectedPanicMsg, logStr)
	}

	// Verify task is marked FAILURE
	task, ok := st.GetTask(taskID)
	if !ok || task.State != "FAILURE" {
		t.Fatalf("expected task FAILURE after panic, got ok=%v, task=%+v", ok, task)
	}

	// Verify staged PDF was removed (no orphaned file left on disk)
	pdfPath := filepath.Join(uploadDir, candidateID+".pdf")
	if _, err := os.Stat(pdfPath); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("expected PDF file to be deleted on panic, but stat returned: %v", err)
	}
}

func TestUploadAbortedCleansUpPDF(t *testing.T) {
	ResetUploadState()
	defer ResetUploadState()

	uploadDir := t.TempDir()
	cfg := &config.Config{UploadDir: uploadDir, MaxUploadBytes: 10 << 20}
	st := store.NewStore()
	// Parser returns empty text which causes immediate exit before complete
	parser := &delayedParser{delay: 10 * time.Millisecond, text: ""}
	h := &CandidatesHandler{store: st, cfg: cfg, parser: parser}

	body, contentType := createMultipartPDF(t, "resume.pdf", "%PDF-1.4 empty text")
	req := httptest.NewRequest(http.MethodPost, "/api/v1/candidates/upload-async", body)
	req.Header.Set("Content-Type", contentType)
	w := httptest.NewRecorder()

	h.UploadResumeAsync(w, req)
	if w.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d", w.Code)
	}

	var resp map[string]string
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	candidateID := resp["candidate_id"]

	drainCtx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()
	_ = DrainUploads(drainCtx)

	// Verify staged PDF was deleted because extraction failed (not orphaned)
	pdfPath := filepath.Join(uploadDir, candidateID+".pdf")
	if _, err := os.Stat(pdfPath); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("expected PDF file to be removed when extraction fails, got err: %v", err)
	}
}
