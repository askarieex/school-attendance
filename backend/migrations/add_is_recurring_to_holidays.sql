-- Migration: Add is_recurring column to holidays table
-- Purpose: Allow holidays like "Republic Day" to repeat every year without manual re-entry

ALTER TABLE holidays
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;

-- Comment for documentation
COMMENT ON COLUMN holidays.is_recurring IS 'If TRUE, this holiday repeats every year on the same month/day';
