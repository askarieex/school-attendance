# 🚀 COMPLETE DEPLOYMENT GUIDE
## School Attendance System - DigitalOcean Production Deployment
**Server IP:** 165.22.214.208
**OS:** Ubuntu 25.10
**Date:** 2025-11-13

---

## 📋 DEPLOYMENT STEPS OVERVIEW

1. ✅ Server Security Setup (SSH, Firewall)
2. ✅ Install Required Software (Node.js, PostgreSQL, Nginx, PM2)
3. ✅ Setup PostgreSQL Database
4. ✅ Upload Backend Code
5. ✅ Configure Environment Variables
6. ✅ Run Database Migrations
7. ✅ Start Backend with PM2
8. ✅ Configure Nginx Reverse Proxy
9. ✅ Setup SSL Certificate (HTTPS)
10. ✅ Test Everything
11. ✅ Setup Monitoring & Backups

---

## 🔐 STEP 1: SERVER SECURITY SETUP

### 1.1. Update System (Do this NOW)
```bash
# SSH into your droplet
ssh root@165.22.214.208

# Update all packages (IMPORTANT!)
apt update && apt upgrade -y

# Reboot if kernel updated
reboot
```

**Wait 1 minute, then SSH again:**
```bash
ssh root@165.22.214.208
```

### 1.2. Create Non-Root User (SECURITY BEST PRACTICE)
```bash
# Create new user 'deploy'
adduser deploy

# When prompted:
# - Password: <create-strong-password>
# - Full Name: Deploy User
# - Rest: Just press Enter

# Add to sudo group
usermod -aG sudo deploy

# Test sudo access
su - deploy
sudo ls /root  # Enter deploy password, should work

# Exit back to root
exit
```

### 1.3. Setup SSH Key Authentication (Optional but recommended)
```bash
# On your LOCAL Mac (new terminal window):
cd ~/.ssh
ssh-keygen -t ed25519 -C "deploy@school-attendance"
# Save as: school_attendance_deploy
# Passphrase: <optional>

# Copy public key to server
ssh-copy-id -i ~/.ssh/school_attendance_deploy.pub deploy@165.22.214.208

# Test login (should not ask for password)
ssh -i ~/.ssh/school_attendance_deploy deploy@165.22.214.208
```

### 1.4. Configure Firewall
```bash
# SSH as root
ssh root@165.22.214.208

# Setup UFW firewall
ufw allow OpenSSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 5432/tcp  # PostgreSQL (only if you need external access)
ufw enable

# Check status
ufw status
```

---

## 📦 STEP 2: INSTALL REQUIRED SOFTWARE

### 2.1. Install Node.js 20 (LTS)
```bash
# Install NVM (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node -v  # Should show v20.x.x
npm -v   # Should show 10.x.x
```

### 2.2. Install PostgreSQL 16
```bash
# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Start PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Check status
systemctl status postgresql
```

### 2.3. Install PM2 (Process Manager)
```bash
npm install -g pm2

# Verify
pm2 -v
```

### 2.4. Install Nginx (Web Server)
```bash
apt install -y nginx

# Start Nginx
systemctl start nginx
systemctl enable nginx

# Check status
systemctl status nginx
```

### 2.5. Install Git
```bash
apt install -y git

# Verify
git --version
```

---

## 🗄️ STEP 3: SETUP POSTGRESQL DATABASE

### 3.1. Create Database and User
```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt, run:
CREATE DATABASE school_attendance;
CREATE USER school_admin WITH ENCRYPTED PASSWORD 'your_strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE school_attendance TO school_admin;

# Grant schema privileges (PostgreSQL 15+)
\c school_attendance
GRANT ALL ON SCHEMA public TO school_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO school_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO school_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO school_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO school_admin;

# Exit
\q
```

### 3.2. Test Connection
```bash
# Test connection from command line
psql -h localhost -U school_admin -d school_attendance
# Enter password when prompted

# If connected successfully, exit:
\q
```

### 3.3. Configure PostgreSQL for Remote Access (if needed)
```bash
# Edit postgresql.conf
nano /etc/postgresql/16/main/postgresql.conf

# Find and change:
listen_addresses = 'localhost'  # Change to '*' for all IPs or specific IP

# Edit pg_hba.conf
nano /etc/postgresql/16/main/pg_hba.conf

# Add this line (adjust IP range):
host    all             all             0.0.0.0/0               md5

# Restart PostgreSQL
systemctl restart postgresql
```

---

## 📂 STEP 4: UPLOAD BACKEND CODE

### Method 1: Using Git (Recommended)

#### 4.1. Push to GitHub (On your Mac)
```bash
# On your LOCAL Mac:
cd /Users/askerymalik/Documents/Development/school-attendance-sysytem

# Initialize git if not done
git init

# Add all files
git add .

# Commit
git commit -m "Initial production deployment"

# Create GitHub repo and push
# Go to github.com → Create new repository "school-attendance-system"
git remote add origin https://github.com/YOUR_USERNAME/school-attendance-system.git
git branch -M main
git push -u origin main
```

#### 4.2. Clone on Server
```bash
# SSH to server
ssh root@165.22.214.208

# Create app directory
mkdir -p /var/www/school-attendance
cd /var/www/school-attendance

# Clone repository
git clone https://github.com/YOUR_USERNAME/school-attendance-system.git .

# Or if private repo, use personal access token:
git clone https://YOUR_TOKEN@github.com/YOUR_USERNAME/school-attendance-system.git .
```

### Method 2: Using SCP (Direct Upload)

```bash
# On your LOCAL Mac:
cd /Users/askerymalik/Documents/Development/school-attendance-sysytem

# Upload backend folder
scp -r backend root@165.22.214.208:/var/www/school-attendance/

# Upload migrations
scp -r backend/migrations root@165.22.214.208:/var/www/school-attendance/backend/
```

---

## ⚙️ STEP 5: CONFIGURE ENVIRONMENT VARIABLES

### 5.1. Create Production .env File
```bash
# SSH to server
ssh root@165.22.214.208

# Navigate to backend folder
cd /var/www/school-attendance/backend

# Create .env file
nano .env
```

### 5.2. Add Environment Variables
```bash
# Server Configuration
NODE_ENV=production
PORT=5000
API_VERSION=v1

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=school_attendance
DB_USER=school_admin
DB_PASSWORD=your_strong_password_here
DB_POOL_MAX=100
DB_POOL_MIN=10

# JWT Configuration (GENERATE STRONG SECRET!)
JWT_SECRET=YOUR_SUPER_STRONG_JWT_SECRET_MIN_32_CHARS_CHANGE_THIS
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS Configuration (YOUR ACTUAL DOMAIN)
ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com,http://165.22.214.208

# Twilio SMS Configuration (Get from twilio.com)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=+1234567890

# Optional: Error Tracking
SENTRY_DSN=your_sentry_dsn_if_using
```

**Generate Strong JWT Secret:**
```bash
# On server, run:
openssl rand -base64 64

# Copy output and paste as JWT_SECRET
```

### 5.3. Secure .env File
```bash
# Make .env readable only by owner
chmod 600 .env

# Verify
ls -la .env
# Should show: -rw------- 1 root root
```

---

## 🗃️ STEP 6: RUN DATABASE MIGRATIONS

### 6.1. Install Backend Dependencies
```bash
cd /var/www/school-attendance/backend

# Install npm packages
npm install --production

# This installs all dependencies from package.json
```

### 6.2. Run Migrations
```bash
# Run migrations in order
cd /var/www/school-attendance/backend

# Run each migration manually (in order)
psql -h localhost -U school_admin -d school_attendance -f migrations/001_update_devices_to_serial_number.sql
psql -h localhost -U school_admin -d school_attendance -f migrations/002_add_platform_settings.sql
psql -h localhost -U school_admin -d school_attendance -f migrations/003_make_api_key_nullable.sql
# ... run all migrations up to 015

# OR create a script to run all:
for file in migrations/*.sql; do
  echo "Running migration: $file"
  psql -h localhost -U school_admin -d school_attendance -f "$file"
done
```

### 6.3. Verify Database Schema
```bash
# Connect to database
psql -h localhost -U school_admin -d school_attendance

# Check tables
\dt

# Should see:
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

---

## 🚀 STEP 7: START BACKEND WITH PM2

### 7.1. Start Application
```bash
cd /var/www/school-attendance/backend

# Start with PM2
pm2 start src/server.js --name school-attendance-api

# View logs
pm2 logs school-attendance-api

# You should see:
# ✅ Database connection successful
# ✅ JWT_SECRET validated successfully
# 🚀 Server is running on port 5000
# 🔍 Starting Automatic Absence Detection Service...
```

### 7.2. Configure PM2 Startup
```bash
# Save PM2 process list
pm2 save

# Generate startup script
pm2 startup

# Run the command it outputs (something like):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root

# Reboot server to test auto-start
reboot

# Wait 1 minute, SSH back in
ssh root@165.22.214.208

# Check if app is running
pm2 list

# Should show school-attendance-api as "online"
```

### 7.3. PM2 Useful Commands
```bash
# View status
pm2 status

# View logs
pm2 logs

# Restart app
pm2 restart school-attendance-api

# Stop app
pm2 stop school-attendance-api

# View detailed info
pm2 show school-attendance-api

# Monitor resources
pm2 monit
```

---

## 🌐 STEP 8: CONFIGURE NGINX REVERSE PROXY

### 8.1. Create Nginx Configuration
```bash
# Create new site config
nano /etc/nginx/sites-available/school-attendance
```

### 8.2. Add Configuration
```nginx
# Backend API
server {
    listen 80;
    server_name 165.22.214.208 api.yourdomain.com;

    # API endpoint
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for long-running requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Device endpoints (ZKTeco devices)
    location /iclock/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # No timeouts for device endpoints
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # WebSocket support (for Socket.io)
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 8.3. Enable Site
```bash
# Create symbolic link
ln -s /etc/nginx/sites-available/school-attendance /etc/nginx/sites-enabled/

# Remove default site
rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Should show: syntax is ok, test is successful

# Reload Nginx
systemctl reload nginx
```

### 8.4. Test Backend
```bash
# Test health endpoint
curl http://165.22.214.208/

# Should return:
# {"success":true,"message":"School Attendance API is running","version":"v1","timestamp":"..."}

# Test from your Mac browser:
# http://165.22.214.208/
```

---

## 🔒 STEP 9: SETUP SSL CERTIFICATE (HTTPS)

### 9.1. Install Certbot
```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx
```

### 9.2. Get SSL Certificate (If you have a domain)
```bash
# If you have a domain (e.g., api.yourdomain.com)
certbot --nginx -d api.yourdomain.com

# Follow prompts:
# - Email: your-email@example.com
# - Agree to ToS: Yes
# - Share email: No
# - Redirect HTTP to HTTPS: Yes (option 2)

# Test renewal
certbot renew --dry-run
```

### 9.3. Auto-Renewal Setup
```bash
# Certbot installs auto-renewal cron job automatically
# Verify:
systemctl status certbot.timer
```

---

## ✅ STEP 10: TEST EVERYTHING

### 10.1. Backend API Tests
```bash
# Test health check
curl http://165.22.214.208/

# Test API endpoint
curl http://165.22.214.208/api/v1/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# Should return error (no user yet) or success
```

### 10.2. Create Super Admin User
```bash
# Connect to database
psql -h localhost -U school_admin -d school_attendance

# Create super admin
INSERT INTO users (email, password, role, is_active, created_at)
VALUES (
  'admin@schoolattendance.com',
  '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',  -- Replace with bcrypt hash
  'superadmin',
  true,
  NOW()
);

# Exit
\q
```

**Generate bcrypt password hash:**
```bash
# On your Mac, create a simple script:
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YourPassword123', 10));"

# Copy the output hash
```

### 10.3. Test Login
```bash
curl http://165.22.214.208/api/v1/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@schoolattendance.com",
    "password": "YourPassword123"
  }'

# Should return JWT token
```

---

## 📊 STEP 11: SETUP MONITORING & BACKUPS

### 11.1. PM2 Monitoring
```bash
# Install PM2 monitoring dashboard (optional)
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 11.2. Database Backup Script
```bash
# Create backup directory
mkdir -p /var/backups/school-attendance

# Create backup script
nano /usr/local/bin/backup-db.sh
```

**Add script content:**
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/school-attendance"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="school_attendance_$DATE.sql"

# Create backup
pg_dump -h localhost -U school_admin -d school_attendance > "$BACKUP_DIR/$FILENAME"

# Compress
gzip "$BACKUP_DIR/$FILENAME"

# Delete backups older than 7 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $FILENAME.gz"
```

**Make executable:**
```bash
chmod +x /usr/local/bin/backup-db.sh

# Test backup
/usr/local/bin/backup-db.sh
```

### 11.3. Setup Cron Job for Backups
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /usr/local/bin/backup-db.sh >> /var/log/db-backup.log 2>&1
```

### 11.4. Setup Log Rotation
```bash
# Create logrotate config
nano /etc/logrotate.d/school-attendance
```

**Add configuration:**
```
/var/www/school-attendance/backend/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## 🎯 DEPLOYMENT CHECKLIST

### Pre-Deployment:
- ✅ Server updated and secured
- ✅ Firewall configured (UFW)
- ✅ Node.js 20 installed
- ✅ PostgreSQL installed and configured
- ✅ Database created and migrations run
- ✅ Backend code uploaded
- ✅ Environment variables configured
- ✅ PM2 process manager setup
- ✅ Nginx reverse proxy configured
- ✅ SSL certificate installed (if domain)
- ✅ Super admin user created
- ✅ Backups configured

### Post-Deployment:
- ✅ Test API endpoints
- ✅ Test device connection
- ✅ Monitor PM2 logs for 24 hours
- ✅ Test auto-absence service (next day at 11 AM)
- ✅ Test SMS/WhatsApp notifications
- ✅ Monitor database connections
- ✅ Check disk space usage

---

## 🔍 TROUBLESHOOTING

### Backend Not Starting:
```bash
# Check PM2 logs
pm2 logs school-attendance-api

# Check if port 5000 is in use
netstat -tulpn | grep 5000

# Check environment variables
cat /var/www/school-attendance/backend/.env
```

### Database Connection Error:
```bash
# Test PostgreSQL connection
psql -h localhost -U school_admin -d school_attendance

# Check PostgreSQL status
systemctl status postgresql

# Check logs
tail -f /var/log/postgresql/postgresql-16-main.log
```

### Nginx 502 Error:
```bash
# Check if backend is running
pm2 status

# Check Nginx error logs
tail -f /var/log/nginx/error.log

# Test Nginx config
nginx -t

# Restart Nginx
systemctl restart nginx
```

---

## 📞 USEFUL COMMANDS REFERENCE

```bash
# PM2
pm2 list                    # List all apps
pm2 logs                    # View all logs
pm2 restart all             # Restart all apps
pm2 stop all                # Stop all apps
pm2 delete all              # Delete all apps
pm2 save                    # Save process list
pm2 startup                 # Generate startup script

# PostgreSQL
psql -U school_admin -d school_attendance   # Connect to DB
pg_dump school_attendance > backup.sql      # Backup database
psql school_attendance < backup.sql         # Restore database

# Nginx
nginx -t                    # Test config
systemctl reload nginx      # Reload config
systemctl restart nginx     # Restart Nginx
tail -f /var/log/nginx/error.log   # View error logs

# System
htop                        # Monitor resources
df -h                       # Disk usage
free -m                     # Memory usage
netstat -tulpn             # Active ports
ufw status                  # Firewall status
```

---

## 🚀 NEXT STEPS AFTER DEPLOYMENT

1. **Test with Real Device:**
   - Configure ZKTeco device with server IP: 165.22.214.208
   - Test RFID scan → attendance recording

2. **Deploy Frontend:**
   - Deploy React admin panel
   - Deploy Flutter mobile app

3. **Setup Domain:**
   - Point domain to server IP
   - Get SSL certificate
   - Update ALLOWED_ORIGINS

4. **Production Monitoring:**
   - Setup error tracking (Sentry)
   - Setup uptime monitoring (UptimeRobot)
   - Setup log aggregation (Logtail)

---

**Deployment Complete! Your backend is now running at:**
- **API:** http://165.22.214.208/api/v1
- **Health:** http://165.22.214.208/
- **Device Endpoint:** http://165.22.214.208/iclock

🎉 **Production Ready!**
