-- Migration: Add Calendar, Holidays, Devices, and Settings tables
-- Created: 2025-10-17
-- Description: Add support for academic calendar, holidays, device management, and school settings

-- =============================================
-- 1. HOLIDAYS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS holidays (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  holiday_name VARCHAR(200) NOT NULL,
  holiday_date DATE NOT NULL,
  holiday_type VARCHAR(50) DEFAULT 'national', -- national, festival, school_event, vacation
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, holiday_date, holiday_name)
);

CREATE INDEX idx_holidays_school_date ON holidays(school_id, holiday_date);

-- =============================================
-- 2. ACADEMIC YEAR SETTINGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS academic_years (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  year_name VARCHAR(50) NOT NULL, -- e.g., "2024-2025"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT FALSE,
  working_days VARCHAR(50) DEFAULT 'Mon-Sat', -- Working days pattern
  weekly_holiday VARCHAR(50) DEFAULT 'Sunday',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, year_name)
);

CREATE INDEX idx_academic_years_school_current ON academic_years(school_id, is_current);

-- =============================================
-- 3. SCHOOL SETTINGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS school_settings (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE NOT NULL UNIQUE,
  school_open_time TIME DEFAULT '08:00:00',
  school_close_time TIME DEFAULT '14:00:00',
  late_threshold_minutes INTEGER DEFAULT 15, -- Minutes after open time to mark as late
  early_leave_minutes INTEGER DEFAULT 30, -- Minutes before close time to mark as early leave
  first_break_start TIME,
  first_break_end TIME,
  lunch_break_start TIME,
  lunch_break_end TIME,
  sms_enabled BOOLEAN DEFAULT FALSE,
  sms_provider VARCHAR(50), -- fast2sms, msg91, twilio
  sms_api_key TEXT,
  sms_balance INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 4. DEVICES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  device_name VARCHAR(100) NOT NULL,
  device_type VARCHAR(50) DEFAULT 'rfid', -- rfid, biometric, qr, facial
  device_model VARCHAR(100),
  serial_number VARCHAR(100) UNIQUE,
  ip_address VARCHAR(50),
  location VARCHAR(200), -- Gate A, Main Entrance, etc.
  firmware_version VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMP,
  adms_enabled BOOLEAN DEFAULT FALSE,
  push_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_devices_school ON devices(school_id);
CREATE INDEX idx_devices_serial ON devices(serial_number);

-- =============================================
-- 5. DEVICE LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS device_logs (
  id SERIAL PRIMARY KEY,
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  raw_payload TEXT,
  parsed_data JSONB,
  log_type VARCHAR(50) DEFAULT 'attendance', -- attendance, command, error, sync
  status VARCHAR(50) DEFAULT 'success', -- success, failed, pending
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_device_logs_device ON device_logs(device_id);
CREATE INDEX idx_device_logs_school_date ON device_logs(school_id, created_at);

-- =============================================
-- 6. SMS LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS sms_logs (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  recipient_phone VARCHAR(20) NOT NULL,
  recipient_name VARCHAR(200),
  message TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'manual', -- manual, absent_alert, late_alert, low_attendance
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed, delivered
  provider_response JSONB,
  cost DECIMAL(10, 2),
  sent_by INTEGER REFERENCES users(id),
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP
);

CREATE INDEX idx_sms_logs_school ON sms_logs(school_id);
CREATE INDEX idx_sms_logs_status ON sms_logs(status);

-- =============================================
-- 7. SMS TEMPLATES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS sms_templates (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  template_name VARCHAR(100) NOT NULL,
  template_type VARCHAR(50) NOT NULL, -- absent_alert, late_alert, low_attendance, custom
  message_template TEXT NOT NULL,
  variables JSONB, -- {guardian_name}, {student_name}, {date}, etc.
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sms_templates_school ON sms_templates(school_id);

-- =============================================
-- 8. VACATION PERIODS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS vacation_periods (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  vacation_name VARCHAR(200) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE CASCADE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vacation_periods_school ON vacation_periods(school_id);

-- =============================================
-- 9. UPDATE ATTENDANCE_LOGS TABLE
-- =============================================
-- Add new columns to existing attendance_logs table
ALTER TABLE attendance_logs
  ADD COLUMN IF NOT EXISTS device_id INTEGER REFERENCES devices(id),
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'present', -- present, absent, late, early_leave
  ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS marked_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS remarks TEXT;

CREATE INDEX IF NOT EXISTS idx_attendance_device ON attendance_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_logs(status);

-- =============================================
-- 10. AUTO-UPDATE TRIGGERS
-- =============================================

-- Trigger for holidays updated_at
CREATE OR REPLACE FUNCTION update_holidays_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_holidays_updated_at
  BEFORE UPDATE ON holidays
  FOR EACH ROW
  EXECUTE FUNCTION update_holidays_timestamp();

-- Trigger for academic_years updated_at
CREATE TRIGGER set_academic_years_updated_at
  BEFORE UPDATE ON academic_years
  FOR EACH ROW
  EXECUTE FUNCTION update_holidays_timestamp();

-- Trigger for school_settings updated_at
CREATE TRIGGER set_school_settings_updated_at
  BEFORE UPDATE ON school_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_holidays_timestamp();

-- Trigger for devices updated_at
CREATE TRIGGER set_devices_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW
  EXECUTE FUNCTION update_holidays_timestamp();

-- Trigger for sms_templates updated_at
CREATE TRIGGER set_sms_templates_updated_at
  BEFORE UPDATE ON sms_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_holidays_timestamp();

-- =============================================
-- 11. INSERT DEFAULT DATA FOR TESTING
-- =============================================

-- Insert default school settings for existing schools
INSERT INTO school_settings (school_id, school_open_time, school_close_time, late_threshold_minutes)
SELECT id, '08:00:00', '14:00:00', 15
FROM schools
WHERE id NOT IN (SELECT school_id FROM school_settings)
ON CONFLICT (school_id) DO NOTHING;

-- Insert current academic year for existing schools
INSERT INTO academic_years (school_id, year_name, start_date, end_date, is_current)
SELECT id, '2024-2025', '2024-04-01', '2025-03-31', TRUE
FROM schools
WHERE id NOT IN (SELECT school_id FROM academic_years WHERE is_current = TRUE)
ON CONFLICT (school_id, year_name) DO NOTHING;

-- Insert common Indian national holidays for 2024-2025
INSERT INTO holidays (school_id, holiday_name, holiday_date, holiday_type)
SELECT s.id, 'Independence Day', '2024-08-15', 'national'
FROM schools s
WHERE NOT EXISTS (
  SELECT 1 FROM holidays h
  WHERE h.school_id = s.id AND h.holiday_date = '2024-08-15'
);

INSERT INTO holidays (school_id, holiday_name, holiday_date, holiday_type)
SELECT s.id, 'Republic Day', '2025-01-26', 'national'
FROM schools s
WHERE NOT EXISTS (
  SELECT 1 FROM holidays h
  WHERE h.school_id = s.id AND h.holiday_date = '2025-01-26'
);

INSERT INTO holidays (school_id, holiday_name, holiday_date, holiday_type)
SELECT s.id, 'Gandhi Jayanti', '2024-10-02', 'national'
FROM schools s
WHERE NOT EXISTS (
  SELECT 1 FROM holidays h
  WHERE h.school_id = s.id AND h.holiday_date = '2024-10-02'
);

-- Insert default SMS templates
INSERT INTO sms_templates (school_id, template_name, template_type, message_template, variables)
SELECT s.id,
  'Absent Alert',
  'absent_alert',
  'Dear {guardian_name}, {student_name} was absent on {date}. Please contact school if unaware. - {school_name}',
  '["guardian_name", "student_name", "date", "school_name"]'::jsonb
FROM schools s
WHERE NOT EXISTS (
  SELECT 1 FROM sms_templates st
  WHERE st.school_id = s.id AND st.template_type = 'absent_alert'
);

COMMENT ON TABLE holidays IS 'Stores school holidays and vacation dates';
COMMENT ON TABLE academic_years IS 'Stores academic year configurations';
COMMENT ON TABLE school_settings IS 'Stores school-specific settings like timings, SMS config';
COMMENT ON TABLE devices IS 'Stores biometric/RFID device information';
COMMENT ON TABLE device_logs IS 'Stores raw logs from devices for debugging';
COMMENT ON TABLE sms_logs IS 'Stores SMS sending history';
COMMENT ON TABLE sms_templates IS 'Stores reusable SMS templates';
COMMENT ON TABLE vacation_periods IS 'Stores vacation periods within academic year';
