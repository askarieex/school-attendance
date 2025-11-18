# ✅ ZKTeco K40 Pro - Attendance Testing & Verification Guide

## 🎉 Current Status: DEVICE CONNECTED SUCCESSFULLY! ✅

Your ZKTeco K40 Pro (SN: GED7242600838) is now:
- ✅ Connected to VPS server: 165.22.214.208
- ✅ Authenticated with school: My Heritage School
- ✅ Polling every ~20 seconds
- ✅ Auto-absence detection running daily at 11:00 AM IST

---

## 🧪 NEXT STEP: Test Actual Attendance Recording

The device is connected but we need to verify that **fingerprint scans** generate attendance records properly.

### Current Issue:
```
⏭️ Skipping OPERLOG entry (operation log, not attendance)
📋 Parsed 0 attendance records from device
```

**OPERLOG** = Device operation logs (menu access, settings changes, etc.)
**Attendance Data** = Actual fingerprint/RFID scans

We need to test a real fingerprint scan to verify attendance data flow.

---

## 📋 Step-by-Step Testing Procedure

### **STEP 1: Prepare a Test Student**

On your VPS server, verify you have students with RFID cards registered:

```bash
# SSH to VPS
ssh root@165.22.214.208

# Connect to database
sudo -u postgres psql school_attendance

# Check registered students with RFID cards
SELECT
  s.id,
  s.full_name,
  s.rfid_card_id,
  c.class_name,
  sec.section_name
FROM students s
JOIN classes c ON s.class_id = c.id
JOIN sections sec ON s.section_id = sec.id
WHERE s.rfid_card_id IS NOT NULL
AND s.school_id = 1
LIMIT 10;
```

**Expected output:**
```
 id | full_name          | rfid_card_id | class_name | section_name
----+--------------------+--------------+------------+--------------
  1 | John Doe           | 1234567890   | Class 1    | A
  2 | Jane Smith         | 0987654321   | Class 2    | B
```

**If no students have RFID cards:**
```sql
-- Add RFID card to a test student
UPDATE students
SET rfid_card_id = '1234567890'
WHERE id = 1;
```

---

### **STEP 2: Monitor Server Logs in Real-Time**

Open a terminal window and keep it running:

```bash
# SSH to VPS
ssh root@165.22.214.208

# Watch logs in real-time
pm2 logs school-attendance-api --lines 0
```

**Keep this terminal open!** You'll see attendance data appear here when you scan a fingerprint.

---

### **STEP 3: Perform Test Fingerprint Scan**

1. **Go to the ZKTeco K40 Pro device**
2. **Place your enrolled finger on the scanner**
   - Device should beep and show "Success" or "Verified"
   - User name may appear on screen
3. **Immediately check the VPS logs** (from Step 2)

---

### **STEP 4: Verify Expected Log Output**

If attendance recording works properly, you should see:

```
📥 /iclock/cdata from device: K40_Pro (SN: GED7242600838)
📝 Device sent data (length: 245):

ATTLOG:
ATTLOG	1234567890	2025-11-18 09:30:45	0	0

📋 Parsed 1 attendance record(s) from device
✅ Processing attendance record 1/1: Card: 1234567890, Time: 2025-11-18 09:30:45
🔍 Looking up student by RFID card: 1234567890
✅ Student found: John Doe (ID: 1, Class: Class 1, Section: A)
✅ Attendance marked: present
📧 Sending WhatsApp notification to guardian: +91XXXXXXXXXX
✅ Attendance processing complete: { success: 1, duplicate: 0, failed: 0 }
```

---

### **STEP 5: Check Database**

Verify the attendance record was saved:

```bash
# On VPS server
sudo -u postgres psql school_attendance

# Check today's attendance logs
SELECT
  al.id,
  s.full_name,
  s.rfid_card_id,
  al.check_in_time,
  al.status,
  al.created_at
FROM attendance_logs al
JOIN students s ON al.student_id = s.id
WHERE DATE(al.date) = CURRENT_DATE
ORDER BY al.created_at DESC
LIMIT 10;
```

**Expected output:**
```
 id | full_name  | rfid_card_id | check_in_time       | status  | created_at
----+------------+--------------+---------------------+---------+-------------------------
  1 | John Doe   | 1234567890   | 2025-11-18 09:30:45 | present | 2025-11-18 09:30:46.123
```

---

## 🔍 Troubleshooting

### Issue 1: Device Shows "User Not Registered"

**Cause:** RFID card not enrolled in device memory

**Solution:**

#### Option A: Enroll User on Device (Manual)

1. On device menu: **Menu → User → New User**
2. Enter User ID: `1234567890` (must match database rfid_card_id)
3. Enter Name: `John Doe`
4. Enroll fingerprint (place finger 3 times)
5. Save and exit

#### Option B: Sync Users from Server (Automatic)

This requires pushing user data from server to device via PUSH protocol commands.

**Check if device supports user sync:**
```bash
# On VPS server
curl -X POST "http://localhost:5000/iclock/devicecmd" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "SN=GED7242600838&CMD=INFO"
```

**Expected response:**
```
OK
```

**Then push user data:**
```bash
# Add user command to database
sudo -u postgres psql school_attendance

INSERT INTO device_commands (
  device_id,
  command_type,
  command_content,
  status
) VALUES (
  (SELECT id FROM devices WHERE serial_number = 'GED7242600838'),
  'DATA',
  'USER PIN=1234567890	Name=John Doe	Pri=0',
  'pending'
);
```

Device will fetch this command on next poll (~20 seconds).

---

### Issue 2: Logs Show "Student Not Found"

**Cause:** RFID card in device doesn't match database

**Check RFID card mapping:**
```sql
SELECT rfid_card_id, full_name
FROM students
WHERE rfid_card_id = '1234567890';
```

**If empty:**
```sql
-- Update student with RFID card
UPDATE students
SET rfid_card_id = '1234567890'
WHERE full_name = 'John Doe';
```

---

### Issue 3: Still Getting OPERLOG Only

**Cause:** Device sending operation logs instead of attendance data

**Possible reasons:**
1. No users enrolled in device
2. Wrong data format from device
3. Device firmware issue

**Check device user count:**
- Menu → System → Info → User Count
- Should show at least 1 user

**If 0 users:**
- Manually enroll at least one user (see Issue 1)

---

### Issue 4: "Duplicate Attendance" Error

**Cause:** Student already marked present today

**Expected behavior:**
```
⚠️ Duplicate attendance detected for student: John Doe
   Last scan: 09:30:45
   Current scan: 09:45:12
   Skipping duplicate within same day
```

**This is normal!** System prevents multiple attendance records per day per student.

**To test again:**
- Use a different student's RFID card
- OR wait until next day
- OR manually delete today's record:
  ```sql
  DELETE FROM attendance_logs
  WHERE student_id = 1
  AND DATE(date) = CURRENT_DATE;
  ```

---

## 📊 Monitoring Dashboard

### Real-time Logs
```bash
# SSH to VPS
ssh root@165.22.214.208

# Watch all logs
pm2 logs school-attendance-api --lines 0

# Watch only attendance-related logs
pm2 logs school-attendance-api | grep -i "attendance\|ATTLOG\|card"

# Watch only errors
pm2 logs school-attendance-api --err
```

### Check Server Status
```bash
# PM2 process status
pm2 status

# Server health check
curl http://localhost:5000/

# Device endpoint health
curl "http://localhost:5000/iclock/cdata?SN=GED7242600838&options=all"
```

### Database Queries
```sql
-- Today's attendance summary
SELECT
  status,
  COUNT(*) as count
FROM attendance_logs
WHERE DATE(date) = CURRENT_DATE
GROUP BY status;

-- Recent device activity
SELECT
  serial_number,
  is_online,
  last_seen,
  school_id
FROM devices
WHERE serial_number = 'GED7242600838';

-- Pending device commands
SELECT
  dc.id,
  dc.command_type,
  dc.command_content,
  dc.status,
  dc.created_at
FROM device_commands dc
JOIN devices d ON dc.device_id = d.id
WHERE d.serial_number = 'GED7242600838'
AND dc.status = 'pending';
```

---

## 🎯 Complete Test Checklist

- [ ] **Step 1**: Verify students have RFID cards in database
- [ ] **Step 2**: SSH to VPS and run `pm2 logs school-attendance-api --lines 0`
- [ ] **Step 3**: Enroll at least one user on ZKTeco device
- [ ] **Step 4**: Perform test fingerprint scan on device
- [ ] **Step 5**: Check VPS logs for attendance data
- [ ] **Step 6**: Verify attendance record in database
- [ ] **Step 7**: Check if WhatsApp/SMS notification was sent
- [ ] **Step 8**: Test with 2-3 different students
- [ ] **Step 9**: Verify duplicate prevention works
- [ ] **Step 10**: Test late arrival detection (after 10:00 AM)

---

## 🚨 Emergency Diagnostic Commands

If nothing works, run these commands and share the output:

```bash
# 1. Check if device is still polling
ssh root@165.22.214.208 "pm2 logs school-attendance-api --lines 100 --nostream | grep 'polling\|getrequest'"

# 2. Check device status in database
ssh root@165.22.214.208 "sudo -u postgres psql school_attendance -c \"SELECT serial_number, is_online, last_seen FROM devices WHERE serial_number='GED7242600838';\""

# 3. Check recent /iclock/cdata requests
ssh root@165.22.214.208 "pm2 logs school-attendance-api --lines 500 --nostream | grep '/iclock/cdata'"

# 4. Check for errors
ssh root@165.22.214.208 "pm2 logs school-attendance-api --err --lines 50 --nostream"

# 5. Check students with RFID cards
ssh root@165.22.214.208 "sudo -u postgres psql school_attendance -c \"SELECT COUNT(*) FROM students WHERE rfid_card_id IS NOT NULL;\""
```

---

## ✅ Expected End-to-End Workflow

When everything works correctly:

```
1. Student scans fingerprint on ZKTeco K40 Pro
   ↓
2. Device recognizes fingerprint (beeps, shows name)
   ↓
3. Device sends attendance data to VPS via HTTP POST /iclock/cdata
   ↓
4. Backend parses ATTLOG data
   ↓
5. Backend looks up student by RFID card ID
   ↓
6. Backend creates attendance_log record in database
   ↓
7. Backend sends WhatsApp/SMS to parent (if configured)
   ↓
8. Backend sends real-time update via WebSocket
   ↓
9. Dashboard shows attendance in real-time
   ↓
10. Mobile app shows notification (if installed)
```

---

## 📞 Next Steps After Testing

Once attendance recording works:

1. **Enroll All Students**
   - Manually enroll all students on device
   - OR use bulk user sync via device commands

2. **Configure WhatsApp Notifications**
   - Update Twilio credentials in database settings
   - Test SMS/WhatsApp delivery

3. **Deploy Frontend Applications**
   - React super admin panel
   - Flutter mobile app

4. **Enable SSL/HTTPS**
   - Configure SSL certificate for adtenz.site
   - Update device to use HTTPS (if supported)

5. **Setup Automated Backups**
   - Database backups
   - Attendance logs export

---

## 🎉 Success Criteria

You'll know the system is working when:

- ✅ Fingerprint scan creates attendance record in database
- ✅ Parent receives WhatsApp/SMS notification
- ✅ Dashboard shows real-time attendance update
- ✅ Auto-absence detection runs at 11:00 AM
- ✅ Late arrivals marked correctly (after 10:00 AM)
- ✅ Duplicate scans prevented
- ✅ Device polls every 20 seconds without errors

---

## 📧 Support

If you encounter any issues during testing:

1. Share the complete VPS logs from Step 2
2. Share the database query results from Step 5
3. Share any error messages from the device
4. Share screenshots of device screen during scan

**Current device configuration (for reference):**
```
Device: ZKTeco K40 Pro
Serial Number: GED7242600838
Server Address: 165.22.214.208
Server Port: 80
Protocol: PUSH
School: My Heritage School
```

---

**🚀 You're 90% there! The hard part (device connectivity) is done.**

**Next: Just test a fingerprint scan and verify attendance is recorded!**
