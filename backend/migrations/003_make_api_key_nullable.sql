-- Migration: Make api_key column nullable since we now use serial_number
-- This allows new devices to be registered without generating an api_key

-- Step 1: Make api_key nullable
ALTER TABLE devices ALTER COLUMN api_key DROP NOT NULL;

-- Step 2: Add comment
COMMENT ON COLUMN devices.api_key IS 'DEPRECATED: Legacy field kept for backward compatibility. New devices use serial_number only.';

-- Verification Query:
-- SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='devices' AND column_name='api_key';
