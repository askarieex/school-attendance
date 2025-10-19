# Database Migrations

This directory contains SQL migration scripts for updating the database schema.

## How to Run Migrations

### Option 1: Using psql command line

```bash
# Connect to your database and run the migration
psql -U your_username -d school_attendance_db -f migrations/001_update_devices_to_serial_number.sql
```

### Option 2: Using your database client (pgAdmin, DBeaver, etc.)

1. Open your database client
2. Connect to the `school_attendance_db` database
3. Open the migration file: `001_update_devices_to_serial_number.sql`
4. Execute the SQL

### Option 3: From Node.js (recommended for automation)

```javascript
// Create a file: backend/scripts/runMigration.js
const { pool } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration(filename) {
  const sql = fs.readFileSync(
    path.join(__dirname, '../migrations', filename),
    'utf8'
  );

  try {
    await pool.query(sql);
    console.log(`✅ Migration ${filename} completed successfully`);
  } catch (error) {
    console.error(`❌ Migration ${filename} failed:`, error);
    throw error;
  }
}

runMigration('001_update_devices_to_serial_number.sql')
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
```

Then run:
```bash
node backend/scripts/runMigration.js
```

## Migration History

### 001_update_devices_to_serial_number.sql
**Date:** 2025-10-12
**Purpose:** Change device authentication from generated API keys to physical serial numbers from ZKTeco hardware
**Changes:**
- Added `serial_number` column to devices table
- Migrated existing `api_key` values to `serial_number` for backward compatibility
- Added unique constraint and index on `serial_number`
- Updated authentication logic to use serial numbers

**Impact:**
- Existing devices will continue to work (api_key copied to serial_number)
- New devices must be registered with their physical serial number
- More secure: ties physical hardware to database records

## Important Notes

1. **Always backup your database before running migrations**
2. Migrations should be run in order (001, 002, 003, etc.)
3. Test migrations on a development database first
4. Existing devices will continue to work after this migration
