-- Migration: Update existing tables with new columns
-- Created: 2025-10-17
-- Description: Add missing columns to existing tables

-- Update school_settings table with additional columns
ALTER TABLE school_settings
  ADD COLUMN IF NOT EXISTS school_close_time TIME DEFAULT '14:00:00',
  ADD COLUMN IF NOT EXISTS first_break_start TIME,
  ADD COLUMN IF NOT EXISTS first_break_end TIME,
  ADD COLUMN IF NOT EXISTS lunch_break_start TIME,
  ADD COLUMN IF NOT EXISTS lunch_break_end TIME,
  ADD COLUMN IF NOT EXISTS sms_provider VARCHAR(50),
  ADD COLUMN IF NOT EXISTS sms_api_key TEXT,
  ADD COLUMN IF NOT EXISTS sms_balance INTEGER DEFAULT 0;

-- Rename existing column for consistency
ALTER TABLE school_settings
  RENAME COLUMN school_start_time TO school_open_time;

-- Update devices table if missing columns
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS firmware_version VARCHAR(50),
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP,
  ADD COLUMN IF NOT EXISTS adms_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS push_url TEXT;

-- Create indexes if they don't exist (use IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_devices_serial') THEN
    CREATE INDEX idx_devices_serial ON devices(serial_number);
  END IF;
END $$;

COMMENT ON COLUMN school_settings.school_open_time IS 'Time when school opens';
COMMENT ON COLUMN school_settings.school_close_time IS 'Time when school closes';
COMMENT ON COLUMN school_settings.sms_balance IS 'Remaining SMS credits';
