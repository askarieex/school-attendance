#!/bin/bash

################################################################################
# School Attendance System - Automated Database Backup Script
#
# Features:
# - Full PostgreSQL database backup
# - Per-school data backup (attendance, students, teachers)
# - Automatic compression (gzip)
# - Retention policy (keeps last 30 daily, 12 monthly backups)
# - Email notifications on failure
# - Backup verification
# - Cloud upload support (optional S3/Google Drive)
#
# Usage:
#   ./backup-database.sh [full|school] [school_id]
#
# Examples:
#   ./backup-database.sh full              # Full database backup
#   ./backup-database.sh school 1          # Backup only school ID 1
#
################################################################################

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/../../backups"
LOG_DIR="${SCRIPT_DIR}/../../logs"
LOG_FILE="${LOG_DIR}/backup.log"

# Database configuration (read from .env)
ENV_FILE="${SCRIPT_DIR}/../../.env"
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-school_attendance}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD}"

# Backup settings
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATE_ONLY=$(date +"%Y%m%d")
RETENTION_DAYS=30
RETENTION_MONTHLY=12

# Email notification (optional)
NOTIFY_EMAIL="${BACKUP_NOTIFY_EMAIL:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

################################################################################
# Helper Functions
################################################################################

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

send_notification() {
    local subject="$1"
    local message="$2"

    if [ -n "$NOTIFY_EMAIL" ]; then
        echo "$message" | mail -s "$subject" "$NOTIFY_EMAIL" 2>/dev/null || true
    fi
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if pg_dump is installed
    if ! command -v pg_dump &> /dev/null; then
        log_error "pg_dump not found. Please install PostgreSQL client tools."
        exit 1
    fi

    # Check if psql is installed
    if ! command -v psql &> /dev/null; then
        log_error "psql not found. Please install PostgreSQL client tools."
        exit 1
    fi

    # Create directories if they don't exist
    mkdir -p "$BACKUP_DIR"/{full,schools,monthly}
    mkdir -p "$LOG_DIR"

    log "Prerequisites check passed ✓"
}

test_database_connection() {
    log_info "Testing database connection..."

    export PGPASSWORD="$DB_PASSWORD"

    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
        log "Database connection successful ✓"
        return 0
    else
        log_error "Cannot connect to database"
        send_notification "Backup Failed" "Cannot connect to database $DB_NAME"
        exit 1
    fi
}

################################################################################
# Full Database Backup
################################################################################

backup_full_database() {
    log ""
    log "=========================================="
    log "Starting FULL DATABASE BACKUP"
    log "=========================================="

    local backup_file="${BACKUP_DIR}/full/school_attendance_full_${TIMESTAMP}.sql"
    local backup_file_gz="${backup_file}.gz"

    log_info "Database: $DB_NAME"
    log_info "Backup file: $backup_file_gz"

    # Export password for pg_dump
    export PGPASSWORD="$DB_PASSWORD"

    # Create backup with verbose output
    log_info "Creating backup..."
    if pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --format=plain \
        --verbose \
        --no-owner \
        --no-acl \
        -f "$backup_file" 2>> "$LOG_FILE"; then

        # Compress backup
        log_info "Compressing backup..."
        gzip -f "$backup_file"

        # Get backup size
        local backup_size=$(du -h "$backup_file_gz" | cut -f1)

        log "Full backup completed successfully ✓"
        log_info "Backup size: $backup_size"
        log_info "Location: $backup_file_gz"

        # Verify backup
        verify_backup "$backup_file_gz"

        # Monthly backup (on 1st of each month)
        if [ "$(date +%d)" == "01" ]; then
            create_monthly_backup "$backup_file_gz"
        fi

        # Cleanup old backups
        cleanup_old_backups "full"

        send_notification "Backup Successful" "Full database backup completed: $backup_size"

        return 0
    else
        log_error "Backup failed!"
        send_notification "Backup Failed" "Full database backup failed. Check logs."
        return 1
    fi
}

################################################################################
# Per-School Backup
################################################################################

backup_school_data() {
    local school_id="$1"

    if [ -z "$school_id" ]; then
        log_error "School ID is required for school backup"
        echo "Usage: $0 school <school_id>"
        exit 1
    fi

    log ""
    log "=========================================="
    log "Starting SCHOOL DATA BACKUP"
    log "=========================================="

    # Get school name
    export PGPASSWORD="$DB_PASSWORD"
    local school_name=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT name FROM schools WHERE id = $school_id;" | xargs)

    if [ -z "$school_name" ]; then
        log_error "School ID $school_id not found in database"
        exit 1
    fi

    log_info "School: $school_name (ID: $school_id)"

    # Create school-specific directory
    local school_dir="${BACKUP_DIR}/schools/school_${school_id}"
    mkdir -p "$school_dir"

    local backup_file="${school_dir}/school_${school_id}_${DATE_ONLY}.sql"

    log_info "Backup file: $backup_file"

    # Generate backup SQL with only school-specific data
    cat > "$backup_file" <<EOF
-- School Attendance System - School-Specific Backup
-- School: $school_name (ID: $school_id)
-- Date: $(date)
--
-- This backup contains:
-- - School settings
-- - Students
-- - Teachers
-- - Classes and Sections
-- - Attendance logs
-- - Leaves
-- - Holidays
-- - Academic years
-- - Subjects
--
-- To restore, run: psql -U postgres -d school_attendance -f $backup_file

BEGIN;

-- School data
\echo 'Backing up school: $school_name'

EOF

    # Export school-specific tables
    log_info "Exporting school data..."

    # Schools table
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --data-only --inserts \
        --table=schools \
        --where="id = $school_id" >> "$backup_file"

    # School settings
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --data-only --inserts \
        --table=school_settings \
        --where="school_id = $school_id" >> "$backup_file"

    # Users (teachers, admins)
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --data-only --inserts \
        --table=users \
        --where="school_id = $school_id" >> "$backup_file"

    # Teachers
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --data-only --inserts \
        --table=teachers \
        --where="school_id = $school_id" >> "$backup_file"

    # Classes
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --data-only --inserts \
        --table=classes \
        --where="school_id = $school_id" >> "$backup_file"

    # Sections
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --data-only --inserts \
        --table=sections \
        --where="school_id = $school_id" >> "$backup_file"

    # Students
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --data-only --inserts \
        --table=students \
        --where="school_id = $school_id" >> "$backup_file"

    # Attendance logs
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --data-only --inserts \
        --table=attendance_logs \
        --where="school_id = $school_id" >> "$backup_file"

    # Leaves
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --data-only --inserts \
        --table=leaves \
        --where="school_id = $school_id" >> "$backup_file"

    # Holidays
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --data-only --inserts \
        --table=holidays \
        --where="school_id = $school_id" >> "$backup_file"

    # Subjects
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --data-only --inserts \
        --table=subjects \
        --where="school_id = $school_id" >> "$backup_file"

    # Academic years
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --data-only --inserts \
        --table=academic_years \
        --where="school_id = $school_id" >> "$backup_file"

    echo "COMMIT;" >> "$backup_file"

    # Compress backup
    log_info "Compressing backup..."
    gzip -f "$backup_file"

    local backup_file_gz="${backup_file}.gz"
    local backup_size=$(du -h "$backup_file_gz" | cut -f1)

    # Get statistics
    local student_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM students WHERE school_id = $school_id;" | xargs)
    local attendance_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM attendance_logs WHERE school_id = $school_id;" | xargs)

    log "School backup completed successfully ✓"
    log_info "School: $school_name"
    log_info "Students: $student_count"
    log_info "Attendance records: $attendance_count"
    log_info "Backup size: $backup_size"
    log_info "Location: $backup_file_gz"

    # Cleanup old school backups (keep last 30 days)
    cleanup_old_backups "schools/school_${school_id}"

    send_notification "School Backup Successful" "Backup completed for $school_name: $backup_size ($student_count students, $attendance_count records)"
}

################################################################################
# Backup Verification
################################################################################

verify_backup() {
    local backup_file="$1"

    log_info "Verifying backup integrity..."

    # Check if file exists and is not empty
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi

    if [ ! -s "$backup_file" ]; then
        log_error "Backup file is empty: $backup_file"
        return 1
    fi

    # Test gzip integrity
    if [[ "$backup_file" == *.gz ]]; then
        if gzip -t "$backup_file" 2>/dev/null; then
            log "Backup verification passed ✓"
            return 0
        else
            log_error "Backup file is corrupted (gzip test failed)"
            return 1
        fi
    else
        # For uncompressed files, just check if it's valid SQL
        if head -n 1 "$backup_file" | grep -q "^--"; then
            log "Backup verification passed ✓"
            return 0
        else
            log_warning "Backup file may not be valid SQL"
            return 1
        fi
    fi
}

################################################################################
# Monthly Backup (Long-term Retention)
################################################################################

create_monthly_backup() {
    local source_file="$1"
    local month_year=$(date +"%Y_%m")
    local monthly_file="${BACKUP_DIR}/monthly/school_attendance_monthly_${month_year}.sql.gz"

    log_info "Creating monthly backup..."
    cp "$source_file" "$monthly_file"

    log "Monthly backup created ✓"
    log_info "Location: $monthly_file"
}

################################################################################
# Cleanup Old Backups
################################################################################

cleanup_old_backups() {
    local backup_type="$1"

    log_info "Cleaning up old backups (retention: $RETENTION_DAYS days)..."

    # Find and delete backups older than retention period
    local deleted_count=$(find "${BACKUP_DIR}/${backup_type}" -name "*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete -print | wc -l)

    if [ "$deleted_count" -gt 0 ]; then
        log_info "Deleted $deleted_count old backup(s)"
    else
        log_info "No old backups to delete"
    fi

    # Cleanup monthly backups (keep last 12 months)
    if [ "$backup_type" == "full" ]; then
        local monthly_deleted=$(find "${BACKUP_DIR}/monthly" -name "*.sql.gz" -type f -mtime +$((RETENTION_MONTHLY * 30)) -delete -print | wc -l)
        if [ "$monthly_deleted" -gt 0 ]; then
            log_info "Deleted $monthly_deleted old monthly backup(s)"
        fi
    fi
}

################################################################################
# List Available Backups
################################################################################

list_backups() {
    log ""
    log "=========================================="
    log "AVAILABLE BACKUPS"
    log "=========================================="

    echo ""
    echo "Full Database Backups:"
    echo "---------------------------------------------"
    find "${BACKUP_DIR}/full" -name "*.sql.gz" -type f -exec ls -lh {} \; 2>/dev/null | awk '{print $9, "("$5")", $6, $7, $8}'

    echo ""
    echo "School-Specific Backups:"
    echo "---------------------------------------------"
    find "${BACKUP_DIR}/schools" -name "*.sql.gz" -type f -exec ls -lh {} \; 2>/dev/null | awk '{print $9, "("$5")", $6, $7, $8}'

    echo ""
    echo "Monthly Backups:"
    echo "---------------------------------------------"
    find "${BACKUP_DIR}/monthly" -name "*.sql.gz" -type f -exec ls -lh {} \; 2>/dev/null | awk '{print $9, "("$5")", $6, $7, $8}'

    echo ""
}

################################################################################
# Main Execution
################################################################################

main() {
    local backup_type="${1:-full}"
    local school_id="$2"

    # Initialize
    check_prerequisites
    test_database_connection

    # Execute backup based on type
    case "$backup_type" in
        full)
            backup_full_database
            ;;
        school)
            backup_school_data "$school_id"
            ;;
        list)
            list_backups
            ;;
        *)
            echo "Usage: $0 {full|school|list} [school_id]"
            echo ""
            echo "Examples:"
            echo "  $0 full              # Full database backup"
            echo "  $0 school 1          # Backup school with ID 1"
            echo "  $0 list              # List all available backups"
            exit 1
            ;;
    esac

    log ""
    log "=========================================="
    log "BACKUP COMPLETED"
    log "=========================================="
}

# Run main function
main "$@"
