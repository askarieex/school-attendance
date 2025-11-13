-- ============================================================================
-- Migration 013: Academic Years System
-- Date: January 2025
-- Description: Create academic_years table and add academic year columns to all relevant tables
-- ============================================================================

-- ============================================================================
-- 1. CREATE ACADEMIC_YEARS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS academic_years (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  year_name VARCHAR(20) NOT NULL, -- '2025-2026', '2026-2027'
  start_date DATE NOT NULL, -- April 1, 2025
  end_date DATE NOT NULL, -- March 31, 2026
  is_current BOOLEAN DEFAULT FALSE, -- Only one year can be current per school
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT, -- Optional description
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, year_name), -- Each school can have unique year names
  CONSTRAINT check_dates CHECK (end_date > start_date),
  CONSTRAINT check_year_name CHECK (year_name ~ '^\d{4}-\d{4}$') -- Format: YYYY-YYYY
);

CREATE INDEX idx_academic_years_school_id ON academic_years(school_id);
CREATE INDEX idx_academic_years_current ON academic_years(is_current);
CREATE INDEX idx_academic_years_active ON academic_years(is_active);

COMMENT ON TABLE academic_years IS 'Stores academic year periods for each school';
COMMENT ON COLUMN academic_years.year_name IS 'Academic year name in format YYYY-YYYY (e.g., 2025-2026)';
COMMENT ON COLUMN academic_years.is_current IS 'Only one year should be current=TRUE per school';
COMMENT ON COLUMN academic_years.start_date IS 'Academic year start date (typically April 1)';
COMMENT ON COLUMN academic_years.end_date IS 'Academic year end date (typically March 31 next year)';

-- ============================================================================
-- 2. ADD TRIGGER FOR updated_at
-- ============================================================================
CREATE TRIGGER update_academic_years_updated_at
BEFORE UPDATE ON academic_years
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. ADD ACADEMIC_YEAR COLUMNS TO EXISTING TABLES (IF NOT EXISTS)
-- ============================================================================

-- Note: classes and teacher_class_assignments already have academic_year columns
-- We'll add to other tables that need it

-- Add academic_year to students table (for tracking which year they were enrolled)
ALTER TABLE students
ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_students_academic_year ON students(academic_year);

-- Add academic_year to attendance table (for historical tracking)
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_attendance_academic_year ON attendance(academic_year);

-- Add academic_year to sections table (inherited from parent class)
ALTER TABLE sections
ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_sections_academic_year ON sections(academic_year);

-- ============================================================================
-- 4. CREATE FUNCTION TO ENSURE ONLY ONE CURRENT YEAR PER SCHOOL
-- ============================================================================
CREATE OR REPLACE FUNCTION ensure_one_current_year()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this year as current, unset all other years for this school
  IF NEW.is_current = TRUE THEN
    UPDATE academic_years
    SET is_current = FALSE
    WHERE school_id = NEW.school_id
      AND id != NEW.id
      AND is_current = TRUE;

    RAISE NOTICE 'Set academic year % as current for school %', NEW.year_name, NEW.school_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS ensure_one_current_year_trigger ON academic_years;
CREATE TRIGGER ensure_one_current_year_trigger
BEFORE INSERT OR UPDATE ON academic_years
FOR EACH ROW
WHEN (NEW.is_current = TRUE)
EXECUTE FUNCTION ensure_one_current_year();

-- ============================================================================
-- 5. CREATE FUNCTION TO GET CURRENT ACADEMIC YEAR
-- ============================================================================
CREATE OR REPLACE FUNCTION get_current_academic_year(p_school_id INTEGER)
RETURNS VARCHAR(20) AS $$
DECLARE
  current_year VARCHAR(20);
BEGIN
  SELECT year_name INTO current_year
  FROM academic_years
  WHERE school_id = p_school_id
    AND is_current = TRUE
    AND is_active = TRUE
  LIMIT 1;

  -- If no current year found, return NULL
  IF current_year IS NULL THEN
    RAISE NOTICE 'No current academic year found for school %', p_school_id;
  END IF;

  RETURN current_year;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_current_academic_year IS 'Returns the current academic year for a given school';

-- ============================================================================
-- 6. CREATE FUNCTION TO AUTO-SET SECTIONS ACADEMIC YEAR FROM CLASS
-- ============================================================================
CREATE OR REPLACE FUNCTION set_section_academic_year()
RETURNS TRIGGER AS $$
DECLARE
  class_year VARCHAR(20);
BEGIN
  -- Get academic year from parent class
  SELECT academic_year INTO class_year
  FROM classes
  WHERE id = NEW.class_id;

  -- Set section's academic year to match the class
  NEW.academic_year := class_year;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS set_section_academic_year_trigger ON sections;
CREATE TRIGGER set_section_academic_year_trigger
BEFORE INSERT OR UPDATE ON sections
FOR EACH ROW
EXECUTE FUNCTION set_section_academic_year();

-- ============================================================================
-- 7. CREATE FUNCTION TO AUTO-SET STUDENTS ACADEMIC YEAR FROM SECTION
-- ============================================================================
CREATE OR REPLACE FUNCTION set_student_academic_year()
RETURNS TRIGGER AS $$
DECLARE
  section_year VARCHAR(20);
BEGIN
  -- Only set if section_id is not null
  IF NEW.section_id IS NOT NULL THEN
    -- Get academic year from section
    SELECT academic_year INTO section_year
    FROM sections
    WHERE id = NEW.section_id;

    -- Set student's academic year to match the section
    NEW.academic_year := section_year;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS set_student_academic_year_trigger ON students;
CREATE TRIGGER set_student_academic_year_trigger
BEFORE INSERT OR UPDATE ON students
FOR EACH ROW
EXECUTE FUNCTION set_student_academic_year();

-- ============================================================================
-- 8. CREATE FUNCTION TO AUTO-SET ATTENDANCE ACADEMIC YEAR FROM SECTION
-- ============================================================================
CREATE OR REPLACE FUNCTION set_attendance_academic_year()
RETURNS TRIGGER AS $$
DECLARE
  section_year VARCHAR(20);
BEGIN
  -- Get academic year from section
  SELECT academic_year INTO section_year
  FROM sections
  WHERE id = NEW.section_id;

  -- Set attendance's academic year to match the section
  NEW.academic_year := section_year;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS set_attendance_academic_year_trigger ON attendance;
CREATE TRIGGER set_attendance_academic_year_trigger
BEFORE INSERT OR UPDATE ON attendance
FOR EACH ROW
EXECUTE FUNCTION set_attendance_academic_year();

-- ============================================================================
-- 9. INSERT DEFAULT ACADEMIC YEAR DATA FOR EXISTING SCHOOLS
-- ============================================================================
DO $$
DECLARE
  school_record RECORD;
  current_year VARCHAR(20);
BEGIN
  -- Generate current year based on current date
  -- If month >= April (4), use current year - next year
  -- If month < April, use last year - current year
  IF EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN
    current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::TEXT;
  ELSE
    current_year := (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::TEXT || '-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  END IF;

  RAISE NOTICE 'Current academic year calculated as: %', current_year;

  -- For each school, create academic years
  FOR school_record IN SELECT id, school_name FROM schools LOOP
    -- Create current academic year (e.g., 2025-2026)
    INSERT INTO academic_years (school_id, year_name, start_date, end_date, is_current, description)
    VALUES (
      school_record.id,
      current_year,
      DATE(EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-04-01'),
      DATE((EXTRACT(YEAR FROM CURRENT_DATE) + 1)::TEXT || '-03-31'),
      TRUE,
      'Current academic year'
    )
    ON CONFLICT (school_id, year_name) DO UPDATE
    SET is_current = TRUE;

    -- Create next academic year (e.g., 2026-2027) as "upcoming"
    INSERT INTO academic_years (school_id, year_name, start_date, end_date, is_current, description)
    VALUES (
      school_record.id,
      (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::TEXT || '-' || (EXTRACT(YEAR FROM CURRENT_DATE) + 2)::TEXT,
      DATE((EXTRACT(YEAR FROM CURRENT_DATE) + 1)::TEXT || '-04-01'),
      DATE((EXTRACT(YEAR FROM CURRENT_DATE) + 2)::TEXT || '-03-31'),
      FALSE,
      'Upcoming academic year'
    )
    ON CONFLICT (school_id, year_name) DO NOTHING;

    RAISE NOTICE 'Created academic years for school: %', school_record.school_name;
  END LOOP;

  -- Update existing classes with current academic year if NULL
  UPDATE classes
  SET academic_year = current_year
  WHERE academic_year IS NULL OR academic_year = '';

  -- Update existing teacher_class_assignments with current academic year if NULL
  UPDATE teacher_class_assignments
  SET academic_year = current_year
  WHERE academic_year IS NULL OR academic_year = '';

  RAISE NOTICE 'Migration completed successfully';
END $$;

-- ============================================================================
-- 10. CREATE VIEW FOR EASY ACCESS TO CURRENT YEAR DATA
-- ============================================================================
CREATE OR REPLACE VIEW current_academic_years AS
SELECT
  ay.id,
  ay.school_id,
  s.school_name,
  ay.year_name,
  ay.start_date,
  ay.end_date,
  ay.description,
  CASE
    WHEN CURRENT_DATE BETWEEN ay.start_date AND ay.end_date THEN 'Active'
    WHEN CURRENT_DATE < ay.start_date THEN 'Upcoming'
    ELSE 'Past'
  END as status
FROM academic_years ay
JOIN schools s ON ay.school_id = s.id
WHERE ay.is_current = TRUE AND ay.is_active = TRUE;

COMMENT ON VIEW current_academic_years IS 'View showing current academic year for all schools';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This migration adds:
-- ✅ academic_years table (master table for managing academic years)
-- ✅ academic_year columns to students, attendance, sections tables
-- ✅ Triggers to ensure only one current year per school
-- ✅ Function to get current academic year (get_current_academic_year)
-- ✅ Auto-set academic year triggers for sections, students, attendance
-- ✅ Default academic year data for existing schools
-- ✅ View for easy access to current year data
-- ✅ Proper indexes for performance
-- ============================================================================
