# 🧪 Postman Testing Guide for ZKTeco Endpoints

## 📥 Step 1: Import the Postman Collection

1. Open **Postman**
2. Click **Import** button (top left)
3. Click **Upload Files**
4. Select the file: `ZKTeco_Postman_Collection.json`
5. Click **Import**

You should now see a collection called **"ZKTeco K40 Pro Integration"** in your sidebar.

---

## ✅ Step 2: Verify Test Data is Ready

I've already created:
- ✅ Test Device: Serial Number = `TEST123456789`, Device ID = 4
- ✅ Test Student: Name = "Test Student Ali", RFID = `1234567890`, Student ID = 9
- ✅ Device Mapping: Student 9 → Device 4 → PIN 101

---

## 🧪 Test 1: Device Authentication (GET /iclock/getrequest)

### What This Tests:
- Device can connect to your server
- Device authentication works
- No commands are pending

### Steps in Postman:

1. Select request: **"1. Test Device Authentication (Should return OK)"**
2. You'll see:
   - **Method**: `GET`
   - **URL**: `http://localhost:3001/iclock/getrequest?SN=TEST123456789`
3. Click **Send**

### ✅ Expected Response:

**Status**: `200 OK`

**Body**:
```
OK
```

**Headers** (check):
- `Content-Type: text/plain`

### What This Means:
- ✅ Device authenticated successfully
- ✅ No commands waiting in queue
- ✅ Backend is working

---

## 🧪 Test 2: Submit Attendance Data (POST /iclock/cdata)

### What This Tests:
- Device can send attendance logs
- Backend parses tab-separated data
- Backend saves attendance to database

### Steps in Postman:

1. Select request: **"2. Submit Attendance Data (Student Scan)"**
2. You'll see:
   - **Method**: `POST`
   - **URL**: `http://localhost:3001/iclock/cdata?SN=TEST123456789`
   - **Headers**: `Content-Type: text/plain`
   - **Body** (raw text):
     ```
     101	2025-10-18 08:45:30	1	15	0	0
     ```
     ⚠️ **IMPORTANT**: The spaces above are **TAB characters** (not spaces). Make sure your body has tabs, not spaces!

3. Click **Send**

### ✅ Expected Response:

**Status**: `200 OK`

**Body**:
```
OK
```

### Verify in Database:

Open your database and run:
```sql
SELECT * FROM attendance_logs ORDER BY created_at DESC LIMIT 1;
```

You should see a new attendance record for student ID 9 at 08:45:30.

---

## 🧪 Test 3: Submit Multiple Attendance Records

### Steps in Postman:

1. Select request: **"3. Submit Multiple Attendance Records"**
2. Body contains multiple lines (each line = one scan):
   ```
   101	2025-10-18 08:45:30	1	15	0	0
   102	2025-10-18 08:47:15	1	15	0	0
   103	2025-10-18 09:15:00	1	15	0	0
   ```
3. Click **Send**

### ✅ Expected Response:

**Status**: `200 OK`
**Body**: `OK`

### What Happens:
- Backend processes 3 attendance logs
- PIN 101 → saves successfully (student exists)
- PIN 102, 103 → logged as "unknown user" (no mapping exists)

---

## 🧪 Test 4: Invalid Device (Authentication Failure)

### What This Tests:
- Security: Unregistered devices cannot connect

### Steps in Postman:

1. Select request: **"4. Test Invalid Device (Should Fail)"**
2. URL has: `?SN=INVALID_DEVICE`
3. Click **Send**

### ✅ Expected Response:

**Status**: `401 Unauthorized`

**Body**:
```
ERROR: Device not registered
```

### What This Means:
- ✅ Authentication is working
- ✅ Only registered devices can connect

---

## 🧪 Test 5: Queue a Command & Retrieve It

### Part A: Queue "Add User" Command

First, queue a command using SQL:

```sql
INSERT INTO device_commands (device_id, command_type, command_string, priority, status)
VALUES (
  4,
  'add_user',
  E'C:295:DATA UPDATE user Pin=102\tName=Sara Ahmed\tCard=9876543210\tPrivilege=0',
  10,
  'pending'
);
```

### Part B: Poll for Command

1. Select request: **"6. Poll for Command (After Queuing)"**
2. Click **Send**

### ✅ Expected Response:

**Status**: `200 OK`

**Body**:
```
C:295:DATA UPDATE user Pin=102	Name=Sara Ahmed	Card=9876543210	Privilege=0
```

**Note**: The spaces in the response are TAB characters.

### What This Means:
- ✅ Command queue is working
- ✅ Device would receive this command
- ✅ Device would add Sara Ahmed (PIN 102) to its memory

### Verify Command Status:

```sql
SELECT * FROM device_commands WHERE device_id = 4 ORDER BY created_at DESC LIMIT 1;
```

The status should have changed from `pending` to `sent`.

---

## 🧪 Test 6: Poll Again (Should Return OK)

1. Click **Send** on the poll request again
2. This time you should get: `OK`
3. Why? Because the command was already sent (status = 'sent', not 'pending')

---

## 📊 Check Your Backend Logs

While testing, watch your backend terminal. You should see logs like:

```
✅ Device authenticated: TEST123456789 (Test K40 Pro) - School: ...

📥 Receiving attendance data from device: Test K40 Pro (SN: TEST123456789)
Raw data received: 101	2025-10-18 08:45:30	1	15	0	0
📋 Parsed 1 attendance records from device
✅ Attendance recorded: Test Student Ali - present at 2025-10-18 08:45:30

✅ Attendance processing complete: { success: 1, duplicate: 0, failed: 0 }
```

---

## 🎯 Quick Reference: Request Details

### Request 1: GET /iclock/getrequest
- **URL**: `http://localhost:3001/iclock/getrequest?SN=TEST123456789`
- **Method**: GET
- **Headers**: None required
- **Expected**: `OK` or command string

### Request 2: POST /iclock/cdata
- **URL**: `http://localhost:3001/iclock/cdata?SN=TEST123456789`
- **Method**: POST
- **Headers**: `Content-Type: text/plain`
- **Body**: Tab-separated attendance data
- **Expected**: `OK`

---

## 🐛 Troubleshooting

### Problem: "Device not registered"

**Solution**: Make sure device exists in database:
```sql
SELECT * FROM devices WHERE serial_number = 'TEST123456789';
```

### Problem: Attendance not saving

**Solution**: Check if student mapping exists:
```sql
SELECT * FROM device_user_mappings WHERE device_id = 4 AND device_pin = 101;
```

### Problem: Command not being sent

**Solution**: Check command queue:
```sql
SELECT * FROM device_commands WHERE device_id = 4 AND status = 'pending';
```

---

## 📝 Notes About TAB Characters

The ZKTeco format uses **TAB characters (`\t`)**, not spaces!

In Postman body:
- To insert a TAB: Press the `Tab` key on your keyboard
- Or: Copy the provided body text from the collection (it has real tabs)

**Example with tabs**:
```
101[TAB]2025-10-18 08:45:30[TAB]1[TAB]15[TAB]0[TAB]0
```

**DON'T use spaces**:
```
101 2025-10-18 08:45:30 1 15 0 0  ❌ WRONG!
```

---

## ✅ Summary

After completing all tests, you've verified:

1. ✅ Device authentication works
2. ✅ Attendance data submission works
3. ✅ Data parsing works (tab-separated format)
4. ✅ Attendance records are saved to database
5. ✅ Command queue works
6. ✅ Commands are sent to devices
7. ✅ Security works (invalid devices are rejected)

**Your ZKTeco integration is fully functional!** 🎉
