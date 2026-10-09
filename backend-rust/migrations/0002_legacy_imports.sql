CREATE TABLE ats_v2.legacy_imports (
 tenant_id uuid NOT NULL REFERENCES ats_v2.tenants(id), source text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('job','candidate')), source_id text NOT NULL,
 destination_id uuid NOT NULL, fingerprint text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,source,kind,source_id)
);
ALTER TABLE ats_v2.legacy_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ats_v2.legacy_imports FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON ats_v2.legacy_imports USING (tenant_id=nullif(current_setting('ats.tenant_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('ats.tenant_id',true),'')::uuid);
