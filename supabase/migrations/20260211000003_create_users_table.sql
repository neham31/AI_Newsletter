-- Migration: Create users table
-- Description: Stores subscriber information

-- Create enum type for email frequency
CREATE TYPE email_frequency AS ENUM ('daily', 'weekly');

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  email_verified BOOLEAN DEFAULT false NOT NULL,
  verification_token TEXT,
  unsubscribe_token TEXT UNIQUE,
  frequency email_frequency NOT NULL DEFAULT 'daily',
  is_active BOOLEAN DEFAULT true NOT NULL,
  signed_up_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create composite index for active users by frequency (used in digest queries)
CREATE INDEX IF NOT EXISTS idx_users_active_frequency ON users(is_active, frequency) WHERE is_active = true;

-- Create index on unsubscribe_token for one-click unsubscribe lookups
CREATE INDEX IF NOT EXISTS idx_users_unsubscribe_token ON users(unsubscribe_token) WHERE unsubscribe_token IS NOT NULL;
