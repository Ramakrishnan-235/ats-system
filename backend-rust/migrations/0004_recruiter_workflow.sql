-- Recruiter workflow: Interview loops and offer tracking on applications
ALTER TABLE ats_v2.applications
    ADD COLUMN IF NOT EXISTS interviews jsonb NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS offer jsonb NOT NULL DEFAULT '{}';

DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ats_runtime') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ats_v2 TO ats_runtime;
    END IF;
END $$;
