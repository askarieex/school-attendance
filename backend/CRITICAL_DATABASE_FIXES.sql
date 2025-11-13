-- ================================================================
-- CRITICAL DATABASE FIXES
-- School Attendance System
-- Date: November 6, 2025
-- ================================================================

-- ================================================================
-- FIX #1: ACADEMIC YEAR MISMATCH
-- ================================================================
-- PROBLEM: System set to 2026-2027 academic year, but today is November 2025
--          which is part of 2025-2026 academic year
-- IMPACT: Teacher assignments not showing, wrong data filtering
-- ================================================================

BEGIN;

-- 1. Check current academic year settings
SELECT id, school_id, current_academic_year, school_start_time, created_at
FROM school_settings
WHERE school_id = 6;

-- Expected output: current_academic_year = '2026-2027' (WRONG!)

-- 2. Fix academic year to correct value
UPDATE school_settings
SET current_academic_year = '2025-2026'
WHERE school_id = 6;

-- 3. Verify the fix
SELECT id, school_id, current_academic_year
FROM school_settings
WHERE school_id = 6;

-- Expected: current_academic_year = '2025-2026' ✅

COMMIT;

-- ================================================================
-- FIX #2: CREATE TEACHER ASSIGNMENTS
-- ================================================================
-- PROBLEM: Teacher askery7865@gmail.com (ID: 23, teacher_id: 8) has 0 assignments
-- IMPACT: Teacher can't see any classes or students in mobile app
-- ================================================================

BEGIN;

-- 1. Check current teacher assignments
SELECT 
    ta.id,
    ta.teacher_id,
    ta.class_id,
    c.name as class_name,
    ta.section_id,
    s.name as section_name,
    ta.subject_id,
    ta.academic_year,
    ta.is_form_teacher
FROM teacher_assignments ta
LEFT JOIN classes c ON ta.class_id = c.id
LEFT JOIN sections s ON ta.section_id = s.id
WHERE ta.teacher_id = 8;

-- Expected: 0 rows (PROBLEM!)

-- 2. Get available classes and sections for this school
SELECT 
    c.id as class_id,
    c.name as class_name,
    s.id as section_id,
    s.name as section_name,
    c.school_id
FROM classes c
LEFT JOIN sections s ON s.class_id = c.id
WHERE c.school_id = 6
ORDER BY c.name, s.name;

-- 3. Create teacher assignments (adjust class_id and section_id based on step 2)
-- IMPORTANT: Replace class_id and section_id with actual values from your database!

INSERT INTO teacher_assignments (
    teacher_id,
    class_id,
    section_id,
    subject_id,
    academic_year,
    is_form_teacher,
    created_at
) VALUES
    -- Example: Assign teacher to Class 1, Section A (as form teacher)
    (8, 1, 1, NULL, '2025-2026', true, NOW()),
    
    -- Example: Assign teacher to Class 2, Section B (as subject teacher)
    (8, 2, 2, 1, '2025-2026', false, NOW())
    
-- Adjust above values based on your school's classes!
ON CONFLICT (teacher_id, class_id, section_id, academic_year) DO NOTHING;

-- 4. Verify assignments created
SELECT 
    ta.id,
    ta.teacher_id,
    u.full_name as teacher_name,
    ta.class_id,
    c.name as class_name,
    ta.section_id,
    s.name as section_name,
    ta.academic_year,
    ta.is_form_teacher
FROM teacher_assignments ta
JOIN users u ON u.teacher_id = ta.teacher_id
JOIN classes c ON ta.class_id = c.id
LEFT JOIN sections s ON ta.section_id = s.id
WHERE ta.teacher_id = 8
ORDER BY ta.is_form_teacher DESC, c.name, s.name;

-- Expected: Should show the assignments created above ✅

COMMIT;

-- ================================================================
-- FIX #3: VERIFY STUDENTS IN ASSIGNED CLASSES
-- ================================================================
-- Make sure assigned classes have students enrolled
-- ================================================================

BEGIN;

-- 1. Check students in assigned classes
SELECT 
    c.id as class_id,
    c.name as class_name,
    s.id as section_id,
    s.name as section_name,
    COUNT(st.id) as student_count
FROM classes c
LEFT JOIN sections s ON s.class_id = c.id
LEFT JOIN students st ON st.class_id = c.id AND (st.section_id = s.id OR s.id IS NULL)
WHERE c.id IN (
    SELECT class_id 
    FROM teacher_assignments 
    WHERE teacher_id = 8
)
AND c.school_id = 6
GROUP BY c.id, c.name, s.id, s.name
ORDER BY c.name, s.name;

-- If student_count = 0, you need to enroll students!

-- 2. (OPTIONAL) If no students, create sample students
-- IMPORTANT: Only run if you need test data!

/*
INSERT INTO students (
    school_id,
    class_id,
    section_id,
    roll_number,
    first_name,
    last_name,
    gender,
    rfid_card_id,
    is_active,
    academic_year,
    created_at
) VALUES
    (6, 1, 1, 1, 'John', 'Doe', 'male', 'RFID001', true, '2025-2026', NOW()),
    (6, 1, 1, 2, 'Jane', 'Smith', 'female', 'RFID002', true, '2025-2026', NOW()),
    (6, 2, 2, 1, 'Mike', 'Johnson', 'male', 'RFID003', true, '2025-2026', NOW())
ON CONFLICT DO NOTHING;
*/

COMMIT;

-- ================================================================
-- FIX #4: VERIFY API RESPONSE DATA
-- ================================================================
-- This query mimics what the API returns to the mobile app
-- ================================================================

SELECT 
    u.id as user_id,
    u.email,
    u.role,
    u.full_name as teacher_name,
    u.teacher_id,
    sch.name as school_name,
    sch.id as school_id,
    ss.current_academic_year,
    json_agg(
        json_build_object(
            'id', ta.id,
            'class_id', ta.class_id,
            'class_name', c.name,
            'section_id', ta.section_id,
            'section_name', s.name,
            'is_form_teacher', ta.is_form_teacher,
            'academic_year', ta.academic_year
        )
    ) FILTER (WHERE ta.id IS NOT NULL) as assignments
FROM users u
JOIN schools sch ON u.school_id = sch.id
LEFT JOIN school_settings ss ON ss.school_id = sch.id
LEFT JOIN teacher_assignments ta ON ta.teacher_id = u.teacher_id AND ta.academic_year = ss.current_academic_year
LEFT JOIN classes c ON ta.class_id = c.id
LEFT JOIN sections s ON ta.section_id = s.id
WHERE u.email = 'askery7865@gmail.com'
GROUP BY u.id, u.email, u.role, u.full_name, u.teacher_id, sch.name, sch.id, ss.current_academic_year;

-- Expected output should include:
-- - teacher_name: "Askery malik"
-- - current_academic_year: "2025-2026"
-- - assignments: [array with at least 1 object]

-- ================================================================
-- DIAGNOSTIC QUERIES
-- ================================================================
-- Run these if issues persist
-- ================================================================

-- Check all academic years in the system
SELECT DISTINCT academic_year, COUNT(*) as count
FROM teacher_assignments
GROUP BY academic_year
ORDER BY academic_year DESC;

-- Check all teachers and their assignment counts
SELECT 
    t.id,
    u.full_name,
    u.email,
    COUNT(ta.id) as assignment_count,
    string_agg(DISTINCT ta.academic_year, ', ') as academic_years
FROM users u
JOIN teachers t ON u.teacher_id = t.id
LEFT JOIN teacher_assignments ta ON ta.teacher_id = t.id
WHERE u.school_id = 6
GROUP BY t.id, u.full_name, u.email
ORDER BY assignment_count DESC;

-- Check school settings for all schools
SELECT 
    s.id as school_id,
    s.name as school_name,
    ss.current_academic_year,
    ss.school_start_time,
    ss.late_threshold_min
FROM schools s
LEFT JOIN school_settings ss ON ss.school_id = s.id
ORDER BY s.id;

-- ================================================================
-- AUTOMATED FIX FOR FUTURE ACADEMIC YEAR TRANSITIONS
-- ================================================================
-- Run this script on April 1st every year to auto-create new academic year
-- ================================================================

-- Create function to auto-transition academic year
CREATE OR REPLACE FUNCTION auto_transition_academic_year()
RETURNS void AS $$
DECLARE
    current_date_var DATE := CURRENT_DATE;
    new_academic_year TEXT;
    rec RECORD;
BEGIN
    -- Check if it's April 1st
    IF EXTRACT(MONTH FROM current_date_var) = 4 AND EXTRACT(DAY FROM current_date_var) = 1 THEN
        
        -- Calculate new academic year (e.g., 2026-2027)
        new_academic_year := EXTRACT(YEAR FROM current_date_var) || '-' || (EXTRACT(YEAR FROM current_date_var) + 1);
        
        -- Update all school settings
        FOR rec IN SELECT id FROM schools WHERE is_active = true
        LOOP
            UPDATE school_settings
            SET current_academic_year = new_academic_year
            WHERE school_id = rec.id;
            
            RAISE NOTICE 'Updated school % to academic year %', rec.id, new_academic_year;
        END LOOP;
        
        RAISE NOTICE 'Academic year transition complete!';
    ELSE
        RAISE NOTICE 'Not April 1st - no transition needed';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Schedule this to run daily at midnight (PostgreSQL cron extension required)
-- Or call manually on April 1st:
-- SELECT auto_transition_academic_year();

-- ================================================================
-- ROLLBACK SCRIPT (if something goes wrong)
-- ================================================================
-- Only use if you need to undo the changes!
-- ================================================================

/*
BEGIN;

-- Revert academic year back to original
UPDATE school_settings
SET current_academic_year = '2026-2027'
WHERE school_id = 6;

-- Delete created teacher assignments
DELETE FROM teacher_assignments
WHERE teacher_id = 8 
AND academic_year = '2025-2026'
AND created_at > NOW() - INTERVAL '1 hour';

COMMIT;
*/

-- ================================================================
-- VERIFICATION CHECKLIST
-- ================================================================
/*
After running these fixes, verify the following:

✅ 1. Academic year is '2025-2026' in school_settings
✅ 2. Teacher has at least 1 assignment in teacher_assignments
✅ 3. Assigned classes have students enrolled
✅ 4. Mobile app shows classes when teacher logs in
✅ 5. Dashboard API returns assignments array (not empty)

If all checks pass, fixes are successful! ✅
*/

-- ================================================================
-- END OF FIX SCRIPT
-- ================================================================
