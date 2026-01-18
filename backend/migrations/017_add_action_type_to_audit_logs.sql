-- Migration: Add action_type column to audit_logs
-- Date: 2026-01-18
-- Description: Adds the missing action_type column to the audit_logs table to fix dashboard errors

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action_type VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
