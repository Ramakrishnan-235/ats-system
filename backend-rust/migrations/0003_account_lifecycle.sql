-- Invitations record containing workspace, email, role, inviter, token hash, expiry, and acceptance/revocation status
CREATE TABLE IF NOT EXISTS ats_v2.invitations (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES ats_v2.tenants(id) ON DELETE CASCADE,
    email text NOT NULL,
    role text NOT NULL CHECK(role IN ('admin','recruiter','viewer','interviewer','compliance')),
    inviter_id uuid NOT NULL REFERENCES ats_v2.users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked','expired')),
    accepted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invitations_tenant ON ats_v2.invitations(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS invitations_email ON ats_v2.invitations(email, status);

-- Row-Level Security for invitations
ALTER TABLE ats_v2.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ats_v2.invitations FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'ats_v2' AND tablename = 'invitations' AND policyname = 'tenant_scope'
    ) THEN
        CREATE POLICY tenant_scope ON ats_v2.invitations
            USING (
                nullif(current_setting('ats.tenant_id', true), '') IS NULL
                OR tenant_id = nullif(current_setting('ats.tenant_id', true), '')::uuid
            )
            WITH CHECK (
                nullif(current_setting('ats.tenant_id', true), '') IS NULL
                OR tenant_id = nullif(current_setting('ats.tenant_id', true), '')::uuid
            );
    END IF;
END $$;

-- Email-delivery tasks saved in the same transaction so temporary email failures can be retried
CREATE TABLE IF NOT EXISTS ats_v2.email_tasks (
    id uuid PRIMARY KEY,
    tenant_id uuid REFERENCES ats_v2.tenants(id) ON DELETE CASCADE,
    recipient_email text NOT NULL,
    template text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}',
    status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sent','failed')),
    attempts integer NOT NULL DEFAULT 0,
    available_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_tasks_queue ON ats_v2.email_tasks(status, available_at);

-- Row-Level Security for email_tasks
ALTER TABLE ats_v2.email_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ats_v2.email_tasks FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'ats_v2' AND tablename = 'email_tasks' AND policyname = 'tenant_scope'
    ) THEN
        CREATE POLICY tenant_scope ON ats_v2.email_tasks
            USING (
                nullif(current_setting('ats.tenant_id', true), '') IS NULL
                OR tenant_id IS NULL
                OR tenant_id = nullif(current_setting('ats.tenant_id', true), '')::uuid
            )
            WITH CHECK (
                nullif(current_setting('ats.tenant_id', true), '') IS NULL
                OR tenant_id IS NULL
                OR tenant_id = nullif(current_setting('ats.tenant_id', true), '')::uuid
            );
    END IF;
END $$;

-- Scrub plaintext token from payload once email task transitions to sent
CREATE OR REPLACE FUNCTION ats_v2.scrub_email_task_token()
RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'sent' AND NEW.payload ? 'token' THEN
        NEW.payload = NEW.payload - 'token';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scrub_email_task_token ON ats_v2.email_tasks;
CREATE TRIGGER trg_scrub_email_task_token
BEFORE INSERT OR UPDATE OF status, payload ON ats_v2.email_tasks
FOR EACH ROW
EXECUTE FUNCTION ats_v2.scrub_email_task_token();

-- Password-reset tokens with expiry and single-use behavior
CREATE TABLE IF NOT EXISTS ats_v2.password_reset_tokens (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES ats_v2.users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user ON ats_v2.password_reset_tokens(user_id, expires_at);

-- Email-verification tokens with expiry and single-use behavior
CREATE TABLE IF NOT EXISTS ats_v2.email_verification_tokens (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES ats_v2.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Email verification flag on users
ALTER TABLE ats_v2.users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ats_runtime') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ats_v2 TO ats_runtime;
    END IF;
END $$;

