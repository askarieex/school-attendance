-- Migration: Add Notification Trigger Settings to school_settings
-- These columns control which attendance events trigger WhatsApp/SMS notifications

-- Add notification trigger columns (default TRUE for all except send_on_present)
ALTER TABLE school_settings
ADD COLUMN IF NOT EXISTS send_on_present BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS send_on_late BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS send_on_absent BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS send_on_leave BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS send_daily_summary BOOLEAN DEFAULT TRUE;

-- Add school timing columns that may be missing
ALTER TABLE school_settings
ADD COLUMN IF NOT EXISTS school_open_time TIME DEFAULT '08:00:00',
ADD COLUMN IF NOT EXISTS school_close_time TIME DEFAULT '15:00:00',
ADD COLUMN IF NOT EXISTS late_threshold_minutes INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS working_days TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri,Sat',
ADD COLUMN IF NOT EXISTS weekly_holiday TEXT DEFAULT 'Sun';

-- Add auto-absence settings
ALTER TABLE school_settings
ADD COLUMN IF NOT EXISTS absence_check_time TIME DEFAULT '10:00:00',
ADD COLUMN IF NOT EXISTS auto_absence_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS absence_grace_period_hours INTEGER DEFAULT 2;

-- Add break time settings
ALTER TABLE school_settings
ADD COLUMN IF NOT EXISTS first_break_start TIME,
ADD COLUMN IF NOT EXISTS first_break_end TIME,
ADD COLUMN IF NOT EXISTS lunch_break_start TIME,
ADD COLUMN IF NOT EXISTS lunch_break_end TIME;

-- Add check-in behavior settings
ALTER TABLE school_settings
ADD COLUMN IF NOT EXISTS allow_early_checkin BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS allow_late_checkin BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS early_checkin_message TEXT DEFAULT 'Welcome! School starts soon.',
ADD COLUMN IF NOT EXISTS late_checkin_message TEXT DEFAULT 'You are late today.',
ADD COLUMN IF NOT EXISTS too_late_checkin_message TEXT DEFAULT 'Please report to the office.';

-- Add profile fields
ALTER TABLE school_settings
ADD COLUMN IF NOT EXISTS school_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS state VARCHAR(100),
ADD COLUMN IF NOT EXISTS pincode VARCHAR(20),
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS website VARCHAR(255),
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add SMS balance tracking
ALTER TABLE school_settings
ADD COLUMN IF NOT EXISTS sms_balance INTEGER DEFAULT 0;

-- Verification
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'school_settings'
ORDER BY ordinal_position;
