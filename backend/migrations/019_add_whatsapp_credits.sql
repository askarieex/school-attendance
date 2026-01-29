-- Migration: Add WhatsApp Credit Management columns to schools table
-- Purpose: Track WhatsApp message credits per school for billing control

-- Add WhatsApp credit management columns
ALTER TABLE schools 
  ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp_credits INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS whatsapp_credits_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS whatsapp_last_refill TIMESTAMP,
  ADD COLUMN IF NOT EXISTS whatsapp_low_credit_threshold INTEGER DEFAULT 50;

-- Add index for quick credit lookups
CREATE INDEX IF NOT EXISTS idx_schools_whatsapp ON schools(id, whatsapp_enabled, whatsapp_credits);

-- Comment on columns for documentation
COMMENT ON COLUMN schools.whatsapp_enabled IS 'Whether WhatsApp notifications are enabled for this school';
COMMENT ON COLUMN schools.whatsapp_credits IS 'Remaining WhatsApp message credits';
COMMENT ON COLUMN schools.whatsapp_credits_used IS 'Total credits used (for analytics)';
COMMENT ON COLUMN schools.whatsapp_last_refill IS 'Timestamp of last credit top-up';
COMMENT ON COLUMN schools.whatsapp_low_credit_threshold IS 'Alert when credits fall below this number';

-- Log migration
SELECT 'Migration 019: WhatsApp credits columns added to schools table' AS status;
