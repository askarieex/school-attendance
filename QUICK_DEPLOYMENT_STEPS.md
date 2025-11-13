# 🚀 QUICK DEPLOYMENT STEPS - School Attendance Backend
## Server: 165.22.214.208 (DigitalOcean Ubuntu 25.10)

**Your server is ready! Follow these steps exactly:**

---

## ✅ STATUS CHECK (Already Done)
- ✅ Node.js v20.19.5 installed
- ✅ npm v10.8.2 installed
- ✅ PM2 installed
- ✅ PostgreSQL 17 installed
- ✅ Nginx installed
- ✅ Git installed

---

## 🗄️ STEP 1: SETUP DATABASE (5 minutes)

### 1.1. Create Database and User
```bash
# Switch to postgres user and create database
sudo -u postgres psql
```

**In PostgreSQL prompt, copy-paste these commands ONE BY ONE:**

```sql
-- Create database
CREATE DATABASE school_attendance;

-- Create user with strong password (CHANGE THIS PASSWORD!)
CREATE USER school_admin WITH ENCRYPTED PASSWORD 'SecurePassword123!@#';

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE school_attendance TO school_admin;

-- Connect to the database
\c school_attendance

-- Grant schema privileges (PostgreSQL 15+)
GRANT ALL ON SCHEMA public TO school_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO school_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO school_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO school_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO school_admin;

-- Exit PostgreSQL
\q
```

### 1.2. Test Database Connection
```bash
# Test if you can connect
psql -h localhost -U school_admin -d school_attendance

# Type password when prompted: SecurePassword123!@#
# If connected successfully, type: \q to exit
```

**If you see `school_attendance=#`, SUCCESS! Type `\q` to exit.**

---

## 📂 STEP 2: UPLOAD BACKEND CODE (3 options - choose one)

### **Option A: Direct SCP Upload (Fastest - 2 minutes)**

**On your Mac (open NEW terminal):**
```bash
cd /Users/askerymalik/Documents/Development/school-attendance-sysytem

# Upload backend folder
scp -r backend root@165.22.214.208:/tmp/

# Upload migrations separately to ensure they're included
scp -r backend/migrations root@165.22.214.208:/tmp/backend/
```

**Back on server SSH terminal:**
```bash
# Create app directory
mkdir -p /var/www/school-attendance

# Move backend to app directory
mv /tmp/backend /var/www/school-attendance/

# Verify files are there
ls -la /var/www/school-attendance/backend/
ls -la /var/www/school-attendance/backend/migrations/
```

---

### **Option B: Using Git (Recommended for production - 5 minutes)**

**On your Mac:**
```bash
cd /Users/askerymalik/Documents/Development/school-attendance-sysytem

# Initialize git (if not done)
git init
git add .
git commit -m "Production deployment"

# Create GitHub repository
# Go to https://github.com/new
# Repository name: school-attendance-system
# Private or Public: Your choice
# Don't initialize with README

# After creating, run:
git remote add origin https://github.com/YOUR_USERNAME/school-attendance-system.git
git branch -M main
git push -u origin main
```

**On server:**
```bash
# Clone repository
mkdir -p /var/www/school-attendance
cd /var/www/school-attendance
git clone https://github.com/YOUR_USERNAME/school-attendance-system.git .

# If private repo, use personal access token:
# git clone https://YOUR_TOKEN@github.com/YOUR_USERNAME/school-attendance-system.git .
```

---

### **Option C: Direct rsync (Alternative - 2 minutes)**

**On your Mac:**
```bash
cd /Users/askerymalik/Documents/Development/school-attendance-sysytem

# Sync backend folder
rsync -avz --progress backend/ root@165.22.214.208:/var/www/school-attendance/backend/
```

---

## ⚙️ STEP 3: CONFIGURE ENVIRONMENT (3 minutes)

```bash
# Go to backend directory
cd /var/www/school-attendance/backend

# Create .env file
nano .env
```

**Copy-paste this ENTIRE configuration:**

```env
# ========================================
# PRODUCTION ENVIRONMENT CONFIGURATION
# School Attendance System
# ========================================

# Server Configuration
NODE_ENV=production
PORT=5000
API_VERSION=v1

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=school_attendance
DB_USER=school_admin
DB_PASSWORD=SecurePassword123!@#
DB_POOL_MAX=100
DB_POOL_MIN=10

# JWT Configuration (MUST GENERATE STRONG SECRET - SEE BELOW)
JWT_SECRET=REPLACE_THIS_WITH_STRONG_SECRET_RUN_COMMAND_BELOW
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS Configuration (Add your domain later)
ALLOWED_ORIGINS=http://165.22.214.208,http://localhost:3000,http://localhost:3001

# Twilio SMS/WhatsApp Configuration
# Get from: https://www.twilio.com/console
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=+1234567890

# Optional: Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Optional: Error Tracking (Sentry)
SENTRY_DSN=your_sentry_dsn_here
```

**Save file:**
- Press `Ctrl + X`
- Press `Y` (yes to save)
- Press `Enter` (confirm filename)

### 3.1. Generate Strong JWT Secret

```bash
# Generate secure JWT secret
openssl rand -base64 64

# Copy the output (looks like: aB3dEf7gH9jKl2mNpQr5sTu8vWx1yZ4...)
```

**Now edit .env again and replace JWT_SECRET:**
```bash
nano .env

# Find line: JWT_SECRET=REPLACE_THIS...
# Replace with the generated secret
# Save: Ctrl+X, Y, Enter
```

### 3.2. Secure .env File
```bash
# Make .env readable only by root
chmod 600 .env

# Verify permissions
ls -la .env
# Should show: -rw------- 1 root root
```

---

## 📦 STEP 4: INSTALL DEPENDENCIES (3 minutes)

```bash
cd /var/www/school-attendance/backend

# Install all npm packages
npm install --production

# This will take 2-3 minutes
# You should see: "added XXX packages in Xs"
```

---

## 🗃️ STEP 5: RUN DATABASE MIGRATIONS (5 minutes)

### 5.1. Check Available Migrations
```bash
cd /var/www/school-attendance/backend

# List all migration files
ls -la migrations/

# You should see files like:
# 001_update_devices_to_serial_number.sql
# 002_add_platform_settings.sql
# ...
# 015_fix_attendance_logs_academic_year.sql
```

### 5.2. Run Initial Schema Migration
```bash
# Find the main schema file (usually 000_initial_schema.sql or similar)
# If you have it, run:
psql -h localhost -U school_admin -d school_attendance -f migrations/000_initial_schema.sql
# Enter password when prompted: SecurePassword123!@#
```

### 5.3. Run All Migrations Automatically
```bash
# Create a script to run all migrations
cat > run_migrations.sh << 'EOF'
#!/bin/bash
echo "Running database migrations..."

# Set database password to avoid prompts
export PGPASSWORD='SecurePassword123!@#'

# Run each migration file in order
for file in migrations/*.sql; do
  if [ -f "$file" ]; then
    echo "Running migration: $file"
    psql -h localhost -U school_admin -d school_attendance -f "$file"

    if [ $? -eq 0 ]; then
      echo "✅ Success: $file"
    else
      echo "❌ Failed: $file"
      exit 1
    fi
  fi
done

echo "✅ All migrations completed successfully!"
EOF

# Make script executable
chmod +x run_migrations.sh

# Run migrations
./run_migrations.sh
```

### 5.4. Verify Database Schema
```bash
# Connect to database
psql -h localhost -U school_admin -d school_attendance

# List all tables
\dt

# You should see these tables:
# - schools
# - users
# - students
# - attendance_logs
# - devices
# - device_commands
# - device_user_mappings
# - academic_years
# - classes
# - sections
# - teachers
# - holidays
# - leaves
# - whatsapp_logs
# - school_settings
# - platform_settings

# Exit
\q
```

**If you see those tables, ✅ MIGRATIONS SUCCESS!**

---

## 🚀 STEP 6: START BACKEND WITH PM2 (2 minutes)

### 6.1. Start Application
```bash
cd /var/www/school-attendance/backend

# Start backend with PM2
pm2 start src/server.js --name school-attendance-api

# View logs (wait 5 seconds)
pm2 logs school-attendance-api
```

**You should see:**
```
✅ Database connection successful
✅ JWT_SECRET validated successfully
   Length: 88 characters ✅
   Strength: Strong 🔒
🚀 Server is running on port 5000
📍 Environment: production
🔍 Starting Automatic Absence Detection Service...
✅ Auto-absence detection service started
```

**If you see these messages, ✅ BACKEND STARTED SUCCESSFULLY!**

Press `Ctrl + C` to stop viewing logs.

### 6.2. Check PM2 Status
```bash
# Check if app is running
pm2 status

# Should show:
# ┌─────┬────────────────────────┬─────────┬─────────┬─────────┐
# │ id  │ name                   │ status  │ restart │ uptime  │
# ├─────┼────────────────────────┼─────────┼─────────┼─────────┤
# │ 0   │ school-attendance-api  │ online  │ 0       │ 10s     │
# └─────┴────────────────────────┴─────────┴─────────┴─────────┘
```

### 6.3. Configure Auto-Start on Reboot
```bash
# Save PM2 process list
pm2 save

# Generate startup script
pm2 startup

# Copy and run the command it shows (looks like):
# sudo env PATH=$PATH:/root/.nvm/versions/node/v20.19.5/bin pm2 startup systemd -u root --hp /root

# Paste and run that command
```

### 6.4. Test Auto-Restart
```bash
# Restart server to test
reboot

# Wait 1 minute, then SSH back in
ssh root@165.22.214.208

# Check if app auto-started
pm2 status

# Should show school-attendance-api as "online"
```

---

## 🌐 STEP 7: CONFIGURE NGINX REVERSE PROXY (3 minutes)

### 7.1. Remove Default Nginx Config
```bash
rm /etc/nginx/sites-enabled/default
```

### 7.2. Create School Attendance Config
```bash
nano /etc/nginx/sites-available/school-attendance
```

**Copy-paste this ENTIRE Nginx configuration:**

```nginx
# School Attendance API - Nginx Configuration
# Backend API Server

upstream backend_api {
    server localhost:5000;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name 165.22.214.208;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Client max body size (for file uploads)
    client_max_body_size 10M;

    # API endpoints
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

        # Caching
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }

    # Device endpoints (ZKTeco RFID devices)
    location /iclock/ {
        proxy_pass http://backend_api;
        proxy_http_version 1.1;

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # Longer timeouts for device communication
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;

        # Disable buffering for real-time device data
        proxy_buffering off;
    }

    # WebSocket support (Socket.io for real-time updates)
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

        # WebSocket timeouts
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Serve uploaded student photos
    location /uploads/ {
        alias /var/www/school-attendance/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location / {
        proxy_pass http://backend_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Error pages
    error_page 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

**Save file:**
- Press `Ctrl + X`
- Press `Y`
- Press `Enter`

### 7.3. Enable Site Configuration
```bash
# Create symbolic link to enable site
ln -s /etc/nginx/sites-available/school-attendance /etc/nginx/sites-enabled/

# Test Nginx configuration
nginx -t

# Should show:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 7.4. Restart Nginx
```bash
# Reload Nginx
systemctl reload nginx

# Check Nginx status
systemctl status nginx

# Should show: active (running)
```

---

## 🔥 STEP 8: CONFIGURE FIREWALL (2 minutes)

```bash
# Allow SSH (important - don't lock yourself out!)
ufw allow OpenSSH

# Allow HTTP (port 80)
ufw allow 80/tcp

# Allow HTTPS (port 443) - for future SSL
ufw allow 443/tcp

# Enable firewall
ufw enable

# Type 'y' when prompted

# Check firewall status
ufw status

# Should show:
# Status: active
# To                         Action      From
# --                         ------      ----
# OpenSSH                    ALLOW       Anywhere
# 80/tcp                     ALLOW       Anywhere
# 443/tcp                    ALLOW       Anywhere
```

---

## ✅ STEP 9: TEST DEPLOYMENT (5 minutes)

### 9.1. Test Backend API

**On server:**
```bash
# Test health endpoint
curl http://localhost:5000/

# Should return JSON:
# {"success":true,"message":"School Attendance API is running","version":"v1","timestamp":"..."}
```

**On your Mac browser, open:**
```
http://165.22.214.208/
```

**You should see:**
```json
{
  "success": true,
  "message": "School Attendance API is running",
  "version": "v1",
  "timestamp": "2025-11-13T16:30:00.000Z"
}
```

### 9.2. Test API Endpoint

**On server:**
```bash
# Test login endpoint (should return error - no users yet)
curl -X POST http://165.22.214.208/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'

# Should return:
# {"success":false,"error":"Invalid email or password"}
```

**If you see that error, ✅ API IS WORKING!** (Error is expected - no users created yet)

### 9.3. Check PM2 Logs
```bash
# View backend logs
pm2 logs school-attendance-api --lines 50

# Should NOT show any errors
# Press Ctrl+C to exit
```

---

## 👤 STEP 10: CREATE SUPER ADMIN USER (5 minutes)

### 10.1. Generate Password Hash

**On server:**
```bash
# Create a simple script to generate password hash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('Admin@123', 10));"

# Copy the output (looks like: $2a$10$abcdefghijklmnopqrstuvwxyz...)
```

### 10.2. Insert Super Admin User
```bash
# Connect to database
psql -h localhost -U school_admin -d school_attendance
```

**In PostgreSQL, run this (replace HASH with your copied hash):**

```sql
-- Create super admin user
INSERT INTO users (
  email,
  password,
  role,
  is_active,
  created_at,
  updated_at
) VALUES (
  'admin@schoolattendance.com',
  '$2a$10$YOUR_GENERATED_HASH_HERE',
  'superadmin',
  true,
  NOW(),
  NOW()
);

-- Verify user created
SELECT id, email, role FROM users WHERE role = 'superadmin';

-- Should show:
-- id | email                        | role
-- ----+-----------------------------+------------
--  1 | admin@schoolattendance.com  | superadmin

-- Exit
\q
```

### 10.3. Test Login

**On your Mac, test login:**
```bash
curl -X POST http://165.22.214.208/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@schoolattendance.com",
    "password": "Admin@123"
  }'
```

**Should return JWT token:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "admin@schoolattendance.com",
      "role": "superadmin"
    }
  }
}
```

**If you see JWT token, 🎉 LOGIN WORKS!**

---

## 📊 STEP 11: SETUP MONITORING & BACKUPS (5 minutes)

### 11.1. Database Backup Script
```bash
# Create backup directory
mkdir -p /var/backups/school-attendance

# Create backup script
nano /usr/local/bin/backup-db.sh
```

**Copy-paste this script:**

```bash
#!/bin/bash
# School Attendance Database Backup Script

BACKUP_DIR="/var/backups/school-attendance"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="school_attendance_$DATE.sql"

# Database credentials
export PGPASSWORD='SecurePassword123!@#'

# Create backup
echo "Creating backup: $FILENAME"
pg_dump -h localhost -U school_admin -d school_attendance > "$BACKUP_DIR/$FILENAME"

# Compress backup
echo "Compressing backup..."
gzip "$BACKUP_DIR/$FILENAME"

# Delete backups older than 7 days
echo "Cleaning old backups (>7 days)..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

# Report
BACKUP_SIZE=$(du -h "$BACKUP_DIR/$FILENAME.gz" | cut -f1)
echo "✅ Backup completed: $FILENAME.gz ($BACKUP_SIZE)"
```

**Save and make executable:**
```bash
# Save: Ctrl+X, Y, Enter

# Make executable
chmod +x /usr/local/bin/backup-db.sh

# Test backup
/usr/local/bin/backup-db.sh

# Should show: ✅ Backup completed: school_attendance_XXXXXXXX_XXXXXX.sql.gz
```

### 11.2. Schedule Daily Backups
```bash
# Edit crontab
crontab -e

# Select nano editor (usually option 1)
```

**Add this line at the end:**
```
# Daily database backup at 2 AM
0 2 * * * /usr/local/bin/backup-db.sh >> /var/log/db-backup.log 2>&1
```

**Save:** `Ctrl+X`, `Y`, `Enter`

### 11.3. PM2 Log Rotation
```bash
# Install PM2 log rotate module
pm2 install pm2-logrotate

# Configure log rotation (max 10MB per file, keep 7 days)
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

---

## 🎯 FINAL VERIFICATION CHECKLIST

Run these commands to verify everything:

```bash
# 1. Check PM2 status
pm2 status
# Should show: school-attendance-api - online

# 2. Check backend logs (no errors)
pm2 logs school-attendance-api --lines 20

# 3. Check Nginx status
systemctl status nginx
# Should show: active (running)

# 4. Check PostgreSQL status
systemctl status postgresql
# Should show: active (running)

# 5. Check firewall
ufw status
# Should show ports 22, 80, 443 allowed

# 6. Test API health
curl http://localhost:5000/
# Should return: {"success":true,"message":"School Attendance API is running"...}

# 7. Test login
curl -X POST http://165.22.214.208/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@schoolattendance.com","password":"Admin@123"}'
# Should return JWT token
```

**If all checks pass: 🎉 DEPLOYMENT COMPLETE!**

---

## 🚀 YOUR BACKEND IS NOW LIVE!

### 📍 API Endpoints:
- **Health Check:** http://165.22.214.208/
- **API Base:** http://165.22.214.208/api/v1
- **Login:** http://165.22.214.208/api/v1/auth/login
- **Device Endpoint:** http://165.22.214.208/iclock

### 🔑 Super Admin Credentials:
- **Email:** admin@schoolattendance.com
- **Password:** Admin@123
- **Role:** superadmin

### 📱 Configure RFID Device:
- **Server IP:** 165.22.214.208
- **Port:** 80
- **Endpoint:** /iclock/cdata

---

## 📋 USEFUL COMMANDS

```bash
# PM2 Management
pm2 status                           # Check app status
pm2 logs                             # View all logs
pm2 logs school-attendance-api       # View specific app logs
pm2 restart school-attendance-api    # Restart app
pm2 stop school-attendance-api       # Stop app
pm2 delete school-attendance-api     # Remove app from PM2

# Database
psql -h localhost -U school_admin -d school_attendance  # Connect to DB
/usr/local/bin/backup-db.sh          # Manual backup

# Nginx
systemctl status nginx               # Check Nginx status
systemctl restart nginx              # Restart Nginx
nginx -t                             # Test Nginx config
tail -f /var/log/nginx/error.log     # View Nginx errors

# System Monitoring
htop                                 # CPU/Memory usage
df -h                                # Disk usage
free -m                              # Memory usage
pm2 monit                            # PM2 monitoring dashboard
```

---

## 🔧 TROUBLESHOOTING

### Backend not starting?
```bash
pm2 logs school-attendance-api
# Check for errors
```

### Database connection error?
```bash
psql -h localhost -U school_admin -d school_attendance
# Test connection manually
```

### Nginx 502 error?
```bash
# Check if backend is running
pm2 status

# Check Nginx logs
tail -f /var/log/nginx/error.log
```

---

## 📞 NEXT STEPS

1. **Deploy Frontend (React Admin Panel)**
   - Upload to `/var/www/school-attendance/frontend`
   - Configure Nginx to serve static files

2. **Setup Domain & SSL**
   - Point domain to 165.22.214.208
   - Install SSL certificate with `certbot`

3. **Configure Twilio**
   - Sign up at https://www.twilio.com
   - Update .env with real credentials
   - Test SMS sending

4. **Setup ZKTeco Device**
   - Configure device with server IP
   - Test RFID scan → attendance recording

---

## 🎉 CONGRATULATIONS!

Your School Attendance Backend is now **LIVE IN PRODUCTION!**

Server IP: **165.22.214.208**
Status: **✅ RUNNING**
Uptime: **Auto-restart enabled**
Backups: **Daily at 2 AM**

**🚀 You're ready to start using the system!**
