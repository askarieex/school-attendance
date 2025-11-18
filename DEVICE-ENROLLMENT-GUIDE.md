# DEVICE USER ENROLLMENT GUIDE
## ZKTeco Device Integration - Student Enrollment System

**Last Updated**: October 18, 2025

---

## OVERVIEW

This guide explains how to enroll students to ZKTeco attendance devices, allowing the device to recognize students when they scan their RFID cards or enter their PINs.

---

## WHAT IS DEVICE ENROLLMENT?

Device enrollment is the process of sending student data (name, PIN, RFID card ID) from the backend system to the physical ZKTeco attendance device. Once enrolled:

1. The device recognizes the student's PIN or RFID card
2. Attendance logs are automatically linked to the correct student
3. No more "Unknown user PIN" errors

---

## HOW IT WORKS

### 1. **Enrollment Process**
```
School Admin → Backend API → Device Command Queue → ZKTeco Device
```

### 2. **Command Queue System**
- Commands are stored in `device_commands` table
- Device polls backend every 30 seconds via `/iclock/getrequest`
- Backend sends pending commands to device
- Device processes commands and acknowledges

### 3. **Database Mappings**
- `device_user_mappings` table stores which student is assigned which PIN on each device
- Each student can have different PINs on different devices
- PINs must be unique per device

---

## API ENDPOINTS

### 1. **Enroll Single Student**

**Endpoint**: `POST /api/v1/school/devices/:deviceId/enroll-student`

**Headers**:
```
Authorization: Bearer <school_admin_token>
```

**Request Body**:
```json
{
  "studentId": 1,
  "devicePin": 3
}
```

**Response**:
```json
{
  "success": true,
  "message": "Student enrolled to device successfully",
  "data": {
    "mapping": {
      "id": 15,
      "device_id": 2,
      "student_id": 1,
      "device_pin": 3,
      "is_active": true
    },
    "message": "Student enrolled successfully. Command queued to sync with device."
  }
}
```

**Example using curl**:
```bash
curl -X POST http://localhost:3001/api/v1/school/devices/2/enroll-student \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"studentId": 1, "devicePin": 3}'
```

---

### 2. **Enroll All Students (Bulk)**

**Endpoint**: `POST /api/v1/school/devices/:deviceId/enroll-all`

**Headers**:
```
Authorization: Bearer <school_admin_token>
```

**Request Body** (optional):
```json
{
  "startingPin": 1
}
```

**Response**:
```json
{
  "success": true,
  "message": "Bulk enrollment completed",
  "data": {
    "enrolled": 8,
    "skipped": 0,
    "details": {
      "enrolled": [
        {
          "studentId": 1,
          "studentName": "John Doe",
          "devicePin": 1
        },
        {
          "studentId": 2,
          "studentName": "Jane Smith",
          "devicePin": 2
        }
      ],
      "skipped": []
    },
    "message": "8 students enrolled successfully. Commands queued to sync with device."
  }
}
```

**Example using curl**:
```bash
curl -X POST http://localhost:3001/api/v1/school/devices/2/enroll-all \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"startingPin": 1}'
```

---

### 3. **Get Enrolled Students**

**Endpoint**: `GET /api/v1/school/devices/:deviceId/enrolled-students`

**Headers**:
```
Authorization: Bearer <school_admin_token>
```

**Response**:
```json
{
  "success": true,
  "message": "Enrolled students retrieved successfully",
  "data": [
    {
      "mapping_id": 15,
      "device_pin": 3,
      "mapping_active": true,
      "student_id": 1,
      "full_name": "John Doe",
      "rfid_card_id": "1234567890",
      "grade": "Grade 10",
      "class_id": 1
    }
  ]
}
```

---

### 4. **Unenroll Student**

**Endpoint**: `DELETE /api/v1/school/devices/:deviceId/students/:studentId`

**Headers**:
```
Authorization: Bearer <school_admin_token>
```

**Response**:
```json
{
  "success": true,
  "message": "Student unenrolled from device successfully. Command queued to sync with device.",
  "data": null
}
```

---

## USAGE EXAMPLES

### Example 1: Enroll Your First Student

For your device with serial number `GED7242600838`:

1. **Get device ID from database**:
```sql
SELECT id FROM devices WHERE serial_number = 'GED7242600838';
-- Let's say device ID = 2
```

2. **Get student ID**:
```sql
SELECT id, full_name FROM students WHERE school_id = 1 LIMIT 1;
-- Let's say student ID = 1, name = "Ahmed Ali"
```

3. **Enroll the student**:
```bash
TOKEN="your_school_admin_token_here"

curl -X POST http://localhost:3001/api/v1/school/devices/2/enroll-student \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": 1, "devicePin": 3}'
```

4. **Wait 30 seconds** for device to poll the backend

5. **Test on device**: Enter PIN "3" or scan RFID card on the device

---

### Example 2: Bulk Enroll All Students

```bash
TOKEN="your_school_admin_token_here"

curl -X POST http://localhost:3001/api/v1/school/devices/2/enroll-all \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"startingPin": 1}'
```

This will:
- Assign PIN 1 to first student
- Assign PIN 2 to second student
- And so on...
- Queue commands for all students
- Device will receive all commands on next poll

---

## TROUBLESHOOTING

### Issue 1: "Unknown user PIN X"

**Cause**: Student with PIN X is not enrolled on the device

**Solution**:
1. Check if student is enrolled:
```bash
curl http://localhost:3001/api/v1/school/devices/2/enrolled-students \
  -H "Authorization: Bearer $TOKEN"
```

2. If not found, enroll the student:
```bash
curl -X POST http://localhost:3001/api/v1/school/devices/2/enroll-student \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": 1, "devicePin": 3}'
```

---

### Issue 2: "Device PIN already assigned"

**Cause**: Another student already has this PIN on the device

**Solution**:
1. Choose a different PIN number
2. Or unenroll the other student first:
```bash
curl -X DELETE http://localhost:3001/api/v1/school/devices/2/students/1 \
  -H "Authorization: Bearer $TOKEN"
```

---

### Issue 3: Commands not reaching device

**Cause**: Device not polling, or network issues

**Solution**:
1. Check device connectivity
2. Verify device IP configuration points to your backend
3. Check device logs in backend:
```bash
# Watch backend logs
tail -f backend/logs/device.log
```

---

## DEVICE COMMAND SYSTEM

### How Commands Work

1. **Queue Command**:
   - API call creates entry in `device_commands` table
   - Status: `pending`

2. **Device Polls**:
   - Device sends: `GET /iclock/getrequest?SN=GED7242600838`
   - Backend checks for pending commands

3. **Backend Responds**:
   - If commands exist, backend sends:
   ```
   C:295:DATA UPDATE user Pin=3	Name=Ahmed Ali	Card=1234567890	Privilege=0
   ```
   - Command status updated to `sent`

4. **Device Acknowledges**:
   - Device processes command
   - User data stored in device memory
   - Device responds: `OK`

5. **Complete**:
   - Command status updated to `completed`

---

## DATABASE SCHEMA

### device_user_mappings
```sql
CREATE TABLE device_user_mappings (
  id SERIAL PRIMARY KEY,
  device_id INTEGER REFERENCES devices(id),
  student_id INTEGER REFERENCES students(id),
  device_pin INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, student_id),
  UNIQUE(device_id, device_pin)
);
```

### device_commands
```sql
CREATE TABLE device_commands (
  id SERIAL PRIMARY KEY,
  device_id INTEGER REFERENCES devices(id),
  command_type VARCHAR(50) NOT NULL,
  command_string TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  sent_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## BEST PRACTICES

### 1. **PIN Number Management**
- Start PINs from 1 for each device
- Keep PINs sequential for easy management
- Document PIN assignments

### 2. **RFID Card IDs**
- Ensure RFID card IDs are unique per school
- Store full card ID in database
- Device will match automatically

### 3. **Bulk Enrollment**
- Use bulk enrollment for initial setup
- Enroll single students for new additions
- Verify enrollment after bulk operation

### 4. **Device Synchronization**
- Allow 30-60 seconds for commands to sync
- Check device_commands table for status
- Monitor backend logs for errors

---

## COMMAND LINE EXAMPLES

### Get School Admin Token
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "askarieex@gmail.com",
    "password": "admin123"
  }'
```

Save the token:
```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### List All Devices
```bash
curl http://localhost:3001/api/v1/school/devices \
  -H "Authorization: Bearer $TOKEN"
```

### List All Students
```bash
curl "http://localhost:3001/api/v1/school/students?page=1&limit=100" \
  -H "Authorization: Bearer $TOKEN"
```

### Enroll Student ID 1 with PIN 3 to Device ID 2
```bash
curl -X POST http://localhost:3001/api/v1/school/devices/2/enroll-student \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": 1, "devicePin": 3}'
```

### Check Enrollment Status
```bash
curl http://localhost:3001/api/v1/school/devices/2/enrolled-students \
  -H "Authorization: Bearer $TOKEN"
```

### View Pending Commands (via database)
```bash
psql school_attendance -c "
  SELECT dc.id, dc.command_type, dc.status, d.serial_number, dc.created_at
  FROM device_commands dc
  JOIN devices d ON dc.device_id = d.id
  WHERE dc.status = 'pending'
  ORDER BY dc.priority DESC, dc.created_at ASC;
"
```

---

## TESTING WITH REAL DEVICE

### Step-by-Step Test

1. **Ensure device is connected**:
   - Check backend logs for device polling
   - You should see: `GET /iclock/getrequest?SN=GED7242600838`

2. **Enroll a student**:
```bash
curl -X POST http://localhost:3001/api/v1/school/devices/2/enroll-student \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": 1, "devicePin": 3}'
```

3. **Check command was queued**:
```bash
psql school_attendance -c "
  SELECT * FROM device_commands
  WHERE device_id = 2 AND status = 'pending'
  ORDER BY created_at DESC LIMIT 1;
"
```

4. **Wait for device to poll** (max 30 seconds)

5. **Check command was sent**:
```bash
psql school_attendance -c "
  SELECT * FROM device_commands
  WHERE device_id = 2
  ORDER BY created_at DESC LIMIT 1;
"
# Status should be 'sent' or 'completed'
```

6. **Test on device**:
   - Enter PIN "3" on device keypad
   - Or scan student's RFID card
   - Device should show student name
   - Backend should receive attendance log

7. **Verify attendance was recorded**:
```bash
curl "http://localhost:3001/api/v1/school/attendance/today" \
  -H "Authorization: Bearer $TOKEN"
```

---

## FIXES IMPLEMENTED (October 18, 2025)

### 1. ✅ Fixed OPERLOG Parsing Error
**File**: `backend/src/services/attendanceParser.js`

**Issue**: Device sends OPERLOG entries (operation logs) which were being parsed as attendance data, causing errors.

**Fix**: Added filter to skip OPERLOG entries:
```javascript
if (trimmedLine.startsWith('OPLOG')) {
  console.log('⏭️  Skipping OPERLOG entry (operation log, not attendance)');
  continue;
}
```

---

### 2. ✅ Added Missing Endpoint
**Endpoint**: `GET /api/v1/school/attendance/today/stats`

**Issue**: Frontend was calling this endpoint but it returned 404.

**Fix**:
- Added `getTodayAttendanceStats()` method in `schoolController.js`
- Added route in `school.routes.js`

---

### 3. ✅ Implemented Device User Enrollment System

**New Endpoints**:
- `POST /api/v1/school/devices/:deviceId/enroll-student`
- `POST /api/v1/school/devices/:deviceId/enroll-all`
- `GET /api/v1/school/devices/:deviceId/enrolled-students`
- `DELETE /api/v1/school/devices/:deviceId/students/:studentId`

**New Features**:
- Enroll single student with custom PIN
- Bulk enroll all students automatically
- View enrolled students per device
- Unenroll students from devices
- Automatic command queuing for device sync

---

## SUPPORT

For issues:
1. Check backend logs: `tail -f backend/logs/server.log`
2. Check device logs in database: `SELECT * FROM device_commands ORDER BY created_at DESC`
3. Verify device connectivity
4. Review this documentation

---

**Status**: ✅ All Systems Operational
**Backend**: Running on port 3001
**Database**: PostgreSQL connected
**Device Integration**: Ready
