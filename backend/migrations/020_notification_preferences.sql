-- Migration 020: Add notification preference columns to school_settings
-- Allows schools to control which attendance types trigger WhatsApp notifications

ALTER TABLE school_settings
ADD COLUMN IF NOT EXISTS send_on_present BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS send_on_leave BOOLEAN DEFAULT true;

-- Add comments
COMMENT ON COLUMN school_settings.send_on_present IS 'Send notification when student arrives on time (default: off)';
COMMENT ON COLUMN school_settings.send_on_leave IS 'Send notification when student is on leave (default: on)';

-- Return status
SELECT 'Migration 020: Notification preference columns added to school_settings' as status;
