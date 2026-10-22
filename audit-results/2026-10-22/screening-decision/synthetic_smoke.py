"""Exercise the real local stack using entirely fictional job/resume evidence."""
import json
import sys
from io import BytesIO
from pathlib import Path
from uuid import uuid4

import httpx
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent
STATE = ROOT / "live-results.json"
CASES = {
    "backend": [
        "SYNTHETIC TEST RESUME - Backend Engineer",
        "Professional experience: Backend Engineer, Example Software, 2020-2026 (six years).",
        "Designed and operated Python FastAPI REST APIs with PostgreSQL for a retail SaaS platform.",
        "Owned schema design, migrations, query tuning, API authentication and automated pytest tests.",
        "Designed a Docker-based service architecture with Redis queues and retry-safe background jobs.",
        "Optimized database queries and caching to reduce p95 API latency from 800ms to 150ms.",
        "Led design reviews and delivered production API releases with CI/CD and observability.",
        "Core skills: Python, FastAPI, PostgreSQL, Docker, Redis, REST APIs, pytest, Git, CI/CD.",
    ],
    "retail": [
        "SYNTHETIC TEST RESUME - Retail Sales Associate",
        "Professional experience: Retail Sales Associate, Example Retail, 2020-2026 (six years).",
        "Processed in-store sales, arranged stock displays, and assisted customers with purchases.",
        "Managed daily inventory counts and reconciled cash register transactions.",
        "Increased store accessory sales by 12 percent through product demonstrations.",
        "My professional work is retail sales; I have no programming or software development experience.",
        "I have never built software applications, APIs, databases, or deployment systems.",
        "Core skills: Customer service, retail sales, inventory counting, cash handling.",
    ],
}


def pdf(lines):
    output = BytesIO()
    document = canvas.Canvas(output)
    document.setTitle("Fictional ATS screening verification")
    document.setFont("Helvetica", 9)
    for index, line in enumerate(lines):
        document.drawString(32, 800 - index * 24, line)
    document.save()
    return output.getvalue()


def checked(response):
    response.raise_for_status()
    return response.json()


with httpx.Client(base_url="http://127.0.0.1:8080/api/v1", timeout=40,
                  headers={"Origin": "http://localhost:3000"}) as client:
    me = checked(client.get("/auth/me"))
    assert me.get("development_mode"), "Only run in the existing local development workspace"
    if sys.argv[1] == "start":
        assert not STATE.exists(), "A previous smoke run already exists; use check"
        job = checked(client.post("/jobs", json={
            "title": "QA LLM Decision Explanation - Python Backend - 2026-10-22",
            "department": "Synthetic verification",
            "job_description": "Develop and own production Python FastAPI REST APIs backed by PostgreSQL. Use Docker and automated tests. Demonstrate relevant backend ownership and measurable service improvements.",
            "required_skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
            "min_years_experience": 3, "status": "OPEN",
        }))
        run = {"job_id": job["id"], "cases": {}, "synthetic_only": True}
        # Save identities immediately so a retry never duplicates test records.
        STATE.write_text(json.dumps(run, indent=2), encoding="utf-8")
        for name, lines in CASES.items():
            data = pdf(lines)
            (ROOT / f"synthetic-{name}.pdf").write_bytes(data)
            upload = checked(client.post("/candidates/upload-async",
                headers={"Idempotency-Key": str(uuid4())},
                data={"job_id": job["id"], "name": f"Synthetic {name} decision test",
                      "headline": f"Synthetic {name} screening verification"},
                files={"file": (f"synthetic-{name}.pdf", data, "application/pdf")}))
            run["cases"][name] = {"upload": upload}
            STATE.write_text(json.dumps(run, indent=2), encoding="utf-8")
        print(json.dumps(run, indent=2))
    elif sys.argv[1] == "check":
        run = json.loads(STATE.read_text(encoding="utf-8"))
        complete = True
        for name, case in run["cases"].items():
            task = checked(client.get(f"/candidates/tasks/{case['upload']['task_id']}"))
            case["task"] = task
            if task["state"] != "SUCCESS":
                complete = False
                print(name, task["state"], task.get("error", ""))
                continue
            candidate_id = task["result"]["candidate_id"]
            profile = checked(client.get(f"/candidates/{candidate_id}", params={"job_id": run["job_id"]}))
            case["candidate_id"] = candidate_id
            case["stage"] = profile["stage"]
            case["scorecard"] = profile["scorecard"]
            card = case["scorecard"]
            print(name, card.get("evaluation_status"), card.get("screening_decision"), card.get("decision_explanation"))
            complete &= card.get("evaluation_status") == "COMPLETED" and bool(card.get("decision_explanation"))
        run["verified"] = bool(complete)
        STATE.write_text(json.dumps(run, indent=2), encoding="utf-8")
        print("Persisted screening explanations verified:", bool(complete))
    else:
        raise SystemExit("Use start or check")
