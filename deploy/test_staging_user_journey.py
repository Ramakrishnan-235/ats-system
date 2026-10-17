"""End-to-end verification of staging user journey:
1. Sign in / register a staging user
2. Create a job
3. Upload a resume (PDF)
4. Inspect the result (ingestion, profile, skills, masked PII)
5. Save a stage change (e.g. advance stage to Technical Interview)
6. Verify persisted stage change
"""

import io
import time
from uuid import uuid4
import fitz
import httpx

BASE_URL = "http://localhost:3000/core-api"

def main():
    print(f"Connecting to ATS frontend proxy at {BASE_URL}...")
    with httpx.Client(base_url=BASE_URL, headers={"origin": "http://localhost:3000"}, timeout=30) as client:
        # Step 1: Sign in / Register
        suffix = str(uuid4())[:8]
        email = f"staging-{suffix}@example.com"
        password = f"P@ssw0rd-{suffix}!"
        print(f"\n[Step 1] Registering and signing in staging user: {email}")
        reg_res = client.post("/api/v1/auth/register", json={
            "email": email,
            "password": password,
            "name": "Staging Recruiter",
            "workspace_name": f"Staging Org {suffix}",
            "workspace_kind": "corporate"
        })
        assert reg_res.status_code == 200, f"Registration failed: {reg_res.text}"
        who = client.get("/api/v1/auth/me")
        assert who.status_code == 200, f"Auth check failed: {who.text}"
        user_info = who.json()
        print(f"  Authenticated successfully as: {user_info['user']['email']} (Tenant: {user_info['user']['tenant_id']})")

        # Step 2: Create a Job
        print("\n[Step 2] Creating a job requisition...")
        job_res = client.post("/api/v1/jobs", json={
            "title": "Lead Full-Stack Engineer",
            "job_description": "We are seeking a Lead Full-Stack Engineer proficient in TypeScript, React, Rust, and PostgreSQL to build scalable web applications.",
            "department": "Engineering"
        })
        assert job_res.status_code == 200, f"Job creation failed: {job_res.text}"
        job_data = job_res.json()
        job_id = job_data["id"]
        print(f"  Job created successfully: '{job_data['title']}' (ID: {job_id})")

        # Step 3: Upload a Resume
        print("\n[Step 3] Generating and uploading candidate resume PDF...")
        pdf = fitz.open()
        page = pdf.new_page()
        page.insert_text(
            (50, 50),
            "Jane Doe\n"
            "jane.doe@staging-example.test\n"
            "+1-555-0199\n"
            "San Francisco, CA\n\n"
            "PROFESSIONAL SUMMARY\n"
            "Lead Full-Stack Engineer with 8 years of experience building distributed systems and modern React frontends.\n\n"
            "SKILLS\n"
            "TypeScript, React, Rust, PostgreSQL, Docker, Next.js\n\n"
            "WORK EXPERIENCE\n"
            "Senior Software Engineer | Acme Cloud (2020 - Present)\n"
            "- Architected microservices in Rust handling 50k req/sec.\n"
            "- Designed responsive React/TypeScript UI dashboard.\n"
        )
        pdf_bytes = pdf.tobytes()
        pdf.close()

        upload_res = client.post(
            "/api/v1/candidates/upload-async",
            headers={"idempotency-key": str(uuid4())},
            files={"file": ("jane-doe-resume.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
            data={"job_id": job_id, "name": "Jane Doe", "headline": "Lead Full-Stack Engineer"}
        )
        assert upload_res.status_code == 202, f"Upload failed: {upload_res.text}"
        upload_data = upload_res.json()
        task_id = upload_data["task_id"]
        candidate_id = upload_data["candidate_id"]
        print(f"  Upload accepted (202): Task ID {task_id}, Candidate ID {candidate_id}")

        # Step 4: Inspect the Result
        print("\n[Step 4] Polling ingestion task status and inspecting candidate profile...")
        deadline = time.monotonic() + 120
        while time.monotonic() < deadline:
            task_status = client.get(f"/api/v1/candidates/tasks/{task_id}")
            assert task_status.status_code == 200, f"Task status error: {task_status.text}"
            state = task_status.json().get("state")
            print(f"  Task state: {state}")
            if state in {"SUCCESS", "FAILURE"}:
                assert state == "SUCCESS", f"Ingestion task failed: {task_status.text}"
                break
            time.sleep(2)
        else:
            raise TimeoutError("Ingestion task timed out")

        # Fetch Candidate Detail
        cand_res = client.get(f"/api/v1/candidates/{candidate_id}")
        assert cand_res.status_code == 200, f"Failed to get candidate: {cand_res.text}"
        profile = cand_res.json()
        print(f"  Candidate Name: {profile.get('name')}")
        print(f"  PII Masked: {profile.get('is_pii_masked')}")
        assert profile.get("is_pii_masked"), "Candidate profile should have PII masked"
        assert "jane.doe@staging-example.test" not in cand_res.text, "Raw email should be redacted"
        print(f"  Core Skills: {profile.get('core_skills')}")
        applications = profile.get("applications", [])
        assert len(applications) > 0, "Candidate should have at least 1 job application"
        current_stage = applications[0]["stage"]
        print(f"  Current Stage: {current_stage}")

        # Step 5: Save a Stage Change
        new_stage = "Interview"
        print(f"\n[Step 5] Saving stage change: '{current_stage}' -> '{new_stage}'...")
        stage_res = client.patch(
            f"/api/v1/jobs/{job_id}/candidates/{candidate_id}/stage?new_stage={new_stage}"
        )
        assert stage_res.status_code == 200, f"Stage change failed: {stage_res.text}"
        print(f"  Stage update response: {stage_res.json()}")

        # Step 6: Verify Persisted Stage Change
        print("\n[Step 6] Verifying persisted stage change...")
        updated_cand_res = client.get(f"/api/v1/candidates/{candidate_id}")
        assert updated_cand_res.status_code == 200
        updated_profile = updated_cand_res.json()
        saved_stage = updated_profile["applications"][0]["stage"]
        print(f"  Persisted Stage in Database: {saved_stage}")
        assert saved_stage == new_stage, f"Expected stage {new_stage}, found {saved_stage}"

        # Verify Stage in Job Applicants
        job_apps_res = client.get(f"/api/v1/jobs/{job_id}/candidates")
        assert job_apps_res.status_code == 200
        job_apps = job_apps_res.json()
        matching_app = next((a for a in job_apps if a["id"] == candidate_id), None)
        assert matching_app is not None, "Candidate should be listed in job applicants"
        print(f"  Job Board Stage: {matching_app['stage']}")
        assert matching_app["stage"] == new_stage

    print("\n" + "=" * 70)
    print("SUCCESS: Full staging user journey verified end-to-end!")
    print("1. Signed in as staging user")
    print("2. Created job requisition")
    print("3. Uploaded resume PDF")
    print("4. Inspected extraction & masked candidate profile")
    print(f"5. Saved stage change to '{new_stage}' and verified persistence")
    print("=" * 70)

if __name__ == "__main__":
    main()
