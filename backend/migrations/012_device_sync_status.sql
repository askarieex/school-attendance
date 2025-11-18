-- Migration 012: Device User Sync Status Tracking
-- Purpose: Track which students are synced to each biometric device
-- Created: 2025-11-18

BEGIN;

-- Create sync status tracking table
CREATE TABLE IF NOT EXISTS device_user_sync_status (
  id SERIAL PRIMARY KEY,
  device_id INT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  device_pin INT NOT NULL,

  -- Sync status tracking
  sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'sent', 'synced', 'failed', 'deleted')),

  -- Timestamp tracking
  last_sync_attempt TIMESTAMP,
  last_sync_success TIMESTAMP,

  -- Error handling
  sync_retries INT DEFAULT 0,
  error_message TEXT,

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Ensure one student can only be synced once per device
  UNIQUE(device_id, student_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_device_sync_status ON device_user_sync_status(device_id, sync_status);
CREATE INDEX IF NOT EXISTS idx_student_sync_status ON device_user_sync_status(student_id, sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_failed ON device_user_sync_status(device_id) WHERE sync_status = 'failed';

-- Add comments
COMMENT ON TABLE device_user_sync_status IS 'Tracks synchronization status of students to biometric devices';
COMMENT ON COLUMN device_user_sync_status.sync_status IS 'Values: pending (queued), sent (command sent), synced (confirmed by device), failed (error), deleted (removed from device)';
COMMENT ON COLUMN device_user_sync_status.device_pin IS 'The PIN assigned to student on this specific device';

-- Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_device_sync_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_device_sync_status_timestamp
BEFORE UPDATE ON device_user_sync_status
FOR EACH ROW
EXECUTE FUNCTION update_device_sync_status_timestamp();

-- Populate initial sync status for existing device-student mappings
INSERT INTO device_user_sync_status (device_id, student_id, device_pin, sync_status, last_sync_success)
SELECT
  dum.device_id,
  dum.student_id,
  dum.device_pin,
  'synced' as sync_status, -- Assume existing mappings are already synced
  CURRENT_TIMESTAMP as last_sync_success
FROM device_user_mappings dum
ON CONFLICT (device_id, student_id) DO NOTHING;

COMMIT;

-- Verification queries
DO $$
DECLARE
  sync_count INT;
BEGIN
  SELECT COUNT(*) INTO sync_count FROM device_user_sync_status;
  RAISE NOTICE '✅ Migration 012 complete!';
  RAISE NOTICE '   Created device_user_sync_status table';
  RAISE NOTICE '   Initial sync records: %', sync_count;
END $$;
