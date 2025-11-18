-- Migration: Add teacher_code column to teachers table
-- Date: 2025-10-20
-- Description: Adds unique teacher_code for displaying teacher IDs in the frontend

-- Add column
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS teacher_code VARCHAR(30) UNIQUE;

-- Generate teacher codes for existing teachers
UPDATE teachers 
SET teacher_code = CONCAT('TCH-', school_id, '-', UPPER(TO_HEX(id)))
WHERE teacher_code IS NULL;

-- Make NOT NULL after populating
ALTER TABLE teachers ALTER COLUMN teacher_code SET NOT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_teachers_code ON teachers(teacher_code);

-- Verify
SELECT COUNT(*) as total_teachers, 
       COUNT(DISTINCT teacher_code) as unique_codes,
       COUNT(teacher_code) as non_null_codes
FROM teachers;
