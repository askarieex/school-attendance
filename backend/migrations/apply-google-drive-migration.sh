#!/bin/bash

################################################################################
# Apply Google Drive Backup Migration to Production Database
#
# This script applies migration 023 which adds:
# - Google Drive OAuth columns to school_settings
# - backup_logs table for tracking uploads
#
# Usage:
#   ./apply-google-drive-migration.sh
#
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================================${NC}"
echo -e "${BLUE}  Google Drive Backup Migration - Database Setup${NC}"
echo -e "${BLUE}======================================================================${NC}"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_FILE="${SCRIPT_DIR}/023_add_google_drive_backup_tables.sql"

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Error: Migration file not found at: $MIGRATION_FILE${NC}"
    exit 1
fi

# Load database credentials from .env
ENV_FILE="${SCRIPT_DIR}/../../.env"
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
    echo -e "${GREEN}✅ Loaded database credentials from .env${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: .env file not found, using defaults${NC}"
fi

# Database configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-school_attendance}"
DB_USER="${DB_USER:-postgres}"

# Display connection info (hide password)
echo ""
echo -e "${BLUE}Database Connection:${NC}"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Confirm before proceeding
echo -e "${YELLOW}This will modify the database structure.${NC}"
echo -e "${YELLOW}Press ENTER to continue, or Ctrl+C to cancel...${NC}"
read -r

# Set password for psql
export PGPASSWORD="$DB_PASSWORD"

# Test database connection
echo -e "${BLUE}🔍 Testing database connection...${NC}"
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Failed to connect to database${NC}"
    echo "Please check your database credentials in .env"
    exit 1
fi

# Check if migration has already been applied
echo ""
echo -e "${BLUE}🔍 Checking if migration is already applied...${NC}"

# Check if backup_logs table exists
TABLE_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'backup_logs');" | xargs)

if [ "$TABLE_EXISTS" = "t" ]; then
    echo -e "${YELLOW}⚠️  Migration appears to be already applied (backup_logs table exists)${NC}"
    echo -e "${YELLOW}Do you want to continue anyway? (y/N): ${NC}"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Migration cancelled.${NC}"
        exit 0
    fi
fi

# Apply migration
echo ""
echo -e "${BLUE}📦 Applying migration: 023_add_google_drive_backup_tables.sql${NC}"
echo ""

if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"; then
    echo ""
    echo -e "${GREEN}======================================================================${NC}"
    echo -e "${GREEN}✅ MIGRATION COMPLETED SUCCESSFULLY!${NC}"
    echo -e "${GREEN}======================================================================${NC}"

    # Verify migration
    echo ""
    echo -e "${BLUE}🔍 Verifying migration...${NC}"

    # Check columns
    echo -e "${BLUE}Checking school_settings columns:${NC}"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'school_settings'
        AND column_name LIKE 'google_drive%'
        ORDER BY column_name;
    "

    echo ""
    echo -e "${BLUE}Checking backup_logs table:${NC}"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\d backup_logs"

    echo ""
    echo -e "${GREEN}✅ Verification complete!${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Restart your backend server: pm2 restart school-attendance-api"
    echo "  2. Test Google Drive connection at: https://admin.adtenz.site/backup"
    echo "  3. Click 'Connect Google Drive' button"
    echo ""

else
    echo ""
    echo -e "${RED}======================================================================${NC}"
    echo -e "${RED}❌ MIGRATION FAILED${NC}"
    echo -e "${RED}======================================================================${NC}"
    echo ""
    echo -e "${RED}Please check the error message above.${NC}"
    echo -e "${RED}The transaction was rolled back - no changes were made.${NC}"
    exit 1
fi
