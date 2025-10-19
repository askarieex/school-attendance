# Manual Enrollment Guide - ZKTeco K40 Pro

## Overview

This guide explains how to manually enroll students on your ZKTeco K40 Pro attendance device and have their attendance automatically recorded in your backend system.

## Current System Architecture

**Phase 1: Manual Enrollment (Current)**
- Students are added to the dashboard first (they get a sequential database ID)
- Students are then manually enrolled on the physical device using ZKTeco desktop software
- **CRITICAL:** Use the student's database ID as their device PIN when enrolling
- On first scan, the backend automatically creates the device-to-student mapping
- All subsequent scans are recorded as attendance

**Phase 2: Automatic Enrollment (Future)**
- If you upgrade to better hardware (e.g., ZKTeco MB560 ~$200-300), the backend already supports automatic enrollment
- Students added to dashboard will automatically sync to the device
- No manual enrollment needed

## Prerequisites

1. Backend server running on port 3001
2. ZKTeco K40 Pro device connected to network
3. Device registered in your dashboard with serial number GED7242600838
4. ZKTeco desktop software installed (ZKAccess 3.5 or ZKTime 5.0)

Download ZKTeco software:
- ZKAccess 3.5: https://www.zkteco.com/en/product_detail/382.html
- ZKTime 5.0: https://www.zkteco.com/en/product_detail/381.html

## Step-by-Step Enrollment Process

### Step 1: Create Student in Dashboard

1. Log in to your school admin dashboard
2. Go to Students section
3. Add a new student with their details
4. **IMPORTANT:** Note the student's ID number after creation
   - Example: Student "John Doe" is created with ID = 5

### Step 2: Download and Install Desktop Software

1. Download ZKAccess 3.5 or ZKTime 5.0 from ZKTeco website
2. Install the software on a Windows computer
3. Connect to the same network as your attendance device

### Step 3: Connect to Device

1. Open ZKAccess/ZKTime software
2. Go to Device Management
3. Add your device:
   - Device Model: K40 Pro
   - Connection: TCP/IP
   - IP Address: Your device's IP address
   - Port: 4370 (default)
   - Serial Number: GED7242600838

### Step 4: Enroll Student on Device

1. In the software, go to User Management > Add New User
2. **CRITICAL:** Set the PIN/ID field to match the student's database ID
   - Example: If John Doe has database ID = 5, set PIN = 5
3. Enter the student's name (optional, for display on device)
4. Enroll their fingerprint or RFID card:
   - **For fingerprint:** Have student place finger on device sensor 3 times
   - **For RFID card:** Place the RFID card on the device reader
5. Save the user to the device

### Step 5: Test Attendance Recording

1. Have the student scan their fingerprint/card on the device
2. Check the backend logs - you should see:
   ```
   ℹ️  No mapping found for PIN 5, checking if PIN matches student ID...
   ✨ Auto-creating device mapping: PIN 5 → Student John Doe (ID: 5)
   ✅ Attendance recorded: John Doe - present at 2025-10-18 08:30:00
   ```
3. Check your dashboard - attendance should appear immediately

## How the Backend Works

### First Scan (Auto-Mapping)

When a student scans for the first time:

1. Device sends PIN (e.g., PIN=5) to backend
2. Backend checks `device_user_mappings` table - no mapping found
3. Backend looks up `students` table for student with ID=5
4. If found, automatically creates mapping in `device_user_mappings`
5. Records attendance in `attendance_logs`

**Code Reference:** `src/services/attendanceProcessor.js:25-54`

### Subsequent Scans

Once the mapping exists:

1. Device sends PIN=5
2. Backend finds mapping in `device_user_mappings`
3. Immediately records attendance
4. No additional lookups needed

## Troubleshooting

### Student scan not appearing in dashboard

**Check backend logs for:**
```bash
tail -f /tmp/server-clean.log
```

**Common issues:**

1. **PIN doesn't match student ID**
   - Error: `⚠️  Unknown user PIN X - No student found with this ID`
   - Solution: Re-enroll student with correct PIN = student database ID

2. **Student not in correct school**
   - Error: `No student found with this ID`
   - Solution: Verify student belongs to same school as device

3. **Device not sending data**
   - Check device is connected to network
   - Check device serial number matches in database
   - Verify device server URL is set to your backend (http://YOUR_IP:3001/iclock)

### View students in database

```sql
-- Check student IDs
SELECT id, full_name, grade, school_id FROM students ORDER BY id;

-- Check device mappings
SELECT * FROM device_user_mappings WHERE device_id = 1;

-- Check recent attendance
SELECT
  al.*,
  s.full_name
FROM attendance_logs al
JOIN students s ON al.student_id = s.id
ORDER BY al.created_at DESC
LIMIT 10;
```

## Important Notes

1. **Always use Student Database ID as Device PIN**
   - This is the critical link between dashboard and device
   - If PIN doesn't match ID, attendance won't record

2. **One-time manual enrollment per student**
   - After enrolling once, all future attendance is automatic
   - Mapping persists in database

3. **Upgrade path exists**
   - If project succeeds, upgrade to MB560 devices
   - Backend already supports automatic enrollment
   - No code changes needed, just hardware swap

4. **Multi-school support**
   - Each school can have its own device
   - Students are isolated by school_id
   - One student can't scan on another school's device

## Desktop Software Configuration

### Set Device Server URL

Your device needs to know where to send attendance data:

1. In ZKAccess/ZKTime, go to Device Settings
2. Find "Server Settings" or "Push Protocol"
3. Set server URL to: `http://YOUR_BACKEND_IP:3001/iclock`
4. Enable "Push Protocol" or "ADMS Push"
5. Save and restart device

Example:
- If backend is running on 192.168.1.100
- Server URL: `http://192.168.1.100:3001/iclock`

## Testing Checklist

- [ ] Student created in dashboard (note the ID)
- [ ] Desktop software installed and connected to device
- [ ] Student enrolled with PIN = database ID
- [ ] Device server URL configured correctly
- [ ] Backend server running (check with `curl http://localhost:3001`)
- [ ] Test scan shows in backend logs
- [ ] Attendance appears in dashboard

## Next Steps After Successful Testing

1. Enroll all students for your first pilot school
2. Monitor attendance for 1-2 weeks
3. Gather feedback from school administrators
4. If successful, purchase better hardware for scaling:
   - Recommended: ZKTeco MB560 (~$200-300 per device)
   - Supports automatic enrollment via ADMS protocol
   - Better for multi-school deployment

## Support

If you encounter issues:

1. Check backend logs: `tail -f /tmp/server-clean.log`
2. Verify database student IDs: `SELECT id, full_name FROM students;`
3. Check device connectivity
4. Ensure PIN matches student database ID exactly

## Code Files Reference

- `src/services/attendanceProcessor.js` - Auto-mapping logic
- `src/controllers/iclockController.js` - Device communication
- `src/routes/iclock.js` - Device endpoints
- `src/middleware/deviceAuth.js` - Device authentication
