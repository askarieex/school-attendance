-- =====================================================
-- CLEAN DATABASE - REMOVE ALL DATA EXCEPT SUPERADMIN
-- This will be applied immediately (no rollback)
-- =====================================================

-- 1. DELETE ALL ATTENDANCE AND LOGS
DELETE FROM whatsapp_logs;
DELETE FROM attendance_logs;
DELETE FROM device_user_mappings;
DELETE FROM device_commands;

-- 2. DELETE ALL STUDENTS
DELETE FROM students;

-- 3. DELETE ALL TEACHERS
DELETE FROM teacher_class_assignments;
DELETE FROM teachers;

-- 4. DELETE ALL CLASSES AND SECTIONS
DELETE FROM sections;
DELETE FROM classes;

-- 5. DELETE ALL LEAVES AND HOLIDAYS
DELETE FROM leaves;
DELETE FROM holidays;

-- 6. DELETE ALL DEVICES
DELETE FROM devices;

-- 7. DELETE ALL SCHOOLS
DELETE FROM school_settings;
DELETE FROM schools;

-- 8. DELETE ALL ACADEMIC YEARS
DELETE FROM academic_years;

-- 9. DELETE ALL USERS EXCEPT SUPERADMIN (hadi@gmail.com)
DELETE FROM users
WHERE role != 'superadmin' OR email != 'hadi@gmail.com';

-- 10. DELETE AUDIT LOGS (if exists)
DELETE FROM audit_logs WHERE 1=1;

-- 11. RESET AUTO-INCREMENT SEQUENCES
ALTER SEQUENCE schools_id_seq RESTART WITH 1;
ALTER SEQUENCE devices_id_seq RESTART WITH 1;
ALTER SEQUENCE students_id_seq RESTART WITH 1;
ALTER SEQUENCE teachers_id_seq RESTART WITH 1;
ALTER SEQUENCE classes_id_seq RESTART WITH 1;
ALTER SEQUENCE sections_id_seq RESTART WITH 1;
ALTER SEQUENCE attendance_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE leaves_id_seq RESTART WITH 1;
ALTER SEQUENCE holidays_id_seq RESTART WITH 1;
ALTER SEQUENCE academic_years_id_seq RESTART WITH 1;

-- 12. VERIFY CLEANUP
SELECT 'DATABASE CLEANED!' as status;
SELECT '==================' as separator;
SELECT 'Remaining Data:' as info;
SELECT '==================' as separator;

SELECT 'SCHOOLS' as table_name, COUNT(*) as count FROM schools
UNION ALL
SELECT 'USERS (1 = superadmin)', COUNT(*) FROM users
UNION ALL
SELECT 'DEVICES', COUNT(*) FROM devices
UNION ALL
SELECT 'STUDENTS', COUNT(*) FROM students
UNION ALL
SELECT 'TEACHERS', COUNT(*) FROM teachers
UNION ALL
SELECT 'CLASSES', COUNT(*) FROM classes
UNION ALL
SELECT 'ATTENDANCE_LOGS', COUNT(*) FROM attendance_logs
ORDER BY table_name;

SELECT '==================' as separator;
SELECT 'Remaining Users:' as info;
SELECT '==================' as separator;

SELECT id, email, role, full_name, is_active FROM users;
