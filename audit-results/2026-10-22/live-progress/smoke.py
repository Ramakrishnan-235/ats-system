"""Local synthetic-only UI progress verification support."""
import json
import sys
import time
from pathlib import Path

import httpx

root = Path(__file__).resolve().parent
state_path = root / "state.json"
with httpx.Client(base_url="http://127.0.0.1:8080/api/v1", timeout=30,
                  headers={"Origin": "http://localhost:3000"}) as client:
    me = client.get("/auth/me")
    me.raise_for_status()
    assert me.json().get("development_mode"), "Synthetic testing requires local development mode"
    if sys.argv[1] == "create":
        if state_path.exists():
            print(state_path.read_text())
        else:
            response = client.post("/jobs", json={
                "title": "QA Live Progress - Python Backend Engineer",
                "department": "Synthetic verification",
                "job_description": "Build production Python FastAPI REST APIs with PostgreSQL, Docker and automated tests. Demonstrate backend ownership and measurable service improvements.",
                "required_skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
                "min_years_experience": 3, "status": "OPEN",
            })
            response.raise_for_status()
            state = {"job_id": response.json()["id"], "synthetic_only": True}
            state_path.write_text(json.dumps(state, indent=2))
            print(json.dumps(state))
    elif sys.argv[1] == "watch":
        task_id = sys.argv[2]
        state = json.loads(state_path.read_text())
        state["task_id"] = task_id
        state_path.write_text(json.dumps(state, indent=2))
        previous = None
        deadline = time.monotonic() + 300
        while time.monotonic() < deadline:
            response = client.get(f"/candidates/tasks/{task_id}")
            response.raise_for_status()
            snapshot = response.json()
            with (root / "snapshots.jsonl").open("a") as output:
                output.write(json.dumps(snapshot) + "\n")
            signature = (snapshot["state"], str(snapshot.get("stages")))
            if signature != previous:
                print(snapshot["state"], snapshot.get("step"),
                      {key: value["status"] for key, value in snapshot.get("stages", {}).items()}, flush=True)
                previous = signature
            if snapshot["state"] in ("SUCCESS", "FAILURE"):
                (root / "final-task.json").write_text(json.dumps(snapshot, indent=2))
                assert snapshot.get("stages"), "No actual worker operation history was persisted"
                break
            time.sleep(0.75)
