-- Create raw_emails table for storing inbound email data from Mailgun
CREATE TABLE IF NOT EXISTS raw_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  recipient TEXT,
  sender TEXT,
  subject TEXT,
  body_html TEXT,
  body_plain TEXT,
  message_id TEXT UNIQUE,
  received_at TIMESTAMPTZ,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying unprocessed emails
CREATE INDEX IF NOT EXISTS idx_raw_emails_processed ON raw_emails(processed) WHERE processed = FALSE;

-- Index for querying by source
CREATE INDEX IF NOT EXISTS idx_raw_emails_source_id ON raw_emails(source_id);

-- Index for querying by received date
CREATE INDEX IF NOT EXISTS idx_raw_emails_received_at ON raw_emails(received_at DESC);
