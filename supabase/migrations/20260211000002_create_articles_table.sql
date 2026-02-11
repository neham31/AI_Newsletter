-- Migration: Create articles table
-- Description: Stores extracted news content from newsletters and blogs

-- Create articles table
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES sources(id),
  headline TEXT NOT NULL,
  summary TEXT,
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  image_url TEXT,
  published_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  raw_email_id UUID,
  extraction_confidence FLOAT DEFAULT 1.0 NOT NULL
);

-- Create unique index on url_hash for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_url_hash ON articles(url_hash);

-- Create index on source_id and published_at for source-based queries
CREATE INDEX IF NOT EXISTS idx_articles_source_published ON articles(source_id, published_at DESC);

-- Create index on published_at for date-based queries
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);

-- Create GIN index on tags for array search
CREATE INDEX IF NOT EXISTS idx_articles_tags ON articles USING GIN(tags);
