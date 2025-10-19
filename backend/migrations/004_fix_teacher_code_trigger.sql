-- Migration: Fix teacher code generation trigger
-- Created: 2025-10-13
-- Description: Update the generate_teacher_code function to use correct column name

-- Drop existing function and trigger
DROP FUNCTION IF EXISTS generate_teacher_code() CASCADE;

-- Create the corrected function
CREATE OR REPLACE FUNCTION generate_teacher_code()
RETURNS TRIGGER AS $$
DECLARE
  school_prefix TEXT;
  next_num INTEGER;
BEGIN
  -- Get school abbreviation from name (first 3 letters)
  SELECT UPPER(LEFT(name, 3))
  INTO school_prefix
  FROM schools WHERE id = NEW.school_id;

  -- Get next sequence number for this school
  SELECT COALESCE(MAX(CAST(SUBSTRING(teacher_code FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_num
  FROM teachers
  WHERE school_id = NEW.school_id;

  -- Generate teacher code: SCH-TCH-001
  NEW.teacher_code := school_prefix || '-TCH-' || LPAD(next_num::TEXT, 3, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER set_teacher_code
  BEFORE INSERT ON teachers
  FOR EACH ROW
  EXECUTE FUNCTION generate_teacher_code();
