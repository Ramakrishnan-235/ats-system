ALTER TABLE ats_v2.processing_jobs
ADD COLUMN progress_stages jsonb NOT NULL DEFAULT '{}'::jsonb;
