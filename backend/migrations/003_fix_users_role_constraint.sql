-- Migration: Fix users role constraint to include teacher role
-- Created: 2025-10-13
-- Description: Update the users_role_check constraint to allow 'teacher' role

-- Drop the old constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add the updated constraint that includes 'teacher' role
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('superadmin', 'school_admin', 'teacher'));

-- Verify the constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'users_role_check';
