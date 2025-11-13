-- Migration: Add Auto-Absence Detection Settings to school_settings table
-- Date: 2025-01-12
-- Purpose: Enable automatic absence marking when students don't scan RFID card

-- Add auto-absence columns to school_settings table
ALTER TABLE school_settings
ADD COLUMN IF NOT EXISTS auto_absence_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS absence_grace_period_hours INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS absence_check_time TIME DEFAULT '11:00:00';

-- Add comments for documentation
COMMENT ON COLUMN school_settings.auto_absence_enabled IS 'Enable/disable automatic absence detection (default: true)';
COMMENT ON COLUMN school_settings.absence_grace_period_hours IS 'Hours after school start before marking absent (default: 2)';
COMMENT ON COLUMN school_settings.absence_check_time IS 'Time when auto-absence check runs (default: 11:00 AM)';

-- Update existing schools to have default settings
UPDATE school_settings
SET
  auto_absence_enabled = COALESCE(auto_absence_enabled, true),
  absence_grace_period_hours = COALESCE(absence_grace_period_hours, 2),
  absence_check_time = COALESCE(absence_check_time, '11:00:00'::TIME)
WHERE auto_absence_enabled IS NULL
   OR absence_grace_period_hours IS NULL
   OR absence_check_time IS NULL;

-- For schools that don't have school_settings yet, create default entries
INSERT INTO school_settings (school_id, auto_absence_enabled, absence_grace_period_hours, absence_check_time)
SELECT
  s.id,
  true,
  2,
  '11:00:00'::TIME
FROM schools s
LEFT JOIN school_settings ss ON s.id = ss.school_id
WHERE ss.school_id IS NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_school_settings_auto_absence
ON school_settings(school_id, auto_absence_enabled)
WHERE auto_absence_enabled = true;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Auto-absence settings migration complete';
  RAISE NOTICE '   - auto_absence_enabled column added (default: true)';
  RAISE NOTICE '   - absence_grace_period_hours column added (default: 2)';
  RAISE NOTICE '   - absence_check_time column added (default: 11:00:00)';
  RAISE NOTICE '   - Index created for performance';
  RAISE NOTICE '   - Default settings applied to all schools';
END $$;
