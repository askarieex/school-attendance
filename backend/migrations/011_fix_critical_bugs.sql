-- Migration: Fix Critical Production Bugs
-- Created: 2025-11-01
-- Description: Fixes critical bugs found in production audit

-- =============================================
-- BUG #2 FIX: Add unique constraint on attendance_logs
-- =============================================
-- This prevents duplicate attendance records for the same student on the same date
-- CRITICAL: Required for ON CONFLICT clause in manual attendance UPSERT

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_attendance_per_day
  ON attendance_logs(student_id, date, school_id);

COMMENT ON INDEX idx_unique_attendance_per_day IS 'Ensures one attendance record per student per day per school (fixes race condition)';

-- =============================================
-- PERFORMANCE: Add missing indexes
-- =============================================

-- Index for attendance by school and date (dashboard queries)
CREATE INDEX IF NOT EXISTS idx_attendance_school_date
  ON attendance_logs(school_id, date DESC);

-- Index for device user mapping lookups
CREATE INDEX IF NOT EXISTS idx_device_mappings_lookup
  ON device_user_mappings(device_id, student_id);

-- Index for device PIN uniqueness per device
CREATE INDEX IF NOT EXISTS idx_device_pin_unique
  ON device_user_mappings(device_id, device_pin);

-- Index for student searches by RFID
CREATE INDEX IF NOT EXISTS idx_students_rfid
  ON students(rfid_card_id) WHERE is_active = TRUE;

-- Index for students by school and class
CREATE INDEX IF NOT EXISTS idx_students_school_class
  ON students(school_id, class_id, section_id) WHERE is_active = TRUE;

-- Index for attendance logs by status (for filtering)
CREATE INDEX IF NOT EXISTS idx_attendance_status
  ON attendance_logs(school_id, status, date);

-- Index for device commands by status and priority
CREATE INDEX IF NOT EXISTS idx_device_commands_queue
  ON device_commands(device_id, status, priority DESC, created_at ASC);

-- =============================================
-- BUG #7 FIX: Form teacher uniqueness constraint
-- =============================================
-- Prevent multiple teachers being assigned as form teacher for same section

-- First, check if form_teacher_id column exists in sections table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'sections'
    AND column_name = 'form_teacher_id'
  ) THEN
    -- Add unique constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'unique_form_teacher_per_section'
    ) THEN
      ALTER TABLE sections
        ADD CONSTRAINT unique_form_teacher_per_section
        UNIQUE (id, form_teacher_id);

      RAISE NOTICE 'Added unique constraint for form teachers';
    END IF;
  ELSE
    RAISE NOTICE 'form_teacher_id column does not exist in sections table - skipping constraint';
  END IF;
END $$;

-- =============================================
-- DATA INTEGRITY: Add check constraints
-- =============================================

-- Ensure late_threshold_minutes is reasonable (0-60 minutes)
ALTER TABLE school_settings
  ADD CONSTRAINT check_late_threshold
  CHECK (late_threshold_minutes >= 0 AND late_threshold_minutes <= 60);

-- Ensure school timings are logical
ALTER TABLE school_settings
  ADD CONSTRAINT check_school_hours
  CHECK (school_close_time > school_open_time);

-- Ensure device command priority is reasonable
ALTER TABLE device_commands
  ADD CONSTRAINT check_command_priority
  CHECK (priority >= 0 AND priority <= 100);

-- =============================================
-- Add updated_at column if missing
-- =============================================
ALTER TABLE attendance_logs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_attendance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_attendance_updated_at
  BEFORE UPDATE ON attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_attendance_timestamp();

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Verify unique index exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_unique_attendance_per_day'
  ) THEN
    RAISE NOTICE '✅ Unique index on attendance_logs created successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to create unique index on attendance_logs';
  END IF;
END $$;

COMMENT ON TABLE attendance_logs IS 'Stores student attendance records - one record per student per day per school';
COMMENT ON TABLE device_user_mappings IS 'Maps students to device PINs for biometric/RFID enrollment';
