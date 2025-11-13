-- =====================================================
-- PRODUCTION READINESS DATABASE FIXES
-- Run these SQL commands before deploying to production
-- =====================================================

-- 1. ADD UNIQUE CONSTRAINTS
-- =====================================================

-- Serial number must be unique (prevents duplicate device registration)
ALTER TABLE devices
ADD CONSTRAINT devices_serial_number_unique UNIQUE (serial_number);

-- RFID card ID should be unique (prevents card duplication)
ALTER TABLE students
ADD CONSTRAINT students_rfid_unique UNIQUE (rfid_card_id);

-- Email should be unique for schools
ALTER TABLE schools
ADD CONSTRAINT schools_email_unique UNIQUE (email);

-- Email should be unique for users
ALTER TABLE users
ADD CONSTRAINT users_email_unique UNIQUE (email);


-- 2. ADD CHECK CONSTRAINTS
-- =====================================================

-- Attendance status validation (only allow valid statuses)
ALTER TABLE attendance_logs
ADD CONSTRAINT check_status CHECK (status IN ('present', 'absent', 'late', 'leave'));

-- User role validation (only allow valid roles)
ALTER TABLE users
ADD CONSTRAINT check_role CHECK (role IN ('superadmin', 'school_admin', 'teacher'));

-- Plan validation (only allow valid subscription plans)
ALTER TABLE schools
ADD CONSTRAINT check_plan CHECK (plan IN ('trial', 'basic', 'professional', 'enterprise'));


-- 3. ADD PERFORMANCE INDEXES
-- =====================================================

-- Index for attendance queries by date
CREATE INDEX IF NOT EXISTS idx_attendance_logs_date ON attendance_logs(date);

-- Index for attendance queries by student
CREATE INDEX IF NOT EXISTS idx_attendance_logs_student_date ON attendance_logs(student_id, date);

-- Index for attendance queries by school
CREATE INDEX IF NOT EXISTS idx_attendance_logs_school_date ON attendance_logs(school_id, date);

-- Index for device serial number lookups
CREATE INDEX IF NOT EXISTS idx_devices_serial_number ON devices(serial_number);

-- Index for student RFID lookups
CREATE INDEX IF NOT EXISTS idx_students_rfid ON students(rfid_card_id);

-- Index for user email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index for school email lookups
CREATE INDEX IF NOT EXISTS idx_schools_email ON schools(email);


-- 4. ADD SECURITY LOGS TABLE (if not exists)
-- =====================================================

CREATE TABLE IF NOT EXISTS security_logs (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  description TEXT,
  device_id INTEGER REFERENCES devices(id),
  student_id INTEGER REFERENCES students(id),
  user_id INTEGER REFERENCES users(id),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for security log queries
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type);


-- 5. VERIFY EXISTING DATA INTEGRITY
-- =====================================================

-- Check for duplicate serial numbers (should return 0 rows)
SELECT serial_number, COUNT(*)
FROM devices
GROUP BY serial_number
HAVING COUNT(*) > 1;

-- Check for duplicate RFID cards (should return 0 rows)
SELECT rfid_card_id, COUNT(*)
FROM students
WHERE rfid_card_id IS NOT NULL
GROUP BY rfid_card_id
HAVING COUNT(*) > 1;

-- Check for duplicate emails in schools (should return 0 rows)
SELECT email, COUNT(*)
FROM schools
GROUP BY email
HAVING COUNT(*) > 1;

-- Check for duplicate emails in users (should return 0 rows)
SELECT email, COUNT(*)
FROM users
GROUP BY email
HAVING COUNT(*) > 1;


-- 6. CLEAN UP ORPHANED RECORDS
-- =====================================================

-- Find students without a school (should return 0)
SELECT COUNT(*) FROM students
WHERE school_id NOT IN (SELECT id FROM schools);

-- Find devices without a school (should return 0)
SELECT COUNT(*) FROM devices
WHERE school_id NOT IN (SELECT id FROM schools);

-- Find attendance logs without a student (should return 0)
SELECT COUNT(*) FROM attendance_logs
WHERE student_id NOT IN (SELECT id FROM students);


-- 7. VERIFY CRITICAL DATA
-- =====================================================

-- Count active schools
SELECT COUNT(*) as active_schools FROM schools WHERE is_active = TRUE;

-- Count active devices
SELECT COUNT(*) as active_devices FROM devices WHERE is_active = TRUE;

-- Count active students
SELECT COUNT(*) as active_students FROM students WHERE is_active = TRUE;

-- Count total attendance records
SELECT COUNT(*) as total_attendance FROM attendance_logs;

-- Count attendance records today
SELECT COUNT(*) as today_attendance FROM attendance_logs WHERE date = CURRENT_DATE;


-- =====================================================
-- NOTES:
-- =====================================================
-- 1. Run this script in a transaction for safety:
--    BEGIN;
--    -- run all commands
--    COMMIT; (or ROLLBACK if errors)
--
-- 2. If any UNIQUE constraint fails, investigate duplicates first
--
-- 3. Backup database before running:
--    pg_dump school_attendance > backup_$(date +%Y%m%d).sql
--
-- 4. Test on staging environment before production
-- =====================================================
