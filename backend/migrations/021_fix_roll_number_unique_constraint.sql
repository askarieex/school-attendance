-- Migration: Fix Unique Roll Number Constraint
-- Created: 2026-02-04
-- Description: Replaces the weak performance index with a strict UNIQUE constraint for roll numbers.

-- 1. Drop the old "Performance Only" index
DROP INDEX IF EXISTS idx_students_roll;

-- 2. Create the new "Strict Unique" index
-- This ensures that no two active students in the same School + Class + Section can have the same Roll Number.
-- If you try to insert a duplicate, the database will throw a hard error (Code 23505).

CREATE UNIQUE INDEX idx_students_roll_unique
ON students(school_id, class_id, section_id, roll_number)
WHERE is_active = TRUE;

-- Note: If this migration fails, it means you already have duplicate data in your database.
-- You must find and remove duplicates before applying this safety lock.
