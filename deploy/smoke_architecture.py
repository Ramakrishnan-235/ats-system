"""Exercise real PostgreSQL, private S3 and Redis/Celery with a synthetic PDF.

Run with ats-core's Python environment. Requires the architecture infrastructure
and a compiled native Rust binary; starts and stops only its own test processes.
No live language or embedding models are used in this infrastructure smoke test.
"""

import argparse
import io
import os
import subprocess
import sys
import time
from pathlib import Path
from uuid import uuid4

import fitz
import httpx
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]


def wait_ready(url, process, deadline=60):
    until = time.monotonic() + deadline
    while time.monotonic() < until:
        if process.poll() is not None:
            raise RuntimeError("Test service exited; inspect private smoke logs")
        try:
            if httpx.get(url, timeout=2).status_code == 200:
                return
        except httpx.HTTPError:
            pass
        time.sleep(0.5)
    raise RuntimeError("Test service readiness timed out")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--core-binary", type=Path, required=True)
    parser.add_argument("--models", action="store_true", help="Also verify the existing local EmbeddingGemma and Gemma services")
    parser.add_argument("--deployed", action="store_true", help="Exercise the running containers through the frontend proxy")
    args = parser.parse_args()
    config = dotenv_values(ROOT / ".env.architecture")
    env = os.environ.copy()
    env.update({k: v for k, v in config.items() if v is not None})
    env.update(
        DATABASE_URL=f"postgresql://ats_runtime:{config['ATS_RUNTIME_DATABASE_PASSWORD']}@127.0.0.1:5544/ats_architecture",
        ATS_MIGRATION_DATABASE_URL=f"postgresql://ats_migrator:{config['ATS_DATABASE_PASSWORD']}@127.0.0.1:5544/ats_architecture",
        ATS_BIND="127.0.0.1:18080",
        ATS_CORE_URL="http://127.0.0.1:18080",
        ATS_AI_URL="http://127.0.0.1:18100",
        AWS_ENDPOINT="http://127.0.0.1:9002",
        AWS_BUCKET="ats-documents",
        AWS_REGION="us-east-1",
        AWS_ACCESS_KEY_ID=config["ATS_STORAGE_ACCESS_KEY"],
        AWS_SECRET_ACCESS_KEY=config["ATS_STORAGE_SECRET_KEY"],
        ATS_S3_ALLOW_HTTP="true",
        ATS_STORAGE_BACKEND="s3",
        ATS_AI_ENABLE_LLM="false",
        ATS_AI_ENABLE_EMBEDDINGS="false",
        ATS_ALLOW_SIGNUP="true",
        ATS_SECURE_COOKIE="false",
        REDIS_URL="redis://127.0.0.1:6380/5",
        PYTHONPATH=str(ROOT / "ats-core" / "src"),
        PYTHONUNBUFFERED="1",
        LANGSMITH_TRACING="false",
        RUST_LOG="ats_backend=info",
    )
    logs = ROOT / ".local-runtime" / "smoke"
    if args.models:
        env.update(ATS_AI_ENABLE_LLM="true", ATS_AI_ENABLE_EMBEDDINGS="true", ATS_EMBEDDING_BACKEND="http", ATS_EMBEDDING_BASE_URL="http://127.0.0.1:8001", ATS_EMBEDDING_MODEL="google/embeddinggemma-2", OLLAMA_BASE_URL="http://127.0.0.1:11435/v1", OLLAMA_MODEL="gemma4:e2b", OPENROUTER_API_KEY="", LLM_API_KEY="")
    logs.mkdir(parents=True, exist_ok=True)
    handles, processes = [], []

    def start(command, label):
        log = (logs / f"{label}.log").open("w", encoding="utf-8")
        handles.append(log)
        process = subprocess.Popen(command, cwd=ROOT / "ats-core", env=env, stdout=log, stderr=subprocess.STDOUT)
        processes.append(process)
        return process

    try:
        if not args.deployed:
            core = start([str(args.core_binary.resolve())], "core")
            wait_ready("http://127.0.0.1:18080/ready", core)
            ai = start([sys.executable, "-m", "uvicorn", "ai_main:app", "--host", "127.0.0.1", "--port", "18100"], "ai")
            wait_ready("http://127.0.0.1:18100/health", ai)
            start([sys.executable, "-m", "celery", "-A", "ats_core.ai_api.worker:celery_app", "worker", "--pool=solo", "--concurrency=1", "--loglevel=INFO"], "worker")
        base_url = "http://localhost:3000/core-api" if args.deployed else "http://127.0.0.1:18080"
        with httpx.Client(base_url=base_url, headers={"origin": "http://localhost:3000"}, timeout=30) as client:
            suffix = str(uuid4())
            registration = client.post("/api/v1/auth/register", json={"email": f"smoke-{suffix}@example.test", "password": str(uuid4()) + str(uuid4()), "name": "Synthetic Smoke Owner", "workspace_name": f"Smoke test {suffix}", "workspace_kind": "agency"})
            registration.raise_for_status()
            job = client.post("/api/v1/jobs", json={"title": "Python developer", "job_description": "Develop Python APIs and SQL services"})
            job.raise_for_status()
            pdf = fitz.open()
            page = pdf.new_page()
            page.insert_text((50, 50), "Synthetic Candidate\nsynthetic.candidate@example.test\nPython Developer\nSKILLS\nPython, SQL, Docker\nEXPERIENCE\nSoftware Engineer Jan 2020 - Dec 2022\nExample Systems\nDeveloped Python APIs and optimized SQL queries by 30%.")
            document = pdf.tobytes()
            pdf.close()
            uploaded = client.post("/api/v1/candidates/upload-async", headers={"idempotency-key": suffix}, files={"file": ("synthetic-resume.pdf", io.BytesIO(document), "application/pdf")}, data={"job_id": job.json()["id"]})
            uploaded.raise_for_status()
            identity = uploaded.json()
            until = time.monotonic() + 600
            while time.monotonic() < until:
                status = client.get(f"/api/v1/candidates/tasks/{identity['task_id']}")
                status.raise_for_status()
                if status.json()["state"] in {"SUCCESS", "FAILURE"}:
                    assert status.json()["state"] == "SUCCESS", "Real ingestion failed; inspect smoke logs"
                    break
                time.sleep(1)
            else:
                raise RuntimeError("Real ingestion timed out")
            detail = client.get(f"/api/v1/candidates/{identity['candidate_id']}")
            detail.raise_for_status()
            profile = detail.json()
            assert profile["is_pii_masked"] and "synthetic.candidate@example.test" not in detail.text
            assert "Python" in profile["core_skills"]
            assert profile["applications"][0]["stage"] == "Recruiter Review"
            if args.models:
                assert profile["scorecard"]["evaluation_status"] == "COMPLETED", "Local model evaluation did not complete"
                assert profile["scorecard"]["categories"], "Local model returned no rubric evidence"
                assert isinstance(profile["scorecard"]["overall_match_score"], (int,float))
                import psycopg2
                with psycopg2.connect(env["DATABASE_URL"]) as db:
                    with db.cursor() as cursor:
                        who=client.get("/api/v1/auth/me").json()
                        cursor.execute("SELECT set_config('ats.tenant_id',%s,true)",(who["user"]["tenant_id"],))
                        cursor.execute("SELECT vector_dims(e.embedding) FROM ats_v2.embeddings e JOIN ats_v2.documents d ON d.id=e.document_id AND d.tenant_id=e.tenant_id WHERE d.candidate_id=%s",(identity["candidate_id"],))
                        assert cursor.fetchone()==(768,), "Expected a stored real 768-dimensional model vector"
            original = client.get(f"/api/v1/candidates/{identity['candidate_id']}/resume-pdf")
            original.raise_for_status()
            assert original.content == document
            customer = client.post("/api/v1/clients", json={"name": "Synthetic Customer"})
            customer.raise_for_status()
            submission = client.post("/api/v1/submissions", json={"client_id": customer.json()["id"], "application_id": profile["applications"][0]["id"]})
            submission.raise_for_status()
            assert len(client.get("/api/v1/submissions").json()) == 1
            assert client.get("/api/v1/analytics").json()["stages"][0]["count"] == 1
            if not args.deployed:
                core.terminate()
                core.wait(timeout=30)
                core = start([str(args.core_binary.resolve())], "core-restarted")
                wait_ready("http://127.0.0.1:18080/ready", core)
            persisted = client.get(f"/api/v1/candidates/{identity['candidate_id']}")
            persisted.raise_for_status()
            assert persisted.json()["core_skills"] == profile["core_skills"]
        print("PASS: real PDF -> private S3 -> outbox -> Redis/Celery -> parser -> authenticated result; masked profile, original PDF, agency submission and analytics.")
        print("PASS: frontend proxy and container worker." if args.deployed else "PASS: session and profile persistence after core process restart.")
        if args.models:
            print("PASS: local Gemma evaluation saved to the application and real EmbeddingGemma vector stored with 768 dimensions.")
    finally:
        for process in reversed(processes):
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=30)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
        for log in handles:
            log.close()


if __name__ == "__main__":
    main()
