# ZKTeco Integration Testing Guide

## ✅ Fixes Applied - Quick Summary

### Code Fixes (Already Done)
- [x] Fixed `ReferenceError: mapping is not defined` in attendanceProcessor.js:89
- [x] Fixed `TypeError: Cannot read properties of undefined (reading 'split')` in attendanceProcessor.js:133
- [x] Added integer casting for command IDs in iclockController.js
- [x] Added rowCount validation and logging in receiveCommandConfirmation

### Database Fixes (Run SQL Migration)
- [ ] Run migration: `migrations/007_fix_device_commands_table.sql`
- [ ] Verify device exists in DB
- [ ] Insert test command

---

## 🧪 Step-by-Step Testing

### 1. Run Database Migration

```bash
cd /Users/askerymalik/Documents/Development/school-attendance-sysytem/backend
```

**Option A: Using psql command line**
```bash
psql -U postgres -d school_attendance -f migrations/007_fix_device_commands_table.sql
```

**Option B: Using Node.js**
```bash
node -e "
const { query } = require('./src/config/database');
const fs = require('fs');
const sql = fs.readFileSync('./migrations/007_fix_device_commands_table.sql', 'utf8');
query(sql).then(() => console.log('✅ Migration complete')).catch(console.error);
"
```

**Option C: Copy-paste in pgAdmin**
- Open pgAdmin
- Connect to `school_attendance` database
- Open Query Tool
- Paste contents of `007_fix_device_commands_table.sql`
- Execute (F5)

---

### 2. Verify Your Device Exists

Run in pgAdmin or psql:

```sql
-- Find your device
SELECT id, device_name, serial_number, school_id, is_active 
FROM devices 
WHERE serial_number = 'GED7242600838';
```

**Expected Result:**
```
 id | device_name | serial_number  | school_id | is_active 
----|-------------|----------------|-----------|----------
  8 | cps divice  | GED7242600838  |     3     |   true
```

**If device not found:**
```sql
-- Create the device
INSERT INTO devices (school_id, device_name, serial_number, location, is_active)
VALUES (3, 'CPS Device', 'GED7242600838', 'Main Gate', true)
RETURNING id, device_name, serial_number;
```

---

### 3. Insert a Test Command

Replace `8` with your actual device ID:

```sql
INSERT INTO device_commands (
  device_id, 
  command_type, 
  command_string, 
  status, 
  priority, 
  created_at
)
VALUES (
  8,  -- ⚠️ CHANGE THIS to your device.id
  'DATA',
  'C:1001:DATA UPDATE user Pin=101 Name=TestStudent Passwd= Card=12345678 Grp=1 TZ=0000000100000000',
  'pending',
  100,
  CURRENT_TIMESTAMP
)
RETURNING id, command_type, status;
```

**Expected Result:**
```
 id  | command_type | status  
-----|--------------|--------
1001 |     DATA     | pending
```

---

### 4. Start Backend Server

```bash
cd /Users/askerymalik/Documents/Development/school-attendance-sysytem/backend
npm run dev
```

**Watch for:**
```
✅ Database connected successfully
🚀 Server running on port 3001
Attendance system ready!
```

---

### 5. Test Device Polling (Simulate Device)

**From another terminal or Postman:**

```bash
# Device polls for commands
curl "http://192.168.1.7:3001/iclock/getrequest?SN=GED7242600838"
```

**Expected Response:**
```
C:1001:DATA UPDATE user Pin=101 Name=TestStudent Passwd= Card=12345678 Grp=1 TZ=0000000100000000
```

**In server logs, you should see:**
```
✅ Device authenticated: GED7242600838 (cps divice) - School: CPS
📡 Device polling: cps divice (SN: GED7242600838)
📤 Sending command id=1001 to device GED7242600838 (len=85)
```

---

### 6. Test Command Confirmation (Simulate Device Response)

```bash
# Device confirms command execution (Return=0 means success)
curl -X POST \
  "http://192.168.1.7:3001/iclock/devicecmd?SN=GED7242600838" \
  -H "Content-Type: text/plain" \
  -d "ID=1001&Return=0&CMD=DATA"
```

**Expected Response:**
```
OK
```

**In server logs:**
```
📨 Command confirmation from device: cps divice (SN: GED7242600838)
   Raw confirmation payload: ID=1001&Return=0&CMD=DATA
   Command ID: 1001, Return Code: 0, CMD: DATA
✅ Command 1001 marked as completed
```

**Verify in database:**
```sql
SELECT id, command_type, status, completed_at, error_message
FROM device_commands
WHERE id = 1001;
```

**Expected:**
```
  id  | command_type |  status   |      completed_at       | error_message 
------|--------------|-----------|-------------------------|---------------
 1001 |     DATA     | completed | 2025-10-23 20:35:12.456 | NULL
```

---

### 7. Test Attendance Upload (Simulate Device)

```bash
# Device sends attendance data
curl -X POST \
  "http://192.168.1.7:3001/iclock/cdata?SN=GED7242600838&table=ATTLOG&Stamp=9999" \
  -H "Content-Type: text/plain" \
  --data-binary $'101\t2025-10-23 08:30:00\t1\t15\t0\t0'
```

**Expected Response:**
```
OK
```

**In server logs:**
```
📥 /iclock/cdata from device: cps divice (SN: GED7242600838)
📋 Parsed 1 attendance record(s) from device
✅ Attendance recorded: [Student Name] - present at 2025-10-23 08:30:00
✅ Attendance processing complete: { success: 1, duplicate: 0, failed: 0 }
```

**Verify in database:**
```sql
SELECT * FROM attendance_logs
WHERE date = CURRENT_DATE
ORDER BY created_at DESC
LIMIT 5;
```

---

## 🐛 Troubleshooting Common Issues

### Issue: "Device not found or inactive"

**Fix:**
```sql
-- Check device exists and is active
SELECT * FROM devices WHERE serial_number = 'GED7242600838';

-- If exists but inactive:
UPDATE devices SET is_active = true WHERE serial_number = 'GED7242600838';
```

### Issue: "No pending commands" but you inserted one

**Fix:**
```sql
-- Check command status
SELECT id, device_id, status FROM device_commands WHERE id = 1001;

-- Reset to pending if needed:
UPDATE device_commands SET status = 'pending', sent_at = NULL WHERE id = 1001;
```

### Issue: "rowCount = 0" when device confirms command

**Possible causes:**
1. Command ID doesn't exist in database
2. Command was already completed/failed
3. Type mismatch (text vs integer)

**Fix:**
```sql
-- Check if command exists
SELECT * FROM device_commands WHERE id = 1001;

-- Check data type of id column
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'device_commands' AND column_name = 'id';
```

### Issue: "Cannot read properties of undefined (reading 'split')"

**Already Fixed!** ✅ 

If you still see this:
- Restart the server: `Ctrl+C` then `npm run dev`
- Check that attendanceProcessor.js line 133 has the defensive check

---

## 📊 Monitoring Commands

### View all pending commands:
```sql
SELECT id, device_id, command_type, status, priority, created_at
FROM device_commands
WHERE status = 'pending'
ORDER BY priority DESC, created_at ASC;
```

### View command history:
```sql
SELECT 
  dc.id, 
  d.device_name,
  dc.command_type,
  dc.status,
  dc.created_at,
  dc.sent_at,
  dc.completed_at,
  dc.error_message
FROM device_commands dc
JOIN devices d ON dc.device_id = d.id
ORDER BY dc.created_at DESC
LIMIT 20;
```

### Clear old completed commands:
```sql
-- Delete commands older than 7 days
DELETE FROM device_commands 
WHERE status IN ('completed', 'failed') 
  AND completed_at < NOW() - INTERVAL '7 days';
```

---

## ✅ Success Checklist

- [ ] Migration 007 executed successfully
- [ ] Device found in database with correct serial number
- [ ] Test command inserted and shows as 'pending'
- [ ] Server starts without errors
- [ ] Device polling returns command string
- [ ] Command confirmation updates status to 'completed'
- [ ] Attendance upload parses and saves to database
- [ ] No errors in server logs

---

## 🚀 Next Steps

Once all tests pass:

1. **Remove test command:**
   ```sql
   DELETE FROM device_commands WHERE command_type = 'DATA' AND command_string LIKE '%TestStudent%';
   ```

2. **Configure real device:**
   - In device settings: Server IP = 192.168.1.7, Port = 3001
   - Enable PUSH protocol
   - Save and restart device

3. **Monitor first real attendance:**
   - Watch server logs
   - Check attendance_logs table
   - Verify student mapping created

4. **Set up student enrollment:**
   - Use API or admin panel to add students
   - System will auto-create device mappings when students scan

---

**Need help?** Check the main README.md or DEVICE-ALGORITHM.md for detailed protocol documentation.
