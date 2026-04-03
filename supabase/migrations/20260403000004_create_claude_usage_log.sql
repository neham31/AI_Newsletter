-- Migration: Create claude_usage_log table
-- Purpose: Track Claude API token usage for cost monitoring

CREATE TABLE IF NOT EXISTS claude_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying by date (most recent first)
CREATE INDEX IF NOT EXISTS idx_claude_usage_log_date ON claude_usage_log(date DESC);

-- Index for querying by model
CREATE INDEX IF NOT EXISTS idx_claude_usage_log_model ON claude_usage_log(model);

COMMENT ON TABLE claude_usage_log IS 'Tracks Claude API token usage per call for cost monitoring';
COMMENT ON COLUMN claude_usage_log.date IS 'Date the API call was made';
COMMENT ON COLUMN claude_usage_log.model IS 'Claude model used (e.g., claude-haiku-4-5)';
COMMENT ON COLUMN claude_usage_log.input_tokens IS 'Number of input tokens consumed';
COMMENT ON COLUMN claude_usage_log.output_tokens IS 'Number of output tokens generated';
