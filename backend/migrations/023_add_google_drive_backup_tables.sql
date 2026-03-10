-- Migration: Add Google Drive Backup Support
-- Date: 2026-03-10
-- Description: Add columns to school_settings and create backup_logs table for Google Drive integration

BEGIN;

-- ============================================================================
-- PART 1: Add Google Drive columns to school_settings
-- ============================================================================

-- Add Google Drive OAuth token columns
ALTER TABLE school_settings
ADD COLUMN IF NOT EXISTS google_drive_refresh_token TEXT DEFAULT NULL;

ALTER TABLE school_settings
ADD COLUMN IF NOT EXISTS google_drive_access_token TEXT DEFAULT NULL;

ALTER TABLE school_settings
ADD COLUMN IF NOT EXISTS google_drive_connected BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN school_settings.google_drive_refresh_token IS 'OAuth 2.0 refresh token for Google Drive (never expires, used to get new access tokens)';
COMMENT ON COLUMN school_settings.google_drive_access_token IS 'OAuth 2.0 access token for Google Drive (expires in 1 hour, auto-refreshed)';
COMMENT ON COLUMN school_settings.google_drive_connected IS 'Whether school has connected their Google Drive account';

-- ============================================================================
-- PART 2: Create backup_logs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS backup_logs (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  backup_file VARCHAR(255) NOT NULL,
  cloud_provider VARCHAR(50) NOT NULL DEFAULT 'google_drive',
  file_size BIGINT,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  cloud_file_id VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT backup_logs_status_check CHECK (status IN ('success', 'failed', 'pending'))
);

COMMENT ON TABLE backup_logs IS 'Tracks backup upload history to Google Drive';
COMMENT ON COLUMN backup_logs.school_id IS 'School that owns this backup';
COMMENT ON COLUMN backup_logs.backup_file IS 'Filename of the backup (e.g., school_1_20260310.sql.gz)';
COMMENT ON COLUMN backup_logs.cloud_provider IS 'Cloud storage provider (currently only google_drive)';
COMMENT ON COLUMN backup_logs.file_size IS 'Size of backup file in bytes';
COMMENT ON COLUMN backup_logs.status IS 'Upload status: success, failed, or pending';
COMMENT ON COLUMN backup_logs.error_message IS 'Error message if upload failed';
COMMENT ON COLUMN backup_logs.cloud_file_id IS 'Google Drive file ID for accessing the file';
COMMENT ON COLUMN backup_logs.created_at IS 'When the backup was created/uploaded';

-- ============================================================================
-- PART 3: Create indexes for performance
-- ============================================================================

-- Index for querying backups by school
CREATE INDEX IF NOT EXISTS idx_backup_logs_school_id ON backup_logs(school_id);

-- Index for querying recent backups
CREATE INDEX IF NOT EXISTS idx_backup_logs_created_at ON backup_logs(created_at DESC);

-- Composite index for school + date queries
CREATE INDEX IF NOT EXISTS idx_backup_logs_school_date ON backup_logs(school_id, created_at DESC);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_backup_logs_status ON backup_logs(status);

-- ============================================================================
-- PART 4: Grant permissions (if using specific database users)
-- ============================================================================

-- Grant permissions to the application user (adjust if you use a different user)
-- GRANT SELECT, INSERT, UPDATE ON backup_logs TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE backup_logs_id_seq TO your_app_user;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run these after migration to verify)
-- ============================================================================

-- Check if columns were added
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'school_settings'
-- AND column_name LIKE 'google_drive%';

-- Check if backup_logs table exists
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'backup_logs';

-- Check indexes
-- SELECT indexname FROM pg_indexes WHERE tablename = 'backup_logs';

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================

-- To rollback this migration:
-- BEGIN;
-- DROP TABLE IF EXISTS backup_logs CASCADE;
-- ALTER TABLE school_settings DROP COLUMN IF EXISTS google_drive_refresh_token;
-- ALTER TABLE school_settings DROP COLUMN IF EXISTS google_drive_access_token;
-- ALTER TABLE school_settings DROP COLUMN IF EXISTS google_drive_connected;
-- COMMIT;
