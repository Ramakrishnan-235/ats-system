-- Separate schema preserves the legacy installation until an explicit import/cutover.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS ats_v2;
CREATE TABLE ats_v2.tenants (
 id uuid PRIMARY KEY, name text NOT NULL, kind text NOT NULL CHECK(kind IN ('corporate','agency')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ats_v2.users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL,
 password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ats_v2.memberships (
 tenant_id uuid REFERENCES ats_v2.tenants(id), user_id uuid REFERENCES ats_v2.users(id),
 role text NOT NULL CHECK(role IN ('admin','recruiter','viewer','interviewer','compliance')),
 PRIMARY KEY(tenant_id,user_id)
);
CREATE TABLE ats_v2.sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES ats_v2.users(id),
 tenant_id uuid NOT NULL, expires_at timestamptz NOT NULL,
 FOREIGN KEY(tenant_id,user_id) REFERENCES ats_v2.memberships(tenant_id,user_id) ON DELETE CASCADE
);
CREATE TABLE ats_v2.auth_attempts (
 identity_hash text PRIMARY KEY, attempts integer NOT NULL, window_start timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ats_v2.jobs (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES ats_v2.tenants(id),
 title text NOT NULL, department text NOT NULL DEFAULT '', location text NOT NULL DEFAULT '',
 job_description text NOT NULL, required_skills jsonb NOT NULL DEFAULT '[]',
 min_years_experience double precision NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','PAUSED','CLOSED')),
 revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id)
);
CREATE TABLE ats_v2.candidates (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES ats_v2.tenants(id),
 profile jsonb NOT NULL DEFAULT '{}', contact jsonb NOT NULL DEFAULT '{}',
 sanitized_text text NOT NULL DEFAULT '', revision integer NOT NULL DEFAULT 1,
 processing_status text NOT NULL DEFAULT 'PENDING', deleted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id)
);
CREATE TABLE ats_v2.documents (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, candidate_id uuid NOT NULL,
 version integer NOT NULL, object_key text NOT NULL UNIQUE, source_hash text NOT NULL,
 filename text NOT NULL, size_bytes bigint NOT NULL CHECK(size_bytes > 0),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 UNIQUE(tenant_id,candidate_id,version),
 FOREIGN KEY(tenant_id,candidate_id) REFERENCES ats_v2.candidates(tenant_id,id)
);
CREATE TABLE ats_v2.applications (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, candidate_id uuid NOT NULL, job_id uuid NOT NULL,
 stage text NOT NULL DEFAULT 'Screening', current_score double precision CHECK(current_score BETWEEN 0 AND 100),
 revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,candidate_id,job_id),
 FOREIGN KEY(tenant_id,candidate_id) REFERENCES ats_v2.candidates(tenant_id,id),
 FOREIGN KEY(tenant_id,job_id) REFERENCES ats_v2.jobs(tenant_id,id)
);
CREATE TABLE ats_v2.stage_transitions (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, application_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES ats_v2.users(id), from_stage text NOT NULL, to_stage text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,application_id) REFERENCES ats_v2.applications(tenant_id,id)
);
-- Control-plane jobs are accessed only by tenant-scoped public SQL or service-authenticated endpoints.
CREATE TABLE ats_v2.processing_jobs (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, candidate_id uuid NOT NULL, document_id uuid NOT NULL,
 application_id uuid, operation text NOT NULL CHECK(operation IN ('ingest','evaluate')),
 state text NOT NULL DEFAULT 'QUEUED' CHECK(state IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED','STALE')),
 input_revision integer NOT NULL, job_revision integer, document_version integer NOT NULL,
 attempt_id uuid, attempts integer NOT NULL DEFAULT 0, lease_until timestamptz,
 result_hash text, result jsonb, error_code text, progress integer NOT NULL DEFAULT 0, step text NOT NULL DEFAULT 'Queued', created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,candidate_id) REFERENCES ats_v2.candidates(tenant_id,id),
 FOREIGN KEY(tenant_id,document_id) REFERENCES ats_v2.documents(tenant_id,id),
 FOREIGN KEY(tenant_id,application_id) REFERENCES ats_v2.applications(tenant_id,id)
);
CREATE INDEX processing_recovery ON ats_v2.processing_jobs(state,lease_until);
CREATE TABLE ats_v2.outbox (
 job_id uuid PRIMARY KEY REFERENCES ats_v2.processing_jobs(id),
 available_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz,
 attempts integer NOT NULL DEFAULT 0, locked_until timestamptz
);
CREATE TABLE ats_v2.upload_requests (
 tenant_id uuid NOT NULL, idempotency_key text NOT NULL, source_hash text NOT NULL,
 job_id uuid NOT NULL REFERENCES ats_v2.processing_jobs(id), PRIMARY KEY(tenant_id,idempotency_key)
);
CREATE TABLE ats_v2.evaluations (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, application_id uuid NOT NULL,
 processing_job_id uuid NOT NULL UNIQUE REFERENCES ats_v2.processing_jobs(id), document_id uuid NOT NULL,
 job_revision integer NOT NULL, rubric_version text NOT NULL, model_version text NOT NULL,
 scorecard jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,application_id) REFERENCES ats_v2.applications(tenant_id,id),
 FOREIGN KEY(tenant_id,document_id) REFERENCES ats_v2.documents(tenant_id,id)
);
CREATE TABLE ats_v2.embeddings (
 tenant_id uuid NOT NULL, document_id uuid NOT NULL, model text NOT NULL,
 preprocessing_version text NOT NULL, embedding vector(768) NOT NULL,
 PRIMARY KEY(tenant_id,document_id,model,preprocessing_version),
 FOREIGN KEY(tenant_id,document_id) REFERENCES ats_v2.documents(tenant_id,id)
);
CREATE INDEX embeddings_hnsw ON ats_v2.embeddings USING hnsw(embedding vector_cosine_ops);
CREATE INDEX candidate_fts ON ats_v2.candidates USING gin(to_tsvector('english',sanitized_text));
CREATE INDEX candidates_tenant ON ats_v2.candidates(tenant_id,created_at);
CREATE TABLE ats_v2.notes (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, candidate_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES ats_v2.users(id), content text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,candidate_id) REFERENCES ats_v2.candidates(tenant_id,id)
);
CREATE TABLE ats_v2.audit_events (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES ats_v2.tenants(id), actor_id uuid,
 actor_role text NOT NULL, action text NOT NULL, resource_type text NOT NULL, resource_id text NOT NULL,
 decision text NOT NULL DEFAULT 'ALLOWED', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ats_v2.taxonomy (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES ats_v2.tenants(id), canonical_name text NOT NULL,
 category text NOT NULL, aliases jsonb NOT NULL DEFAULT '[]', is_ambiguous boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'approved' CHECK(status IN ('approved','pending','rejected')),
 source text NOT NULL DEFAULT 'manual', revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,canonical_name)
);
CREATE TABLE ats_v2.clients (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES ats_v2.tenants(id),
 name text NOT NULL, contact jsonb NOT NULL DEFAULT '{}', UNIQUE(tenant_id,id)
);
CREATE TABLE ats_v2.submissions (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, client_id uuid NOT NULL, application_id uuid NOT NULL,
 snapshot jsonb NOT NULL, status text NOT NULL DEFAULT 'SUBMITTED',
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,client_id) REFERENCES ats_v2.clients(tenant_id,id),
 FOREIGN KEY(tenant_id,application_id) REFERENCES ats_v2.applications(tenant_id,id)
);
-- Defense in depth. All business queries ALSO contain tenant predicates.
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['jobs','candidates','documents','applications','stage_transitions','evaluations','embeddings','notes','audit_events','taxonomy','clients','submissions'] LOOP
  EXECUTE format('ALTER TABLE ats_v2.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE ats_v2.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY tenant_scope ON ats_v2.%I USING (tenant_id = nullif(current_setting(''ats.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''ats.tenant_id'',true),'''')::uuid)',tab);
 END LOOP;
END $$;
