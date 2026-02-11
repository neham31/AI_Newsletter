-- Migration: Create sources table
-- Description: Stores newsletter and blog source metadata

-- Create enum type for source type
CREATE TYPE source_type AS ENUM ('newsletter', 'blog');

-- Create sources table
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  type source_type NOT NULL,
  description TEXT,
  audience TEXT,
  reach TEXT,
  feed_url TEXT,
  intake_email TEXT,
  icon_url TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create index on slug for faster lookups
CREATE INDEX IF NOT EXISTS idx_sources_slug ON sources(slug);

-- Create index on is_active for filtering active sources
CREATE INDEX IF NOT EXISTS idx_sources_is_active ON sources(is_active);

-- Create trigger to update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sources_updated_at
  BEFORE UPDATE ON sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
