# 🔧 ZKTeco K40 Pro - Quick Reference Card

## 📱 Current Device Configuration

```
┌──────────────────────────────────────────────────────┐
│  ZKTeco K40 Pro - Production Configuration           │
├──────────────────────────────────────────────────────┤
│  Serial Number:  GED7242600838                       │
│  Device Name:    ss                                  │
│  School:         My Heritage School                  │
│                                                      │
│  🌐 Network Settings (COMM → Ethernet)              │
│  IP Address:     192.168.1.200                       │
│  Subnet Mask:    255.255.255.0                       │
│  Gateway:        192.168.1.1                         │
│  DNS Server:     8.8.8.8                             │
│                                                      │
│  ☁️  Cloud Server Settings (COMM → CloudServer)     │
│  Server Address: 165.22.214.208                      │
│  Server Port:    80                                  │
│  Enable:         ON                                  │
│  Protocol:       PUSH                                │
│  HTTPS:          OFF                                 │
│  Domain Name:    OFF                                 │
│  Proxy Server:   OFF                                 │
│                                                      │
│  📊 Server Details                                   │
│  Domain:         adtenz.site                         │
│  Backend Port:   5000 (via Nginx on port 80)        │
│  API Base:       https://adtenz.site/api/v1         │
│  Device Endpoint: http://165.22.214.208/iclock      │
│                                                      │
│  ✅ Connection Status: ONLINE                        │
│  Last Seen:      Polling every ~20 seconds           │
└──────────────────────────────────────────────────────┘
```

---

## 🎯 Quick Diagnostic Commands (Run on VPS)

### Check if device is connected:
```bash
ssh root@165.22.214.208
pm2 logs school-attendance-api --lines 50 | grep "GED7242600838"
```

### Check latest attendance records:
```bash
ssh root@165.22.214.208 "sudo -u postgres psql school_attendance -c \"SELECT s.full_name, al.check_in_time, al.status FROM attendance_logs al JOIN students s ON al.student_id = s.id WHERE DATE(al.date) = CURRENT_DATE ORDER BY al.created_at DESC LIMIT 5;\""
```

### Check device status in database:
```bash
ssh root@165.22.214.208 "sudo -u postgres psql school_attendance -c \"SELECT serial_number, is_online, last_seen FROM devices WHERE serial_number='GED7242600838';\""
```

---

## 📋 Testing Steps (Quick Version)

### 1️⃣ Enroll a Test User on Device
```
Press M/OK → User → New User
User ID: 1234567890
Name: Test User
Enroll fingerprint (3 times)
Save
```

### 2️⃣ Watch Server Logs
```bash
ssh root@165.22.214.208
pm2 logs school-attendance-api --lines 0
```

### 3️⃣ Scan Fingerprint
Place enrolled finger on device → Watch logs

### 4️⃣ Verify in Database
```bash
ssh root@165.22.214.208 "sudo -u postgres psql school_attendance -c \"SELECT * FROM attendance_logs WHERE DATE(date) = CURRENT_DATE ORDER BY created_at DESC LIMIT 1;\""
```

---

## 🔍 Troubleshooting Flowchart

```
Device shows "User Not Registered"?
│
├─ YES → Enroll user on device (Menu → User → New User)
│        Use RFID card ID from database as User ID
│
└─ NO → Fingerprint scan successful?
        │
        ├─ YES → Check VPS logs for attendance data
        │        │
        │        ├─ Logs show "Parsed 1 attendance record"?
        │        │  │
        │        │  ├─ YES → ✅ WORKING! Check database
        │        │  │
        │        │  └─ NO → Still showing "OPERLOG only"?
        │        │           │
        │        │           ├─ YES → Device needs user enrollment
        │        │           │        Check device user count
        │        │           │
        │        │           └─ NO → Check for errors in logs
        │        │
        │        └─ Logs show "Student not found"?
        │           │
        │           ├─ YES → Update database with RFID card:
        │           │        UPDATE students SET rfid_card_id='1234567890'
        │           │        WHERE id = 1;
        │           │
        │           └─ NO → Share logs for debugging
        │
        └─ NO → Device shows error?
                Share error message
```

---

## 🚨 Common Issues & Quick Fixes

### Issue: "Device not polling anymore"
**Check:**
```bash
# Restart backend if needed
ssh root@165.22.214.208 "pm2 restart school-attendance-api"

# Check device network connection
# On device: Menu → Comm → Ethernet → Test Connection
```

### Issue: "Attendance marked but no SMS sent"
**Check Twilio configuration:**
```bash
ssh root@165.22.214.208 "sudo -u postgres psql school_attendance -c \"SELECT key, value FROM settings WHERE key LIKE 'twilio%';\""
```

### Issue: "Duplicate attendance error"
**Expected behavior!** One attendance per student per day.
**To test again:** Use different student or delete test record:
```sql
DELETE FROM attendance_logs WHERE student_id = 1 AND DATE(date) = CURRENT_DATE;
```

### Issue: "Late status not working"
**Check late threshold:**
```bash
ssh root@165.22.214.208 "sudo -u postgres psql school_attendance -c \"SELECT school_open_time, late_threshold_minutes FROM schools WHERE id = 1;\""
```

Default: Opens 09:00 AM, Late after 10:00 AM (60 min threshold)

---

## 📊 Database Schema (Key Tables)

### Students Table
```sql
-- Find students with RFID cards
SELECT id, full_name, rfid_card_id, class_id, guardian_phone
FROM students
WHERE school_id = 1 AND rfid_card_id IS NOT NULL;
```

### Attendance Logs Table
```sql
-- Today's attendance
SELECT
  al.id,
  s.full_name,
  al.check_in_time,
  al.status,
  al.created_at
FROM attendance_logs al
JOIN students s ON al.student_id = s.id
WHERE DATE(al.date) = CURRENT_DATE
ORDER BY al.created_at DESC;
```

### Devices Table
```sql
-- Device status
SELECT
  serial_number,
  device_name,
  is_online,
  last_seen,
  school_id
FROM devices
WHERE serial_number = 'GED7242600838';
```

---

## 🎯 Key File Locations

### On VPS Server (165.22.214.208)

**Backend Code:**
```
/root/school-attendance-system/backend/
```

**Environment File:**
```
/root/school-attendance-system/backend/.env
```

**PM2 Logs:**
```
~/.pm2/logs/school-attendance-api-out.log
~/.pm2/logs/school-attendance-api-error.log
```

**Nginx Config:**
```
/etc/nginx/sites-available/default
```

**Database:**
```
PostgreSQL 14
Database name: school_attendance
User: postgres
```

---

## 🔐 Important Security Notes

### Current Security Issues:
1. ⚠️ Weak JWT secret in .env
2. ⚠️ Twilio credentials exposed in Git
3. ⚠️ Default database password

### To Fix:
```bash
# Generate strong JWT secret
openssl rand -base64 64

# Update .env file
ssh root@165.22.214.208
nano /root/school-attendance-system/backend/.env

# Update these values:
JWT_SECRET=<new-strong-secret-here>
DB_PASSWORD=<new-strong-password>

# Restart backend
pm2 restart school-attendance-api
```

---

## 📱 Device Menu Navigation

### Quick Access Paths:

**Check Network Connection:**
```
M/OK → Comm → Ethernet → Test Connection
```

**View User Count:**
```
M/OK → System → Info → User Count
```

**Enroll New User:**
```
M/OK → User → New User
```

**Check Cloud Server Settings:**
```
M/OK → Comm → CloudServer
```

**Manual Data Upload:**
```
M/OK → System → Upload Data
```

**View Device Serial Number:**
```
M/OK → System → Info → Device Info
```

---

## 🎓 School Configuration

### School Settings in Database:
```sql
SELECT
  school_name,
  school_open_time,
  late_threshold_minutes,
  absence_grace_period_minutes,
  timezone
FROM schools
WHERE id = 1;
```

**Default Values:**
- School Opens: 09:00 AM
- Late Threshold: 60 minutes (10:00 AM)
- Absence Grace Period: 120 minutes (11:00 AM)
- Timezone: Asia/Kolkata (IST)

---

## 📞 Support Checklist

**Before asking for help, gather:**

1. ✅ VPS logs (last 100 lines):
   ```bash
   pm2 logs school-attendance-api --lines 100 --nostream
   ```

2. ✅ Device status:
   ```sql
   SELECT * FROM devices WHERE serial_number='GED7242600838';
   ```

3. ✅ Student RFID cards count:
   ```sql
   SELECT COUNT(*) FROM students WHERE rfid_card_id IS NOT NULL;
   ```

4. ✅ Today's attendance count:
   ```sql
   SELECT COUNT(*) FROM attendance_logs WHERE DATE(date) = CURRENT_DATE;
   ```

5. ✅ Device screen error (screenshot if any)

6. ✅ Network connectivity test from device

---

## ✅ System Health Checklist

Run daily to ensure everything is working:

```bash
# 1. Check backend is running
ssh root@165.22.214.208 "pm2 status | grep school-attendance-api"

# 2. Check device is online
ssh root@165.22.214.208 "sudo -u postgres psql school_attendance -c \"SELECT is_online, last_seen FROM devices WHERE serial_number='GED7242600838';\""

# 3. Check today's attendance count
ssh root@165.22.214.208 "sudo -u postgres psql school_attendance -c \"SELECT COUNT(*) FROM attendance_logs WHERE DATE(date) = CURRENT_DATE;\""

# 4. Check for errors
ssh root@165.22.214.208 "pm2 logs school-attendance-api --err --lines 20 --nostream"

# 5. Check disk space
ssh root@165.22.214.208 "df -h"

# 6. Check database size
ssh root@165.22.214.208 "sudo -u postgres psql -c \"SELECT pg_size_pretty(pg_database_size('school_attendance'));\""
```

---

## 🚀 Performance Optimization

### Current Backend Performance:
- Connection Pool: 100 connections
- Rate Limiting: 100 req/min (API), 500 req/min (Device)
- Auto-absence Detection: Daily at 11:00 AM
- Device Poll Interval: ~20 seconds

### Monitor Performance:
```bash
# Check backend memory usage
ssh root@165.22.214.208 "pm2 info school-attendance-api"

# Check database connections
ssh root@165.22.214.208 "sudo -u postgres psql -c \"SELECT count(*) FROM pg_stat_activity;\""

# Check slow queries
ssh root@165.22.214.208 "sudo -u postgres psql school_attendance -c \"SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 5;\""
```

---

**🎉 Device is connected and ready for production use!**

**Next: Test fingerprint scan to verify end-to-end attendance workflow.**
