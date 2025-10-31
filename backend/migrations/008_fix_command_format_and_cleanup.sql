-- =====================================================
-- Migration: Fix Command Format and Cleanup Old Commands
-- Date: 2025-10-23
-- Purpose: Ensure command_string has correct format and clean up old data
-- =====================================================

-- Step 1: Ensure command_string column is TEXT type (can handle long commands)
ALTER TABLE device_commands
  ALTER COLUMN command_string TYPE TEXT;

-- Step 2: Add comment explaining the format
COMMENT ON COLUMN device_commands.command_string IS 
  'Command string in ZKTeco ADMS format. Must start with C:<id>: prefix and use tab separators. Example: C:123:DATA USER PIN=101\tName=Test\tCard=123\tGrp=1\tTZ=0000000000000000\tVerifyMode=0\tPwd=';

-- Step 3: Show commands with wrong format (for logging)
DO $$
DECLARE
  wrong_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO wrong_count
  FROM device_commands
  WHERE status IN ('pending', 'sent')
    AND command_string NOT LIKE 'C:%'
    AND command_string != 'PLACEHOLDER'
    AND command_string IS NOT NULL;
  
  IF wrong_count > 0 THEN
    RAISE NOTICE '⚠️ Found % command(s) with wrong format that will be deleted', wrong_count;
  ELSE
    RAISE NOTICE '✅ No commands with wrong format found';
  END IF;
END $$;

-- Step 4: Delete commands with wrong format
-- These are old commands created before the fix
DELETE FROM device_commands
WHERE status IN ('pending', 'sent')
  AND command_string NOT LIKE 'C:%'
  AND command_string != 'PLACEHOLDER'
  AND command_string IS NOT NULL;

-- Step 5: Update any PLACEHOLDER commands that somehow got stuck
UPDATE device_commands
SET status = 'failed',
    error_message = 'Command string was never updated from PLACEHOLDER'
WHERE command_string = 'PLACEHOLDER'
  AND status IN ('pending', 'sent')
  AND created_at < NOW() - INTERVAL '1 hour';

-- Step 6: Create index for faster command format validation
CREATE INDEX IF NOT EXISTS idx_device_commands_format_check
  ON device_commands(status)
  WHERE command_string NOT LIKE 'C:%' 
    AND command_string IS NOT NULL 
    AND command_string != 'PLACEHOLDER';

-- Step 7: Add check constraint (optional - only if you want to enforce at DB level)
-- UNCOMMENT if you want strict validation at database level:
-- ALTER TABLE device_commands DROP CONSTRAINT IF EXISTS device_commands_format_check;
-- ALTER TABLE device_commands ADD CONSTRAINT device_commands_format_check
--   CHECK (
--     command_string IS NULL OR
--     command_string = 'PLACEHOLDER' OR
--     command_string LIKE 'C:%'
--   );

-- Step 8: Show summary
DO $$
DECLARE
  total_count INTEGER;
  pending_count INTEGER;
  sent_count INTEGER;
  completed_count INTEGER;
  failed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM device_commands;
  SELECT COUNT(*) INTO pending_count FROM device_commands WHERE status = 'pending';
  SELECT COUNT(*) INTO sent_count FROM device_commands WHERE status = 'sent';
  SELECT COUNT(*) INTO completed_count FROM device_commands WHERE status = 'completed';
  SELECT COUNT(*) INTO failed_count FROM device_commands WHERE status = 'failed';
  
  RAISE NOTICE '📊 Device Commands Summary:';
  RAISE NOTICE '   Total: %', total_count;
  RAISE NOTICE '   Pending: %', pending_count;
  RAISE NOTICE '   Sent: %', sent_count;
  RAISE NOTICE '   Completed: %', completed_count;
  RAISE NOTICE '   Failed: %', failed_count;
END $$;

-- Step 9: Show sample of correct commands
SELECT 
  id,
  command_type,
  LEFT(command_string, 60) as command_preview,
  status,
  created_at
FROM device_commands
WHERE command_string LIKE 'C:%'
ORDER BY created_at DESC
LIMIT 5;

-- ✅ Migration complete
SELECT '✅ Migration 008 completed successfully - Command format fixed and old commands cleaned up' AS status;
