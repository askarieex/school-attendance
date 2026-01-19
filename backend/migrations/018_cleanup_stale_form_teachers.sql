-- Clean up stale form teacher references
-- This removes form_teacher_id from sections where the teacher/user no longer exists

-- 1. Remove form_teacher_id references to deleted/inactive users
UPDATE sections 
SET form_teacher_id = NULL 
WHERE form_teacher_id IS NOT NULL 
AND form_teacher_id NOT IN (
    SELECT u.id FROM users u 
    JOIN teachers t ON t.user_id = u.id 
    WHERE t.is_active = TRUE AND u.is_active = TRUE
);

-- 2. Remove orphan teacher_class_assignments for deleted teachers
DELETE FROM teacher_class_assignments 
WHERE teacher_id NOT IN (
    SELECT id FROM teachers WHERE is_active = TRUE
);

-- 3. Show current form teacher assignments to verify
SELECT 
    s.id as section_id,
    c.class_name,
    s.section_name,
    s.form_teacher_id,
    u.full_name as form_teacher_name
FROM sections s
JOIN classes c ON s.class_id = c.id
LEFT JOIN users u ON s.form_teacher_id = u.id
WHERE s.form_teacher_id IS NOT NULL
ORDER BY c.class_name, s.section_name;
