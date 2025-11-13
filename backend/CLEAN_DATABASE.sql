-- =====================================================
-- CLEAN DATABASE - REMOVE ALL DATA EXCEPT SUPERADMIN
-- =====================================================
-- This script will delete all data but keep:
-- 1. Superadmin user (hadi@gmail.com)
-- 2. Database schema/tables intact
-- 3. Platform settings
-- =====================================================

-- Start transaction for safety
BEGIN;

-- =====================================================
-- 1. DELETE ALL ATTENDANCE AND LOGS
-- =====================================================
DELETE FROM whatsapp_logs;
DELETE FROM attendance_logs;
DELETE FROM device_user_mappings;
DELETE FROM device_commands;

-- =====================================================
-- 2. DELETE ALL STUDENTS
-- =====================================================
DELETE FROM students;

-- =====================================================
-- 3. DELETE ALL TEACHERS
-- =====================================================
DELETE FROM teacher_class_assignments;
DELETE FROM teachers;

-- =====================================================
-- 4. DELETE ALL CLASSES AND SECTIONS
-- =====================================================
DELETE FROM sections;
DELETE FROM classes;

-- =====================================================
-- 5. DELETE ALL LEAVES AND HOLIDAYS
-- =====================================================
DELETE FROM leaves;
DELETE FROM holidays;

-- =====================================================
-- 6. DELETE ALL DEVICES
-- =====================================================
DELETE FROM devices;

-- =====================================================
-- 7. DELETE ALL SCHOOLS
-- =====================================================
DELETE FROM school_settings;
DELETE FROM schools;

-- =====================================================
-- 8. DELETE ALL ACADEMIC YEARS
-- =====================================================
DELETE FROM academic_years;

-- =====================================================
-- 9. DELETE ALL USERS EXCEPT SUPERADMIN
-- =====================================================
-- Keep only the superadmin user (hadi@gmail.com)
DELETE FROM users
WHERE role != 'superadmin'
   OR email NOT IN ('hadi@gmail.com');

-- =====================================================
-- 10. DELETE AUDIT LOGS (if exists)
-- =====================================================
DELETE FROM audit_logs WHERE 1=1;

-- =====================================================
-- 11. RESET AUTO-INCREMENT SEQUENCES
-- =====================================================
-- This will reset all ID counters to start from 1
ALTER SEQUENCE schools_id_seq RESTART WITH 1;
ALTER SEQUENCE users_id_seq RESTART WITH (SELECT MAX(id) + 1 FROM users);
ALTER SEQUENCE devices_id_seq RESTART WITH 1;
ALTER SEQUENCE students_id_seq RESTART WITH 1;
ALTER SEQUENCE teachers_id_seq RESTART WITH 1;
ALTER SEQUENCE classes_id_seq RESTART WITH 1;
ALTER SEQUENCE sections_id_seq RESTART WITH 1;
ALTER SEQUENCE attendance_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE leaves_id_seq RESTART WITH 1;
ALTER SEQUENCE holidays_id_seq RESTART WITH 1;
ALTER SEQUENCE academic_years_id_seq RESTART WITH 1;

-- =====================================================
-- 12. VERIFY CLEANUP
-- =====================================================
-- Check what's left in database
SELECT 'SCHOOLS' as table_name, COUNT(*) as count FROM schools
UNION ALL
SELECT 'USERS (should be 1 superadmin)', COUNT(*) FROM users
UNION ALL
SELECT 'DEVICES', COUNT(*) FROM devices
UNION ALL
SELECT 'STUDENTS', COUNT(*) FROM students
UNION ALL
SELECT 'TEACHERS', COUNT(*) FROM teachers
UNION ALL
SELECT 'CLASSES', COUNT(*) FROM classes
UNION ALL
SELECT 'SECTIONS', COUNT(*) FROM sections
UNION ALL
SELECT 'ATTENDANCE_LOGS', COUNT(*) FROM attendance_logs
UNION ALL
SELECT 'LEAVES', COUNT(*) FROM leaves
UNION ALL
SELECT 'HOLIDAYS', COUNT(*) FROM holidays
UNION ALL
SELECT 'ACADEMIC_YEARS', COUNT(*) FROM academic_years;

-- Show remaining users
SELECT id, email, role, full_name, is_active
FROM users;

-- =====================================================
-- COMMIT OR ROLLBACK
-- =====================================================
-- IMPORTANT: Review the output above before committing!
-- If everything looks good, uncomment the COMMIT line
-- If something is wrong, use ROLLBACK instead

-- COMMIT;  -- Uncomment this line to apply changes
ROLLBACK;  -- Remove this line after reviewing

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. This script is wrapped in a transaction (BEGIN/ROLLBACK)
-- 2. By default, it will ROLLBACK (undo) all changes
-- 3. After running and verifying the output, edit this file:
--    - Comment out: ROLLBACK;
--    - Uncomment: COMMIT;
--    - Run again to actually apply changes
--
-- 4. To run this script:
--    psql -U postgres -d school_attendance -f CLEAN_DATABASE.sql
--
-- 5. What will remain:
--    - 1 superadmin user (hadi@gmail.com)
--    - All tables (structure intact)
--    - Platform settings
--    - No schools, students, teachers, attendance data
-- =====================================================
