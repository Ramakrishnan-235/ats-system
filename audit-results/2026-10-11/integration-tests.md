# Python and HTTP integration audit — 2026-10-11

## Verified results

Selected deterministic Python suites completed: **67 passed, 1 failed**, 68 total in 17.26 seconds. Private Python AI contract suite: **14 passed**. These cover service authentication, dispatch identity, result schema, incomplete score handling, sanitized scoring evidence, citation grounding, worker lease/artifact/result order, duplicate delivery, safe failure payloads, tenant taxonomy snapshots, parser extraction, privacy, prompt injection, and worker validation with mocked collaborators. They do not prove deployed model or database behavior.

Working directory: `D:/Projects/Applicant Tracking System/ats-system/ats-core`.

```powershell
.\.venv\Scripts\python.exe -m pytest test/test_private_ai_contract.py test/test_pipeline_refactoring.py test/test_resume_parser_enhanced.py test/test_residue_privacy.py test/test_prompt_injection_sanitizer.py test/test_pdf_citation_grounding.py test/test_worker_review_regressions.py -q --junitxml=../audit-results/2026-10-11/python-tests.xml
```

The initial sandbox attempts stalled in Python Windows asyncio local socketpair setup. A run outside that socket restriction completed. Only the six verified Python processes belonging to the three stalled test attempts were stopped afterward.

## Confirmed failure

`test/test_pipeline_refactoring.py::test_audit_accepts_ats_id_formats_and_rejects_empty_ids` fails with `NameError: name 'os' is not defined` at `ats-core/src/ats_core/evaluator/audit_logger.py:96`, where `os.getenv(...)` is used without importing `os`.

This is the retained legacy evaluation audit persistence path. It is distinct from the active Rust public audit API and private AI artifact/result persistence. No repair or source edits were performed as part of this audit.

## Read-only HTTP route smoke

All 16 checked frontend pages return HTTP200 and HTML: `/`, `/jobs`, `/jobs/new`, `/candidates`, `/candidates/demo-1`, `/imports`, `/inbox`, `/clients`, `/analytics`, `/taxonomy`, `/audit-log`, `/settings`, `/onboarding`, `/workspace`, `/interviews`, `/offers`.

All three backend proxy checks return HTTP500: `/core-api/health`, `/core-api/auth/session`, `/core-api/api/v1/auth/me`. Page HTML200 does not mean the features are backend-connected or functional; it only verifies route responses. Machine-readable timings/statuses are in `http-route-status.json`.

## Full integration blocker

`docker compose ps --format json` cannot connect to the Docker Desktop Linux engine: `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.` This was verified outside the sandbox. Docker Desktop was not found at either checked standard system/per-user installation path. No architecture services were started or changed.

The existing `deploy/smoke_architecture.py` requires PostgreSQL on5544, private S3 on9002, Redis on6380, and the Rust core. It would exercise synthetic PDF upload, outbox, Celery/parser, authenticated result, masking, original retrieval, agency submissions, analytics and restart persistence. It was **not run** because infrastructure is absent. No customer record mutations, paid inference, model downloads, or source changes were performed.

Saved evidence: `python-tests.xml`, `http-route-status.json`, and `integration-summary.json` in this folder.
