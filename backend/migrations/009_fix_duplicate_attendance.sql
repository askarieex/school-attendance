-- Migration: Fix Duplicate Attendance Records
-- This prevents same student being marked present twice on same day

-- Step 1: Remove any existing duplicates before adding constraint
WITH duplicates AS (
  SELECT
    student_id,
    date,
    school_id,
    MIN(id) as keep_id
  FROM attendance_logs
  GROUP BY student_id, date, school_id
  HAVING COUNT(*) > 1
)
DELETE FROM attendance_logs
WHERE id IN (
  SELECT al.id
  FROM attendance_logs al
  INNER JOIN duplicates d
    ON al.student_id = d.student_id
    AND al.date = d.date
    AND al.school_id = d.school_id
  WHERE al.id != d.keep_id
);

-- Step 2: Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique_student_date_school
ON attendance_logs(student_id, date, school_id)
WHERE is_active = TRUE;

-- Step 3: Add comment for documentation
COMMENT ON INDEX idx_attendance_unique_student_date_school IS
'Prevents duplicate attendance records for same student on same day';

-- Verify constraint was added
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'attendance_logs'
AND indexname = 'idx_attendance_unique_student_date_school';
