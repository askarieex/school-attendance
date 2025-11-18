-- =====================================================
-- Super Admin Panel Features - Database Migration
-- Created: 2025-11-05
-- Purpose: Add system settings and audit logging
-- =====================================================

-- 1. PLATFORM SETTINGS (System Configuration)
CREATE TABLE IF NOT EXISTS platform_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type VARCHAR(50) NOT NULL DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
  category VARCHAR(50) NOT NULL, -- 'whatsapp', 'email', 'storage', 'general', 'security'
  is_secret BOOLEAN DEFAULT FALSE, -- Hide value in UI (for passwords, tokens)
  description TEXT,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. AUDIT LOGS (Track all super admin actions)
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  user_email VARCHAR(255),
  user_role VARCHAR(50),
  action_type VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'login', 'config_change', 'password_reset'
  resource_type VARCHAR(50) NOT NULL, -- 'school', 'user', 'device', 'setting', 'password'
  resource_id INTEGER,
  description TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_platform_settings_category ON platform_settings(category);
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Insert default platform settings
INSERT INTO platform_settings (setting_key, setting_value, setting_type, category, is_secret, description) VALUES
-- GENERAL SETTINGS
('platform_name', 'School Attendance System', 'string', 'general', false, 'Name of the platform'),
('platform_url', 'http://localhost:3001', 'string', 'general', false, 'Base URL of the platform'),
('default_timezone', 'Asia/Kolkata', 'string', 'general', false, 'Default timezone for the platform'),
('default_language', 'en', 'string', 'general', false, 'Default language (en, es, fr, etc)'),

-- WHATSAPP SETTINGS (Shared Twilio Account)
('whatsapp_enabled', 'true', 'boolean', 'whatsapp', false, 'Enable WhatsApp notifications globally'),
('twilio_account_sid', '', 'string', 'whatsapp', true, 'Twilio Account SID (shared for all schools)'),
('twilio_auth_token', '', 'string', 'whatsapp', true, 'Twilio Auth Token (shared for all schools)'),
('twilio_phone_number', '', 'string', 'whatsapp', false, 'Twilio WhatsApp phone number (+14155238886)'),
('whatsapp_daily_limit', '5000', 'number', 'whatsapp', false, 'Daily message limit for entire platform'),

-- EMAIL SETTINGS
('email_enabled', 'false', 'boolean', 'email', false, 'Enable email notifications'),
('smtp_host', 'smtp.gmail.com', 'string', 'email', false, 'SMTP server host'),
('smtp_port', '587', 'number', 'email', false, 'SMTP server port'),
('smtp_secure', 'false', 'boolean', 'email', false, 'Use TLS/SSL for SMTP'),
('smtp_username', '', 'string', 'email', false, 'SMTP username/email'),
('smtp_password', '', 'string', 'email', true, 'SMTP password'),
('email_from_name', 'School Attendance System', 'string', 'email', false, 'From name for emails'),
('email_from_address', 'noreply@schoolattendance.com', 'string', 'email', false, 'From email address'),

-- STORAGE SETTINGS
('upload_directory', './uploads', 'string', 'storage', false, 'Directory for file uploads'),
('max_file_size', '5242880', 'number', 'storage', false, 'Max file size in bytes (5MB default)'),
('allowed_file_types', '["image/jpeg","image/jpg","image/png"]', 'json', 'storage', false, 'Allowed MIME types for uploads'),

-- SECURITY SETTINGS
('jwt_access_expiry', '15m', 'string', 'security', false, 'JWT access token expiry time'),
('jwt_refresh_expiry', '7d', 'string', 'security', false, 'JWT refresh token expiry time'),
('max_login_attempts', '5', 'number', 'security', false, 'Max failed login attempts before lockout'),
('lockout_duration', '15', 'number', 'security', false, 'Account lockout duration in minutes'),
('session_timeout', '60', 'number', 'security', false, 'Session timeout in minutes'),
('password_min_length', '8', 'number', 'security', false, 'Minimum password length'),
('password_require_uppercase', 'true', 'boolean', 'security', false, 'Require uppercase in password'),
('password_require_lowercase', 'true', 'boolean', 'security', false, 'Require lowercase in password'),
('password_require_number', 'true', 'boolean', 'security', false, 'Require number in password'),
('password_require_special', 'true', 'boolean', 'security', false, 'Require special character in password')

ON CONFLICT (setting_key) DO NOTHING;

-- Create a trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_platform_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_platform_settings_timestamp
BEFORE UPDATE ON platform_settings
FOR EACH ROW
EXECUTE FUNCTION update_platform_settings_timestamp();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Super Admin Panel tables created successfully!';
  RAISE NOTICE '   - platform_settings (% rows)', (SELECT COUNT(*) FROM platform_settings);
  RAISE NOTICE '   - audit_logs (created)';
  RAISE NOTICE '✅ Indexes created for performance';
  RAISE NOTICE '✅ Default settings inserted';
END $$;
