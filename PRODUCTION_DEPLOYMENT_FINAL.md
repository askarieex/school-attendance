# 🚀 PRODUCTION DEPLOYMENT - COMPLETE GUIDE
## School Attendance System - adtenz.site

**Last Updated**: November 18, 2025
**Production Domain**: `adtenz.site`
**Production IP**: To be verified
**Stack**: Node.js + PostgreSQL + React + Flutter

---

## ⚠️ CRITICAL SECURITY ISSUES TO FIX BEFORE DEPLOYMENT

### 🔴 **BLOCKER #1: Weak JWT Secret**
**Current**: `super_secret_jwt_key_for_development_only_change_in_production`
**Risk**: Anyone can forge JWT tokens and impersonate users
**Action Required**: Generate strong secret (see Step 3.1)

### 🔴 **BLOCKER #2: Exposed Twilio Credentials in Git**
**Current**: Real Twilio credentials committed to repository
**Risk**: Anyone with repo access can send SMS/WhatsApp on your account
**Files**: `backend/.env`
**Action Required**:
1. Revoke and regenerate Twilio credentials
2. Add `.env` to `.gitignore`
3. Never commit secrets again

### 🔴 **BLOCKER #3: Weak Database Password**
**Current**: `postgres` (default)
**Risk**: Database compromise, data theft
**Action Required**: Change to strong password (see Step 1.1)

### 🟡 **WARNING: Development Mode Enabled**
**Current**: `NODE_ENV=development` in production `.env`
**Risk**: Verbose error messages leak system internals
**Action Required**: Change to `NODE_ENV=production`

---

## 📋 PRE-DEPLOYMENT CHECKLIST

Before starting, ensure you have:

- [ ] **Server Access**: SSH credentials to production server
- [ ] **Domain**: `adtenz.site` DNS pointing to server IP
- [ ] **Server Requirements**:
  - Ubuntu 20.04+ or similar
  - Node.js 16+
  - PostgreSQL 13+
  - Nginx
  - PM2
  - Minimum 2GB RAM, 20GB disk
- [ ] **External Services**:
  - [ ] Twilio account (for SMS/WhatsApp)
  - [ ] SSL certificate (Let's Encrypt recommended)
- [ ] **Backups**: All local code committed to Git

---

## 🗂️ DEPLOYMENT ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT DEVICES                       │
│  - Flutter Mobile App (Teachers/Parents)               │
│  - React Admin Panel (Super Admin)                     │
│  - ZKTeco K40 Pro RFID Devices                        │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ HTTPS (443) / HTTP (80)
                 ↓
┌─────────────────────────────────────────────────────────┐
│              NGINX REVERSE PROXY                        │
│  - SSL Termination                                      │
│  - Load Balancing                                       │
│  - Static File Serving                                  │
│  - WebSocket Proxy                                      │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────┐
│         NODE.JS BACKEND (PM2 Managed)                   │
│  - Express API (Port 3001 internally)                   │
│  - WebSocket Server (Socket.io)                         │
│  - RFID Device Handler (ZKTeco PUSH)                   │
│  - Cron Jobs (Auto-absence detection)                  │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────┐
│            POSTGRESQL DATABASE                          │
│  - 15 Tables (schools, students, attendance, etc.)     │
│  - Connection Pool (max 100 connections)                │
│  - Daily Automated Backups                             │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 STEP-BY-STEP DEPLOYMENT

### **STEP 1: SERVER PREPARATION (10 minutes)**

#### 1.1. Connect to Server
```bash
# SSH to production server
ssh root@adtenz.site

# Or if using IP:
ssh root@YOUR_SERVER_IP

# Update system packages
apt update && apt upgrade -y
```

#### 1.2. Install Required Software
```bash
# Install Node.js 20 LTS (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show v10.x.x

# Install PostgreSQL 14+
apt install -y postgresql postgresql-contrib

# Install Nginx
apt install -y nginx

# Install PM2 globally
npm install -g pm2

# Install other utilities
apt install -y git curl ufw certbot python3-certbot-nginx
```

#### 1.3. Verify Installations
```bash
# Check all services
systemctl status postgresql  # Should be active
systemctl status nginx       # Should be active
node --version              # Should be v20+
pm2 --version               # Should be installed
```

---

### **STEP 2: DATABASE SETUP (15 minutes)**

#### 2.1. Secure PostgreSQL
```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt:
```

```sql
-- Change postgres user password
ALTER USER postgres WITH PASSWORD 'STRONG_PASSWORD_HERE_MIN_16_CHARS';

-- Create database
CREATE DATABASE school_attendance;

-- Create dedicated user with strong password
CREATE USER school_admin WITH ENCRYPTED PASSWORD 'ANOTHER_STRONG_PASSWORD_MIN_16_CHARS';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE school_attendance TO school_admin;

-- Connect to database
\c school_attendance

-- Grant schema privileges (PostgreSQL 15+)
GRANT ALL ON SCHEMA public TO school_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO school_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO school_admin;

-- Exit
\q
```

#### 2.2. Configure PostgreSQL for Production
```bash
# Edit PostgreSQL config
nano /etc/postgresql/*/main/postgresql.conf

# Find and update these settings:
```

```ini
# Memory settings (for 4GB RAM server)
shared_buffers = 1GB
effective_cache_size = 3GB
maintenance_work_mem = 256MB
work_mem = 16MB

# Connection settings
max_connections = 200

# Performance
random_page_cost = 1.1  # For SSD
effective_io_concurrency = 200
```

```bash
# Restart PostgreSQL
systemctl restart postgresql

# Verify it's running
systemctl status postgresql
```

#### 2.3. Test Database Connection
```bash
# Test connection
psql -h localhost -U school_admin -d school_attendance

# If successful, you'll see: school_attendance=#
# Type \q to exit
```

---

### **STEP 3: BACKEND DEPLOYMENT (20 minutes)**

#### 3.1. Upload Backend Code

**Option A: Git Clone (Recommended)**
```bash
# Create app directory
mkdir -p /var/www/school-attendance
cd /var/www/school-attendance

# Clone from GitHub
git clone https://github.com/YOUR_USERNAME/school-attendance-system.git .

# Or if private repo:
git clone https://YOUR_TOKEN@github.com/YOUR_USERNAME/school-attendance-system.git .
```

**Option B: SCP Upload from Mac**
```bash
# On your Mac terminal:
cd /Users/askerymalik/Documents/Development/school-attendance-sysytem

# Upload backend
scp -r backend root@adtenz.site:/var/www/school-attendance/

# Upload migrations
scp -r backend/migrations root@adtenz.site:/var/www/school-attendance/backend/
```

#### 3.2. Install Dependencies
```bash
cd /var/www/school-attendance/backend

# Install production dependencies only
npm install --production

# Should complete without errors
```

#### 3.3. Create Production Environment File
```bash
cd /var/www/school-attendance/backend
nano .env
```

**Copy this configuration (REPLACE ALL PLACEHOLDERS):**

```env
# ========================================
# PRODUCTION ENVIRONMENT - adtenz.site
# ========================================

# Server Configuration
NODE_ENV=production
PORT=3001
API_VERSION=v1

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=school_attendance
DB_USER=school_admin
DB_PASSWORD=YOUR_STRONG_DB_PASSWORD_FROM_STEP_2_1
DB_POOL_MAX=100
DB_POOL_MIN=10

# JWT Configuration - CRITICAL: GENERATE STRONG SECRETS
# Run: openssl rand -base64 64
JWT_SECRET=PASTE_GENERATED_SECRET_HERE_MINIMUM_64_CHARS
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=PASTE_DIFFERENT_SECRET_HERE_MINIMUM_64_CHARS
JWT_REFRESH_EXPIRES_IN=7d

# CORS Configuration
ALLOWED_ORIGINS=https://adtenz.site,https://www.adtenz.site,https://admin.adtenz.site

# Twilio SMS/WhatsApp Configuration
# IMPORTANT: Get NEW credentials from https://www.twilio.com/console
# DO NOT use the ones in your current .env file (they're exposed in Git)
TWILIO_ACCOUNT_SID=YOUR_NEW_TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=YOUR_NEW_TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER=+YOUR_TWILIO_PHONE_NUMBER
TWILIO_WHATSAPP_NUMBER=whatsapp:+YOUR_WHATSAPP_NUMBER

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info

# Error Tracking (Optional - Sentry)
# SENTRY_DSN=your_sentry_dsn_here
```

**Save:** `Ctrl+X`, `Y`, `Enter`

#### 3.4. Generate Strong JWT Secrets
```bash
# Generate JWT_SECRET
openssl rand -base64 64

# Copy output, edit .env, paste as JWT_SECRET

# Generate JWT_REFRESH_SECRET
openssl rand -base64 64

# Copy output, edit .env, paste as JWT_REFRESH_SECRET

# Edit .env and update both secrets
nano .env
```

#### 3.5. Secure Environment File
```bash
# Make .env readable only by owner
chmod 600 .env

# Verify permissions
ls -la .env
# Should show: -rw------- 1 root root

# Verify environment loads correctly
node -e "require('dotenv').config(); console.log('JWT_SECRET length:', process.env.JWT_SECRET.length);"
# Should show: JWT_SECRET length: 88 (or similar, >64)
```

---

### **STEP 4: DATABASE MIGRATIONS (10 minutes)**

#### 4.1. Run Initial Schema
```bash
cd /var/www/school-attendance/backend

# Run main migration script
npm run db:migrate

# This executes: node src/config/migrate.js
```

#### 4.2. Run Additional Migrations
```bash
# Set database password for batch operations
export PGPASSWORD='YOUR_DB_PASSWORD_FROM_STEP_2_1'

# Run all migration files in order
for file in migrations/*.sql; do
  echo "Running migration: $file"
  psql -h localhost -U school_admin -d school_attendance -f "$file"

  if [ $? -eq 0 ]; then
    echo "✅ Success: $file"
  else
    echo "❌ Failed: $file"
    echo "Check if migration was already applied or has errors"
  fi
done

# Unset password
unset PGPASSWORD
```

#### 4.3. Verify Database Schema
```bash
# Connect to database
psql -h localhost -U school_admin -d school_attendance

# List all tables
\dt

# Expected tables (15 total):
# - schools
# - users
# - students
# - teachers
# - classes
# - sections
# - academic_years
# - attendance_logs
# - devices
# - device_commands
# - holidays
# - leaves
# - subjects
# - school_settings
# - audit_logs

# Check for critical indexes
\di

# Exit
\q
```

**If you see all 15 tables, ✅ MIGRATIONS COMPLETE!**

---

### **STEP 5: START BACKEND WITH PM2 (5 minutes)**

#### 5.1. Start Application
```bash
cd /var/www/school-attendance/backend

# Start with PM2
pm2 start src/server.js --name school-attendance-api --instances 1 --max-memory-restart 1G

# View startup logs
pm2 logs school-attendance-api --lines 30
```

**You should see:**
```
✅ Database connection successful
🔐 Validating JWT_SECRET configuration...
✅ JWT_SECRET validated successfully
   Length: 88 characters ✅
   Strength: Strong 🔒
🚀 Server is running on port 3001
📍 Environment: production
🔍 Starting Automatic Absence Detection Service...
✅ Auto-absence detection service started
   Schedule: Daily at 11:00 AM (Monday-Saturday)
```

**Press `Ctrl+C` to stop viewing logs**

#### 5.2. Configure Auto-Restart
```bash
# Save PM2 process list
pm2 save

# Generate startup script
pm2 startup

# Copy and run the command it outputs
# It will look like:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root

# Test auto-restart
pm2 restart school-attendance-api

# Check status
pm2 status

# Should show: school-attendance-api │ online
```

#### 5.3. Configure PM2 Monitoring
```bash
# Install PM2 log rotation
pm2 install pm2-logrotate

# Configure log rotation (max 10MB per file, keep 30 days)
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'  # Daily at midnight

# Save configuration
pm2 save
```

---

### **STEP 6: NGINX CONFIGURATION (15 minutes)**

#### 6.1. Remove Default Config
```bash
rm /etc/nginx/sites-enabled/default
```

#### 6.2. Create Production Nginx Config
```bash
nano /etc/nginx/sites-available/school-attendance
```

**Copy this COMPLETE configuration:**

```nginx
# School Attendance System - Production Nginx Config
# Domain: adtenz.site

# Backend API upstream
upstream backend_api {
    server localhost:3001;
    keepalive 64;
}

# HTTP Server (Port 80) - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name adtenz.site www.adtenz.site;

    # Allow Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }

    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Server (Port 443) - Main configuration
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name adtenz.site www.adtenz.site;

    # SSL Certificate paths (Let's Encrypt)
    # These will be configured by certbot in Step 7
    ssl_certificate /etc/letsencrypt/live/adtenz.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/adtenz.site/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/adtenz.site/chain.pem;

    # SSL Configuration (Modern, Secure)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Client body size (for file uploads - student photos)
    client_max_body_size 10M;
    client_body_timeout 60s;

    # Logging
    access_log /var/log/nginx/school-attendance-access.log;
    error_log /var/log/nginx/school-attendance-error.log;

    # API Endpoints
    location /api/ {
        proxy_pass http://backend_api;
        proxy_http_version 1.1;

        # Headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffering
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
    }

    # RFID Device Endpoints (ZKTeco K40 Pro)
    location /iclock/ {
        proxy_pass http://backend_api;
        proxy_http_version 1.1;

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Longer timeouts for device communication
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;

        # Disable buffering
        proxy_buffering off;
        proxy_request_buffering off;

        # Increase buffer sizes for large device payloads
        proxy_buffer_size 16k;
        proxy_buffers 8 16k;
    }

    # WebSocket (Socket.io for real-time updates)
    location /socket.io/ {
        proxy_pass http://backend_api;
        proxy_http_version 1.1;

        # WebSocket headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Long timeouts for persistent connections
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_connect_timeout 60s;
    }

    # Serve uploaded student photos
    location /uploads/ {
        alias /var/www/school-attendance/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";

        # Security: Only allow image files
        location ~ \.(jpg|jpeg|png|gif|webp)$ {
            try_files $uri =404;
        }
    }

    # Health check endpoint
    location / {
        proxy_pass http://backend_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Error pages
    error_page 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

**Save:** `Ctrl+X`, `Y`, `Enter`

#### 6.3. Enable Site Configuration
```bash
# Create symbolic link
ln -s /etc/nginx/sites-available/school-attendance /etc/nginx/sites-enabled/

# Test Nginx configuration
nginx -t

# Should show:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

**⚠️ Note:** Nginx will show SSL errors until we configure Let's Encrypt in Step 7. This is expected.

---

### **STEP 7: SSL CERTIFICATE (Let's Encrypt) - (10 minutes)**

#### 7.1. Temporary HTTP-Only Config
First, comment out SSL lines in Nginx config to get certificate:

```bash
nano /etc/nginx/sites-available/school-attendance

# Comment out these lines (add # at start):
# ssl_certificate /etc/letsencrypt/live/adtenz.site/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/adtenz.site/privkey.pem;
# ssl_trusted_certificate /etc/letsencrypt/live/adtenz.site/chain.pem;

# Also comment out the HTTPS server block temporarily
# Add # before "server {" on line ~30 and before the closing "}" at the end

# Save: Ctrl+X, Y, Enter
```

```bash
# Reload Nginx
nginx -t && systemctl reload nginx
```

#### 7.2. Obtain SSL Certificate
```bash
# Create webroot directory for Let's Encrypt
mkdir -p /var/www/letsencrypt

# Obtain certificate (replace YOUR_EMAIL)
certbot certonly --webroot -w /var/www/letsencrypt \
  -d adtenz.site -d www.adtenz.site \
  --email YOUR_EMAIL@example.com \
  --agree-tos \
  --non-interactive

# Should show:
# Successfully received certificate.
# Certificate is saved at: /etc/letsencrypt/live/adtenz.site/fullchain.pem
```

#### 7.3. Restore Nginx SSL Config
```bash
nano /etc/nginx/sites-available/school-attendance

# Uncomment all SSL lines (remove # from start)
# Uncomment the HTTPS server block

# Save: Ctrl+X, Y, Enter
```

```bash
# Test configuration
nginx -t

# Should now pass without SSL errors

# Reload Nginx
systemctl reload nginx
```

#### 7.4. Configure Auto-Renewal
```bash
# Test renewal
certbot renew --dry-run

# Should show: Congratulations, all simulated renewals succeeded

# Certbot auto-renew is already configured via systemd timer
systemctl status certbot.timer

# Should show: active (waiting)
```

---

### **STEP 8: FIREWALL CONFIGURATION (5 minutes)**

```bash
# Allow SSH (CRITICAL - don't lock yourself out!)
ufw allow OpenSSH

# Allow HTTP
ufw allow 80/tcp

# Allow HTTPS
ufw allow 443/tcp

# Enable firewall
ufw enable

# Type 'y' when prompted

# Check status
ufw status verbose

# Should show:
# Status: active
# To                         Action      From
# --                         ------      ----
# OpenSSH                    ALLOW       Anywhere
# 80/tcp                     ALLOW       Anywhere
# 443/tcp                    ALLOW       Anywhere
```

---

### **STEP 9: CREATE SUPER ADMIN USER (5 minutes)**

#### 9.1. Generate Password Hash
```bash
cd /var/www/school-attendance/backend

# Generate bcrypt hash for password "Admin@2025"
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('Admin@2025', 10));"

# Copy the entire output (starts with $2a$ or $2b$)
```

#### 9.2. Insert Super Admin
```bash
# Connect to database
psql -h localhost -U school_admin -d school_attendance

# In PostgreSQL, run this (replace HASH_HERE with copied hash):
```

```sql
-- Create super admin
INSERT INTO users (
  email,
  password_hash,
  role,
  full_name,
  is_active,
  created_at,
  updated_at
) VALUES (
  'admin@adtenz.site',
  '$2a$10$YOUR_COPIED_HASH_HERE',
  'superadmin',
  'System Administrator',
  true,
  NOW(),
  NOW()
);

-- Verify creation
SELECT id, email, role, full_name FROM users WHERE role = 'superadmin';

-- Should show:
-- id |      email        | role       | full_name
-- ---+-------------------+------------+----------------------
--  1 | admin@adtenz.site | superadmin | System Administrator

-- Exit
\q
```

---

### **STEP 10: TESTING & VERIFICATION (10 minutes)**

#### 10.1. Test Backend Health
```bash
# Test from server
curl http://localhost:3001/

# Should return:
# {"success":true,"message":"School Attendance API is running","version":"v1",...}
```

**From your browser:**
```
https://adtenz.site/
```

**Should show same JSON response**

#### 10.2. Test Super Admin Login
```bash
# Test login API
curl -X POST https://adtenz.site/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@adtenz.site",
    "password": "Admin@2025"
  }'

# Should return JWT token:
# {
#   "success": true,
#   "data": {
#     "accessToken": "eyJhbGciOiJIUzI1NiIs...",
#     "refreshToken": "...",
#     "user": {
#       "id": 1,
#       "email": "admin@adtenz.site",
#       "role": "superadmin"
#     }
#   }
# }
```

**✅ If you see JWT token, LOGIN WORKS!**

#### 10.3. Test RFID Device Endpoint
```bash
# Test device handshake
curl "https://adtenz.site/iclock/cdata?SN=TEST123&options=all"

# Should return device configuration:
# GET OPTION FROM: TEST123
# Stamp=0
# OpStamp=0
# PhotoStamp=0
# TimeZone=330
# ...
```

#### 10.4. Monitor Logs
```bash
# View PM2 logs
pm2 logs school-attendance-api --lines 50

# View Nginx access log
tail -f /var/log/nginx/school-attendance-access.log

# View Nginx error log
tail -f /var/log/nginx/school-attendance-error.log

# Press Ctrl+C to stop
```

---

### **STEP 11: BACKUP CONFIGURATION (10 minutes)**

#### 11.1. Create Backup Directory
```bash
mkdir -p /var/backups/school-attendance
chmod 700 /var/backups/school-attendance
```

#### 11.2. Create Database Backup Script
```bash
nano /usr/local/bin/backup-school-attendance.sh
```

**Copy this script:**

```bash
#!/bin/bash
# School Attendance System - Automated Backup Script
# Backs up database and uploaded files

set -e  # Exit on error

# Configuration
BACKUP_DIR="/var/backups/school-attendance"
APP_DIR="/var/www/school-attendance"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30  # Keep backups for 30 days

# Database credentials (from .env)
DB_NAME="school_attendance"
DB_USER="school_admin"
DB_PASSWORD="YOUR_DB_PASSWORD_HERE"

# Export password for pg_dump
export PGPASSWORD="$DB_PASSWORD"

echo "========================================="
echo "School Attendance Backup - $DATE"
echo "========================================="

# Create timestamped backup directory
BACKUP_PATH="$BACKUP_DIR/$DATE"
mkdir -p "$BACKUP_PATH"

# 1. Backup Database
echo "1. Backing up database..."
pg_dump -h localhost -U "$DB_USER" -d "$DB_NAME" \
  --format=custom \
  --file="$BACKUP_PATH/database.dump"
echo "   ✅ Database backed up: $(du -h "$BACKUP_PATH/database.dump" | cut -f1)"

# 2. Backup uploaded files (student photos)
echo "2. Backing up uploaded files..."
if [ -d "$APP_DIR/backend/uploads" ]; then
  tar -czf "$BACKUP_PATH/uploads.tar.gz" -C "$APP_DIR/backend" uploads/
  echo "   ✅ Files backed up: $(du -h "$BACKUP_PATH/uploads.tar.gz" | cut -f1)"
else
  echo "   ⚠️  No uploads directory found"
fi

# 3. Backup configuration files
echo "3. Backing up configuration..."
cp "$APP_DIR/backend/.env" "$BACKUP_PATH/env.backup" 2>/dev/null || echo "   ⚠️  .env not found"
cp /etc/nginx/sites-available/school-attendance "$BACKUP_PATH/nginx.conf" 2>/dev/null || echo "   ⚠️  Nginx config not found"

# 4. Create backup metadata
cat > "$BACKUP_PATH/backup_info.txt" <<EOF
Backup Date: $(date)
Database: $DB_NAME
Database Size: $(du -h "$BACKUP_PATH/database.dump" | cut -f1)
Files Size: $(du -h "$BACKUP_PATH/uploads.tar.gz" | cut -f1 2>/dev/null || echo "N/A")
Server: $(hostname)
EOF

# 5. Cleanup old backups
echo "4. Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -maxdepth 1 -type d -name "20*" -mtime +$RETENTION_DAYS -exec rm -rf {} \;

# 6. Calculate total backup size
TOTAL_SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
BACKUP_COUNT=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "20*" | wc -l)

echo "========================================="
echo "✅ Backup completed successfully!"
echo "   Location: $BACKUP_PATH"
echo "   Size: $TOTAL_SIZE"
echo "   Total backups: $BACKUP_COUNT"
echo "========================================="

# Unset password
unset PGPASSWORD

# Optional: Upload to S3/remote storage
# aws s3 sync "$BACKUP_DIR" s3://your-bucket/school-attendance-backups/
```

**Save:** `Ctrl+X`, `Y`, `Enter`

```bash
# Make executable
chmod +x /usr/local/bin/backup-school-attendance.sh

# IMPORTANT: Update script with actual database password
nano /usr/local/bin/backup-school-attendance.sh
# Find: DB_PASSWORD="YOUR_DB_PASSWORD_HERE"
# Replace with actual password from Step 2.1
# Save: Ctrl+X, Y, Enter

# Test backup
/usr/local/bin/backup-school-attendance.sh

# Should show:
# ✅ Backup completed successfully!
```

#### 11.3. Schedule Automated Backups
```bash
# Edit crontab
crontab -e

# Select nano editor (usually option 1)
```

**Add these lines:**

```cron
# Daily database backup at 2:00 AM IST
0 2 * * * /usr/local/bin/backup-school-attendance.sh >> /var/log/backup-school-attendance.log 2>&1

# Weekly server reboot (optional - Sunday 3:00 AM)
# 0 3 * * 0 /sbin/reboot
```

**Save:** `Ctrl+X`, `Y`, `Enter`

#### 11.4. Verify Cron Job
```bash
# List cron jobs
crontab -l

# Should show the backup job

# Check if crond is running
systemctl status cron

# Should show: active (running)
```

---

### **STEP 12: MONITORING & ALERTS (10 minutes)**

#### 12.1. Configure PM2 Monitoring
```bash
# View PM2 dashboard
pm2 monit

# Press Ctrl+C to exit

# Setup PM2 Plus (optional - cloud monitoring)
# pm2 link YOUR_SECRET_KEY YOUR_PUBLIC_KEY
```

#### 12.2. Create Health Check Script
```bash
nano /usr/local/bin/health-check.sh
```

```bash
#!/bin/bash
# Health Check Script

API_URL="https://adtenz.site/"

# Check if API is responding
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL")

if [ "$HTTP_STATUS" != "200" ]; then
  echo "❌ API DOWN! HTTP Status: $HTTP_STATUS"

  # Restart PM2 app
  pm2 restart school-attendance-api

  # Log incident
  echo "$(date): API was down (HTTP $HTTP_STATUS), restarted" >> /var/log/health-check.log

  # Optional: Send alert email/SMS
  # mail -s "School Attendance API Down" admin@adtenz.site <<< "API returned HTTP $HTTP_STATUS"
else
  echo "✅ API is healthy (HTTP $HTTP_STATUS)"
fi
```

```bash
# Make executable
chmod +x /usr/local/bin/health-check.sh

# Test it
/usr/local/bin/health-check.sh

# Should show: ✅ API is healthy (HTTP 200)
```

#### 12.3. Schedule Health Checks
```bash
crontab -e

# Add this line:
```

```cron
# Health check every 5 minutes
*/5 * * * * /usr/local/bin/health-check.sh
```

---

### **STEP 13: PRODUCTION OPTIMIZATION (5 minutes)**

#### 13.1. Enable Nginx Gzip Compression
```bash
nano /etc/nginx/nginx.conf

# Find the "http" block and add/uncomment:
```

```nginx
http {
    # ... existing config ...

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/rss+xml font/truetype font/opentype
               application/vnd.ms-fontobject image/svg+xml;

    # ... rest of config ...
}
```

```bash
# Test and reload
nginx -t && systemctl reload nginx
```

#### 13.2. Configure System Limits
```bash
# Increase file descriptor limits
nano /etc/security/limits.conf

# Add at the end:
```

```
* soft nofile 65536
* hard nofile 65536
root soft nofile 65536
root hard nofile 65536
```

```bash
# Apply immediately
ulimit -n 65536

# Verify
ulimit -n
# Should show: 65536
```

#### 13.3. Configure Node.js Memory
```bash
# Update PM2 process with memory limit
pm2 delete school-attendance-api

pm2 start /var/www/school-attendance/backend/src/server.js \
  --name school-attendance-api \
  --instances 1 \
  --max-memory-restart 1G \
  --node-args="--max-old-space-size=2048"

pm2 save
```

---

## ✅ DEPLOYMENT COMPLETE!

### 🎉 YOUR PRODUCTION SYSTEM IS NOW LIVE!

**Production URLs:**
- **API Base**: https://adtenz.site/api/v1
- **Health Check**: https://adtenz.site/
- **Login**: https://adtenz.site/api/v1/auth/login
- **Device Endpoint**: https://adtenz.site/iclock/cdata

**Super Admin Credentials:**
- **Email**: admin@adtenz.site
- **Password**: Admin@2025
- **Role**: superadmin

**System Status:**
- ✅ Backend API running on PM2
- ✅ PostgreSQL database configured
- ✅ Nginx reverse proxy with SSL
- ✅ Firewall configured
- ✅ Daily backups at 2:00 AM
- ✅ Health checks every 5 minutes
- ✅ Auto-restart on reboot

---

## 📋 POST-DEPLOYMENT TASKS

### **IMMEDIATE (Required)**

1. **Change Super Admin Password**
   ```bash
   # Login to admin panel and change password from default
   ```

2. **Configure Twilio** (for SMS/WhatsApp)
   - Sign up at https://www.twilio.com
   - Get Account SID and Auth Token
   - Update backend/.env
   - Restart PM2: `pm2 restart school-attendance-api`

3. **Test Complete Workflow**
   - Create a school via super admin panel
   - Create a school admin user
   - Create students
   - Configure RFID device
   - Test attendance scan
   - Verify SMS/WhatsApp notifications

### **WITHIN 24 HOURS**

4. **Deploy Frontend Applications**
   - **Super Admin Panel** (React)
   - **Mobile App** (Flutter - build APK/IPA)

5. **Configure ZKTeco Devices**
   - Server: adtenz.site
   - Port: 443 (HTTPS) or 80 (HTTP)
   - See: `ZKTECO_K40_PRO_PRODUCTION_SETUP.md`

6. **Monitor First 24 Hours**
   - Check PM2 logs: `pm2 logs`
   - Check Nginx logs: `tail -f /var/log/nginx/*.log`
   - Check for errors

### **WITHIN 1 WEEK**

7. **Setup Remote Backups**
   - Upload backups to S3, Google Cloud Storage, or DigitalOcean Spaces
   - Test backup restoration

8. **Configure Error Tracking**
   - Sign up for Sentry.io
   - Add SENTRY_DSN to .env
   - Test error reporting

9. **Performance Monitoring**
   - Setup PM2 Plus: https://app.pm2.io
   - Monitor response times
   - Check database slow queries

10. **Security Hardening**
    - Install fail2ban: `apt install fail2ban`
    - Configure SSH key-only auth (disable password)
    - Setup CloudFlare (DDoS protection)

---

## 🔧 USEFUL PRODUCTION COMMANDS

### **PM2 Management**
```bash
pm2 status                          # Check app status
pm2 logs school-attendance-api      # View logs (live)
pm2 logs --lines 100                # View last 100 lines
pm2 restart school-attendance-api   # Restart app
pm2 reload school-attendance-api    # Zero-downtime reload
pm2 stop school-attendance-api      # Stop app
pm2 monit                           # Monitoring dashboard
```

### **Database Management**
```bash
# Connect to database
psql -h localhost -U school_admin -d school_attendance

# Manual backup
/usr/local/bin/backup-school-attendance.sh

# Restore from backup
pg_restore -h localhost -U school_admin -d school_attendance \
  /var/backups/school-attendance/BACKUP_FOLDER/database.dump
```

### **Nginx Management**
```bash
systemctl status nginx              # Check status
systemctl restart nginx             # Restart
systemctl reload nginx              # Reload config
nginx -t                            # Test config
tail -f /var/log/nginx/error.log    # View errors
```

### **System Monitoring**
```bash
htop                               # CPU/Memory (install: apt install htop)
df -h                              # Disk usage
free -m                            # Memory usage
du -sh /var/www/school-attendance  # App size
```

### **SSL Certificate**
```bash
certbot renew                      # Renew SSL certificate
certbot certificates               # List certificates
systemctl status certbot.timer     # Check auto-renewal
```

---

## 🚨 TROUBLESHOOTING

### **Backend not starting?**
```bash
# Check logs
pm2 logs school-attendance-api

# Common issues:
# - Database connection error → Check .env credentials
# - Port already in use → Check: lsof -i :3001
# - JWT_SECRET too weak → Generate new: openssl rand -base64 64
```

### **502 Bad Gateway?**
```bash
# Check if backend is running
pm2 status

# Check Nginx error log
tail -f /var/log/nginx/error.log

# Restart backend
pm2 restart school-attendance-api
```

### **SSL Certificate Errors?**
```bash
# Check certificate status
certbot certificates

# Renew manually
certbot renew --force-renewal

# Check Nginx SSL config
nginx -t
```

### **Database Connection Refused?**
```bash
# Check PostgreSQL status
systemctl status postgresql

# Check if listening
netstat -tuln | grep 5432

# Test connection
psql -h localhost -U school_admin -d school_attendance
```

### **RFID Device Not Connecting?**
```bash
# Check Nginx logs for /iclock/ requests
tail -f /var/log/nginx/access.log | grep iclock

# Check backend logs
pm2 logs school-attendance-api | grep iclock

# Verify device configuration:
# - Server: adtenz.site
# - Port: 443 (HTTPS) or 80 (HTTP)
# - Protocol: PUSH/ADMS
```

---

## 📞 SUPPORT & MAINTENANCE

### **Log Files Locations**
- PM2 Logs: `~/.pm2/logs/`
- Nginx Access: `/var/log/nginx/school-attendance-access.log`
- Nginx Error: `/var/log/nginx/school-attendance-error.log`
- PostgreSQL: `/var/log/postgresql/`
- Backups: `/var/backups/school-attendance/`
- Health Checks: `/var/log/health-check.log`

### **Configuration Files**
- Backend .env: `/var/www/school-attendance/backend/.env`
- Nginx: `/etc/nginx/sites-available/school-attendance`
- PostgreSQL: `/etc/postgresql/*/main/postgresql.conf`
- PM2 Startup: `/etc/systemd/system/pm2-root.service`

### **Backup Strategy**
- **Database**: Daily at 2:00 AM (automated)
- **Files**: Included in daily backup
- **Retention**: 30 days
- **Location**: `/var/backups/school-attendance/`
- **Remote**: Not configured (TODO: setup S3/GCS)

---

## 🎯 NEXT STEPS

1. ✅ Backend deployed and running
2. ⏳ Deploy Super Admin Panel (React)
3. ⏳ Build and distribute Mobile App (Flutter)
4. ⏳ Configure first school in system
5. ⏳ Setup RFID devices
6. ⏳ Train school administrators
7. ⏳ Go live with first school!

---

**Deployment Date**: November 18, 2025
**Deployed By**: System Administrator
**Version**: 1.0.0
**Status**: ✅ PRODUCTION READY

---

## 🔒 SECURITY REMINDER

**CRITICAL: After deployment, immediately:**
1. Change super admin password
2. Rotate Twilio credentials if exposed
3. Review all .env files for secrets
4. Add `.env` to `.gitignore` (already done)
5. Never commit secrets to Git again
6. Setup 2FA for SSH access
7. Configure fail2ban for brute-force protection

**Your system is now LIVE and serving real users. Monitor carefully!**
