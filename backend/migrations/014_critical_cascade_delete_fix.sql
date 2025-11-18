-- ============================================================================
-- Migration 014: Fix Cascade Delete (CRITICAL)
-- Description: Prevent attendance history loss when deleting students
-- ============================================================================

BEGIN;

-- Fix cascade deletes on attendance_logs
ALTER TABLE attendance_logs
DROP CONSTRAINT IF EXISTS attendance_logs_student_id_fkey CASCADE;

ALTER TABLE attendance_logs
DROP CONSTRAINT IF EXISTS fk_attendance_student CASCADE;

-- Re-add with SET NULL (preserve historical records)
ALTER TABLE attendance_logs
ADD CONSTRAINT fk_attendance_student
FOREIGN KEY (student_id) REFERENCES students(id)
ON DELETE SET NULL;

-- Add denormalized student_name for historical preservation
ALTER TABLE attendance_logs
ADD COLUMN IF NOT EXISTS student_name VARCHAR(255);

-- Populate existing records
UPDATE attendance_logs al
SET student_name = s.full_name
FROM students s
WHERE al.student_id = s.id AND al.student_name IS NULL;

-- Create trigger to auto-populate student_name
CREATE OR REPLACE FUNCTION preserve_student_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.student_name IS NULL AND NEW.student_id IS NOT NULL THEN
    SELECT full_name INTO NEW.student_name
    FROM students WHERE id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_attendance_student_name ON attendance_logs;
CREATE TRIGGER set_attendance_student_name
BEFORE INSERT OR UPDATE ON attendance_logs
FOR EACH ROW EXECUTE FUNCTION preserve_student_name();

-- Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_students_school_year
ON students(school_id, academic_year, is_active)
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_attendance_logs_academic_year
ON attendance_logs(academic_year, school_id);

-- Fix device FK constraint too
ALTER TABLE attendance_logs
DROP CONSTRAINT IF EXISTS fk_attendance_device;

ALTER TABLE attendance_logs
ADD CONSTRAINT fk_attendance_device
FOREIGN KEY (device_id) REFERENCES devices(id)
ON DELETE SET NULL;

COMMIT;

-- Vacuum and analyze
VACUUM ANALYZE attendance_logs;
VACUUM ANALYZE students;
