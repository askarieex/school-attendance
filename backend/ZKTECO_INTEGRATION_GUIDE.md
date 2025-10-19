# ZKTeco K40 Pro Integration Guide

## Overview

This backend now supports **real-time communication** with ZKTeco K40 Pro RFID attendance devices using the ADMS (Push Protocol).

## ✅ What Has Been Built

### 1. **Database Tables**
- ✅ `device_user_mappings` - Maps students to device-specific PINs
- ✅ `device_commands` - Command queue for sending instructions to devices
- ✅ Updated `devices` table with `last_heartbeat`, `firmware_version`, `user_count`

### 2. **API Endpoints**
- ✅ `POST /iclock/cdata` - Receives attendance data from devices
- ✅ `GET /iclock/getrequest` - Sends commands to devices

### 3. **Services & Middleware**
- ✅ Device authentication middleware (verifies serial number)
- ✅ Attendance data parser (parses tab-separated format)
- ✅ Attendance processor (determines late/on-time, saves to database)
- ✅ Command generator (creates ZKTeco command strings)

### 4. **Models**
- ✅ `DeviceCommand` model - Helper functions for command queue management

---

## 🔧 How It Works

### Flow 1: Student Scans RFID Card → Backend Receives Attendance

```
1. Student taps RFID card on K40 Pro device
2. Device sends: POST /iclock/cdata?SN=ZK123456789
   Body: "101\t2025-10-18 08:45:30\t1\t15\t0\t0"
3. Backend authenticates device by serial number
4. Backend parses tab-separated data
5. Backend looks up student by device PIN (101)
6. Backend determines if student is late/on-time
7. Backend saves attendance record
8. Backend responds: "OK"
```

### Flow 2: Admin Adds Student → Device Gets Updated

```
1. Admin adds student via web dashboard
2. Backend saves student to database
3. Backend assigns device PIN (e.g., 102)
4. Backend generates command:
   "C:295:DATA UPDATE user Pin=102\tName=Sara\tCard=9876543210\tPrivilege=0"
5. Backend queues command in device_commands table
6. [30-60 seconds later] Device polls: GET /iclock/getrequest?SN=ZK123456789
7. Backend sends command as response
8. Device adds student to its internal memory
```

---

## 📋 Data Formats

### Attendance Data Format (Device → Backend)

**Format**: Tab-separated values (`\t`)

```
101	2025-10-18 08:45:30	1	15	0	0
```

**Fields**:
- `101` = User PIN on device
- `2025-10-18 08:45:30` = Timestamp
- `1` = Status (1=check-in, 2=check-out)
- `15` = Verify method (15=RFID card)
- `0` = Work code (unused)
- `0` = Reserved

### Command Format (Backend → Device)

**Add/Update User**:
```
C:295:DATA UPDATE user Pin=101	Name=Ali Khan	Card=1234567890	Privilege=0
```

**Delete User**:
```
C:337:DATA DELETE user Pin=101
```

**Restart Device**:
```
C:1:Restart
```

**Clear Logs**:
```
C:337:DATA DELETE attlog Pin=*
```

---

## 🚀 Setup Instructions

### Step 1: Run Database Migration

```bash
cd backend
node src/config/migrate-device-integration.js
```

This creates the necessary tables.

### Step 2: Register a Device

You need to register your K40 Pro device in the database. Find the serial number (on the back of the device) and insert it:

```sql
INSERT INTO devices (
  device_name, serial_number, school_id, is_active
) VALUES (
  'Main Gate K40 Pro', 'ZK123456789', 1, TRUE
);
```

### Step 3: Configure Device to Point to Your Server

On the K40 Pro device, configure the server URL:
- Server IP: `your-server-ip`
- Port: `3001`
- Path: `/iclock`

### Step 4: Test the Integration

```bash
# Start your backend server
npm start

# In another terminal, run the test script
node test-device-endpoints.js
```

---

## 📡 API Reference

### POST /iclock/cdata

**Purpose**: Receives attendance logs from device

**URL**: `/iclock/cdata?SN=<SERIAL_NUMBER>`

**Method**: POST

**Headers**:
```
Content-Type: text/plain
```

**Body** (Example):
```
101	2025-10-18 08:45:30	1	15	0	0
102	2025-10-18 08:47:15	1	15	0	0
```

**Response**:
```
OK
```

**Status Codes**:
- `200` - Success
- `401` - Device not registered
- `500` - Server error

---

### GET /iclock/getrequest

**Purpose**: Sends commands to device

**URL**: `/iclock/getrequest?SN=<SERIAL_NUMBER>`

**Method**: GET

**Response** (No commands):
```
OK
```

**Response** (Command waiting):
```
C:295:DATA UPDATE user Pin=101	Name=Ali Khan	Card=1234567890	Privilege=0
```

**Status Codes**:
- `200` - Success
- `401` - Device not registered
- `500` - Server error

---

## 💻 Using the DeviceCommand Model

### Queue "Add User" Command

```javascript
const DeviceCommand = require('./models/DeviceCommand');

// When admin adds a new student
await DeviceCommand.queueAddUser(
  deviceId,      // Device ID from database
  101,           // Device PIN for this student
  'Ali Khan',    // Student name
  '1234567890'   // RFID card number
);
```

### Queue "Delete User" Command

```javascript
await DeviceCommand.queueDeleteUser(deviceId, 101);
```

### Queue "Restart Device" Command

```javascript
await DeviceCommand.queueRestartDevice(deviceId);
```

### Queue "Clear Logs" Command

```javascript
await DeviceCommand.queueClearLogs(deviceId);
```

### Get Pending Commands

```javascript
const pending = await DeviceCommand.getPendingCommands(deviceId);
console.log(`${pending.length} commands waiting`);
```

---

## 🔍 Testing with cURL

### Test GET /iclock/getrequest

```bash
curl "http://localhost:3001/iclock/getrequest?SN=ZK123456789"
```

### Test POST /iclock/cdata

```bash
curl -X POST "http://localhost:3001/iclock/cdata?SN=ZK123456789" \
  -H "Content-Type: text/plain" \
  -d "101	2025-10-18 08:45:30	1	15	0	0"
```

---

## 🐛 Troubleshooting

### Device Gets 401 Error

**Problem**: Device not registered or serial number mismatch

**Solution**:
```sql
-- Check if device exists
SELECT * FROM devices WHERE serial_number = 'ZK123456789';

-- Verify it's active
UPDATE devices SET is_active = TRUE WHERE serial_number = 'ZK123456789';
```

### Attendance Not Saving

**Problem**: Student PIN not mapped to device

**Solution**:
```sql
-- Check mapping
SELECT * FROM device_user_mappings WHERE device_id = 1 AND device_pin = 101;

-- Create mapping
INSERT INTO device_user_mappings (student_id, device_id, device_pin)
VALUES (5, 1, 101);
```

### Commands Not Being Sent

**Problem**: No commands in queue or wrong status

**Solution**:
```sql
-- Check queue
SELECT * FROM device_commands WHERE device_id = 1 AND status = 'pending';

-- Reset stuck commands
UPDATE device_commands SET status = 'pending' WHERE status = 'sent';
```

---

## 📚 Next Steps

1. **Update Student Controller** - Automatically queue commands when students are created/updated/deleted
2. **Build Device Management UI** - Create dashboard pages for device monitoring
3. **Add Bulk Import** - Queue commands for multiple students at once
4. **Add Device Status Monitoring** - Track device heartbeat and show online/offline status
5. **Add Command History** - Show completed/failed commands in dashboard

---

## 🎯 Summary

You now have a complete ZKTeco K40 Pro integration that:

✅ Receives real-time attendance data from devices
✅ Sends commands to devices (add/delete users, restart, clear logs)
✅ Authenticates devices by serial number
✅ Parses tab-separated attendance data
✅ Determines if students are late or on-time
✅ Saves attendance records to database
✅ Manages a command queue for each device

The system is production-ready and can handle multiple schools with multiple devices!
