-- schema.sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =============================================================================
-- 1. UTILITY FUNCTIONS & TRIGGERS
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================================================
-- 2. CANDIDATES TABLE
-- Stores de-identified candidate data, calculated metrics, structured JSON, and vector embeddings
-- =============================================================================
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anonymized_name VARCHAR(100) NOT NULL DEFAULT '[CANDIDATE_NAME]',
    target_headline VARCHAR(255) NOT NULL,
    years_of_experience NUMERIC(4, 1) NOT NULL CHECK (years_of_experience >= 0),
    location VARCHAR(100) DEFAULT 'Remote',
    highest_education VARCHAR(100),
    core_skills TEXT[] NOT NULL DEFAULT '{}',
    raw_anonymized_text TEXT NOT NULL,
    structured_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    parsing_engine VARCHAR(50) DEFAULT 'hybrid-pymupdf-docling',
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- HNSW Vector Index for Fast Cosine Similarity Search
CREATE INDEX IF NOT EXISTS idx_candidates_embedding_hnsw 
ON candidates USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- Payload Filter Indexes (Years of Experience, Location, Highest Education)
CREATE INDEX IF NOT EXISTS idx_candidates_exp ON candidates (years_of_experience);
CREATE INDEX IF NOT EXISTS idx_candidates_location ON candidates (location);
CREATE INDEX IF NOT EXISTS idx_candidates_education ON candidates (highest_education);
CREATE INDEX IF NOT EXISTS idx_candidates_payload_filters ON candidates (years_of_experience, location, highest_education);
CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON candidates (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_core_skills ON candidates USING GIN (core_skills);
CREATE INDEX IF NOT EXISTS idx_candidates_profile_gin ON candidates USING GIN (structured_profile jsonb_path_ops);

DROP TRIGGER IF EXISTS trg_candidates_updated_at ON candidates;
CREATE TRIGGER trg_candidates_updated_at
BEFORE UPDATE ON candidates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 3. JOB POSTINGS TABLE
-- Stores job requisitions, extracted hard criteria, soft preferences, and vector embeddings
-- =============================================================================
CREATE TABLE IF NOT EXISTS job_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    department VARCHAR(100),
    location VARCHAR(100) DEFAULT 'Remote',
    job_description TEXT NOT NULL,
    min_years_experience NUMERIC(4, 1) DEFAULT 0.0 CHECK (min_years_experience >= 0),
    required_skills TEXT[] NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' 
        CHECK (status IN ('DRAFT', 'OPEN', 'PAUSED', 'CLOSED')),
    structured_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- HNSW Vector Index on Job Postings
CREATE INDEX IF NOT EXISTS idx_jobs_embedding_hnsw 
ON job_postings USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON job_postings (status);
CREATE INDEX IF NOT EXISTS idx_jobs_location ON job_postings (location);
CREATE INDEX IF NOT EXISTS idx_jobs_required_skills ON job_postings USING GIN (required_skills);
CREATE INDEX IF NOT EXISTS idx_jobs_criteria_gin ON job_postings USING GIN (structured_criteria jsonb_path_ops);

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON job_postings;
CREATE TRIGGER trg_jobs_updated_at
BEFORE UPDATE ON job_postings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 4. APPLICATIONS TABLE
-- Connects Candidates to Job Postings with status tracking and latest scores
-- =============================================================================
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'APPLIED' 
        CHECK (status IN ('APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEWING', 'OFFERED', 'REJECTED', 'WITHDRAWN')),
    stage VARCHAR(50) NOT NULL DEFAULT 'Initial Ingestion',
    current_match_score NUMERIC(5, 2) CHECK (current_match_score BETWEEN 0.0 AND 100.0),
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_candidate_job UNIQUE (candidate_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_candidate ON applications (candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications (job_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications (status);
CREATE INDEX IF NOT EXISTS idx_applications_score ON applications (current_match_score DESC NULLS LAST);

DROP TRIGGER IF EXISTS trg_applications_updated_at ON applications;
CREATE TRIGGER trg_applications_updated_at
BEFORE UPDATE ON applications
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 5. SCORING AUDITS TABLE
-- Immutable evaluation ledger for LLM transparency, legal compliance, and EEOC audits
-- =============================================================================
CREATE TABLE IF NOT EXISTS scoring_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
    overall_match_score NUMERIC(5, 2) NOT NULL CHECK (overall_match_score BETWEEN 0.0 AND 100.0),
    qualification_tier VARCHAR(30) NOT NULL 
        CHECK (qualification_tier IN ('Strong Fit', 'Potential Fit', 'Low Match')),
    criteria_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
    pros TEXT[] NOT NULL DEFAULT '{}',
    cons_or_risks TEXT[] NOT NULL DEFAULT '{}',
    recommended_interview_questions TEXT[] NOT NULL DEFAULT '{}',
    recruiter_summary TEXT NOT NULL,
    
    -- LLM Telemetry & Audit Metadata
    llm_model VARCHAR(100) NOT NULL,
    prompt_tokens INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    latency_ms INT DEFAULT 0,
    raw_prompt TEXT,
    raw_llm_response TEXT,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audits_candidate ON scoring_audits (candidate_id);
CREATE INDEX IF NOT EXISTS idx_audits_job ON scoring_audits (job_id);
CREATE INDEX IF NOT EXISTS idx_audits_tier ON scoring_audits (qualification_tier);
CREATE INDEX IF NOT EXISTS idx_audits_evaluated_at ON scoring_audits (evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_audits_breakdown_gin ON scoring_audits USING GIN (criteria_breakdown jsonb_path_ops);

-- =============================================================================
-- 6. SKILLS TAXONOMY TABLE
-- Core proprietary ontology table mapping canonical names, categories, aliases,
-- ambiguity guards, and review flywheel states.
-- =============================================================================
CREATE TABLE IF NOT EXISTS skills_taxonomy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('language', 'framework', 'database', 'platform', 'tool', 'library', 'domain', 'soft_skill')),
    aliases TEXT[] NOT NULL DEFAULT '{}',
    is_ambiguous BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'rejected')),
    source TEXT DEFAULT 'manual' CHECK (source IN ('lightcast', 'esco', 'onet', 'stackoverflow', 'llm', 'resume_parser', 'manual')),
    occurrence_count INT NOT NULL DEFAULT 1,
    taxonomy_version TEXT NOT NULL DEFAULT '2026.08.1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_canonical ON skills_taxonomy (canonical_name);
CREATE INDEX IF NOT EXISTS idx_taxonomy_category ON skills_taxonomy (category);
CREATE INDEX IF NOT EXISTS idx_taxonomy_status ON skills_taxonomy (status);
CREATE INDEX IF NOT EXISTS idx_taxonomy_aliases_gin ON skills_taxonomy USING GIN (aliases);
CREATE INDEX IF NOT EXISTS idx_taxonomy_version ON skills_taxonomy (taxonomy_version);

DROP TRIGGER IF EXISTS trg_taxonomy_updated_at ON skills_taxonomy;
CREATE TRIGGER trg_taxonomy_updated_at
BEFORE UPDATE ON skills_taxonomy
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

