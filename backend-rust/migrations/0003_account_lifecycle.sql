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

