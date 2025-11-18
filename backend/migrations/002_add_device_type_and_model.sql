-- Migration: Add device_type and device_model fields for hardware flexibility
-- This allows the system to support any RFID hardware (ZKTeco, HID, Suprema, etc.)

-- Step 1: Add device_type column (manufacturer/brand)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='devices' AND column_name='device_type') THEN
        ALTER TABLE devices ADD COLUMN device_type VARCHAR(50) DEFAULT 'ZKTECO';
    END IF;
END $$;

-- Step 2: Add device_model column (specific model)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='devices' AND column_name='device_model') THEN
        ALTER TABLE devices ADD COLUMN device_model VARCHAR(100) DEFAULT 'K40 Pro';
    END IF;
END $$;

-- Step 3: Add firmware_version column (for tracking updates)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='devices' AND column_name='firmware_version') THEN
        ALTER TABLE devices ADD COLUMN firmware_version VARCHAR(50);
    END IF;
END $$;

-- Step 4: Add protocol_type column (how device communicates)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='devices' AND column_name='protocol_type') THEN
        ALTER TABLE devices ADD COLUMN protocol_type VARCHAR(50) DEFAULT 'HTTP_REST';
    END IF;
END $$;

-- Step 5: Update existing devices to have proper type/model
UPDATE devices
SET device_type = 'ZKTECO',
    device_model = 'K40 Pro',
    protocol_type = 'HTTP_REST'
WHERE device_type IS NULL OR device_type = '';

-- Step 6: Create index for device type lookups
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(device_type);

-- Step 7: Add comments for documentation
COMMENT ON COLUMN devices.device_type IS 'Device manufacturer/brand (e.g., ZKTECO, HID, SUPREMA, ANVIZ, HIKVISION)';
COMMENT ON COLUMN devices.device_model IS 'Specific device model (e.g., K40 Pro, MultiCLASS SE RP40, BioStation 2)';
COMMENT ON COLUMN devices.firmware_version IS 'Device firmware version for tracking updates';
COMMENT ON COLUMN devices.protocol_type IS 'Communication protocol (HTTP_REST, TCP, MQTT, WIEGAND)';

-- Step 8: Create device_types reference table for future validation
CREATE TABLE IF NOT EXISTS supported_device_types (
    id SERIAL PRIMARY KEY,
    manufacturer VARCHAR(50) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    requires_serial BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 9: Insert commonly supported device types
INSERT INTO supported_device_types (manufacturer, requires_serial, notes)
VALUES
    ('ZKTECO', TRUE, 'ZKTeco biometric and RFID devices (K40 Pro, etc.)'),
    ('HID', TRUE, 'HID Global access control readers'),
    ('SUPREMA', TRUE, 'Suprema BioStation and other biometric devices'),
    ('ANVIZ', TRUE, 'Anviz facial recognition and RFID devices'),
    ('HIKVISION', TRUE, 'Hikvision access control terminals'),
    ('GENERIC', FALSE, 'Generic RFID readers (may use MAC address or custom ID)')
ON CONFLICT (manufacturer) DO NOTHING;

-- Verification Query (run this after migration to verify):
-- SELECT id, device_name, device_type, device_model, serial_number, protocol_type FROM devices;
-- SELECT * FROM supported_device_types;
