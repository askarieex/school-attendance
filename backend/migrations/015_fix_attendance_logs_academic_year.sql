-- ============================================================================
-- Migration 015: Fix attendance_logs Academic Year Auto-Set
-- Date: 2025-11-13
-- Description: Migration 013 created trigger for wrong table name ("attendance" instead of "attendance_logs")
--              This migration creates the correct trigger
-- Issue: CRITICAL - All attendance logs have NULL academic_year
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. VERIFY attendance_logs COLUMN EXISTS
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_logs' AND column_name = 'academic_year'
  ) THEN
    RAISE EXCEPTION 'attendance_logs.academic_year column does not exist! Run migration 014 first.';
  END IF;

  RAISE NOTICE '✅ attendance_logs.academic_year column exists';
END $$;

-- ============================================================================
-- 2. CREATE FUNCTION TO AUTO-SET ATTENDANCE_LOGS ACADEMIC YEAR
-- ============================================================================
CREATE OR REPLACE FUNCTION set_attendance_log_academic_year()
RETURNS TRIGGER AS $$
DECLARE
  student_year VARCHAR(20);
BEGIN
  -- Only set if student_id is not null
  IF NEW.student_id IS NOT NULL THEN
    -- Get academic year from student
    SELECT academic_year INTO student_year
    FROM students
    WHERE id = NEW.student_id;

    -- Set attendance log's academic year to match the student
    IF student_year IS NOT NULL THEN
      NEW.academic_year := student_year;
    ELSE
      -- If student has no academic year, try to get current year from school
      SELECT get_current_academic_year(NEW.school_id) INTO student_year;
      NEW.academic_year := student_year;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_attendance_log_academic_year IS
'Auto-sets academic_year in attendance_logs from student record (FIXED: was pointing to wrong table)';

-- ============================================================================
-- 3. DROP OLD INCORRECT TRIGGER (if exists)
-- ============================================================================
DROP TRIGGER IF EXISTS set_attendance_academic_year_trigger ON attendance;
DROP TRIGGER IF EXISTS set_attendance_log_academic_year_trigger ON attendance_logs;

RAISE NOTICE '🗑️ Dropped old triggers (if they existed)';

-- ============================================================================
-- 4. CREATE NEW CORRECT TRIGGER
-- ============================================================================
CREATE TRIGGER set_attendance_log_academic_year_trigger
BEFORE INSERT OR UPDATE ON attendance_logs
FOR EACH ROW EXECUTE FUNCTION set_attendance_log_academic_year();

COMMENT ON TRIGGER set_attendance_log_academic_year_trigger ON attendance_logs IS
'Auto-sets academic_year from student record before insert/update';

RAISE NOTICE '✅ Created trigger on attendance_logs table';

-- ============================================================================
-- 5. BACKFILL EXISTING RECORDS WITH NULL academic_year
-- ============================================================================
DO $$
DECLARE
  updated_count INT;
BEGIN
  -- Update attendance_logs that have NULL academic_year
  UPDATE attendance_logs al
  SET academic_year = s.academic_year
  FROM students s
  WHERE al.student_id = s.id
    AND al.academic_year IS NULL
    AND s.academic_year IS NOT NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count > 0 THEN
    RAISE NOTICE '📊 Backfilled academic_year for % attendance records', updated_count;
  ELSE
    RAISE NOTICE '✅ No backfill needed - all records already have academic_year';
  END IF;
END $$;

-- ============================================================================
-- 6. HANDLE ORPHANED RECORDS (where student doesn't exist)
-- ============================================================================
DO $$
DECLARE
  orphaned_count INT;
BEGIN
  -- For orphaned records, try to set from school's current academic year
  UPDATE attendance_logs al
  SET academic_year = get_current_academic_year(al.school_id)
  WHERE al.academic_year IS NULL
    AND (al.student_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM students WHERE id = al.student_id
    ));

  GET DIAGNOSTICS orphaned_count = ROW_COUNT;

  IF orphaned_count > 0 THEN
    RAISE NOTICE '⚠️ Set academic_year for % orphaned attendance records', orphaned_count;
  END IF;
END $$;

-- ============================================================================
-- 7. VERIFICATION
-- ============================================================================
DO $$
DECLARE
  null_count INT;
  total_count INT;
  trigger_exists BOOLEAN;
BEGIN
  -- Check if trigger was created
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_attendance_log_academic_year_trigger'
  ) INTO trigger_exists;

  IF NOT trigger_exists THEN
    RAISE EXCEPTION '❌ FAILED: Trigger was not created!';
  END IF;

  -- Count records with NULL academic_year
  SELECT COUNT(*) INTO null_count
  FROM attendance_logs
  WHERE academic_year IS NULL;

  SELECT COUNT(*) INTO total_count
  FROM attendance_logs;

  RAISE NOTICE '';
  RAISE NOTICE '================================';
  RAISE NOTICE '✅ Migration 015 COMPLETED';
  RAISE NOTICE '================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Results:';
  RAISE NOTICE '  ✅ Trigger created: set_attendance_log_academic_year_trigger';
  RAISE NOTICE '  ✅ Function created: set_attendance_log_academic_year()';
  RAISE NOTICE '  📊 Total attendance records: %', total_count;
  RAISE NOTICE '  📊 Records with NULL academic_year: %', null_count;

  IF null_count > 0 THEN
    RAISE NOTICE '  ⚠️ WARNING: % records still have NULL academic_year', null_count;
    RAISE NOTICE '  💡 These may be records where student has no academic_year set';
  ELSE
    RAISE NOTICE '  ✅ All records have academic_year set!';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'Test the trigger:';
  RAISE NOTICE '  INSERT INTO attendance_logs (student_id, school_id, date, check_in_time, status)';
  RAISE NOTICE '  SELECT id, school_id, CURRENT_DATE, NOW(), ''present''';
  RAISE NOTICE '  FROM students WHERE is_active = true LIMIT 1;';
  RAISE NOTICE '';
  RAISE NOTICE '================================';
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION RECOMMENDATIONS
-- ============================================================================
-- 1. Run this query to verify trigger is working:
--    SELECT academic_year FROM attendance_logs ORDER BY created_at DESC LIMIT 10;
--
-- 2. If you see NULL values, check:
--    SELECT id, academic_year FROM students WHERE is_active = true LIMIT 10;
--
-- 3. Ensure all students have academic_year set:
--    UPDATE students SET academic_year = get_current_academic_year(school_id)
--    WHERE academic_year IS NULL;
-- ============================================================================
