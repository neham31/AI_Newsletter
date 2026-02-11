-- Migration: Create ingestion_log table
-- Purpose: Debug and track the content ingestion pipeline

-- Create ingestion_type enum for log entry categorization
DO $$ BEGIN
    CREATE TYPE ingestion_type AS ENUM (
        'email_received',
        'rss_polled',
        'extraction_success',
        'extraction_failed',
        'duplicate_skipped'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create ingestion_log table
CREATE TABLE IF NOT EXISTS ingestion_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES sources(id),
    type ingestion_type NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying logs by source
CREATE INDEX IF NOT EXISTS idx_ingestion_log_source_id ON ingestion_log(source_id);

-- Index for querying logs by type
CREATE INDEX IF NOT EXISTS idx_ingestion_log_type ON ingestion_log(type);

-- Index for querying logs by time (most recent first)
CREATE INDEX IF NOT EXISTS idx_ingestion_log_created_at ON ingestion_log(created_at DESC);

-- Composite index for filtering by source and type
CREATE INDEX IF NOT EXISTS idx_ingestion_log_source_type ON ingestion_log(source_id, type);
