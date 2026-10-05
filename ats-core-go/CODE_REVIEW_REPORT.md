# ATS Core Go — code review and refactoring report

Date: 5 October 2026. Reviewed Git baseline: `2a620f5e6a7aa7f1e71fa2804440147e5eb0fed5`.

Reviewed `ats-core-go` with API/security and storage/concurrency sub-agents. The
coordinating agent reviewed services, configuration, deployment files and integration
contracts, implemented fixes, and independently checked the combined changes.
Changes are local and uncommitted. The earlier Python/frontend review was not resumed.

## Changes implemented

| Finding | Refactoring and resulting behavior | Main files |
| --- | --- | --- |
| Authentication defaulted off; empty configured keys could pass middleware. | Enabled authentication by default, fail startup with an empty key, fail closed in middleware, and compare hashed credentials in constant time. CORS no longer allows credentials by default. | `internal/config/config.go`, `internal/api/middleware.go`, `internal/api/router.go`, `cmd/server/main.go` |
| Multipart memory limits were mistaken for upload size limits; writes and parser failures were ignored. | Bound HTTP bodies and file reads, validate PDF extension/signature, clean multipart temporary files, persist with exclusive private permissions, and report storage errors before accepting work. Default PDF limit is 10 MiB. | `internal/api/candidates_handler.go` |
| Accepted uploads used the completed request context, exposed unlimited background work, and could panic or falsely succeed. | Limit accepted uploads to eight concurrent slots; return 429 at capacity. Processing has an independent two-minute evaluation context, panic recovery, terminal failure state, and failed-PDF cleanup. Unknown tasks return 404. | `internal/api/candidates_handler.go` |
| Uploads invented skills, 4.5 years of experience, education, contact details, and scores. | Preserve only actual extracted text and supplied association. Unknown facts stay empty/null; unassigned uploads remain unevaluated. Invalid job IDs are rejected. Filename-derived display labels are not claimed as verified identity extraction. | `internal/api/candidates_handler.go` |
| Model failures returned a fixed 85 score, invented strengths and resume quotes. | Removed synthetic evaluation fallback. Inference defaults off and requires `ATS_LLM_ENABLED=true`. Select one configured provider without silently changing destinations. Failures remain errors. | `internal/services/evaluator.go`, `.env.example` |
| Model responses accepted missing/out-of-range scores, invented evidence and page references. | Require a finite 0–100 overall score and valid criterion ranges; verify quotes against submitted resume text; calculate tier from score; remove unverified page claims. Bound responses to 1 MiB and reject HTTP/provider/JSON failures. | `internal/services/evaluator.go` |
| Inference sent known identifiers and could follow redirects. | Mask known names/contact fields and pattern-matched emails, phones and profile URLs before model calls. Refuse redirects to prevent forwarding credentials or candidate data. This is a limited redactor, not a guarantee of complete anonymity. | `internal/services/evaluator.go`, `internal/services/matcher.go`, `internal/api/candidates_handler.go` |
| PDF extraction treated printable binary metadata as resume text; citation lookup returned invented coordinates even on misses. | Remove ASCII fallback. Extract only supported uncompressed literal text; reject unsupported/compressed/encrypted/image PDFs explicitly. Return no citation location until a layout-aware parser can verify geometry. | `internal/services/pdf_parser.go` |
| Lexical scoring matched Java in JavaScript, divided by an empty query, discarded short technical tokens, and evaluated irrelevant candidates. | Match exact tokens, retain Go/C/C++/C#/.NET/CI/CD, deduplicate queries, handle empty input, exclude zero-overlap candidates, and use deterministic tie ordering. Label lexical reranking as fallback. | `internal/services/matcher.go` |
| Store reads/writes exposed pointers, slices and nested maps outside locks. | Add defensive copies across candidates, jobs, applications, tasks and taxonomy, including nested JSON-compatible data. Add an empty `NewStore()` constructor for isolated tests. | `internal/store/copy.go`, `internal/store/memory_store.go` |
| Evaluations and job PATCH could overwrite simultaneous recruiter changes. | Atomic scorecard updates preserve current notes and stages; atomic field-level job updates preserve status, counts and unrelated edits. | `internal/store/memory_store.go`, `internal/api/jobs_handler.go`, `internal/services/matcher.go` |
| A job-specific stage change altered the candidate's global stage; links fabricated profiles/scores. | Keep application stages separate; require an existing job/candidate; build associations from stored evidence rather than trusting synthetic ranking payloads. | `internal/store/memory_store.go`, `internal/api/jobs_handler.go` |
| Dashboard weekly/count metrics and seeded top matches were synthetic. | Use observed UTC-dated records and task/evaluation states; exclude pending/failed/nonfinite/out-of-range scores. Seeded top matches are null/pending. | `internal/store/memory_store.go`, `internal/store/seed_data.go` |
| Masking missed nested response content; map iteration and pagination were unstable. | Mask nested candidate/application/dashboard strings and remove raw text/filenames/image avatars from masked profiles. Sort listings, make taxonomy pagination deterministic/overflow-safe, deduplicate added aliases, and handle Unicode note initials. | `internal/store/privacy.go`, `internal/store/memory_store.go` |
| JSON writes accepted oversized/concatenated/non-object data; unsupported sync reported success. | Require one object within 1 MiB, validate write parameters, and return 501 for unimplemented taxonomy seed synchronization. | `internal/api/http_helpers.go`, `internal/api/jobs_handler.go`, `internal/api/taxonomy_handler.go`, `internal/api/match_handler.go` |
| Docker builder version conflicted with go.mod; build copied local uploads and ran as root; README made unsupported performance claims. | Align builder with Go 1.27, use a non-root runtime, exclude local PDFs/secrets/binaries from context, declare direct module dependencies, and document actual capabilities and setup. | `Dockerfile`, `.dockerignore`, `go.mod`, `README.md` |

## Verification

Used the installed Go 1.27.0 toolchain with `GOTOOLCHAIN=local` and `GOPROXY=off`.
All inference tests mock the HTTP transport or evaluator; no live model was called.

| Check | Result |
| --- | --- |
| `go test -count=1 ./...` | Passed: 34 top-level tests plus table-driven subtests. API 13, configuration 2, services 9, store 10. This includes 32 newly added top-level regressions. |
| `go vet ./...` | Passed. |
| `go build ./...` | Passed for all packages; the existing executable was not overwritten. |
| `gofmt -l cmd internal` | Clean after formatting. |
| Scoped Git whitespace check | Passed. |
| `go test -race ./...` | Unverified: the installed environment has CGO disabled and no C compiler on PATH; Go rejected the race run. Concurrent snapshot regressions passed under normal testing, which does not replace race detection. |

No Docker image build, database/queue migration, deployment, real PDF corpus
benchmark, model-quality evaluation or load test was performed. Source was compiled;
the checked-in `ats-core-server.exe` remains the previous binary and needs rebuilding.

## Compatibility and configuration changes

- Set a unique `ATS_API_KEY`; default authentication now requires it. Export
  environment variables explicitly: `.env.example` is documentation, and `.env`
  files are not automatically loaded. `ATS_AUTH_ENABLED=false` is an explicit local opt-out.
- Model evaluation defaults off. Assigned uploads requiring evaluation fail if
  inference is disabled/unavailable; unassigned supported-PDF ingestion can succeed
  with a pending scorecard. No successful AI result is invented.
- Uploads return asynchronous `202` task handles; missing handles now return 404.
  Clients must poll until a terminal state and read the terminal result. The current
  frontend `uploadAndWait()` checks only once and assumes inline processing; it
  needs adaptation before the Go upload flow is end-to-end compatible.
- Job creation rejects `run_ai_match=true` rather than claiming work ran. Use the
  explicit match endpoint. Application linking requires an existing candidate ID;
  a manual UI action without an ID needs an explicit profile-creation workflow.
- Unsupported PDF formats now fail instead of appearing parsed; citation responses
  return `found=false`/null location. A real PDF/OCR/layout service is required to
  restore these capabilities reliably.

## Remaining findings

| Priority | Finding and evidence | Recommended next work |
| --- | --- | --- |
| P1 | Store and upload tasks remain process-local (`internal/store/memory_store.go`); `DATABASE_URL` is unused. Restart loses state, multiple replicas disagree, and shutdown does not drain accepted background uploads. | Introduce durable tenant-owned records, task lifecycle, document metadata/storage and graceful worker draining/recovery. |
| P1 | Shared API key does not establish recruiter identity, roles or tenant ownership. `include_pii=true` and original PDFs are available to any key holder. | Add identity-based authorization and tenant checks, including privileged PII/document access and cross-tenant tests. |
| P1 | Regex/known-field masking can miss names or other identifying prose. Real redaction quality, model responses and prompt-injection resistance are unverified. | Establish local/cloud inference policy, strengthen redaction, and validate representative resumes before enabling inference. |
| P1 | Evaluations are stored on a global candidate scorecard rather than versioned per-job/application results; job application match scores can become stale (`internal/services/matcher.go`). | Persist results against explicit job/application/revision IDs and update authorized ranking summaries transactionally. |
| P1 | Frontend assumes inline upload completion; manual linking and job-creation matching flags also differ from the truthful Go contracts. | Add polling/terminal-result handling and explicit profile creation/evaluation actions, then run end-to-end tests. |
| P2 | PDF parser is deliberately limited; citation geometry/OCR/font decoding is unsupported. | Integrate the established Python document pipeline or a full parser through a bounded authenticated service contract. |
| P2 | Local PDFs lack retention/deletion policy and durable metadata; task records grow without eviction. Matching requests have no global admission limit. | Add retention controls, durable storage, bounded task history and request/worker quotas. |
| P2 | Demo jobs still load automatically; job-title lookup is ambiguous and canonical taxonomy uniqueness is not transactional. | Introduce explicit demo mode, use IDs consistently, and enforce taxonomy uniqueness in canonical persistence. |
| P2 | Race detection, Docker deployment, real inference/extraction and claimed performance are not verified. | Run CI with race-detector prerequisites and realistic integration/load/quality tests. |

The highest-value next step is a durable, tenant-authorized candidate/application
workflow with reliable task polling and per-job evaluation ownership. The fixes
above improve current correctness; they do not make this in-memory service production-ready.
