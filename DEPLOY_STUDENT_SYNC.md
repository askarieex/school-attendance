# 🚀 Deploy Student Sync Verification - Quick Guide

## 📋 What We Built

**3 new features to keep your device always in sync with database:**

1. **Sync Status Tracking** - Know which students are synced to device
2. **Auto-Verification (Every 2 Hours)** - Automatically fixes missing/extra students
3. **Manual Sync API** - Button to force full re-sync

---

## ⚡ Quick Deploy (5 Minutes)

### Step 1: Upload Files to VPS (2 minutes)

From your Mac, run:

```bash
# Go to project folder
cd /Users/askerymalik/Documents/Development/school-attendance-sysytem

# Copy migration file
scp backend/migrations/012_device_sync_status.sql root@165.22.214.208:/root/school-attendance-system/backend/migrations/

# Copy sync service
scp backend/src/services/studentSyncVerification.js root@165.22.214.208:/root/school-attendance-system/backend/src/services/

# Copy routes
scp backend/src/routes/deviceManagement.routes.js root@165.22.214.208:/root/school-attendance-system/backend/src/routes/

# Copy controller
scp backend/src/controllers/deviceManagementController.js root@165.22.214.208:/root/school-attendance-system/backend/src/controllers/

# Copy updated server.js
scp backend/src/server.js root@165.22.214.208:/root/school-attendance-system/backend/src/
```

---

### Step 2: Run Database Migration (1 minute)

```bash
# SSH to VPS
ssh root@165.22.214.208

# Go to backend folder
cd /root/school-attendance-system/backend

# Run migration
sudo -u postgres psql school_attendance < migrations/012_device_sync_status.sql
```

**Expected output:**
```
BEGIN
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
COMMENT
COMMENT
COMMENT
CREATE FUNCTION
CREATE TRIGGER
INSERT 0 X
COMMIT
NOTICE:  ✅ Migration 012 complete!
NOTICE:     Created device_user_sync_status table
NOTICE:     Initial sync records: X
```

---

### Step 3: Restart Backend (1 minute)

```bash
# Still on VPS
pm2 restart school-attendance-api

# Watch logs
pm2 logs school-attendance-api --lines 50
```

**Expected logs:**
```
✅ Database connection successful
🔍 Starting Automatic Absence Detection Service...
✅ Student Sync Verification scheduled: 0 */2 * * * (IST)
🔄 Starting Student Sync Verification Service...
🔄 Running initial sync verification check...
🚀 Server is running on port 5000
```

**After 5 seconds, you should see:**
```
🔄 ========== STUDENT SYNC VERIFICATION START ==========
📱 Found 1 active device(s) to verify
🔍 Verifying device: ss (ID: X, School: 1)
   Expected students in database: 50
   Synced students in device: 50
   Missing students: 0
   Extra students: 0
   ✅ Verification complete for device: ss
✅ ========== STUDENT SYNC VERIFICATION COMPLETE ==========
```

---

## 🧪 Test the Sync Features

### Test 1: Check Sync Status

```bash
# Get your auth token first (replace with your actual token)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Check sync status for device ID 1
curl -X GET "http://localhost:5000/api/v1/device-management/1/sync-status" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "device": {
      "id": 1,
      "name": "ss",
      "serialNumber": "GED7242600838",
      "isOnline": true,
      "lastSeen": "2025-11-18T..."
    },
    "summary": {
      "total": 50,
      "synced": 48,
      "pending": 2,
      "sent": 0,
      "failed": 0,
      "not_synced": 0
    },
    "students": [...],
    "pendingCommands": 2,
    "syncHealthPercentage": 96
  }
}
```

---

### Test 2: Manual Full Sync

```bash
# Force full sync for device ID 1
curl -X POST "http://localhost:5000/api/v1/device-management/1/sync-students" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected response:**
```json
{
  "success": true,
  "message": "Full sync initiated for device ss. 50 student(s) queued for sync.",
  "data": {
    "deviceId": 1,
    "deviceName": "ss",
    "totalStudents": 50,
    "commandsQueued": 50,
    "commandsSkipped": 0,
    "estimatedSyncTime": "10 minutes"
  }
}
```

---

### Test 3: Manual Verification

```bash
# Run sync verification manually
curl -X POST "http://localhost:5000/api/v1/device-management/1/verify-sync" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected response:**
```json
{
  "success": true,
  "message": "Sync verification completed",
  "data": {
    "deviceId": 1,
    "deviceName": "ss",
    "verification": {
      "missing": 2,
      "extra": 0,
      "synced": 48
    },
    "message": "Found 2 missing and 0 extra student(s). Correction commands queued."
  }
}
```

---

## 📊 How to Check Sync Status Anytime

### Quick SQL Check:

```bash
ssh root@165.22.214.208

sudo -u postgres psql school_attendance -c "
SELECT
  (SELECT COUNT(*) FROM students WHERE school_id = 1 AND is_active = TRUE AND rfid_card_id IS NOT NULL) as db_students,
  (SELECT COUNT(*) FROM device_user_sync_status WHERE device_id = 1 AND sync_status = 'synced') as synced_students,
  (SELECT COUNT(*) FROM device_user_sync_status WHERE device_id = 1 AND sync_status = 'pending') as pending_students,
  (SELECT COUNT(*) FROM device_user_sync_status WHERE device_id = 1 AND sync_status = 'failed') as failed_students;
"
```

**Perfect sync:**
```
 db_students | synced_students | pending_students | failed_students
-------------+-----------------+------------------+-----------------
          50 |              50 |                0 |               0
```

**Out of sync:**
```
 db_students | synced_students | pending_students | failed_students
-------------+-----------------+------------------+-----------------
          50 |              45 |                3 |               2
```
This means: 45 synced, 3 pending (will sync soon), 2 failed (need attention)

---

## 🔄 How Auto-Sync Works

### Schedule:
- Runs **every 2 hours** (can change in .env: `SYNC_VERIFICATION_SCHEDULE="0 */2 * * *"`)
- IST timezone

### What it does:

1. **Gets expected students from database**
   - All active students with RFID cards

2. **Gets synced students from sync_status table**
   - Students marked as 'synced', 'sent', or 'pending'

3. **Finds MISSING students**
   - In database but not in device
   - → Queues add_user command

4. **Finds EXTRA students**
   - In device but not in database (or inactive)
   - → Queues delete_user command

5. **Retries FAILED syncs**
   - Up to 3 retry attempts
   - After 3 failures, manual intervention needed

### Logs to watch:

```bash
pm2 logs school-attendance-api | grep "SYNC VERIFICATION"
```

**Healthy logs:**
```
🔄 ========== STUDENT SYNC VERIFICATION START ==========
📱 Found 1 active device(s) to verify
   Expected students in database: 50
   Synced students in device: 50
   Missing students: 0
   Extra students: 0
✅ ========== STUDENT SYNC VERIFICATION COMPLETE ==========
```

**Issues detected logs:**
```
🔄 ========== STUDENT SYNC VERIFICATION START ==========
📱 Found 1 active device(s) to verify
   Expected students in database: 50
   Synced students in device: 45
   Missing students: 5
   Extra students: 2
   ⚠️  Adding 5 missing student(s) to device...
      ➕ Queued add: John Doe (PIN: 101, RFID: 1234567890)
      ...
   ⚠️  Removing 2 extra student(s) from device...
      ➖ Queued delete: Old Student (PIN: 999)
      ...
✅ ========== STUDENT SYNC VERIFICATION COMPLETE ==========
```

---

## 📱 Future: Add to Admin Dashboard

You can add these buttons to your React admin panel:

```jsx
// In your Device Management page

<Card>
  <h3>Device: {device.name}</h3>
  <p>Sync Health: {syncHealth}%</p>

  <div>
    <Button onClick={() => checkSyncStatus(deviceId)}>
      📊 Check Sync Status
    </Button>

    <Button onClick={() => fullSyncDevice(deviceId)}>
      🔄 Full Sync All Students
    </Button>

    <Button onClick={() => verifySyncDevice(deviceId)}>
      🔍 Verify & Fix Sync
    </Button>
  </div>

  <Table>
    <thead>
      <tr>
        <th>Student</th>
        <th>RFID Card</th>
        <th>Class</th>
        <th>Sync Status</th>
        <th>Last Synced</th>
      </tr>
    </thead>
    <tbody>
      {students.map(s => (
        <tr key={s.id}>
          <td>{s.full_name}</td>
          <td>{s.rfid_card_id}</td>
          <td>{s.class_name} - {s.section_name}</td>
          <td>
            <Badge color={getSyncStatusColor(s.sync_status)}>
              {s.sync_status}
            </Badge>
          </td>
          <td>{s.last_sync_success || 'Never'}</td>
        </tr>
      ))}
    </tbody>
  </Table>
</Card>
```

---

## ✅ Verification Checklist

After deployment, verify everything works:

- [ ] Migration ran successfully (table created)
- [ ] Backend restarted without errors
- [ ] Sync service started (check logs)
- [ ] Initial sync verification ran (check logs after 5 seconds)
- [ ] API endpoint works: GET `/device-management/1/sync-status`
- [ ] Manual sync works: POST `/device-management/1/sync-students`
- [ ] Manual verification works: POST `/device-management/1/verify-sync`
- [ ] Auto-sync runs every 2 hours (check logs)

---

## 🚨 Troubleshooting

### Issue: Migration fails with "relation already exists"

**Solution:** Table already exists, skip migration
```bash
# Just verify table exists
sudo -u postgres psql school_attendance -c "\d device_user_sync_status"
```

### Issue: Backend won't start - "Cannot find module studentSyncVerification"

**Solution:** File upload failed, re-upload:
```bash
scp backend/src/services/studentSyncVerification.js root@165.22.214.208:/root/school-attendance-system/backend/src/services/
```

### Issue: API returns 404 for device-management endpoints

**Solution:** Routes not registered, check server.js:
```bash
grep "deviceManagementRoutes" /root/school-attendance-system/backend/src/server.js
```

Should see:
```javascript
const deviceManagementRoutes = require('./routes/deviceManagement.routes');
app.use(`/api/${API_VERSION}/device-management`, deviceManagementRoutes);
```

### Issue: Sync service doesn't run

**Solution:** Check logs for errors:
```bash
pm2 logs school-attendance-api --err --lines 50
```

---

## 📊 Monitor Sync Health

### Daily Check:

```bash
# Quick health check
ssh root@165.22.214.208 "sudo -u postgres psql school_attendance -c \"
SELECT
  d.serial_number,
  d.device_name,
  COUNT(*) FILTER (WHERE dss.sync_status = 'synced') as synced,
  COUNT(*) FILTER (WHERE dss.sync_status = 'pending') as pending,
  COUNT(*) FILTER (WHERE dss.sync_status = 'failed') as failed
FROM devices d
LEFT JOIN device_user_sync_status dss ON d.id = dss.device_id
WHERE d.is_active = TRUE
GROUP BY d.id, d.serial_number, d.device_name;
\""
```

**Expected output:**
```
 serial_number  | device_name | synced | pending | failed
----------------+-------------+--------+---------+--------
 GED7242600838  | ss          |     50 |       0 |      0
```

---

## 🎯 Summary

**What you got:**

1. ✅ **Sync Status Table** - Tracks which students are synced to device
2. ✅ **Auto-Verification Service** - Runs every 2 hours, fixes sync issues
3. ✅ **Manual Sync API** - 3 endpoints for checking and fixing sync
4. ✅ **Detailed Logs** - Know exactly what's happening
5. ✅ **Retry Mechanism** - Auto-retries failed syncs up to 3 times

**How to use:**

- **Let it run automatically** - Sync service checks every 2 hours
- **Manual check** - Use API to get sync status anytime
- **Force sync** - Use API to queue all students for sync
- **Monitor** - Check logs or run SQL queries

**Your device will ALWAYS be in sync with database now! 🎉**

---

## 📞 Next Steps

1. ✅ Deploy (follow steps above) - 5 minutes
2. ✅ Test API endpoints - 5 minutes
3. ⚠️ Add to admin dashboard (optional) - 1 hour
4. ⚠️ Test with real students - 10 minutes

---

**Questions? Issues? Share the logs! 🚀**
