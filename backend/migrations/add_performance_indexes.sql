-- Migration: Add Performance Indexes for Classes & Teachers
-- Date: 2025-10-20
-- Description: Adds critical indexes to improve query performance

-- ============================================
-- TEACHER CLASS ASSIGNMENTS INDEXES
-- ============================================

-- Index for finding assignments by teacher and academic year (most common query)
CREATE INDEX IF NOT EXISTS idx_tca_teacher_year 
ON teacher_class_assignments(teacher_id, academic_year);

-- Index for finding assignments by section
CREATE INDEX IF NOT EXISTS idx_tca_section 
ON teacher_class_assignments(section_id);

-- Index for form teacher lookups
CREATE INDEX IF NOT EXISTS idx_tca_form_teacher 
ON teacher_class_assignments(teacher_id, is_form_teacher) 
WHERE is_form_teacher = TRUE;

-- ============================================
-- SECTIONS INDEXES
-- ============================================

-- Index for finding sections by class (very common)
CREATE INDEX IF NOT EXISTS idx_sections_class_active 
ON sections(class_id, is_active);

-- Index for form teacher lookups
CREATE INDEX IF NOT EXISTS idx_sections_form_teacher 
ON sections(form_teacher_id) 
WHERE form_teacher_id IS NOT NULL;

-- ============================================
-- CLASSES INDEXES
-- ============================================

-- Index for school and academic year filtering
CREATE INDEX IF NOT EXISTS idx_classes_school_year 
ON classes(school_id, academic_year, is_active);

-- Index for class name searches
CREATE INDEX IF NOT EXISTS idx_classes_name 
ON classes(class_name);

-- ============================================
-- TEACHERS INDEXES
-- ============================================

-- Index for school filtering
CREATE INDEX IF NOT EXISTS idx_teachers_school_active 
ON teachers(school_id, is_active);

-- Index for subject specialization filtering
CREATE INDEX IF NOT EXISTS idx_teachers_subject 
ON teachers(subject_specialization) 
WHERE subject_specialization IS NOT NULL;

-- ============================================
-- VERIFY INDEXES
-- ============================================

-- Show all indexes on these tables
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('teacher_class_assignments', 'sections', 'classes', 'teachers')
ORDER BY tablename, indexname;

-- ============================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================

ANALYZE teacher_class_assignments;
ANALYZE sections;
ANALYZE classes;
ANALYZE teachers;

-- Show table statistics
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows
FROM pg_stat_user_tables
WHERE tablename IN ('teacher_class_assignments', 'sections', 'classes', 'teachers');
