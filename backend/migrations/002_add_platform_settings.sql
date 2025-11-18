-- Migration: Add platform_settings table for super admin configuration
-- This table stores system-wide settings in database instead of .env files

CREATE TABLE IF NOT EXISTS platform_settings (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type VARCHAR(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
  is_secret BOOLEAN DEFAULT FALSE,
  description TEXT,
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_settings_category ON platform_settings(category);
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(setting_key);

-- Insert default settings

-- GENERAL SETTINGS
INSERT INTO platform_settings (category, setting_key, setting_value, setting_type, is_secret, description) VALUES
('general', 'platform_name', 'School Attendance System', 'string', false, 'Name of the platform'),
('general', 'platform_url', 'http://localhost:3001', 'string', false, 'Base URL of the platform'),
('general', 'default_timezone', 'Asia/Kolkata', 'string', false, 'Default timezone for the system'),
('general', 'default_language', 'en', 'string', false, 'Default language'),
('general', 'support_email', 'support@schoolattendance.com', 'string', false, 'Support email address'),
('general', 'company_name', 'School Attendance SaaS', 'string', false, 'Company name for branding')
ON CONFLICT (setting_key) DO NOTHING;

-- WHATSAPP SETTINGS (Twilio)
INSERT INTO platform_settings (category, setting_key, setting_value, setting_type, is_secret, description) VALUES
('whatsapp', 'whatsapp_enabled', 'true', 'boolean', false, 'Enable/disable WhatsApp notifications globally'),
('whatsapp', 'twilio_account_sid', 'your_account_sid_here', 'string', true, 'Twilio Account SID (shared for all schools)'),
('whatsapp', 'twilio_auth_token', 'your_auth_token_here', 'string', true, 'Twilio Auth Token'),
('whatsapp', 'twilio_phone_number', '+1234567890', 'string', false, 'Twilio WhatsApp-enabled phone number'),
('whatsapp', 'whatsapp_daily_limit', '5000', 'number', false, 'Daily message limit across all schools'),
('whatsapp', 'whatsapp_rate_limit', '100', 'number', false, 'Messages per minute rate limit')
ON CONFLICT (setting_key) DO NOTHING;

-- EMAIL SETTINGS (SMTP)
INSERT INTO platform_settings (category, setting_key, setting_value, setting_type, is_secret, description) VALUES
('email', 'email_enabled', 'false', 'boolean', false, 'Enable/disable email notifications'),
('email', 'smtp_host', 'smtp.gmail.com', 'string', false, 'SMTP server host'),
('email', 'smtp_port', '587', 'number', false, 'SMTP server port'),
('email', 'smtp_secure', 'false', 'boolean', false, 'Use TLS/SSL'),
('email', 'smtp_username', '', 'string', false, 'SMTP username'),
('email', 'smtp_password', '', 'string', true, 'SMTP password'),
('email', 'email_from_address', 'noreply@schoolattendance.com', 'string', false, 'From email address'),
('email', 'email_from_name', 'School Attendance System', 'string', false, 'From name')
ON CONFLICT (setting_key) DO NOTHING;

-- STORAGE SETTINGS
INSERT INTO platform_settings (category, setting_key, setting_value, setting_type, is_secret, description) VALUES
('storage', 'storage_provider', 'local', 'string', false, 'Storage provider (local, s3, cloudflare)'),
('storage', 'upload_directory', './uploads', 'string', false, 'Local upload directory path'),
('storage', 'max_file_size', '5242880', 'number', false, 'Max file size in bytes (5MB default)'),
('storage', 'allowed_file_types', '["image/jpeg","image/jpg","image/png"]', 'json', false, 'Allowed file MIME types'),
('storage', 's3_bucket', '', 'string', false, 'AWS S3 bucket name (if using S3)'),
('storage', 's3_region', 'us-east-1', 'string', false, 'AWS S3 region'),
('storage', 's3_access_key', '', 'string', true, 'AWS S3 access key'),
('storage', 's3_secret_key', '', 'string', true, 'AWS S3 secret key')
ON CONFLICT (setting_key) DO NOTHING;

-- SECURITY SETTINGS
INSERT INTO platform_settings (category, setting_key, setting_value, setting_type, is_secret, description) VALUES
('security', 'jwt_access_expiry', '15m', 'string', false, 'JWT access token expiry time'),
('security', 'jwt_refresh_expiry', '7d', 'string', false, 'JWT refresh token expiry time'),
('security', 'max_login_attempts', '5', 'number', false, 'Maximum failed login attempts before lockout'),
('security', 'lockout_duration', '15', 'number', false, 'Account lockout duration in minutes'),
('security', 'session_timeout', '60', 'number', false, 'Session timeout in minutes'),
('security', 'password_min_length', '8', 'number', false, 'Minimum password length'),
('security', 'password_require_uppercase', 'true', 'boolean', false, 'Require uppercase letter in password'),
('security', 'password_require_lowercase', 'true', 'boolean', false, 'Require lowercase letter in password'),
('security', 'password_require_number', 'true', 'boolean', false, 'Require number in password'),
('security', 'password_require_special', 'true', 'boolean', false, 'Require special character in password'),
('security', 'enable_2fa', 'false', 'boolean', false, 'Enable two-factor authentication'),
('security', 'api_rate_limit', '100', 'number', false, 'API requests per minute per IP')
ON CONFLICT (setting_key) DO NOTHING;

-- FEATURES FLAGS
INSERT INTO platform_settings (category, setting_key, setting_value, setting_type, is_secret, description) VALUES
('features', 'enable_attendance_reports', 'true', 'boolean', false, 'Enable attendance reports feature'),
('features', 'enable_parent_portal', 'false', 'boolean', false, 'Enable parent portal'),
('features', 'enable_student_app', 'true', 'boolean', false, 'Enable student mobile app'),
('features', 'enable_teacher_app', 'true', 'boolean', false, 'Enable teacher mobile app'),
('features', 'enable_whatsapp_alerts', 'true', 'boolean', false, 'Enable WhatsApp attendance alerts'),
('features', 'enable_email_alerts', 'false', 'boolean', false, 'Enable email attendance alerts'),
('features', 'enable_sms_alerts', 'false', 'boolean', false, 'Enable SMS attendance alerts')
ON CONFLICT (setting_key) DO NOTHING;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_platform_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_platform_settings_updated_at ON platform_settings;
CREATE TRIGGER trigger_platform_settings_updated_at
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_settings_updated_at();

COMMENT ON TABLE platform_settings IS 'Platform-wide configuration settings managed from super admin panel';
