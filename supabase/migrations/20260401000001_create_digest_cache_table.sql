-- Create digest_cache table for caching AI-generated TLDR per batch run
-- This avoids regenerating takeaways for every user in the same batch

CREATE TABLE IF NOT EXISTS digest_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  takeaways TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_digest_cache_key ON digest_cache (cache_key);
