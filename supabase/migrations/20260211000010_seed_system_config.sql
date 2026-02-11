-- Migration: Seed system_config table with initial settings
-- Description: Seeds max_subscribers and subscriptions_paused configuration

-- Insert system configuration settings (use ON CONFLICT to make idempotent)
INSERT INTO system_config (key, value)
VALUES
  (
    'max_subscribers',
    '{"limit": 3000, "enabled": true}'::jsonb
  ),
  (
    'subscriptions_paused',
    '{"paused": false, "message": "We''ve hit capacity! Join the waitlist."}'::jsonb
  )
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();
