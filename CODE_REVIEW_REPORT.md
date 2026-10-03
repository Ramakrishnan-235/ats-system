# Code review and refactoring report

Date: 2 October 2026. Reviewed baseline: `b470acd4971c5b06c9b2dcbe410598adb1efa735`.

The review used three sub-agents for API/worker security, search/parsing/evaluation,
and the frontend. The coordinating agent independently reviewed integration
contracts, fixed schema and taxonomy defects, checked dependencies, and verified
the combined changes. Changes are local and uncommitted.

The application checkout is the nested `ats-system` Git repository. Its initial
working tree was clean. The outer workspace has a separate Git repository that
already reports the project files as moved; that existing layout was preserved.

## Implemented changes

| Finding | Result | Main files |
| --- | --- | --- |
| Upload filenames could control staging paths; file reads had no size bound. | Added server-owned paths, exclusive file creation, configurable 10 MiB limit, PDF signature/type checks, upload-handle closure, and safe cleanup. Candidate PDF/citation access validates IDs instead of interpreting them as glob patterns. | `ats-core/src/ats_core/api/upload_storage.py`, `api/v1/candidates.py`, `workers/tasks.py` |
| Authentication was disabled implicitly and CORS allowed all origins with credentials. | Authentication requires explicit development opt-out; credential comparisons handle Unicode safely. API/worker configuration loads `.env` before environment-dependent imports. CORS defaults to explicit local frontend origins. | `ats-core/main.py`, `api/auth.py`, `workers/celery_app.py`, `.env.example` |
| Redis failures produced fabricated progress, and API errors exposed implementation details. | Inline uploads record real terminal state and identify their execution mode. Unavailable worker status returns an explicit service error. Client errors no longer return stack traces or exception internals. | `api/v1/candidates.py`, `api/v1/match.py` |
| Worker imports eagerly constructed database pools and ML models. | Worker resources initialize lazily within the worker process. Permanent input errors are validated before model loading; staged files survive retries and are cleaned after terminal failure or successful commit. Structured profiles use JSON-compatible serialization. | `workers/tasks.py` |
| Parser fallback invented skills, job history, experience, and fit scores. | Extracted fields require source evidence; experience uses dated employment intervals with overlap merging. Missing evaluation is explicitly pending and carries no synthetic fit score. Manual candidate/job paths no longer manufacture 95-point matches or fake history. | `parsers/resume_parser.py`, `api/v1/candidates.py`, `api/v1/jobs.py` |
| Generated embeddings were 384-dimensional while database contracts required 1536. | Added a shared 384-dimensional contract and finite, nonzero vector validation. Fresh SQL schema and ORM now agree. Candidate embeddings use document encoding. Existing database conversion requires a separate reviewed migration. | `search/embedding_config.py`, `search/dense_embedder.py`, `search/pgvector_store.py`, `models/db.py`, `schema.sql`, `docs/vector-dimension-migration.md` |
| Retrieval lost technical symbols, omitted real matches in small corpora, and could partially update its indexes. | BM25 preserves distinct technical tokens and uses positive IDF. Hybrid indexes validate batches before publishing them. Cosine comparison rejects incompatible dimensions; reranking sorts by raw score before display rounding. | `search/bm25_indexer.py`, `search/hybrid_retriever.py`, `search/reranker.py` |
| Skill evaluation matched substrings such as Java inside JavaScript. | Matches exact normalized requirements, deduplicates requirements, and distinguishes no requirements from a perfect score. | `evaluator/skill_evaluator.py` |
| LLM output could claim evidence or PDF coordinates absent from the source. | Evaluation citations must occur in the source; model-generated coordinates are discarded. PDF lookup requires the full citation, with a punctuation-normalized retry. Scores and qualification tiers agree; audit foreign keys require valid UUIDs. Prompt boundaries escape identifier/control delimiters. | `evaluator/deep_evaluator.py`, `evaluator/llm_evaluator.py`, `evaluator/audit_logger.py`, `parsers/pdf_parser.py` |
| Pydantic preprocessing ignored some declared aliases, discarded skill evidence, and changed input mappings. | Centralized alias resolution honors field precedence, normalizes copied mappings, and preserves supplied skill evidence/category/proficiency/duration. Nonfinite evaluation scores and invalid PDF coordinate values are rejected. | `schema/_normalization.py`, `schema/candidate.py`, `schema/timeline.py`, `schema/skills.py`, `schema/evaluation.py` |
| Rejected taxonomy records still resolved; renames left stale alias entries. | Resolution indexes now follow rejection, renaming, and reapproval; added deterministic lifecycle tests. | `taxonomy/taxonomy_service.py` |
| Dashboard aggregates crashed on empty score categories and contained synthetic counts. | Counts derive from stored candidates, jobs, and evaluations; failed/unevaluated records are handled explicitly. PII masking applies consistently to candidate-related response paths. | `api/v1/dashboard.py`, `api/v1/candidates.py`, `api/v1/jobs.py` |

Frontend changes and final verification results are recorded below after integration
checks complete.

## Configuration and compatibility

- Set a unique backend `ATS_API_KEY` when authentication is enabled. Explicit
  `ATS_AUTH_ENABLED=false` is available for local development. Existing exported
  variables take precedence over `.env`.
- `ATS_CORS_ORIGINS` configures browser origins. `ATS_MAX_UPLOAD_BYTES` sets the
  PDF limit; `ATS_UPLOAD_STAGING_DIR` selects a server-controlled staging directory.
- Existing PostgreSQL installations need the [vector migration procedure](ats-core/docs/vector-dimension-migration.md).
  `CREATE TABLE IF NOT EXISTS` does not change existing column types. Existing
  vectors must be regenerated with the intended model; truncation is invalid.
- Added direct `python-dotenv` and `phonenumbers` dependencies, which were previously
  used implicitly, and synchronized the existing lock metadata. Pytest now knows
  the source path and canonical test directory. Python 3.12 and Node 20.9+ requirements
  are reflected in the setup documentation.

## Remaining findings and recommended next work

| Priority | Finding | Next step |
| --- | --- | --- |
| P1 | HTTP candidate/job/taxonomy/task state is process-local, while Celery writes to PostgreSQL separately. Restarts lose HTTP records and multiple API workers do not share state. | Make database-backed ingestion and queries the canonical path; return durable task IDs and integrate queue lifecycle with recruiter pages. |
| P1 | A shared API key provides no recruiter identity, role checks, or tenant isolation. Default tenant IDs in skill tables do not establish isolation. | Add identity-based sessions, tenant-owned records, authorization checks, and cross-tenant regression tests. |
| P1 | Default model configuration may use cloud inference. Sanitization, UI masking, and citation checks do not prove complete PII removal or eliminate prompt injection. | Establish explicit local/cloud inference policy, candidate-data controls, retention/deletion, and redaction-quality tests with representative resumes. |
| P1 | Fresh-schema dimension fixes cannot repair an existing database automatically. | Back up, migrate, regenerate embeddings, rebuild indexes, and validate production-like inserts/searches before rollout. |
| P2 | The backend still contains seeded demonstration jobs and process-local taxonomy administration. Alias/canonical collision handling and concurrent mutation are not comprehensively redesigned. | Separate explicit demo mode from live data and make taxonomy changes transactional with uniqueness checks. |
| P2 | Model extraction quality, retrieval recall, real database transactions, queue retries, and actual inference latency require infrastructure integration tests. | Run a dedicated integration suite with PostgreSQL/pgvector, Redis/Celery, intended model versions, and representative resumes. |
| P2 | Repository-wide backend lint includes substantial typing, import-order, unused-import, and formatting debt. | Adopt a agreed baseline, fix it in focused batches, then make lint a CI gate. |

## Verification

Verification is being finalized. The full infrastructure-dependent suite and AI
benchmarks are outside the offline checks: no live LLM, model download, database
migration, deployment, or running application data change was performed.

The project-local Python `.venv` contains a lightweight review environment, not
the complete ML stack. Frontend dependencies and build artifacts are ignored by
Git. Temporary/generated files are excluded from the review patch.
