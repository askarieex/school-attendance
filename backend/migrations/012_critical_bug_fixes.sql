-- Migration: Critical Bug Fixes
-- Date: November 5, 2025
-- Purpose: Fix critical bugs found during deep code audit

-- ==============================================================================
-- BUG FIX #1: Add Unique Constraint on attendance_logs (Prevent Duplicates)
-- ==============================================================================

-- Step 1: Remove any existing duplicate records before adding constraint
-- (Keep the earliest entry for each student per day)
DO $$
DECLARE
    duplicate_count INT;
BEGIN
    -- Find and delete duplicate attendance logs (keep oldest one)
    WITH duplicates AS (
        SELECT id, 
               ROW_NUMBER() OVER (
                   PARTITION BY student_id, date, school_id 
                   ORDER BY created_at ASC
               ) as row_num
        FROM attendance_logs
    )
    DELETE FROM attendance_logs
    WHERE id IN (
        SELECT id FROM duplicates WHERE row_num > 1
    );
    
    GET DIAGNOSTICS duplicate_count = ROW_COUNT;
    RAISE NOTICE '✅ Removed % duplicate attendance records', duplicate_count;
END $$;

-- Step 2: Add unique constraint
ALTER TABLE attendance_logs 
DROP CONSTRAINT IF EXISTS unique_attendance_per_student_per_day;

ALTER TABLE attendance_logs 
ADD CONSTRAINT unique_attendance_per_student_per_day 
UNIQUE (student_id, date, school_id);

COMMENT ON CONSTRAINT unique_attendance_per_student_per_day ON attendance_logs 
IS 'Prevents duplicate attendance entries for same student on same day';

-- ==============================================================================
-- BUG FIX #2: Add Performance Indexes
-- ==============================================================================

-- Index for date-based queries (most common filter)
CREATE INDEX IF NOT EXISTS idx_attendance_date 
ON attendance_logs(date);

-- Composite index for school + date queries (dashboard queries)
CREATE INDEX IF NOT EXISTS idx_attendance_school_date 
ON attendance_logs(school_id, date);

-- Index for status filtering (present/late/absent reports)
CREATE INDEX IF NOT EXISTS idx_attendance_status 
ON attendance_logs(status);

-- Index for student-specific queries
CREATE INDEX IF NOT EXISTS idx_attendance_student 
ON attendance_logs(student_id, date DESC);

-- Index for device tracking
CREATE INDEX IF NOT EXISTS idx_attendance_device 
ON attendance_logs(device_id, date DESC);

-- Index for manual vs RFID filtering
CREATE INDEX IF NOT EXISTS idx_attendance_manual 
ON attendance_logs(is_manual, date DESC);

-- ==============================================================================
-- BUG FIX #3: Add retry_count column to device_commands (Fix infinite loop)
-- ==============================================================================

-- Add retry_count column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'device_commands' AND column_name = 'retry_count'
    ) THEN
        ALTER TABLE device_commands ADD COLUMN retry_count INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Added retry_count column to device_commands';
    END IF;
END $$;

-- Add index for fetching timed-out commands
CREATE INDEX IF NOT EXISTS idx_device_commands_timeout 
ON device_commands(device_id, status, sent_at) 
WHERE status = 'sent';

-- ==============================================================================
-- BUG FIX #4: Add WhatsApp logs table indexes
-- ==============================================================================

-- Index for deduplication check (most critical query)
CREATE INDEX IF NOT EXISTS idx_whatsapp_dedup 
ON whatsapp_logs(phone, student_id, status, sent_at);

-- Index for student-wise WhatsApp history
CREATE INDEX IF NOT EXISTS idx_whatsapp_student 
ON whatsapp_logs(student_id, sent_at DESC);

-- Index for school-wise WhatsApp analytics
CREATE INDEX IF NOT EXISTS idx_whatsapp_school 
ON whatsapp_logs(school_id, sent_at DESC);

-- ==============================================================================
-- BUG FIX #5: Add constraint to prevent negative roll numbers
-- ==============================================================================

-- Add check constraint for roll_number (must be positive or string)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'students_roll_number_check'
    ) THEN
        ALTER TABLE students 
        ADD CONSTRAINT students_roll_number_check 
        CHECK (
            roll_number !~ '^-' -- Cannot start with minus sign
        );
        RAISE NOTICE '✅ Added roll_number validation constraint';
    END IF;
END $$;

-- ==============================================================================
-- BUG FIX #6: Add updated_at triggers for all tables (missing in some)
-- ==============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to attendance_logs
DROP TRIGGER IF EXISTS trigger_attendance_logs_updated_at ON attendance_logs;
CREATE TRIGGER trigger_attendance_logs_updated_at
    BEFORE UPDATE ON attendance_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to students
DROP TRIGGER IF EXISTS trigger_students_updated_at ON students;
CREATE TRIGGER trigger_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to devices
DROP TRIGGER IF EXISTS trigger_devices_updated_at ON devices;
CREATE TRIGGER trigger_devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to device_commands
DROP TRIGGER IF EXISTS trigger_device_commands_updated_at ON device_commands;
CREATE TRIGGER trigger_device_commands_updated_at
    BEFORE UPDATE ON device_commands
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- BUG FIX #7: Add cascade deletes for student-related data
-- ==============================================================================

-- When a student is deleted, clean up related records
-- (This prevents orphaned attendance logs)

-- attendance_logs.student_id foreign key (if not already set)
DO $$
BEGIN
    -- Check if foreign key exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_attendance_student'
          AND table_name = 'attendance_logs'
    ) THEN
        ALTER TABLE attendance_logs
        ADD CONSTRAINT fk_attendance_student
        FOREIGN KEY (student_id) 
        REFERENCES students(id) 
        ON DELETE CASCADE;
        RAISE NOTICE '✅ Added CASCADE delete for attendance_logs.student_id';
    END IF;
END $$;

-- device_user_mappings.student_id foreign key
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_device_mapping_student'
          AND table_name = 'device_user_mappings'
    ) THEN
        ALTER TABLE device_user_mappings
        ADD CONSTRAINT fk_device_mapping_student
        FOREIGN KEY (student_id) 
        REFERENCES students(id) 
        ON DELETE CASCADE;
        RAISE NOTICE '✅ Added CASCADE delete for device_user_mappings.student_id';
    END IF;
END $$;

-- ==============================================================================
-- BUG FIX #8: Add validation constraints
-- ==============================================================================

-- Validate phone numbers (must be 10-20 characters)
ALTER TABLE students 
DROP CONSTRAINT IF EXISTS students_phone_length_check;

ALTER TABLE students 
ADD CONSTRAINT students_phone_length_check 
CHECK (
    (guardian_phone IS NULL OR LENGTH(guardian_phone) BETWEEN 10 AND 20) AND
    (mother_phone IS NULL OR LENGTH(mother_phone) BETWEEN 10 AND 20) AND
    (parent_phone IS NULL OR LENGTH(parent_phone) BETWEEN 10 AND 20)
);

-- Validate email format (basic check)
ALTER TABLE students 
DROP CONSTRAINT IF EXISTS students_email_format_check;

ALTER TABLE students 
ADD CONSTRAINT students_email_format_check 
CHECK (
    guardian_email IS NULL OR guardian_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
);

-- ==============================================================================
-- BUG FIX #9: Add default values to prevent NULL errors
-- ==============================================================================

-- Set default values for boolean columns
ALTER TABLE students 
ALTER COLUMN is_active SET DEFAULT TRUE;

ALTER TABLE devices 
ALTER COLUMN is_active SET DEFAULT TRUE;

ALTER TABLE teachers 
ALTER COLUMN is_active SET DEFAULT TRUE;

-- Set default value for created_at if missing
ALTER TABLE attendance_logs 
ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

-- ==============================================================================
-- BUG FIX #10: Create view for daily attendance summary (Performance)
-- ==============================================================================

CREATE OR REPLACE VIEW daily_attendance_summary AS
SELECT 
    date,
    school_id,
    COUNT(*) as total_records,
    COUNT(CASE WHEN status = 'present' THEN 1 END) as present_count,
    COUNT(CASE WHEN status = 'late' THEN 1 END) as late_count,
    COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_count,
    COUNT(CASE WHEN status = 'leave' THEN 1 END) as leave_count,
    COUNT(CASE WHEN is_manual = TRUE THEN 1 END) as manual_entries,
    MIN(check_in_time) as earliest_arrival,
    MAX(check_in_time) as latest_arrival,
    ROUND(
        (COUNT(CASE WHEN status IN ('present', 'late') THEN 1 END)::DECIMAL / 
         NULLIF(COUNT(*), 0)) * 100, 
        2
    ) as attendance_percentage
FROM attendance_logs
GROUP BY date, school_id;

COMMENT ON VIEW daily_attendance_summary 
IS 'Pre-aggregated daily attendance statistics for faster dashboard queries';

-- Create index on the view (materialized view for performance)
-- Note: Regular views cannot have indexes, so convert to materialized view for production
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_attendance_summary_mv AS
SELECT * FROM daily_attendance_summary;

CREATE INDEX IF NOT EXISTS idx_daily_summary_date 
ON daily_attendance_summary_mv(date, school_id);

-- Refresh materialized view (should be done via cron job every 10 minutes)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY daily_attendance_summary_mv;

-- ==============================================================================
-- BUG FIX #11: Add function to cleanup old data (Data Retention)
-- ==============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_data(retention_days INTEGER DEFAULT 365)
RETURNS TABLE(
    table_name TEXT,
    rows_deleted BIGINT
) AS $$
DECLARE
    cutoff_date DATE;
BEGIN
    cutoff_date := CURRENT_DATE - retention_days;
    
    -- Cleanup old attendance logs (older than retention period)
    DELETE FROM attendance_logs WHERE date < cutoff_date;
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    table_name := 'attendance_logs';
    RETURN NEXT;
    
    -- Cleanup old device commands (completed/failed)
    DELETE FROM device_commands 
    WHERE status IN ('completed', 'failed') 
      AND created_at < cutoff_date;
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    table_name := 'device_commands';
    RETURN NEXT;
    
    -- Cleanup old WhatsApp logs
    DELETE FROM whatsapp_logs WHERE sent_at < cutoff_date;
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    table_name := 'whatsapp_logs';
    RETURN NEXT;
    
    -- Vacuum tables to reclaim space
    VACUUM ANALYZE attendance_logs;
    VACUUM ANALYZE device_commands;
    VACUUM ANALYZE whatsapp_logs;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_data 
IS 'Deletes data older than specified days (default 365) and vacuums tables';

-- Example usage:
-- SELECT * FROM cleanup_old_data(365); -- Delete data older than 1 year

-- ==============================================================================
-- VERIFICATION QUERIES
-- ==============================================================================

-- Verify unique constraint
DO $$
DECLARE
    constraint_count INT;
BEGIN
    SELECT COUNT(*) INTO constraint_count
    FROM pg_constraint
    WHERE conname = 'unique_attendance_per_student_per_day';
    
    IF constraint_count > 0 THEN
        RAISE NOTICE '✅ VERIFIED: Unique constraint exists';
    ELSE
        RAISE EXCEPTION '❌ FAILED: Unique constraint missing';
    END IF;
END $$;

-- Verify indexes
DO $$
DECLARE
    index_count INT;
BEGIN
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE tablename = 'attendance_logs'
      AND indexname LIKE 'idx_attendance%';
    
    RAISE NOTICE '✅ Found % indexes on attendance_logs', index_count;
END $$;

-- Show all constraints
SELECT 
    tc.constraint_name,
    tc.table_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('students', 'attendance_logs', 'device_commands')
ORDER BY tc.table_name, tc.constraint_type;

-- ==============================================================================
-- PERFORMANCE TESTING QUERY
-- ==============================================================================

-- Test query performance before and after indexes
EXPLAIN ANALYZE
SELECT 
    s.full_name,
    s.roll_number,
    al.status,
    al.check_in_time
FROM attendance_logs al
JOIN students s ON al.student_id = s.id
WHERE al.school_id = 1
  AND al.date = CURRENT_DATE
  AND al.status = 'late'
ORDER BY al.check_in_time DESC;

-- Expected: Execution time < 50ms with indexes

-- ==============================================================================
-- MIGRATION COMPLETE
-- ==============================================================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE '================================';
    RAISE NOTICE '✅ Migration 012 COMPLETED';
    RAISE NOTICE '================================';
    RAISE NOTICE 'Critical bug fixes applied:';
    RAISE NOTICE '1. Unique constraint on attendance_logs';
    RAISE NOTICE '2. Performance indexes added';
    RAISE NOTICE '3. Device command retry logic';
    RAISE NOTICE '4. WhatsApp deduplication indexes';
    RAISE NOTICE '5. Data validation constraints';
    RAISE NOTICE '6. Cascade deletes';
    RAISE NOTICE '7. Materialized view for performance';
    RAISE NOTICE '8. Data cleanup function';
    RAISE NOTICE '================================';
END $$;
