# FIX: Google Drive Backup - Database Migration Required

**Date:** March 10, 2026
**Issue:** Missing database tables/columns for Google Drive backup feature
**Status:** ✅ READY TO APPLY

---

## THE PROBLEM

Your Google Drive backup feature is failing with these errors:
```
error: relation "backup_logs" does not exist
error: column "google_drive_connected" does not exist
```

**Root Cause:** The database migration for Google Drive backup was never applied to production.

The OAuth error you see (`Error 400: invalid_request`) is a **secondary issue** that will be resolved after fixing the database.

---

## THE SOLUTION

Apply the database migration to add required tables and columns.

### Method 1: Automated Script (Recommended)

**On your production server:**

```bash
# SSH into your production server
ssh root@askarieex

# Navigate to backend directory
cd /var/www/school-attendance/school-attendance/backend

# Make sure migration files are present
ls -la migrations/023_add_google_drive_backup_tables.sql
ls -la migrations/apply-google-drive-migration.sh

# Run the migration script
./migrations/apply-google-drive-migration.sh
```

The script will:
1. Load database credentials from `.env`
2. Test database connection
3. Check if migration is already applied
4. Apply the migration (with transaction safety)
5. Verify the changes

### Method 2: Manual SQL (Alternative)

If the script doesn't work, apply manually:

```bash
# SSH into server
ssh root@askarieex

# Connect to PostgreSQL
psql -U postgres -d school_attendance

# Copy and paste the SQL below:
```

```sql
BEGIN;

-- Add Google Drive columns to school_settings
ALTER TABLE school_settings
ADD COLUMN IF NOT EXISTS google_drive_refresh_token TEXT DEFAULT NULL;

ALTER TABLE school_settings
ADD COLUMN IF NOT EXISTS google_drive_access_token TEXT DEFAULT NULL;

ALTER TABLE school_settings
ADD COLUMN IF NOT EXISTS google_drive_connected BOOLEAN DEFAULT FALSE;

-- Create backup_logs table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_backup_logs_school_id ON backup_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_backup_logs_created_at ON backup_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_logs_school_date ON backup_logs(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_logs_status ON backup_logs(status);

COMMIT;
```

Then verify:
```sql
-- Check columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'school_settings'
AND column_name LIKE 'google_drive%';

-- Check table
\d backup_logs
```

---

## AFTER MIGRATION

### Step 1: Restart Backend
```bash
pm2 restart school-attendance-api
```

### Step 2: Verify Logs
```bash
pm2 logs school-attendance-api --lines 50
```

You should **NO longer see** these errors:
- ❌ `relation "backup_logs" does not exist`
- ❌ `column "google_drive_connected" does not exist`

### Step 3: Test Google Drive Connection

1. Go to: **https://admin.adtenz.site/backup**
2. Click "**Connect Google Drive**" button
3. You may still see OAuth error (different issue - see below)

---

## FIXING THE OAUTH ERROR (After Database Migration)

Once the database is fixed, you'll still see:
```
Error 400: invalid_request
Missing required parameter: redirect_uri
```

This is because the **Google Cloud Console** redirect URI doesn't match.

### Quick Fix:

**Option A: Test on Production (Works Immediately)**
- Your production URL is already configured in Google Cloud
- Just use: **https://admin.adtenz.site/backup** ✅

**Option B: Add Localhost to Google Cloud Console**

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find OAuth Client: `898917278217-ottlqv2rsqsr8efre6ufdarmsp2ul01s`
3. Click Edit
4. Under "Authorized redirect URIs", add:
   ```
   https://admin.adtenz.site/api/v1/school/backup/google-drive/callback
   ```
5. Save and wait 5 minutes

---

## COMPLETE CHECKLIST

- [ ] **Step 1:** Apply database migration (Method 1 or 2)
- [ ] **Step 2:** Restart PM2: `pm2 restart school-attendance-api`
- [ ] **Step 3:** Check logs: `pm2 logs --lines 50`
- [ ] **Step 4:** Verify no more database errors
- [ ] **Step 5:** Test at: https://admin.adtenz.site/backup
- [ ] **Step 6:** Click "Connect Google Drive"
- [ ] **Step 7:** Authorize with Google account
- [ ] **Step 8:** See "Connected ✅" status
- [ ] **Step 9:** Test "Backup Now" button
- [ ] **Step 10:** Check Google Drive for backup file

---

## WHAT THE MIGRATION ADDS

### 1. New Columns in `school_settings`:
- `google_drive_refresh_token` (TEXT) - OAuth refresh token (never expires)
- `google_drive_access_token` (TEXT) - OAuth access token (expires 1h)
- `google_drive_connected` (BOOLEAN) - Connection status

### 2. New Table `backup_logs`:
- `id` (SERIAL PRIMARY KEY)
- `school_id` (INTEGER) - FK to schools
- `backup_file` (VARCHAR) - Filename
- `cloud_provider` (VARCHAR) - 'google_drive'
- `file_size` (BIGINT) - Size in bytes
- `status` (VARCHAR) - 'success', 'failed', 'pending'
- `error_message` (TEXT) - Error details if failed
- `cloud_file_id` (VARCHAR) - Google Drive file ID
- `created_at` (TIMESTAMP) - Upload timestamp

### 3. Indexes for Performance:
- `idx_backup_logs_school_id` - Query by school
- `idx_backup_logs_created_at` - Recent backups
- `idx_backup_logs_school_date` - School + date composite
- `idx_backup_logs_status` - Filter by status

---

## TROUBLESHOOTING

### Issue: "Migration already applied"
**Solution:** The script will detect this and ask for confirmation. It's safe to re-run.

### Issue: "Permission denied"
**Solution:**
```bash
chmod +x migrations/apply-google-drive-migration.sh
```

### Issue: "psql: command not found"
**Solution:** Install PostgreSQL client:
```bash
apt-get install postgresql-client
```

### Issue: "Connection refused"
**Solution:** Check database credentials in `.env` file.

---

## VERIFICATION QUERIES

After migration, verify everything is correct:

```sql
-- 1. Check school_settings columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'school_settings'
AND column_name LIKE 'google_drive%';

-- Expected output:
-- google_drive_access_token   | text    | YES
-- google_drive_connected      | boolean | YES
-- google_drive_refresh_token  | text    | YES

-- 2. Check backup_logs table structure
\d backup_logs

-- Expected: Table with all columns listed above

-- 3. Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'backup_logs';

-- Expected: 4 indexes (id + 4 performance indexes)

-- 4. Test insert (dry run)
BEGIN;
INSERT INTO backup_logs (school_id, backup_file, status)
VALUES (1, 'test_backup.sql.gz', 'pending');
ROLLBACK;

-- Expected: Success (then rollback)
```

---

## FILES CREATED

1. **Migration File:**
   ```
   backend/migrations/023_add_google_drive_backup_tables.sql
   ```

2. **Migration Script:**
   ```
   backend/migrations/apply-google-drive-migration.sh
   ```

3. **This Documentation:**
   ```
   GOOGLE_DRIVE_MIGRATION_FIX.md
   ```

---

## NEXT STEPS (After Migration Works)

1. **Test full backup flow:**
   - Connect Google Drive
   - Upload backup manually
   - Verify file in Google Drive
   - Check backup_logs table

2. **Setup automatic backups:**
   - Create cron job for daily backups at 2 AM
   - Test backup script: `./backend/scripts/backups/backup-database.sh school 1`

3. **Monitor backup logs:**
   ```sql
   SELECT * FROM backup_logs ORDER BY created_at DESC LIMIT 10;
   ```

---

**Last Updated:** March 10, 2026
**Status:** ✅ Ready to Apply
**Estimated Time:** 5 minutes
**Risk Level:** Low (transaction-safe, rollback supported)

---

*Need help? The migration script has built-in safety checks and will rollback on any error.*
