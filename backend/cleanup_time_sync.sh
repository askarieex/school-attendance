#!/bin/bash

# ⛔ Clean Up Time Sync Commands Script ⛔
# This script removes all pending time sync commands from the database

echo "🧹 Cleaning up pending time sync commands..."
echo ""

# Database credentials (update these if different)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-school_attendance_db}"
DB_USER="${DB_USER:-postgres}"

echo "📊 Database: $DB_NAME@$DB_HOST:$DB_PORT"
echo ""

# Check current pending commands
echo "📋 Current pending time sync commands:"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
    id, 
    device_id, 
    command_type, 
    status, 
    created_at
FROM device_commands 
WHERE command_type IN ('SET_TIME', 'set_time')
AND status IN ('pending', 'sent')
ORDER BY created_at DESC;
"

echo ""
echo "🗑️  Deleting pending time sync commands..."

# Delete pending commands
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
DELETE FROM device_commands 
WHERE command_type IN ('SET_TIME', 'set_time') 
AND status IN ('pending', 'sent');
"

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📊 Remaining time sync commands summary:"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
    command_type, 
    status, 
    COUNT(*) as count
FROM device_commands 
WHERE command_type IN ('SET_TIME', 'set_time')
GROUP BY command_type, status;
"

echo ""
echo "✅ All pending time sync commands have been removed!"
echo "🔒 Time sync is now permanently disabled"
echo "📝 Set device time manually through device menu"
