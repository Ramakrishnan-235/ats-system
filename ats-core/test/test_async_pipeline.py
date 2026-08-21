import io
import os
import sys
import tempfile
import uuid
from pathlib import Path
import fitz
from fastapi.testclient import TestClient

# Add src to sys.path
src_dir = str(Path(__file__).resolve().parent.parent / "src")
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

# Add ats-core root to sys.path for main
root_dir = str(Path(__file__).resolve().parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from main import app
from ats_core.workers.celery_app import celery_app
from ats_core.workers.tasks import BaseTaskWithRetry


def create_sample_pdf_bytes() -> bytes:
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
    assert BaseTaskWithRetry.retry_backoff is True
    assert BaseTaskWithRetry.retry_jitter is True
    assert BaseTaskWithRetry.retry_kwargs["max_retries"] == 5
    assert BaseTaskWithRetry.retry_backoff_max == 300
    
    assert celery_app.conf.task_serializer == "json"
    assert celery_app.conf.result_serializer == "json"
    assert celery_app.conf.worker_prefetch_multiplier == 1
    assert celery_app.conf.task_time_limit == 300
    assert celery_app.conf.task_soft_time_limit == 240


def test_fastapi_async_upload_endpoint():
    client = TestClient(app)

    # Health Check
    health_resp = client.get("/health")
    assert health_resp.status_code == 200
    assert health_resp.json()["status"] == "HEALTHY"

    # Test PDF upload
    pdf_data = create_sample_pdf_bytes()
    files = {"file": ("test_resume.pdf", io.BytesIO(pdf_data), "application/pdf")}

    response = client.post("/api/v1/candidates/upload-async", files=files)
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "ACCEPTED"
    assert "task_id" in data
    assert "candidate_id" in data

    # Test Task Status Polling
    status_resp = client.get(f"/api/v1/candidates/tasks/{data['task_id']}")
    assert status_resp.status_code == 200
    assert "state" in status_resp.json()

    # Test Unsupported Media Type validation
    invalid_file = {"file": ("test.txt", io.BytesIO(b"Not a PDF"), "text/plain")}
    bad_resp = client.post("/api/v1/candidates/upload-async", files=invalid_file)
    assert bad_resp.status_code == 415


def test_process_resume_pdf_pipeline_direct():
    pdf_data = create_sample_pdf_bytes()
    from ats_core.parsers.pdf_parser import HybridPDFParser
    from ats_core.parsers.anonymizer import ResumeAnonymizer

    parser = HybridPDFParser()
    anonymizer = ResumeAnonymizer(min_score_threshold=0.55)

    raw_text, engine = parser.parse_pdf(pdf_data, filename="sample.pdf")
    assert len(raw_text) > 50

    sanitized_text = anonymizer.anonymize(raw_text)
    assert "John Doe" not in sanitized_text
