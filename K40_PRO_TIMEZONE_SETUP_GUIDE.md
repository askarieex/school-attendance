# 🌍 ZKTeco K40 Pro - Complete Timezone Setup Guide

## 🎯 Overview

This guide shows you how to **permanently configure timezone** on your ZKTeco K40 Pro biometric device so that:

✅ Attendance logs have **correct timestamps** (no UTC offset errors)
✅ Settings **survive device reboots** (stored in flash memory)
✅ No automatic time sync issues or clock drift
✅ No DST (Daylight Saving Time) jumps

---

## 🧩 Understanding the Problem

### Two Independent Time Layers

| Layer | What it controls | Default behavior |
|-------|------------------|------------------|
| **Device Clock (RTC)** | The actual hour/minute/date stored in device | Set manually or via `SET OPTIONS DateTime` |
| **Time Zone Offset** | Offset applied when device converts log times for PUSH data | Default = `+0000` (UTC) ❌ |
| **DST (Daylight Saving)** | Optional extra offset | Off by default ✅ |

### The Issue

If the timezone offset is wrong (e.g., still `+0000` UTC), your PUSH logs reach the backend **shifted by several hours** even if the on-screen clock looks correct!

**Example:**
- Device displays: `2:30 PM` (looks correct)
- Timezone: `+0000` (UTC) ❌
- Logs sent to backend: `9:00 AM` (wrong by 5.5 hours!)

---

## 🚀 Quick Setup (Recommended)

### Method 1: One-Shot API Call (Easiest)

This sends all 3 required commands automatically:

```bash
# Step 1: Get your device ID
curl http://localhost:3001/api/v1/test/devices

# Step 2: Setup timezone (replace DEVICE_ID with actual ID)
curl -X POST http://localhost:3001/api/v1/test/timezone/setup/DEVICE_ID \
  -H "Content-Type: application/json" \
  -d '{"timezone": "+0530"}'
```

**What this does:**
1. ✅ Sets timezone to `+0530` (IST)
2. ✅ Disables DST (prevents time jumps)
3. ✅ Saves to flash memory (survives reboot)

**Timeline:**
- `0-30s`: Command 1 sent to device
- `30-60s`: Command 2 sent to device
- `60-90s`: Command 3 sent to device
- `90s+`: All settings saved permanently ✅

### Step 3: Verify Configuration

Wait 2 minutes, then verify:

```bash
curl -X POST http://localhost:3001/api/v1/test/timezone/verify/DEVICE_ID
```

Watch backend console logs - you should see:
```
🌍 ========== DEVICE TIMEZONE REPORT ==========
   Timezone Offset: +0530
   ✅ TIMEZONE CORRECT - Device is using IST timezone!
```

### Step 4: Test After Reboot

1. Power off the K40 Pro device
2. Wait 10 seconds
3. Power it back on
4. Run verify command again
5. Timezone should still be `+0530` ✅

---

## 🔧 Manual Setup (Web Interface)

### Using Device LCD Menu

1. On device, press **Menu → System → Time Zone**
2. Select **India Standard Time (IST) +05:30**
3. Press **OK / Save**
4. Go to **Terminal → Update** (saves to flash)
5. Go to **Terminal → Reboot** (restart device)

### Using Web Interface

1. Open `http://DEVICE_IP` in browser
2. Login with admin credentials
3. Go to **Setting → Time Zone**
4. Select `+05:30` from dropdown
5. Click **OK / Save**
6. Click **Terminal → Update**
7. Click **Terminal → Reboot**

---

## 🛠️ Advanced: Individual API Commands

For fine-grained control, use individual endpoints:

### Set Timezone Only

```bash
curl -X POST http://localhost:3001/api/v1/test/timezone/set/DEVICE_ID \
  -H "Content-Type: application/json" \
  -d '{"timezone": "+0530"}'
```

**Other timezone examples:**
- Pakistan: `+0500`
- Bangladesh: `+0600`
- Nepal: `+0545`
- Sri Lanka: `+0530`
- USA EST: `-0500`

### Disable DST

```bash
curl -X POST http://localhost:3001/api/v1/test/timezone/disable-dst/DEVICE_ID
```

### Save to Flash (CRITICAL!)

```bash
curl -X POST http://localhost:3001/api/v1/test/timezone/save/DEVICE_ID
```

**⚠️ WARNING:** Always call save endpoint after timezone/DST changes! Otherwise settings may be lost on reboot.

---

## 📋 Complete Verification Checklist

After setup, verify all 6 items:

| # | Item | How to Check | Expected Result |
|---|------|--------------|-----------------|
| 1 | Timezone offset set | Run verify endpoint | `+0530` ✅ |
| 2 | DST disabled | Check backend logs | `DISABLED` ✅ |
| 3 | Saved to flash | Reboot device | Timezone survives ✅ |
| 4 | Device display time | Look at screen | Matches IST ✅ |
| 5 | Log timestamps | Create test attendance | Correct IST time ✅ |
| 6 | After power loss | Unplug & replug | Still `+0530` ✅ |

---

## 🔍 Troubleshooting

### Issue 1: Timezone Reverts to +0000 After Reboot

**Cause:** Settings not saved to flash

**Solution:**
```bash
# Send save command
curl -X POST http://localhost:3001/api/v1/test/timezone/save/DEVICE_ID

# Wait 30 seconds for device to execute

# Reboot and verify again
```

### Issue 2: Attendance Logs Still Have Wrong Time

**Cause:** Timezone was set AFTER logs were created

**Solution:**
- Old logs will remain with wrong timezone
- New logs (after timezone setup) will be correct
- Optionally: Clear old logs and re-scan students

### Issue 3: Verify Command Shows +0000

**Possible causes:**
1. Device hasn't polled yet (wait 30 seconds)
2. Command failed (check backend logs for errors)
3. Device firmware doesn't support TimeZone option (rare)

**Solution:**
```bash
# Check command status
curl http://localhost:3001/api/v1/test/check-command/COMMAND_ID

# If failed, try manual web interface method instead
```

### Issue 4: Time Jumps Forward/Backward Randomly

**Cause:** DST (Daylight Saving Time) is enabled

**Solution:**
```bash
# Disable DST
curl -X POST http://localhost:3001/api/v1/test/timezone/disable-dst/DEVICE_ID

# Save to flash
curl -X POST http://localhost:3001/api/v1/test/timezone/save/DEVICE_ID
```

---

## 🧪 Testing Guide

### 1. Before Setup - Verify Problem Exists

```bash
# Query current timezone
curl -X POST http://localhost:3001/api/v1/test/timezone/verify/DEVICE_ID
```

Expected (before setup):
```
❌ TIMEZONE WRONG - Device is still on UTC (default)
```

### 2. Run Setup

```bash
curl -X POST http://localhost:3001/api/v1/test/timezone/setup/DEVICE_ID \
  -H "Content-Type: application/json" \
  -d '{"timezone": "+0530"}'
```

### 3. Wait 2 Minutes

Device needs time to poll and execute all 3 commands.

### 4. Verify Success

```bash
curl -X POST http://localhost:3001/api/v1/test/timezone/verify/DEVICE_ID
```

Expected (after setup):
```
✅ TIMEZONE CORRECT - Device is using IST timezone!
```

### 5. Test Reboot Persistence

```bash
# Power off device physically
# Wait 10 seconds
# Power on device
# Wait 30 seconds for device to connect

# Verify again
curl -X POST http://localhost:3001/api/v1/test/timezone/verify/DEVICE_ID
```

Should still show `+0530` ✅

### 6. Test Attendance Log

```bash
# Scan RFID card on device
# Check backend logs for attendance event
# Verify timestamp matches current IST time
```

---

## 📡 API Endpoint Reference

### Complete Timezone Setup

**POST** `/api/v1/test/timezone/setup/:deviceId`

Body (optional):
```json
{
  "timezone": "+0530"
}
```

Response:
```json
{
  "success": true,
  "message": "Timezone setup commands queued successfully",
  "data": {
    "deviceId": 1,
    "timezone": "+0530",
    "commandsQueued": 3,
    "commands": [
      {
        "id": 123,
        "type": "SET_TIMEZONE",
        "description": "Set timezone to +0530"
      },
      {
        "id": 124,
        "type": "DISABLE_DST",
        "description": "Disable daylight saving time"
      },
      {
        "id": 125,
        "type": "SAVE_FLASH",
        "description": "Save settings to flash memory"
      }
    ]
  }
}
```

### Verify Timezone

**POST** `/api/v1/test/timezone/verify/:deviceId`

Response:
```json
{
  "success": true,
  "message": "Timezone verification command queued",
  "data": {
    "commandId": 126,
    "deviceId": 1,
    "command": "C:234:GET OPTIONS TimeZone",
    "status": "pending"
  }
}
```

### Set Custom Timezone

**POST** `/api/v1/test/timezone/set/:deviceId`

Body (required):
```json
{
  "timezone": "+0530"
}
```

### Save to Flash

**POST** `/api/v1/test/timezone/save/:deviceId`

### Disable DST

**POST** `/api/v1/test/timezone/disable-dst/:deviceId`

---

## 💻 Programmatic Usage (Node.js)

```javascript
const CommandGenerator = require('./services/commandGenerator');

// Generate complete timezone setup
const commands = CommandGenerator.completeTimeZoneSetup('+0530');

// commands is array of 3 command objects:
// [
//   { type: 'SET_TIMEZONE', commandString: 'C:230:SET OPTIONS TimeZone=+0530', ... },
//   { type: 'DISABLE_DST', commandString: 'C:231:SET OPTIONS DaylightSavings=0', ... },
//   { type: 'SAVE_FLASH', commandString: 'C:233:SET OPTIONS Save=1', ... }
// ]

// Insert into database (device will poll and execute)
for (const cmd of commands) {
  await db.query(
    'INSERT INTO device_commands (device_id, command_type, command_string, status, priority) VALUES ($1, $2, $3, $4, $5)',
    [deviceId, cmd.type, cmd.commandString, 'pending', cmd.priority]
  );
}
```

---

## 🧠 Technical Details

### ZKTeco PUSH Protocol Commands

1. **Set Timezone:**
   ```
   C:<ID>:SET OPTIONS TimeZone=+0530
   ```

2. **Disable DST:**
   ```
   C:<ID>:SET OPTIONS DaylightSavings=0
   ```

3. **Save to Flash:**
   ```
   C:<ID>:SET OPTIONS Save=1
   ```

4. **Get Timezone:**
   ```
   C:<ID>:GET OPTIONS TimeZone
   ```

### Device Response Format

When you query timezone, device responds via `POST /iclock/cdata` with:
```
TimeZone=+0530
```

Backend captures this and logs it in console.

### Why 3 Separate Commands?

Device processes commands **one at a time** (polls every ~30 seconds). Sending 3 commands ensures:

1. First poll: Device receives `SET TIMEZONE`, updates timezone
2. Second poll: Device receives `DISABLE DST`, updates DST setting
3. Third poll: Device receives `SAVE`, persists everything to flash

This sequence guarantees all settings are applied and saved.

---

## ✅ Best Practices

1. **Always disable DST** for attendance systems (prevents unexpected time jumps)
2. **Always save to flash** after timezone changes (persist across reboots)
3. **Verify after reboot** to confirm settings survived
4. **Set timezone once** during initial setup, don't change frequently
5. **Use manual time mode** (disable auto time sync from PC)
6. **Test with attendance logs** to confirm timestamps are correct

---

## 🔗 Related Documentation

- [RFID Machine Communication Guide](./RFID_MACHINE_COMMUNICATION_COMPLETE_GUIDE.md)
- [Time Sync Fix Documentation](./TIME_SYNC_ABSOLUTE_FINAL_FIX.md)
- [Disable Time Sync Guide](./DISABLE_TIME_SYNC_COMPLETE.md)

---

## 📞 Support

If you encounter issues:

1. Check backend console logs for detailed error messages
2. Verify device is online: `GET /api/v1/test/devices`
3. Check command status: `GET /api/v1/test/check-command/:commandId`
4. Try manual web interface method as fallback
5. Ensure device firmware is up-to-date

---

## 📝 Changelog

**v1.0.0** - 2025-01-XX
- Initial timezone management system
- Complete API endpoints for setup/verify/save
- Automated one-shot setup endpoint
- Comprehensive verification and logging
- Flash memory persistence
- DST management

---

**🎉 You're done!** Your K40 Pro now has permanent timezone configuration.

Attendance logs will have correct IST timestamps, and settings will survive reboots.
