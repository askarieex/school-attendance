# Quick Start Guide - Serial Number Authentication

## 🚀 Getting Started in 5 Minutes

This guide will get your system up and running with the new serial number authentication.

---

## Step 1: Run Database Migration (2 minutes)

Open your terminal and run:

```bash
cd /Users/askerymalik/Documents/Development/school-attendance-sysytem/backend
node scripts/runMigration.js
```

You should see:
```
✅ Database connected successfully
📦 Running migration: 001_update_devices_to_serial_number.sql
✅ Migration 001_update_devices_to_serial_number.sql completed successfully
```

---

## Step 2: Restart Your Servers (1 minute)

### Terminal 1 - Backend
```bash
cd /Users/askerymalik/Documents/Development/school-attendance-sysytem/backend
npm run dev
```

Wait for:
```
✅ Database connection successful
🚀 Server is running on port 3001
```

### Terminal 2 - Frontend
```bash
cd /Users/askerymalik/Documents/Development/school-attendance-sysytem/super-admin-panel
npm start
```

Wait for:
```
webpack compiled successfully
```

---

## Step 3: Register Your First Device (2 minutes)

1. **Open your browser**: http://localhost:3000

2. **Login** to the Super Admin Panel

3. **Go to Devices** (sidebar menu)

4. **Click "Register Device"**

5. **Fill the form:**
   - **Select School**: Choose a school
   - **Device Serial Number**: `ZK12345678` (from your ZKTeco device label)
   - **Device Name**: `Main Entrance Scanner`
   - **Location**: `Building A - Ground Floor`

6. **Click "Register Device"**

7. **Success!** Your device is now authorized ✅

---

## Step 4: Test Device Authentication (Optional)

Test if your device can authenticate:

```bash
curl -X GET http://localhost:3001/api/v1/device/sync/status \
  -H "X-Device-Serial: ZK12345678" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "status": "online",
    "serverTime": "2024-10-12T10:30:00.000Z"
  }
}
```

---

## ✅ You're Done!

Your system is now using secure serial number authentication.

---

## What Changed?

### Before:
- ❌ System generated random API keys (UUIDs)
- ❌ No physical connection to hardware

### After:
- ✅ Uses physical Serial Numbers from ZKTeco devices
- ✅ More secure and traceable
- ✅ Easier to manage

---

## Common Issues

### Issue: Migration fails with "relation already exists"

**Solution**: The migration has already been run. Check your devices:

```bash
psql -U your_username -d school_attendance_db -c "SELECT id, device_name, serial_number FROM devices;"
```

---

### Issue: Cannot connect to database

**Solution**: Make sure PostgreSQL is running and your `.env` file is correct:

```bash
# Check if PostgreSQL is running
pg_isready

# Check your .env file
cd backend
cat .env | grep DB_
```

---

### Issue: Frontend shows "Failed to load schools"

**Solution**: Backend is not running or wrong port. Check:

1. Backend is running on port 3001
2. Check `super-admin-panel/.env`:
   ```
   REACT_APP_API_URL=http://localhost:3001/api/v1
   ```

---

## Next Steps

- ✅ Register all your physical devices
- ✅ Read `DEVICE_REGISTRATION_GUIDE.md` for detailed instructions
- ✅ Configure your ZKTeco devices to connect to your server

---

## Need Help?

- 📖 Read: `DEVICE_REGISTRATION_GUIDE.md`
- 📝 Details: `IMPLEMENTATION_SUMMARY.md`
- 💬 Check backend logs for errors

---

**Happy coding! 🎉**
