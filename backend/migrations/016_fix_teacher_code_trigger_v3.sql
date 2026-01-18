-- Migration: Fix Teacher Code Trigger Condition
-- Date: 2026-01-18
-- Description: Ensures the teacher code generation trigger respects manually provided teacher codes

-- 1. Drop potentially conflicting triggers
DROP TRIGGER IF EXISTS set_teacher_code ON teachers;
DROP TRIGGER IF EXISTS trigger_generate_teacher_code ON teachers;
DROP TRIGGER IF EXISTS generate_teacher_code_trigger ON teachers;

-- 2. Update the function to be safe (only generate if NULL)
CREATE OR REPLACE FUNCTION generate_teacher_code()
RETURNS TRIGGER AS $$
DECLARE
  school_prefix TEXT;
  next_num INTEGER;
BEGIN
  -- SAFETY CHECK: If teacher_code is already provided, DO NOTHING
  IF NEW.teacher_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get school abbreviation from name (first 3 letters)
  SELECT UPPER(LEFT(name, 3))
  INTO school_prefix
  FROM schools WHERE id = NEW.school_id;

  -- Get next sequence number for this school
  -- Extract number from format PREFIX-TIMESTAMP or PREFIX-TCH-NUM
  -- We just fallback to simple count or max number scan
  SELECT COALESCE(MAX(CAST(SUBSTRING(teacher_code FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_num
  FROM teachers
  WHERE school_id = NEW.school_id
  AND teacher_code ~ '^[A-Z]{3}-TCH-[0-9]+$'; -- Only look at auto-generated format

  -- Generate teacher code: SCH-TCH-001
  NEW.teacher_code := school_prefix || '-TCH-' || LPAD(next_num::TEXT, 3, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Re-create the trigger with the WHEN condition (Double Safety)
CREATE TRIGGER set_teacher_code_safe
  BEFORE INSERT ON teachers
  FOR EACH ROW
  WHEN (NEW.teacher_code IS NULL)
  EXECUTE FUNCTION generate_teacher_code();
