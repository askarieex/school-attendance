-- Migration: Add Classes, Sections, and Teachers Management
-- Date: October 12, 2025
-- Description: Phase 1 - Classes & Teacher Management System

-- ============================================================================
-- 1. CREATE CLASSES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  class_name VARCHAR(100) NOT NULL, -- 'Grade 9', 'Grade 10', 'Pre-KG'
  academic_year VARCHAR(20) NOT NULL, -- '2025-2026'
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, class_name, academic_year)
);

CREATE INDEX idx_classes_school_id ON classes(school_id);
CREATE INDEX idx_classes_active ON classes(is_active);

-- ============================================================================
-- 2. CREATE SECTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS sections (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  section_name VARCHAR(50) NOT NULL, -- 'A', 'B', 'Red', 'Blue'
  max_capacity INTEGER DEFAULT 40,
  current_strength INTEGER DEFAULT 0,
  form_teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Assigned teacher
  room_number VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(class_id, section_name)
);

CREATE INDEX idx_sections_class_id ON sections(class_id);
CREATE INDEX idx_sections_form_teacher ON sections(form_teacher_id);
CREATE INDEX idx_sections_active ON sections(is_active);

-- ============================================================================
-- 3. CREATE TEACHERS TABLE (Extended Profile)
-- ============================================================================
CREATE TABLE IF NOT EXISTS teachers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  teacher_code VARCHAR(50) UNIQUE, -- 'TCH001', 'TCH002'
  phone VARCHAR(20),
  date_of_birth DATE,
  date_of_joining DATE,
  subject_specialization VARCHAR(255), -- 'Mathematics', 'Science', 'English'
  qualification VARCHAR(255), -- 'M.Ed, B.Sc', 'B.A., B.Ed'
  photo_url TEXT,
  address TEXT,
  emergency_contact VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_teachers_user_id ON teachers(user_id);
CREATE INDEX idx_teachers_school_id ON teachers(school_id);
CREATE INDEX idx_teachers_code ON teachers(teacher_code);
CREATE INDEX idx_teachers_active ON teachers(is_active);

-- ============================================================================
-- 4. CREATE TEACHER CLASS ASSIGNMENTS TABLE (Many-to-Many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS teacher_class_assignments (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE NOT NULL,
  subject VARCHAR(100), -- 'Mathematics', 'English', 'All Subjects' (for form teacher)
  is_form_teacher BOOLEAN DEFAULT FALSE,
  academic_year VARCHAR(20) NOT NULL, -- '2025-2026'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(teacher_id, section_id, subject, academic_year)
);

CREATE INDEX idx_tca_teacher_id ON teacher_class_assignments(teacher_id);
CREATE INDEX idx_tca_section_id ON teacher_class_assignments(section_id);
CREATE INDEX idx_tca_form_teacher ON teacher_class_assignments(is_form_teacher);
CREATE INDEX idx_tca_academic_year ON teacher_class_assignments(academic_year);

-- ============================================================================
-- 5. UPDATE STUDENTS TABLE - Add Class and Section References
-- ============================================================================
ALTER TABLE students
ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS roll_number VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_section_id ON students(section_id);

-- ============================================================================
-- 6. UPDATE SCHOOL_SETTINGS TABLE - Add Attendance Rules
-- ============================================================================
ALTER TABLE school_settings
ADD COLUMN IF NOT EXISTS allow_early_checkin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS allow_late_checkin BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS early_checkin_message TEXT DEFAULT 'Too early! Attendance starts at {time}',
ADD COLUMN IF NOT EXISTS late_checkin_message TEXT DEFAULT 'You are late. Please meet your class teacher.',
ADD COLUMN IF NOT EXISTS too_late_checkin_message TEXT DEFAULT 'Attendance closed. Contact school office.';

-- ============================================================================
-- 7. CREATE FUNCTION TO UPDATE updated_at TIMESTAMP
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- 8. CREATE TRIGGERS FOR updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS update_classes_updated_at ON classes;
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sections_updated_at ON sections;
CREATE TRIGGER update_sections_updated_at BEFORE UPDATE ON sections
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_teachers_updated_at ON teachers;
CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON teachers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_teacher_assignments_updated_at ON teacher_class_assignments;
CREATE TRIGGER update_teacher_assignments_updated_at BEFORE UPDATE ON teacher_class_assignments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 9. CREATE FUNCTION TO AUTO-GENERATE TEACHER CODE
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_teacher_code()
RETURNS TRIGGER AS $$
DECLARE
    school_abbr VARCHAR(10);
    next_num INTEGER;
    new_code VARCHAR(50);
BEGIN
    -- Get school abbreviation (first 3 letters of school code)
    SELECT UPPER(LEFT(school_code, 3)) INTO school_abbr
    FROM schools WHERE id = NEW.school_id;

    -- Get next teacher number for this school
    SELECT COALESCE(MAX(CAST(SUBSTRING(teacher_code FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO next_num
    FROM teachers
    WHERE school_id = NEW.school_id AND teacher_code IS NOT NULL;

    -- Generate code: SCH-TCH-001
    new_code := school_abbr || '-TCH-' || LPAD(next_num::TEXT, 3, '0');

    NEW.teacher_code := new_code;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS generate_teacher_code_trigger ON teachers;
CREATE TRIGGER generate_teacher_code_trigger
BEFORE INSERT ON teachers
FOR EACH ROW
WHEN (NEW.teacher_code IS NULL)
EXECUTE FUNCTION generate_teacher_code();

-- ============================================================================
-- 10. CREATE FUNCTION TO UPDATE SECTION STRENGTH
-- ============================================================================
CREATE OR REPLACE FUNCTION update_section_strength()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.section_id IS NOT NULL THEN
            UPDATE sections
            SET current_strength = (
                SELECT COUNT(*) FROM students
                WHERE section_id = NEW.section_id AND is_active = TRUE
            )
            WHERE id = NEW.section_id;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        IF OLD.section_id IS NOT NULL THEN
            UPDATE sections
            SET current_strength = (
                SELECT COUNT(*) FROM students
                WHERE section_id = OLD.section_id AND is_active = TRUE
            )
            WHERE id = OLD.section_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_section_strength_trigger ON students;
CREATE TRIGGER update_section_strength_trigger
AFTER INSERT OR UPDATE OR DELETE ON students
FOR EACH ROW EXECUTE FUNCTION update_section_strength();

-- ============================================================================
-- 11. INSERT SEED DATA (Optional - for testing)
-- ============================================================================

-- Get the first school's ID
DO $$
DECLARE
    first_school_id INTEGER;
    class_9_id INTEGER;
    class_10_id INTEGER;
    section_9a_id INTEGER;
    section_9b_id INTEGER;
BEGIN
    -- Get first school
    SELECT id INTO first_school_id FROM schools LIMIT 1;

    IF first_school_id IS NOT NULL THEN
        -- Create classes
        INSERT INTO classes (school_id, class_name, academic_year, description)
        VALUES
            (first_school_id, 'Grade 9', '2025-2026', 'Ninth Grade'),
            (first_school_id, 'Grade 10', '2025-2026', 'Tenth Grade')
        ON CONFLICT (school_id, class_name, academic_year) DO NOTHING
        RETURNING id INTO class_9_id;

        -- Get class IDs if they already exist
        IF class_9_id IS NULL THEN
            SELECT id INTO class_9_id FROM classes
            WHERE school_id = first_school_id AND class_name = 'Grade 9'
            AND academic_year = '2025-2026';
        END IF;

        SELECT id INTO class_10_id FROM classes
        WHERE school_id = first_school_id AND class_name = 'Grade 10'
        AND academic_year = '2025-2026';

        -- Create sections for Grade 9
        IF class_9_id IS NOT NULL THEN
            INSERT INTO sections (class_id, section_name, max_capacity)
            VALUES
                (class_9_id, 'A', 40),
                (class_9_id, 'B', 40),
                (class_9_id, 'C', 35)
            ON CONFLICT (class_id, section_name) DO NOTHING;
        END IF;

        -- Create sections for Grade 10
        IF class_10_id IS NOT NULL THEN
            INSERT INTO sections (class_id, section_name, max_capacity)
            VALUES
                (class_10_id, 'A', 40),
                (class_10_id, 'B', 40)
            ON CONFLICT (class_id, section_name) DO NOTHING;
        END IF;

        RAISE NOTICE 'Seed data inserted successfully for school %', first_school_id;
    END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This migration adds:
-- ✅ classes table (grades/standards)
-- ✅ sections table (divisions within classes)
-- ✅ teachers table (extended teacher profiles)
-- ✅ teacher_class_assignments table (teacher-section mapping)
-- ✅ Updated students table (with class/section references)
-- ✅ Updated school_settings (attendance rules)
-- ✅ Auto-increment triggers for updated_at
-- ✅ Auto-generate teacher codes
-- ✅ Auto-update section strength
-- ✅ Seed data for testing
