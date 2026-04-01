-- Add themes column to digest_cache for storing weekly AI-generated theme summaries
-- Weekly cache entries store themes as JSONB instead of takeaways text array

ALTER TABLE digest_cache ADD COLUMN IF NOT EXISTS themes JSONB;
