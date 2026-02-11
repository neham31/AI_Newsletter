-- Migration: Create waitlist table
-- Description: Stores emails when subscriber cap is reached

-- Create waitlist table
CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);

-- Create index for ordering by creation time (to show position in queue)
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at);

-- Add comments for documentation
COMMENT ON TABLE waitlist IS 'Stores emails of users waiting to subscribe when subscriber cap is reached';
COMMENT ON COLUMN waitlist.id IS 'Unique identifier for the waitlist entry';
COMMENT ON COLUMN waitlist.email IS 'Email address of the person on the waitlist';
COMMENT ON COLUMN waitlist.created_at IS 'When the email was added to the waitlist';
