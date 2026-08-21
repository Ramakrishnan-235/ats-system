import io
import os
import sys
import tempfile
import uuid
from pathlib import Path
import fitz
from fastapi.testclient import TestClient

# Add src to sys.path
src_dir = str(Path(__file__).resolve().parent / "src")
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

from main import app
from ats_core.workers.celery_app import celery_app
from ats_core.workers.tasks import process_resume_pdf_task, BaseTaskWithRetry


def create_sample_pdf_bytes() -> bytes:
    """Generates a sample PDF resume in memory using PyMuPDF."""
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text(
        (50, 72),
        "John Doe\n"
        "Email: john.doe@techdomain.org | Phone: +1-415-555-0199 | Location: San Francisco, CA\n"
        "Headline: Senior Distributed Backend Engineer\n\n"
        "Executive Summary:\n"
        "Senior software engineer with 7+ years of experience designing scalable microservices in Python, Go, and PostgreSQL.\n\n"
        "Work Experience:\n"
        "Lead Backend Engineer | Acme Distributed Systems (2021-03 - Present)\n"
        "- Architected high-throughput Kafka streaming pipelines processing 25M events daily.\n"
        "- Decreased database query latency by 45% using Redis caching.\n\n"
        "Core Skills:\n"
        "Python, Go, FastAPI, PostgreSQL, Redis, Kafka, Docker, Kubernetes\n"
    )
    return doc.tobytes()


def test_celery_task_configuration():
    print("\n--- 1. Testing Celery Worker & Retry Configuration ---")
    assert BaseTaskWithRetry.retry_backoff is True, "Exponential backoff must be enabled"
    assert BaseTaskWithRetry.retry_jitter is True, "Retry jitter must be enabled"
    assert BaseTaskWithRetry.retry_kwargs["max_retries"] == 5, "Max retries must be 5"
    assert BaseTaskWithRetry.retry_backoff_max == 300, "Max backoff must be capped at 300s"
    
    assert celery_app.conf.task_serializer == "json"
    assert celery_app.conf.result_serializer == "json"
    assert celery_app.conf.worker_prefetch_multiplier == 1
    assert celery_app.conf.task_time_limit == 300
    assert celery_app.conf.task_soft_time_limit == 240
    print("✓ Celery worker & exponential backoff jitter settings verified!")


def test_fastapi_async_upload_endpoint():
    print("\n--- 2. Testing FastAPI Async Ingestion & Polling Endpoints ---")
    client = TestClient(app)

    # A. Health Check
    health_resp = client.get("/health")
    assert health_resp.status_code == 200
    assert health_resp.json()["status"] == "HEALTHY"
    print("✓ GET /health verified: 200 OK")

    # B. Test PDF upload
    pdf_data = create_sample_pdf_bytes()
    files = {"file": ("test_resume.pdf", io.BytesIO(pdf_data), "application/pdf")}

    response = client.post("/api/v1/candidates/upload-async", files=files)
    assert response.status_code == 202, f"Expected 202 Accepted, got {response.status_code}"
    data = response.json()
    assert data["status"] == "ACCEPTED"
    assert "task_id" in data
    assert "candidate_id" in data
    task_id = data["task_id"]
    print(f"✓ POST /api/v1/candidates/upload-async: 202 Accepted (Task ID: {task_id})")

    # C. Test Task Status Polling
    status_resp = client.get(f"/api/v1/candidates/tasks/{task_id}")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["task_id"] == task_id
    assert "state" in status_data
    print(f"✓ GET /api/v1/candidates/tasks/{task_id}: State='{status_data['state']}'")

    # D. Test Unsupported Media Type validation
    invalid_file = {"file": ("test.txt", io.BytesIO(b"Not a PDF"), "text/plain")}
    bad_resp = client.post("/api/v1/candidates/upload-async", files=invalid_file)
    assert bad_resp.status_code == 415
    print("✓ Non-PDF rejection verified: 415 Unsupported Media Type")


def test_process_resume_pdf_pipeline_direct():
    print("\n--- 3. Testing Direct Resume Processing Pipeline ---")
    pdf_data = create_sample_pdf_bytes()
    candidate_id = str(uuid.uuid4())

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_data)
        tmp_path = tmp.name

    try:
        # Run parsing and extraction steps synchronously
        from ats_core.parsers.pdf_parser import HybridPDFParser
        from ats_core.parsers.anonymizer import ResumeAnonymizer

        parser = HybridPDFParser()
        anonymizer = ResumeAnonymizer(min_score_threshold=0.55)

        raw_text, engine = parser.parse_pdf(pdf_data, filename="sample.pdf")
        assert len(raw_text) > 50, "Expected non-empty text from PDF"

        sanitized_text = anonymizer.anonymize(raw_text)
        assert "John Doe" not in sanitized_text, "Name must be redacted"
        assert "[CANDIDATE_NAME]" in sanitized_text or "[REDACTED]" in sanitized_text or "john.doe" not in sanitized_text
        print(f"✓ PDF parsing ({engine}) & PII scrubbing verified successfully.")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


if __name__ == "__main__":
    test_celery_task_configuration()
    test_fastapi_async_upload_endpoint()
    test_process_resume_pdf_pipeline_direct()
    print("\n=======================================================")
    print("🎉 ALL ASYNC CELERY & FASTAPI PIPELINE TESTS PASSED!")
    print("=======================================================\n")
