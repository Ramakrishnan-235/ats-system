-- Pause API/Celery writes before applying. Original vectors are preserved for rollback.
BEGIN;
DO $$
DECLARE
    target_table text;
    current_type text;
    old_index text;
BEGIN
    FOREACH target_table IN ARRAY ARRAY['candidates', 'job_postings'] LOOP
        SELECT format_type(a.atttypid, a.atttypmod) INTO current_type
        FROM pg_attribute a
        WHERE a.attrelid = target_table::regclass AND a.attname = 'embedding'
          AND NOT a.attisdropped;
        IF current_type = 'vector(768)' THEN
            CONTINUE;
        END IF;
        IF current_type IS NULL THEN
            RAISE EXCEPTION 'Missing %.embedding', target_table;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = target_table::regclass
                   AND attname = 'embedding_legacy_pre_gemma2' AND NOT attisdropped) THEN
            RAISE EXCEPTION 'Existing legacy column in %, review before migrating', target_table;
        END IF;
        EXECUTE format('ALTER TABLE %I RENAME COLUMN embedding TO embedding_legacy_pre_gemma2', target_table);
        EXECUTE format('ALTER TABLE %I ADD COLUMN embedding vector(768)', target_table);
        old_index := CASE WHEN target_table = 'candidates' THEN 'idx_candidates_embedding_hnsw' ELSE 'idx_jobs_embedding_hnsw' END;
        IF to_regclass(old_index) IS NOT NULL THEN
            EXECUTE format('ALTER INDEX %I RENAME TO %I', old_index, old_index || '_legacy_pre_gemma2');
        END IF;
    END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS idx_candidates_embedding_hnsw
    ON candidates USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_jobs_embedding_hnsw
    ON job_postings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
COMMIT;
