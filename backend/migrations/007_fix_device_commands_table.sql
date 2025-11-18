-- =============================================
-- Migration: Fix device_commands table structure
-- Date: 2025-10-23
-- Purpose: Ensure all required columns exist with correct types
-- =============================================

-- 1. Ensure device_commands table exists with all required columns
CREATE TABLE IF NOT EXISTS device_commands (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  command_type VARCHAR(50) NOT NULL,
  command_string TEXT NOT NULL,
  priority INTEGER DEFAULT 100,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'failed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT
);

-- 2. Add missing columns if they don't exist (for existing tables)
ALTER TABLE device_commands
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- 3. Update existing NULL status values to 'pending'
UPDATE device_commands 
SET status = 'pending' 
WHERE status IS NULL;

-- 4. Add constraint to status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'device_commands_status_check'
  ) THEN
    ALTER TABLE device_commands 
    ADD CONSTRAINT device_commands_status_check 
    CHECK (status IN ('pending', 'sent', 'completed', 'failed'));
  END IF;
END $$;

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_device_commands_device_status 
  ON device_commands(device_id, status);

CREATE INDEX IF NOT EXISTS idx_device_commands_status 
  ON device_commands(status);

CREATE INDEX IF NOT EXISTS idx_device_commands_priority 
  ON device_commands(device_id, status, priority DESC, created_at ASC);

-- 6. Verify device table has required columns
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP,
  ADD COLUMN IF NOT EXISTS firmware_version VARCHAR(50),
  ADD COLUMN IF NOT EXISTS user_count INTEGER DEFAULT 0;

-- =============================================
-- VERIFICATION QUERIES (run these to check)
-- =============================================

-- Check device_commands table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'device_commands'
ORDER BY ordinal_position;

-- Check if your device exists
SELECT id, device_name, serial_number, school_id, is_active 
FROM devices 
WHERE serial_number = 'GED7242600838';

-- Check pending commands
SELECT id, device_id, command_type, status, priority, created_at
FROM device_commands
WHERE status = 'pending'
ORDER BY priority DESC, created_at ASC
LIMIT 10;

-- =============================================
-- OPTIONAL: Insert test command (MODIFY device_id)
-- =============================================
-- IMPORTANT: Replace 8 with your actual device ID from the query above

-- INSERT INTO device_commands (device_id, command_type, command_string, status, priority, created_at)
-- VALUES (
--   8,  -- ⚠️ CHANGE THIS to your actual device.id
--   'DATA',
--   'C:1001:DATA UPDATE user Pin=101 Name=TestStudent',
--   'pending',
--   100,
--   CURRENT_TIMESTAMP
-- );

COMMENT ON TABLE device_commands IS 'Command queue for ZKTeco devices - managed by PUSH protocol';
COMMENT ON COLUMN device_commands.status IS 'pending=queued, sent=picked by device, completed=device confirmed success, failed=device returned error';
COMMENT ON COLUMN device_commands.priority IS 'Higher priority commands sent first (e.g., 100=restart, 10=add user, 0=normal)';

-- ✅ Migration complete
SELECT 'Migration 007 completed successfully' AS status;
