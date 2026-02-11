-- Migration: Create user_subscriptions table
-- Purpose: Track which sources each user subscribes to

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES sources(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint: each user can only subscribe to a source once
    CONSTRAINT user_subscriptions_user_source_unique UNIQUE (user_id, source_id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_source_id ON user_subscriptions(source_id);
