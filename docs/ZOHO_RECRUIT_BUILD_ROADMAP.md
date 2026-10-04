# ATS improvement roadmap toward Zoho Recruit capability

Prepared: 3 October 2026  
Current micro-SaaS priorities and fresh audit: [micro-SaaS improvement plan](MICRO_SAAS_IMPROVEMENT_PLAN.md), prepared 4 October 2026 against HEAD `91c4fa8`. Use that plan for first paid release priorities and validation; this document remains the broader capability roadmap.

Architecture updated: 4 October 2026 — Rust core backend and Python AI services. Detailed boundaries and file changes: [migration plan](<D:/Projects/Applicant Tracking System/ats-system/docs/RUST_CORE_PYTHON_AI_MIGRATION_PLAN.md>).
Project: D:/Projects/Applicant Tracking System/ats-system  
Inspected Git HEAD: b470acd, plus substantial existing uncommitted changes  
Status: proposed implementation plan; source inspection completed, implementation and runtime verification not performed in this planning pass.

## Decision and scope

Evolve the existing application into a recruitment SaaS with a shared ATS core and two first-release workflows: corporate hiring and recruitment agencies. Rust will own the public business backend and authoritative persistence; Python will retain parsing, evidence extraction, embeddings, reranking and LLM evaluation behind private service contracts. Preserve the useful AI algorithms and recruiter interface. Build identity, authorization and application workflow in the Rust core.

The user's confirmed requirement is **both corporate hiring teams and agencies from the first release**. The supplied research assumes corporate employers; this plan expands that scope explicitly. Both paths must pass the first-release acceptance gates. Intermediate developer milestones are not releases for only one segment.

Team size, budget, launch geography, expected volume and first customers remain unconfirmed. Timing below is an estimate with staffing scenarios, not a delivery promise. The detailed sequence illustrates a 2–4 developer team with access to product/QA support and managed infrastructure. A solo schedule is longer.

The product goal is functional recruitment capability comparable to the report over successive releases, with its own interface and implementation. The first release covers complete recruiting journeys. Broader workflow configuration, partner integrations, global operations and enterprise procurement maturity follow.

Zoho's current feature documentation confirms the benchmark spans sourcing, pipelines, automation, collaboration, communication, interviews, customization, AI and analytics. This is much broader than the present screening engine. [Zoho Recruit feature reference](https://www.zoho.com/recruit/key-features.html)

## 1. What exists and what needs improvement

These findings are based on current source files, not screenshots or README claims. Presence in source does not prove production behavior.

| Area | Current evidence | Required change | Priority |
| --- | --- | --- | --- |
| Frontend and backend foundation | Next.js/React/TypeScript frontend; FastAPI/Pydantic/SQLAlchemy backend | Retain frontend and Python AI components; migrate public ATS domains to Rust with explicit contracts | Retain/migrate |
| Candidate and job persistence | HTTP routes use CANDIDATES_STORE, JOBS_STORE and JOB_CANDIDATES_STORE; task state also lives in memory | Use PostgreSQL repositories for every business read/write; restart and multi-process consistency | P0 |
| Resume ingestion | upload-async parses during the request and records execution_mode=inline; a separate Celery path writes Candidate rows | One durable ingestion service and task lifecycle, shared by recruiter uploads, career applications and bulk imports | P0 |
| Login and access | One shared API key; no verified user/organization membership model; include_pii is a client-requested query flag | User sessions, tenant membership, role/object/field policy; server decides permission to reveal PII | P0 |
| Tenant schema | Candidate, JobPosting, Application and ScoringAudit lack tenant ownership; two skill tables have an all-zero tenant default | Real tenants and tenant-safe relationships across the complete data path | P0 |
| Pipeline | Application ORM exists, but HTTP pipeline updates use dictionaries and also overwrite candidate-wide stage/status | Application owns job-specific stage and history; a candidate may progress differently on several jobs | P0 |
| Original resumes | API PDF viewing uses local staging paths; the worker deletes its staged file after commit | Keep authorized originals in durable object storage; use staging only during processing | P0 |
| Analytics/settings/audit UI | Fixed analytics CSV; local demo team settings; global audit page filters an empty mock array; candidate audit tab has fixed telemetry and a verification badge | Persist settings, connect real metrics/events, remove unsupported verification claims, show explicit empty/unavailable states | P0 |
| Embeddings | Fresh ORM/schema use 384 dimensions and a migration guide exists | Inspect actual DB types; versioned migration and complete re-embedding where needed; never truncate old vectors | P0 |
| Parsing/search/evaluation | PDF parsing, anonymization, skill taxonomy, hybrid retrieval, reranking and citation validation are present | Reuse behind common services; prove data flow, quality and resource costs with real samples | P1 |
| Recruiting business modules | No corresponding registered API modules found for corporate approvals, agency clients/submissions/placements, interviews, offers, career applications or billing | Implement the first-release modules below | P1 |
| Operations | Compose defines PostgreSQL, Redis and Ollama; no application Dockerfile/CI/migration framework found in the inspected inventory | Reproducible app/worker builds, staged deployment, migrations, backups, observability and release checks | P0/P1 |

P0 means necessary for a trustworthy foundation. P1 means necessary for the agreed first release. P2 means expansion after successful pilots.

Selected source evidence:

- [Candidate/task dictionaries](<D:/Projects/Applicant Tracking System/ats-system/ats-core/src/ats_core/api/v1/candidates.py:17>) and [inline upload handler](<D:/Projects/Applicant Tracking System/ats-system/ats-core/src/ats_core/api/v1/candidates.py:228>).
- [Job storage](<D:/Projects/Applicant Tracking System/ats-system/ats-core/src/ats_core/api/v1/jobs.py:738>) and [stage mutation](<D:/Projects/Applicant Tracking System/ats-system/ats-core/src/ats_core/api/v1/jobs.py:1053>).
- [Current ORM](<D:/Projects/Applicant Tracking System/ats-system/ats-core/src/ats_core/models/db.py:19>), [authentication](<D:/Projects/Applicant Tracking System/ats-system/ats-core/src/ats_core/api/auth.py:24>), and [worker implementation](<D:/Projects/Applicant Tracking System/ats-system/ats-core/src/ats_core/workers/tasks.py>).
- [Static analytics export](<D:/Projects/Applicant Tracking System/ats-system/frontend/src/app/analytics/page.tsx:31>), [demo settings](<D:/Projects/Applicant Tracking System/ats-system/frontend/src/app/settings/page.tsx:51>), [unconnected audit page](<D:/Projects/Applicant Tracking System/ats-system/frontend/src/app/audit-log/page.tsx:46>), and [fixed candidate audit telemetry](<D:/Projects/Applicant Tracking System/ats-system/frontend/src/components/candidate/audit-trail-tab.tsx:10>).
- [Frontend upload terminal-state assumption](<D:/Projects/Applicant Tracking System/ats-system/frontend/src/lib/api.ts:110>) and [existing vector migration guide](<D:/Projects/Applicant Tracking System/ats-system/ats-core/docs/vector-dimension-migration.md>).

Earlier review notes recorded 191 offline backend tests passing, with frontend checks unfinished. Those results are historical, were not rerun here, and do not establish current or live-service readiness. The existing review report remains a draft. Establish a fresh baseline in Phase 0.

## 2. First-release product definition

Use one product with workspace type CORPORATE or AGENCY. A person can belong to several workspaces and switch explicitly. Shared candidate, job, application, document, search, interview, communication and reporting modules serve both.

| Capability | Shared core | Corporate first release | Agency first release |
| --- | --- | --- | --- |
| Workspace | Organization setup, members, roles, brand, timezone | Departments, hiring teams and hiring managers | Agency teams, client companies, contacts and account ownership |
| Jobs | Draft/publish/close jobs; reusable pipeline stages | Requisition, simple approval, approved opening | Client job order, assigned recruiter, basic fee terms |
| Candidates | Profile, resume versions, contact permission, notes/tags, duplicate review | Apply/referral/source records | Talent pool and candidate-to-client sharing permission |
| Applications | One job-specific pipeline per application; source, history and rejection reasons | Recruiter and hiring-manager review | Submission to a client and tracked client feedback |
| Collaboration | Notes, tasks, structured interview feedback, notifications | Job-scoped hiring team permissions | Client-scoped reviewer access to selected submissions |
| Candidate acquisition | Branded job pages, application form, CSV/PDF import | Employer career site and referral form | Agency career site with controlled client-name visibility |
| Interviews and offers | Schedule, invite, scorecards, offer status and documents | Approval and hire handoff | Client interview coordination and placement record |
| Reporting | Actual funnel, stage aging, sources, recruiter activity | Department/job time-to-hire | Submissions, interviews, placements, estimated fees |
| Commercial operation | Tenant entitlements, recruiter seat counts, usage metering, account export | Employer package | Agency package with client/submission functionality |

Agency fee tracking initially records expected fees, agreed terms and placement status. A placement is not proof of invoiced or collected revenue. Payroll, contractor timesheets and a full accounting system are separate later products if validated by customers.

The first release includes a small client review portal: authenticated invitations, submitted candidate snapshots, permitted documents, feedback and interview requests. Broader vendor/candidate self-service portals come later. This small portal is essential to the requested agency workflow.

Provide accessible, responsive recruiting and application pages. Start with one selected email/calendar ecosystem for the pilot cohort, plus standard calendar invitation support for others. Add the second ecosystem before onboarding customers who require it. Confirm provider needs during discovery; do not advertise unsupported integrations.

## 3. Architecture decisions for this repository

| Layer | Decision now | Expansion trigger |
| --- | --- | --- |
| Web | Keep Next.js/TypeScript and current reusable UI components | Improve module structure and accessible UX as workflows stabilize |
| API | Rust/Axum modular core for public ATS endpoints; private Python/FastAPI service for AI dispatch/results | Extract additional business services only for measured scaling, isolation or ownership needs |
| Database | PostgreSQL as system of record; Rust/SQLx owns business transactions and one reviewed migration set | Read replica or dedicated tenant database when measured/customer requirements justify it |
| Search | Start with indexed SQL/full-text filtering plus existing pgvector capabilities; tenant-scope all retrieval | Evaluate OpenSearch when representative load, faceting or relevance requirements exceed this approach |
| Background work | Rust owns durable jobs/outbox; private Python bridge dispatches AI tasks through Celery/Redis and returns results for Rust to persist | Consider Temporal for long-running, versioned human workflows after simple persisted rules prove insufficient |
| Files | S3-compatible object storage; quarantine, scanning, document versions and authorized downloads | Regional buckets or stronger customer-specific isolation when required |
| Identity | Integrate a managed identity provider; keep authorization inside the ATS | Enterprise SSO when required by first enterprise pilots; SCIM/delegation in the enterprise phase |
| Parsing | Benchmark existing parser and a commercial parser behind the same interface | Choose per quality, language, privacy and cost evidence |
| AI | Python/Instructor/Pydantic for optional asynchronous extraction/evaluation, versioned results and evidence; Rust validates and persists authorized outputs | Better models only after evaluation shows measurable benefit |
| Reporting | Indexed SQL and bounded/materialized summaries based on real events | Warehouse when historical/custom reports interfere with transactional latency |
| Hosting | Managed application containers, managed PostgreSQL, Redis and object storage in one region | Kubernetes/multiple regions only when operational or contractual requirements warrant them |

The selected Rust/Python split reflects the user's architecture decision on 4 October 2026. Keep the Rust business core modular and preserve Python AI algorithms. Re-estimate the timeline after implementing the first Rust slice; another service and cross-language contracts add migration and operational work.

FastAPI's deployment guidance discusses worker processes and separate memory, which reinforces the need to remove business records from process-local dictionaries. [FastAPI deployment concepts](https://fastapi.tiangolo.com/deployment/concepts/)

PostgreSQL RLS provides another enforcement layer, but table owners and privileged roles can bypass policies. Use a restricted application role, explicit tenant context per transaction, suitable FORCE ROW LEVEL SECURITY policies where appropriate, and tests using the actual production role. RLS does not protect files, caches or external integrations. [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

Celery task retries require idempotent business effects; a queue alone does not establish exactly-once processing. Use stable job IDs, uniqueness constraints and retry-safe writes. [Celery task guidance](https://docs.celeryq.dev/en/stable/userguide/tasks.html)

SQLx is the selected database layer for the Rust core, including one reviewed migration set. Baseline the existing SQLAlchemy-era schema and test upgrades against both empty and representative existing databases. Python AI services must not run an independent production migration history. [SQLx documentation](https://docs.rs/sqlx/latest/sqlx/)

Temporal is a later candidate for durable long-running workflow execution; first-release stages, approvals and reminders can use persisted state plus workers. Adoption should follow concrete workflow requirements. [Temporal documentation](https://docs.temporal.io/)

## 4. Domain and authorization model

| Domain | Principal entities | Important rule |
| --- | --- | --- |
| Identity | Tenant, User, Membership, Role, Permission | A login is not automatically a member of every workspace |
| Corporate | Department, Requisition, Approval, HiringTeam | Approved requisitions can produce job openings; hiring-team scope controls access |
| Agency | ClientCompany, ClientContact, ClientAccessGrant, Submission, Placement | A client can access only deliberately shared submissions |
| Recruiting | JobPosting, Candidate, Application, PipelineDefinition, Stage, StageTransition | Stage and decision belong to Application; Candidate is reusable within its tenant |
| Documents | CandidateDocument, DocumentVersion, IngestionJob | Preserve original and extracted versions, source hash, status and object key |
| Collaboration | Note, Task, Interview, InterviewParticipant, Scorecard, Offer | Scorecards belong to an interview/application; submitted feedback has controlled revisions |
| Communication | Template, Message, IntegrationConnection, DeliveryAttempt | Store provider identity, thread/event IDs and retry history |
| Governance | AuditEvent, PrivacyPreference, RetentionPolicy, DeletionJob | Capture actor, tenant, action, target and time without uncontrolled PII in logs |
| Platform | OutboxEvent, Entitlement, UsageEvent, WebhookDelivery | Persist side-effect intent with business changes; reconcile delivery independently |

Use tenant_id on tenant-owned records, tenant-inclusive uniqueness constraints and composite foreign keys that prevent cross-tenant relationships. Do not accept a tenant ID from a request body as authority; resolve it from authenticated membership. Remove all-zero tenant fallbacks from production flows.

A shared built-in skill catalog may remain global and read-only to customers; tenant custom skills and overrides must be separately owned. Avoid mechanically applying tenant ownership to public reference data without defining the distinction.

Separate restricted contact details and original documents from anonymized/searchable profile data. Parse-failed or unprocessed candidates need explicit draft/processing states and nullable unknown fields; do not force the current non-null model fields to manufacture names, experience or scores.

An agency client company is a business record inside the agency workspace. A corporate tenant is an independent security boundary. If the same real company uses both arrangements, connect them only through an explicit later sharing agreement; matching names or domains must not merge access.

Client submissions should reference a versioned, allowlisted snapshot. Client reviewers must not inherit access to the agency's whole candidate pool, private notes, competing submissions or commercial fee terms. Revoking a grant must block future portal/API downloads; issued signed links require short expiration.

Example release tests:

- A candidate interviewing for Job A remains at screening for Job B when Job A advances.
- Agency Client A cannot view a candidate submission sent only to Client B.
- Corporate Tenant A cannot retrieve Tenant B's candidate by guessing its ID, object key, task ID, export ID or search query.
- Hiding PII in the UI also prevents unauthorized retrieval through API, exports, original PDFs and portal payloads.

## 5. Phased delivery roadmap

Weeks are relative to an agreed kickoff. The ranges illustrate 2–4 developers with product/QA support, a limited integration set, managed services and reuse of the current UI/AI components. Phase exit evidence controls progression.

| Phase | Indicative window | Deliverables | Exit gate |
| --- | --- | --- | --- |
| 0 — Baseline and product contract | Weeks 1–2 | Verify preserved changes; frontend lint/types/build; backend test inventory; runnable environment; remove demo claims; corporate and agency user journeys; schema/permission design | Documented baseline, agreed V1 scope and reproducible development setup |
| 1 — Durable SaaS foundation | Weeks 3–8 | Tenant/user membership; migrations; DB-backed candidates/jobs/applications; object storage; canonical ingestion; outbox; durable task state; basic audit and access controls | Upload survives restart; two API instances agree; repeated worker delivery is safe; tenant/client isolation tests pass |
| 2 — Recruiting core and corporate path | Weeks 9–14 | Job/requisition management; simple approvals; application pipeline/history; hiring teams; notes/tasks/tags; candidate editing/dedup; real list/search; career site; bulk import/export | Corporate pilot journey works from requisition to shortlisted application, including permission checks |
| 3 — Agency path | Weeks 15–18 | Clients/contacts; client jobs; sharing controls; submissions; client reviewer portal; feedback; placements and expected fee tracking | Agency can source, submit, collect client feedback and record placement without cross-client data leakage |
| 4 — Complete hiring journeys | Weeks 19–24 | Email templates/send/log; chosen calendar provider; interview scheduling/rescheduling; scorecards; offer records/documents; basic referral flow; persisted reminders | Both segments can complete interview, offer and hire/placement journeys |
| 5 — Paid-pilot hardening | Weeks 25–32 | Real reports/settings/audit UI; billing or assisted invoicing with entitlements; usage limits; privacy export/deletion; backups/restore; monitoring; deployment/rollback; migration tools | At least two corporate and two agency design partners can operate end to end; release checklist passes |
| 6 — Enterprise operations | Months 9–15, conditional | SSO where not already needed; SCIM; custom roles/field controls; richer approvals; custom fields; signed webhooks; public API scopes; offers/e-sign; second mail/calendar ecosystem; approved board/HRIS connectors | Successful enterprise security/implementation review and observed reliability for the promised service |
| 7 — Broader Zoho-like platform | Months 15–24+, conditional | Visual workflow builder; CRM/talent campaigns; broader portals; advanced analytics; richer search/AI; configuration sandbox; marketplace foundations | Customers validate the added modules and support/operations can sustain them |
| 8 — Global and regulated scale | Re-estimate after enterprise pilots | Regional tenant placement; stronger DR; dedicated data options; compliance audits; optional native mobile; contractual availability/support tiers | Tested recovery, operational ownership and required independent evidence exist |

Enterprise SSO moves into the first-release critical path if a committed pilot requires it. Privacy controls and audit capture start in Phase 1, even though admin tooling and operational exercises mature in Phase 5. Formal certifications must not be implied by implementing controls.

Agency requirements can be developed alongside the corporate path once Phase 1 stabilizes, if staffing permits. They remain mandatory at the first external product release.

## 6. Immediate execution backlog

All items below are proposed and not yet implemented. BE = backend/full-stack owner; FE = frontend owner; QA/Platform can initially be shared responsibilities.

| ID | Work package | Depends on | Owner | Definition of done |
| --- | --- | --- | --- | --- |
| ATS-001 | Establish clean baseline and update the unfinished review record | None | Lead/QA | Record current lint, type, build, offline and integration outcomes separately; preserve existing work |
| ATS-002 | Replace misleading demo output | None | FE | No fixed analytics export or unverifiable audit/compliance badges; demo data cannot appear as customer records |
| ATS-003 | Rust core, domain schema and migration baseline | ATS-001 | BE | Axum/SQLx foundation; reviewed tenant/user/application/client schema; one Rust-managed migration baseline; upgrade and restore rehearsal |
| ATS-004 | Identity, membership and permission matrix | ATS-003 | BE/FE | Real login/invite/revoke; roles and job/client scopes enforced server-side; PII reveal logged |
| ATS-005 | Shared repositories and application service | ATS-003/004 | BE | Candidate/job/application routes use PostgreSQL; same candidate can have independent application stages |
| ATS-006 | Durable document storage | ATS-003/004 | BE/Platform | Tenant-scoped object access, quarantine/scanning, document versions and verified original-PDF retrieval |
| ATS-007 | Canonical ingestion and outbox | ATS-005/006 | BE | Persist input/job/event before enqueue; safe retries; candidate/application IDs agree across API/worker/search |
| ATS-008 | Durable upload UX and task authorization | ATS-007 | FE/BE | Poll or stream until terminal state; reconnect after refresh; retry safely; cancel-request semantics are explicit |
| ATS-009 | Vector migration and search integration | ATS-005/007 | BE | DB type/model checked; vectors rebuilt if required; authorized uploaded candidates become searchable |
| ATS-010 | Audit events and operational telemetry | ATS-004 onward | BE/Platform | Mutations and privileged reads produce scoped events; actual audit UI, trace IDs, queue/error metrics |
| ATS-011 | Corporate requisitions and hiring teams | ATS-005 | BE/FE | Requisition approval, job team, pipeline and rejection history are persisted and permission-tested |
| ATS-012 | Agency clients, submissions and placements | ATS-005/006 | BE/FE | Client-scoped records and portal; controlled snapshots; feedback; expected fees distinct from revenue |
| ATS-013 | Acquisition and migration tools | ATS-007/011/012 | BE/FE | Career application, CSV dry run, row errors, dedup review, resumable import, export |
| ATS-014 | Communication, interviews and offers | ATS-010/011/012 | BE/FE | Provider adapter, templates, invite/reschedule/cancel, scorecard, offer and outcome work end to end |
| ATS-015 | Reporting, entitlements and pilot release | ATS-010 through 014 | Team | Accurate segment-specific reports, limits/billing state, restore exercise and both pilot cohorts signed off |

First two weeks: ATS-001/002, discovery with both segments, and design for ATS-003/004. Weeks 3–4: implement the first migration/identity slice and a database-backed candidate/job/application journey. Then complete storage and ingestion before expanding workflow features. This ordering is more reliable than implementing every screen simultaneously.

### Existing files to change first

| File or area | Planned change |
| --- | --- |
| [Database models](<D:/Projects/Applicant Tracking System/ats-system/ats-core/src/ats_core/models/db.py>) | Use as reference for tenant-safe Rust/SQLx schema, separate application state, documents, task/outbox/audit entities |
| [API authentication](<D:/Projects/Applicant Tracking System/ats-system/ats-core/src/ats_core/api/auth.py>) | Migrate human identity/membership policies to Rust; use private service identity for Python AI |
| [Candidate routes](<D:/Projects/Applicant Tracking System/ats-system/ats-core/src/ats_core/api/v1/candidates.py>) | Move CRUD, PII/files/task permissions to Rust; use private Python ingestion through durable jobs |
| [Job routes](<D:/Projects/Applicant Tracking System/ats-system/ats-core/src/ats_core/api/v1/jobs.py>) | Move jobs and application transitions to Rust/PostgreSQL; retire dictionary and seeded production state |
| [Worker tasks](<D:/Projects/Applicant Tracking System/ats-system/ats-core/src/ats_core/workers/tasks.py>) | Process scoped tenant/document/job inputs, preserve originals, return recoverable results to Rust; remove direct business-table commits |
| [Matching route](<D:/Projects/Applicant Tracking System/ats-system/ats-core/src/ats_core/api/v1/match.py>) | Rust authorizes retrieval and evaluation jobs; Python computes embeddings/reranking/evaluation; Rust saves versioned results |
| [Frontend API client](<D:/Projects/Applicant Tracking System/ats-system/frontend/src/lib/api.ts>) | Rust public API access with real sessions, generated/checked contracts, asynchronous polling and cancellation |
| [Settings page](<D:/Projects/Applicant Tracking System/ats-system/frontend/src/app/settings/page.tsx>) | Connect tenant, team, privacy and provider configuration to real authorized endpoints |
| [Analytics page](<D:/Projects/Applicant Tracking System/ats-system/frontend/src/app/analytics/page.tsx>) | Fetch bounded, filterable reporting data; export the same underlying query |
| [Audit page](<D:/Projects/Applicant Tracking System/ats-system/frontend/src/app/audit-log/page.tsx>) | Display real business and evaluation events with field permissions and retention behavior |

Add a Rust core backend with domain/repository modules and SQLx migrations, private Python AI endpoints, shared versioned contracts, application/worker build definitions, CI workflows and browser integration tests. These are proposed additions, not existing capabilities. See the [Rust/Python migration plan](<D:/Projects/Applicant Tracking System/ats-system/docs/RUST_CORE_PYTHON_AI_MIGRATION_PLAN.md>) for exact ownership and migration steps.

Before editing frontend code, follow its local AGENTS.md requirement to consult the installed Next.js documentation for the relevant APIs.

## 7. Safe migration from the current project

1. Inventory the actual database, running services and existing records. Export any valuable process-local records while the old process is still available; lost in-memory state cannot be recovered from a schema migration.
2. Capture a database and document backup and prove restoration in a non-production environment.
3. Establish a migration baseline matching the real schema. Add tenant, user, document, ingestion, application-history and audit structures using reviewed versioned migrations.
4. Map legacy string identifiers such as cand-prefixed IDs to canonical UUIDs; preserve a migration map for resume links and references. Resolve job/application duplicates explicitly.
5. Assign imported data to a verified tenant; stop on ambiguous ownership. Only after backfill and validation make ownership mandatory and enforce tenant foreign keys/RLS.
6. Copy original resumes to durable object storage and verify hashes/access before retiring local-file assumptions. Preserve restricted identity/contact fields separately from anonymized extraction.
7. Make Rust the authoritative writer for business and saved AI results. Python workers deliver versioned results through an authenticated internal Rust endpoint. Save task/outbox intent in the same transaction as the relevant business state and make dispatch/result delivery idempotent.
8. Inspect existing embedding model and column dimensions, regenerate incompatible embeddings, rebuild indexes and test tenant-scoped retrieval. Record parser/model/prompt versions.
9. Update the frontend for durable processing states, independent application stages and explicit permission failures.
10. Rehearse migration, count reconciliation, rollback/restore and end-to-end journeys. Switch traffic only after agreed gates; preserve rollback assets until the validation window ends.

The currently inspected database model requires extracted fields before insertion. Introduce draft candidates/documents or a staged ingestion entity so a valid upload can be accepted before parsing succeeds.

## 8. Release gates and quality targets

These are proposed acceptance criteria, not measured current performance.

| Gate | Evidence required before paid release |
| --- | --- |
| Durable state | Create records, restart API/worker, and retrieve unchanged records through two API processes |
| Isolation | Automated negative tests across tenants and agency clients for list/detail/search/PII/PDF/tasks/exports/portal views |
| Ingestion reliability | Valid PDF completes; malformed input fails clearly; duplicate delivery is harmless; crash after commit recovers; retry does not duplicate candidates or applications |
| File security | Quarantine and allowed-type checks; no public resume bucket; authorized download; rejected/abandoned file cleanup |
| Privacy lifecycle | Tenant export/deletion workflow covers profile, documents, vectors, derived data and provider jobs; documented backup expiration and minimal audit retention policy |
| Corporate journey | Requisition → approval → published job → application → screening → interview → offer → hire |
| Agency journey | Client job → candidate sourcing → permitted submission → client feedback → interview → offer → placement |
| Reporting accuracy | Counts, filters, exports and date definitions reconcile with persisted applications/events; expected fees not reported as collected revenue |
| UI truthfulness | No demonstration metrics, fake success states or unsupported compliance badges in live workspaces |
| Operational recovery | Backup restoration and failed deployment recovery demonstrated; queue backlog/error alerts tested |
| Performance | Agreed pilot dataset/load, e.g. 10,000 candidates per tenant and 20 active recruiters; provisional p95 ordinary reads <500 ms and filtered search <1 s, excluding parsing/inference |
| AI independence | Disabling/unavailable AI does not prevent upload, manual review, interview scheduling, stage changes or hiring |
| Accessibility | Keyboard and screen-reader checks for application form, pipeline actions and critical dialogs |
| Billing/limits | Subscription or manually assigned contract entitlements are server-enforced; webhook retries do not duplicate billing state |

Define performance workload, environment and measurement period before testing. The proposed dataset and latency targets should be revised with pilot customers. Do not market contractual uptime based on one load test.

## 9. AI improvement plan

The present project has promising evidence and retrieval components. Integrate and evaluate them before increasing model size.

- Assemble a consented or appropriately de-identified evaluation set spanning both segments, target job families, languages, PDF layouts and hard parsing cases.
- Measure extraction accuracy per field, correction rate, failed-document rate, retrieval Recall@K/NDCG, citation support, inference latency and cost.
- Compare existing local parsing with a commercial alternative behind a common adapter. Adopt the option that meets measured requirements and permitted data handling.
- Version the document, parser, embedding model, job requirements, rubric, prompt and evaluation result. A changed job should not silently reuse an old score.
- Make unknown or unsupported evidence explicit. Show source-linked strengths/gaps and allow corrections and recruiter override.
- Keep automated ranking advisory. Require human decisions for rejection, interview selection and hire; assess unjustified proxy features and outcome disparities with appropriate expertise.
- Treat local/cloud processing as a real server-side policy. A cloud-backed model accessed through an Ollama endpoint must not be advertised as local processing.
- Separate an AI evaluation history from business/security audit events. A database class named ScoringAudit is not evidence of tamper-proof retention or regulatory compliance.

A useful differentiation hypothesis is **evidence-linked shortlisting across corporate jobs and agency client submissions**. Validate that customers find it more useful and faster than keyword screening before treating it as the product's competitive advantage.

## 10. Enterprise expansion and explicit deferrals

| Capability | Sequence and adoption condition |
| --- | --- |
| SAML/OIDC SSO | Pull into pilot if a committed customer requires it; managed provider preferred |
| SCIM, custom roles, field controls | After identity and scoping are stable; deprovisioning must revoke active access |
| Automation | Persisted event/condition/action rules → approvals/escalations → versioned visual designer |
| Integrations | Shared credential/token, idempotency, retry, rate-limit and delivery-log framework before accumulating adapters |
| Job boards | Obtain commercial/API access first; begin with customer-priority channels and track publish/update/close reconciliation |
| Candidate CRM/campaigns | Add pools, engagement history and opt-out controls after basic hiring is adopted |
| Portals | Expand the V1 client reviewer portal into candidate/vendor portals based on validated demand |
| Analytics warehouse | Add when measured reporting load or history needs justify it |
| Native mobile | Start responsive; invest after usage shows a need |
| Multi-region/dedicated data plane | Add after target-country/residency commitments and recovery design are agreed |
| Certifications/SLA | Start operational evidence collection early; obtain the required audits and prove support/DR before selling commitments |

Do not make broad job-board coverage, a custom video platform, payroll, a plugin marketplace, Kubernetes or multi-region operations dependencies of the first release. None is needed to prove the two core recruiting journeys.

## 11. Staffing, timeline and economics

| Capacity | Narrow first release serving both segments | Broader enterprise capability |
| --- | --- | --- |
| Solo developer with AI assistance | Approximately 9–15+ months; prioritize one mail/calendar ecosystem and assisted onboarding | Multi-year effort or additional staff; no credible full-parity date yet |
| 2–4 experienced developers plus product/QA support | Approximately 6–9 months; the phase table illustrates up to 32 weeks | Approximately 15–24+ months for selected enterprise depth; global parity requires separate estimation |
| Larger dedicated team | Re-estimate workstreams; the supplied report's roughly six-month MVP assumes 12–15 product/engineering FTEs and corporate-first scope | Its 15–18 month enterprise estimate assumes significant staffing, integration and operations investment |

These are planning judgments with substantial uncertainty. Re-estimate after the baseline, domain design and first durable vertical slice. AI assistance accelerates some implementation but does not remove integration approvals, security validation, customer discovery or operational work.

Use the research budget as a reference for its large-team scenario, not as this repository's funding requirement. Build an actual budget from:

- People and time by workstream.
- Managed database, object storage, backups, containers, queue and monitoring.
- Identity connections/users, parsing pages, email/calendar integration, and model inference.
- Security review, penetration testing where needed, legal/procurement work and customer implementation.
- Contingency for integrations and support.

Measure cost per processed resume, active tenant, recruiter and completed evaluation. Keep metering separate from pricing so pilot experiments do not require a billing rewrite.

Package the same engine as Corporate and Agency editions. Test recruiter-seat pricing with a workspace minimum and light collaborator/client-reviewer access; use allowances for expensive parsing/AI. Treat price points as hypotheses until customer interviews and willingness-to-pay tests. Basic assisted invoicing plus server-enforced entitlements is acceptable for early pilots; self-serve billing can follow.

## 12. Discovery and success measurement

Recruit at least two corporate design partners and two agencies before expanding feature breadth. Follow each partner's actual workflow and import sample data, with appropriate permission.

Confirm:

- Permanent recruitment versus contract staffing requirements.
- Geography, languages, employer/client structure and data handling expectations.
- Candidate volume, active recruiters and simultaneous imports/searches.
- Required mail/calendar, job boards, HRIS and identity provider.
- Approval rules, candidate sharing process, client visibility and fee reporting.
- Target onboarding time, acceptable service support and available budget.

Track activation (first job and application), active recruiters, percentage of workflow completed in-product, feedback delay, stage aging, failed imports, support burden and willingness to pay separately for each segment. Establish customer baselines before promising hiring-speed improvements.

The first implementation milestone is **a tenant-isolated job and candidate/application flow that survives restarts, processes a resume through one durable pipeline, and returns the original PDF under authorization**. That milestone unlocks the corporate and agency modules without amplifying the present persistence and permission gaps.
