-- Migration: Create user_article_log table
-- Purpose: Track which articles have been sent to each user for deduplication

-- Create user_article_log table
CREATE TABLE IF NOT EXISTS user_article_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES articles(id),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    digest_batch_id UUID,

    -- Unique constraint: each article can only be sent to a user once
    CONSTRAINT user_article_log_user_article_unique UNIQUE (user_id, article_id)
);

-- Indexes for common query patterns
-- idx_ual_user_article: For checking if a specific article was sent to a user
CREATE INDEX IF NOT EXISTS idx_ual_user_article ON user_article_log(user_id, article_id);

-- idx_ual_user_sent: For querying a user's sent articles by time
CREATE INDEX IF NOT EXISTS idx_ual_user_sent ON user_article_log(user_id, sent_at DESC);
