-- Migration: Update devices table to use serial_number instead of api_key
-- This migration changes the device authentication from generated UUIDs to physical Serial Numbers
-- from ZKTeco K40 Pro hardware

-- Step 1: Add the new serial_number column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='devices' AND column_name='serial_number') THEN
        ALTER TABLE devices ADD COLUMN serial_number VARCHAR(100);
    END IF;
END $$;

-- Step 2: Copy existing api_key values to serial_number for backward compatibility
-- (Only for rows where serial_number is NULL)
UPDATE devices
SET serial_number = api_key
WHERE serial_number IS NULL;

-- Step 3: Make serial_number NOT NULL and UNIQUE
ALTER TABLE devices
ALTER COLUMN serial_number SET NOT NULL;

-- Step 4: Add unique constraint on serial_number
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devices_serial_number_unique') THEN
        ALTER TABLE devices ADD CONSTRAINT devices_serial_number_unique UNIQUE (serial_number);
    END IF;
END $$;

-- Step 5: Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_devices_serial_number ON devices(serial_number);

-- Step 6: Add comments for documentation
COMMENT ON COLUMN devices.serial_number IS 'Physical serial number from ZKTeco device label (e.g., ZK12345678)';
COMMENT ON COLUMN devices.api_key IS 'DEPRECATED: Use serial_number instead. Kept for backward compatibility.';

-- Step 7: Keep api_key column for backward compatibility but it's no longer the primary identifier
-- In the future, you can drop the api_key column with:
-- ALTER TABLE devices DROP COLUMN IF EXISTS api_key;

-- Verification Query (run this after migration to verify):
-- SELECT id, device_name, serial_number, api_key, school_id, is_active FROM devices;
