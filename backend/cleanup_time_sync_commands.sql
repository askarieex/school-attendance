-- ⛔ DELETE ALL PENDING TIME SYNC COMMANDS ⛔
-- Run this to remove any leftover time sync commands that might be executing

-- Step 1: View current pending time sync commands
SELECT 
    id, 
    device_id, 
    command_type, 
    status, 
    created_at,
    command_string
FROM device_commands 
WHERE command_type IN ('SET_TIME', 'set_time')
AND status IN ('pending', 'sent')
ORDER BY created_at DESC;

-- Step 2: Delete all pending/sent time sync commands
DELETE FROM device_commands 
WHERE command_type IN ('SET_TIME', 'set_time') 
AND status IN ('pending', 'sent');

-- Step 3: Verify deletion
SELECT 
    command_type, 
    status, 
    COUNT(*) as count
FROM device_commands 
WHERE command_type IN ('SET_TIME', 'set_time')
GROUP BY command_type, status;

-- Step 4: View remaining time sync commands (should only be completed/failed)
SELECT 
    id, 
    device_id, 
    command_type, 
    status, 
    created_at
FROM device_commands 
WHERE command_type IN ('SET_TIME', 'set_time')
ORDER BY created_at DESC
LIMIT 20;
