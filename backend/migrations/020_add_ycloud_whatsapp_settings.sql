-- Migration: Add YCloud WhatsApp settings and message templates
-- Created: 2026-01-30
-- This adds the missing YCloud settings and template names to platform_settings

-- First, remove old Twilio settings if they exist (we're using YCloud now)
DELETE FROM platform_settings WHERE setting_key IN ('twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number');

-- Add YCloud WhatsApp settings
INSERT INTO platform_settings (category, setting_key, setting_value, setting_type, is_secret, description) VALUES
('whatsapp', 'ycloud_api_key', '', 'string', true, 'YCloud API Key for WhatsApp Business API'),
('whatsapp', 'whatsapp_phone_id', '', 'string', false, 'WhatsApp Business Phone Number ID'),
('whatsapp', 'whatsapp_business_account_id', '', 'string', false, 'WhatsApp Business Account ID (WABA ID)')
ON CONFLICT (setting_key) DO NOTHING;

-- Add Template Name settings
INSERT INTO platform_settings (category, setting_key, setting_value, setting_type, is_secret, description) VALUES
('whatsapp', 'whatsapp_template_late', 'attendance_late', 'string', false, 'Template name for Late attendance alerts'),
('whatsapp', 'whatsapp_template_absent', 'attendance_absent', 'string', false, 'Template name for Absent alerts'),
('whatsapp', 'whatsapp_template_present', 'attendance_present', 'string', false, 'Template name for Present/On-time alerts'),
('whatsapp', 'whatsapp_template_leave', 'attendance_leave', 'string', false, 'Template name for Leave alerts')
ON CONFLICT (setting_key) DO NOTHING;

-- Verify the settings were added
SELECT setting_key, setting_value, description FROM platform_settings WHERE category = 'whatsapp' ORDER BY setting_key;
