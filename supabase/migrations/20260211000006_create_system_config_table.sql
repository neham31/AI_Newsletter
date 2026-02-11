-- Migration: Create system_config table
-- Description: Stores application settings like subscriber cap

-- Create system_config table
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add trigger to auto-update updated_at column
-- Note: Reusing the update_updated_at_column() function created in sources migration
CREATE OR REPLACE TRIGGER update_system_config_updated_at
    BEFORE UPDATE ON system_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE system_config IS 'Stores application configuration settings as key-value pairs';
COMMENT ON COLUMN system_config.key IS 'Configuration key (e.g., max_subscribers, subscriptions_paused)';
COMMENT ON COLUMN system_config.value IS 'JSON value containing the configuration data';
