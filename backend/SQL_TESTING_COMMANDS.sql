-- =====================================================
-- ZKTeco Integration - SQL Testing Commands
-- Run these in pgAdmin or psql to test the system
-- =====================================================

-- =====================================================
-- STEP 1: VERIFY DEVICE EXISTS
-- =====================================================

-- Check if your device is registered
SELECT 
  id, 
  device_name, 
  serial_number, 
  school_id, 
  is_active,
  last_heartbeat,
  last_seen
FROM devices 
WHERE serial_number = 'GED7242600838';

-- Expected result: Should return 1 row with device details
-- Note the 'id' column value - you'll need it for next steps

-- If device doesn't exist, create it:
-- INSERT INTO devices (school_id, device_name, serial_number, location, is_active)
-- VALUES (3, 'CPS Device', 'GED7242600838', 'Main Gate', true)
-- RETURNING id, device_name, serial_number;


-- =====================================================
-- STEP 2: VERIFY device_commands TABLE STRUCTURE
-- =====================================================

-- Check table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'device_commands'
ORDER BY ordinal_position;

-- Expected columns:
-- id (integer, PRIMARY KEY)
-- device_id (integer, NOT NULL)
-- command_type (text/varchar)
-- command_string (text, NOT NULL)
-- priority (integer)
-- status (text, DEFAULT 'pending')
-- created_at (timestamp)
-- sent_at (timestamp, nullable)
-- completed_at (timestamp, nullable)
-- error_message (text, nullable)


-- =====================================================
-- STEP 3: INSERT A TEST COMMAND
-- =====================================================

-- Replace 8 with your actual device ID from STEP 1
-- This creates a RESTART command for testing

INSERT INTO device_commands (
  device_id, 
  command_type, 
  command_string, 
  priority, 
  status,
  created_at
)
VALUES (
  8,  -- ⚠️ CHANGE THIS to your device.id
  'RESTART',
  'C:RESTART',
  100,
  'pending',
  CURRENT_TIMESTAMP
)
RETURNING id, command_type, command_string, status;

-- Save the returned 'id' value - you'll use it in curl tests
-- Example result: id=1001, command_type=RESTART, status=pending


-- =====================================================
-- STEP 4: INSERT A "ADD USER" TEST COMMAND
-- =====================================================

-- This command adds a test student to the device
-- Replace 8 with your device ID

INSERT INTO device_commands (
  device_id, 
  command_type, 
  command_string, 
  priority, 
  status,
  created_at
)
VALUES (
  8,  -- ⚠️ CHANGE THIS to your device.id
  'add_user',
  'C:101:DATA UPDATE user Pin=101	Name=TestStudent	Passwd=	Card=12345678	Grp=1	TZ=0000000100000000',
  10,
  'pending',
  CURRENT_TIMESTAMP
)
RETURNING id, command_type, command_string, status;

-- Note: The command_string uses TAB characters (\t) between fields
-- ZKTeco devices expect exact formatting with tabs


-- =====================================================
-- STEP 5: VIEW PENDING COMMANDS
-- =====================================================

-- See all pending commands for all devices
SELECT 
  dc.id,
  d.device_name,
  d.serial_number,
  dc.command_type,
  dc.priority,
  dc.status,
  dc.created_at,
  LENGTH(dc.command_string) as cmd_length
FROM device_commands dc
JOIN devices d ON dc.device_id = d.id
WHERE dc.status = 'pending'
ORDER BY dc.priority DESC, dc.created_at ASC;


-- =====================================================
-- STEP 6: VIEW COMMAND HISTORY
-- =====================================================

-- See recent command history with status
SELECT 
  dc.id,
  d.device_name,
  dc.command_type,
  dc.status,
  dc.created_at,
  dc.sent_at,
  dc.completed_at,
  dc.error_message,
  EXTRACT(EPOCH FROM (dc.completed_at - dc.created_at)) as execution_seconds
FROM device_commands dc
JOIN devices d ON dc.device_id = d.id
ORDER BY dc.created_at DESC
LIMIT 20;


-- =====================================================
-- STEP 7: VERIFY COMMAND WAS PICKED UP (after device poll)
-- =====================================================

-- Check if command status changed from 'pending' to 'sent'
-- Run this after device polls GET /iclock/getrequest

SELECT 
  id,
  command_type,
  status,
  sent_at,
  completed_at
FROM device_commands
WHERE id = 1001;  -- Replace with your command ID

-- Expected: status='sent', sent_at should have a timestamp


-- =====================================================
-- STEP 8: VERIFY COMMAND WAS COMPLETED (after device confirms)
-- =====================================================

-- Check if command status changed to 'completed'
-- Run this after device sends POST /iclock/devicecmd

SELECT 
  id,
  command_type,
  status,
  sent_at,
  completed_at,
  error_message
FROM device_commands
WHERE id = 1001;  -- Replace with your command ID

-- Expected: status='completed', completed_at should have a timestamp


-- =====================================================
-- STEP 9: CHECK ATTENDANCE LOGS (after device sends attendance)
-- =====================================================

-- View recent attendance records
SELECT 
  al.id,
  s.full_name as student_name,
  s.rfid_card_id,
  al.date,
  al.check_in_time,
  al.status,
  d.device_name,
  al.created_at
FROM attendance_logs al
JOIN students s ON al.student_id = s.id
JOIN devices d ON al.device_id = d.id
WHERE al.date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY al.created_at DESC
LIMIT 20;


-- =====================================================
-- STEP 10: CHECK DEVICE-STUDENT MAPPINGS
-- =====================================================

-- View which students are mapped to which device PINs
SELECT 
  dum.id,
  d.device_name,
  d.serial_number,
  dum.device_pin,
  s.id as student_id,
  s.full_name as student_name,
  s.rfid_card_id,
  dum.synced,
  dum.created_at
FROM device_user_mappings dum
JOIN devices d ON dum.device_id = d.id
JOIN students s ON dum.student_id = s.id
WHERE d.serial_number = 'GED7242600838'
ORDER BY dum.device_pin ASC;


-- =====================================================
-- TROUBLESHOOTING QUERIES
-- =====================================================

-- Find commands that were sent but never completed (stuck commands)
SELECT 
  dc.id,
  d.device_name,
  dc.command_type,
  dc.status,
  dc.sent_at,
  AGE(NOW(), dc.sent_at) as time_stuck
FROM device_commands dc
JOIN devices d ON dc.device_id = d.id
WHERE dc.status = 'sent'
  AND dc.sent_at < NOW() - INTERVAL '5 minutes'
ORDER BY dc.sent_at ASC;

-- Reset stuck commands back to pending (if device never confirmed)
-- UPDATE device_commands 
-- SET status = 'pending', sent_at = NULL
-- WHERE id IN (SELECT id FROM ... above query);


-- Find failed commands with error messages
SELECT 
  dc.id,
  d.device_name,
  dc.command_type,
  dc.status,
  dc.error_message,
  dc.completed_at
FROM device_commands dc
JOIN devices d ON dc.device_id = d.id
WHERE dc.status = 'failed'
ORDER BY dc.completed_at DESC
LIMIT 10;


-- Check device heartbeat (is device online?)
SELECT 
  device_name,
  serial_number,
  is_online,
  last_heartbeat,
  last_seen,
  AGE(NOW(), last_heartbeat) as last_heartbeat_ago
FROM devices
WHERE serial_number = 'GED7242600838';


-- =====================================================
-- CLEANUP COMMANDS
-- =====================================================

-- Delete old completed commands (older than 7 days)
-- DELETE FROM device_commands 
-- WHERE status IN ('completed', 'failed')
--   AND completed_at < NOW() - INTERVAL '7 days';

-- Delete all test commands
-- DELETE FROM device_commands 
-- WHERE command_type IN ('test', 'RESTART')
--   OR command_string LIKE '%TestStudent%';

-- Reset all pending commands for a device (use with caution!)
-- DELETE FROM device_commands 
-- WHERE device_id = 8 
--   AND status = 'pending';


-- =====================================================
-- PERFORMANCE INDEXES (if not already created)
-- =====================================================

-- These improve query performance
CREATE INDEX IF NOT EXISTS idx_device_commands_device_status 
  ON device_commands(device_id, status);

CREATE INDEX IF NOT EXISTS idx_device_commands_status 
  ON device_commands(status);

CREATE INDEX IF NOT EXISTS idx_device_commands_priority 
  ON device_commands(device_id, status, priority DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_date 
  ON attendance_logs(date, student_id);

CREATE INDEX IF NOT EXISTS idx_device_user_mappings_device 
  ON device_user_mappings(device_id, device_pin);


-- =====================================================
-- SUMMARY: Quick Test Workflow
-- =====================================================

-- 1. Run STEP 1 to get device ID
-- 2. Run STEP 3 to insert test command (save the returned ID)
-- 3. Device polls server (or use curl): GET /iclock/getrequest?SN=...
-- 4. Run STEP 7 to verify status changed to 'sent'
-- 5. Device confirms (or use curl): POST /iclock/devicecmd with ID=...&Return=0
-- 6. Run STEP 8 to verify status changed to 'completed'
-- 7. Check server logs for rowCount=1 (should NOT be 0)

-- ✅ If all steps work, your integration is complete!
