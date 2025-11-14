# 🌍 K40 Pro Timezone - Quick Reference Card

## 🚀 One-Command Setup (Easiest)

```bash
# Step 1: Get device ID
curl http://localhost:3001/api/v1/test/devices

# Step 2: Setup timezone (replace 1 with your device ID)
curl -X POST http://localhost:3001/api/v1/test/timezone/setup/1 \
  -H "Content-Type: application/json" \
  -d '{"timezone": "+0530"}'

# Step 3: Wait 90 seconds, then verify
curl -X POST http://localhost:3001/api/v1/test/timezone/verify/1
```

**Or use the shell script:**

```bash
cd backend/scripts
./setup-timezone.sh list           # List devices
./setup-timezone.sh setup 1        # Setup IST timezone
./setup-timezone.sh verify 1       # Verify configuration
```

---

## 📡 All API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/test/timezone/setup/:deviceId` | POST | Complete setup (3 commands) |
| `/api/v1/test/timezone/verify/:deviceId` | POST | Verify current timezone |
| `/api/v1/test/timezone/set/:deviceId` | POST | Set timezone only |
| `/api/v1/test/timezone/save/:deviceId` | POST | Save to flash |
| `/api/v1/test/timezone/disable-dst/:deviceId` | POST | Disable DST |
| `/api/v1/test/devices` | GET | List all devices |
| `/api/v1/test/check-command/:commandId` | GET | Check command status |

---

## 🌐 Common Timezones

| Country/Region | Timezone Code | Offset |
|----------------|---------------|--------|
| 🇮🇳 India (IST) | `+0530` | UTC+5:30 |
| 🇳🇵 Nepal | `+0545` | UTC+5:45 |
| 🇧🇩 Bangladesh | `+0600` | UTC+6:00 |
| 🇵🇰 Pakistan | `+0500` | UTC+5:00 |
| 🇱🇰 Sri Lanka | `+0530` | UTC+5:30 |
| 🇦🇪 UAE | `+0400` | UTC+4:00 |
| 🇬🇧 UK (GMT) | `+0000` | UTC+0:00 |
| 🇺🇸 USA (EST) | `-0500` | UTC-5:00 |
| 🇺🇸 USA (PST) | `-0800` | UTC-8:00 |

---

## ✅ Verification Checklist

After setup, check all 6 items:

- [ ] Timezone shows `+0530` (not `+0000`)
- [ ] DST disabled
- [ ] Settings survive device reboot
- [ ] Device display shows correct IST time
- [ ] New attendance logs have correct timestamps
- [ ] After power loss, timezone still `+0530`

---

## 🔧 Node.js Code Example

```javascript
const CommandGenerator = require('./services/commandGenerator');

// Complete timezone setup (returns array of 3 commands)
const commands = CommandGenerator.completeTimeZoneSetup('+0530');

// Insert commands into database
for (const cmd of commands) {
  await db.query(
    'INSERT INTO device_commands (device_id, command_type, command_string, status, priority) VALUES ($1, $2, $3, $4, $5)',
    [deviceId, cmd.type, cmd.commandString, 'pending', cmd.priority]
  );
}

// Individual commands
CommandGenerator.setTimeZone('+0530', 230);      // Set timezone
CommandGenerator.disableDST(231);                // Disable DST
CommandGenerator.saveToFlash(233);               // Save to flash
CommandGenerator.getTimeZone(234);               // Query timezone
```

---

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Timezone reverts to `+0000` after reboot | Run save endpoint: `/timezone/save/:deviceId` |
| Verify shows `+0000` | Wait 30s and retry, or use manual web interface |
| Time jumps randomly | Disable DST: `/timezone/disable-dst/:deviceId` |
| Old logs have wrong time | Only new logs will be correct after setup |

---

## 🧪 Testing Procedure

1. **Before:** Verify problem exists (should show `+0000`)
   ```bash
   curl -X POST http://localhost:3001/api/v1/test/timezone/verify/1
   ```

2. **Setup:** Run complete setup
   ```bash
   curl -X POST http://localhost:3001/api/v1/test/timezone/setup/1 \
     -H "Content-Type: application/json" -d '{"timezone": "+0530"}'
   ```

3. **Wait:** 90 seconds for all commands to execute

4. **Verify:** Should now show `+0530`
   ```bash
   curl -X POST http://localhost:3001/api/v1/test/timezone/verify/1
   ```

5. **Reboot Test:** Power off/on device, verify still `+0530`

6. **Attendance Test:** Scan RFID, check log timestamp matches IST

---

## 📖 Full Documentation

For detailed explanations, see: [K40_PRO_TIMEZONE_SETUP_GUIDE.md](./K40_PRO_TIMEZONE_SETUP_GUIDE.md)

---

**🎉 Done!** Your K40 Pro timezone is now permanently configured.
