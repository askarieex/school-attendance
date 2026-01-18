-- Migration: Add school profile and additional columns to school_settings
-- Date: 2026-01-18
-- Description: Adds missing columns for school profile, working days, and SMS notification settings

-- School Profile Information
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS school_name VARCHAR(255);
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Working Days Configuration
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS working_days VARCHAR(50) DEFAULT 'Mon-Sat';
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS weekly_holiday VARCHAR(20) DEFAULT 'Sunday';

-- SMS Notification Settings
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS send_on_absent BOOLEAN DEFAULT TRUE;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS send_on_late BOOLEAN DEFAULT TRUE;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS send_daily_summary BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN school_settings.school_name IS 'Official school name';
COMMENT ON COLUMN school_settings.logo_url IS 'URL or path to school logo image';
COMMENT ON COLUMN school_settings.working_days IS 'Working days pattern (Mon-Fri, Mon-Sat, Sun-Thu)';
COMMENT ON COLUMN school_settings.weekly_holiday IS 'Weekly holiday day (Sunday, Saturday, Friday)';
COMMENT ON COLUMN school_settings.send_on_absent IS 'Send SMS to parents when student is absent';
COMMENT ON COLUMN school_settings.send_on_late IS 'Send SMS to parents when student is late';
COMMENT ON COLUMN school_settings.send_daily_summary IS 'Send daily attendance summary to parents';
