# ZKTeco K40 Pro Device Registration Guide

## Overview

This guide explains how to register ZKTeco K40 Pro devices with your School Attendance Management System using physical Serial Numbers for secure authentication.

---

## Understanding Serial Numbers

### What is a Device Serial Number?

The **Serial Number** is a unique identifier **physically printed** on your ZKTeco K40 Pro device. It's typically found on a sticker on the back or bottom of the device.

**Example Serial Numbers:**
- `ZK12345678`
- `ZKTECO-K40-A1B2C3`
- `SN:20230456789`

### Why Use Serial Numbers?

✅ **Security**: Only authorized physical devices can connect
✅ **Simplicity**: No need to generate or manage API keys
✅ **Traceability**: Direct link between hardware and software
✅ **Tamper-proof**: Serial numbers cannot be changed

---

## Registration Workflow

### Step 1: Unbox and Locate the Serial Number

1. Unbox your ZKTeco K40 Pro device
2. Turn the device over or check the sides
3. Find the sticker with the Serial Number
4. Write down or photograph the serial number: `_________________`

**Example Label:**
```
ZKTeco K40 Pro
Model: K40-Pro
Serial Number: ZK12345678
Mfg Date: 2024-01
```

### Step 2: Register in Super Admin Panel

1. **Login** to your Super Admin Panel
2. Navigate to **Devices** → **Register Device**
3. Fill out the registration form:

   | Field | Value | Example |
   |-------|-------|---------|
   | **Select School*** | Choose from dropdown | Greenwood High School |
   | **Device Serial Number*** | Enter from device label | `ZK12345678` |
   | **Device Name*** | Friendly name | Main Entrance Scanner |
   | **Location** | Physical location | Building A - Ground Floor |

4. Click **"Register Device"**
5. ✅ Success! Device is now authorized

### Step 3: Configure the ZKTeco Device

Now that the device is registered in your system, configure the device to connect:

1. **Power on** the ZKTeco K40 Pro
2. **Access the device menu** (usually via touchscreen or admin card)
3. **Navigate to Network Settings**:
   - Server URL: `https://yourdomain.com/api/v1/device/sync`
   - OR Local: `http://192.168.1.100:3001/api/v1/device/sync`
4. **Authentication**:
   - The device will automatically send its Serial Number
   - No additional API key needed
5. **Test Connection** → Should show "Connected"

---

## How Authentication Works

### Device Connection Flow

```
┌─────────────────┐
│  ZKTeco K40 Pro │
│  SN: ZK12345678 │
└────────┬────────┘
         │
         │ 1. Connects to server
         │    Sends Header: X-Device-Serial: ZK12345678
         ▼
┌─────────────────────┐
│   Your API Server   │
│                     │
│ 2. Checks database  │
│    Is ZK12345678    │
│    registered?      │
└────────┬────────────┘
         │
    ┌────┴────┐
    │  YES?   │
    └────┬────┘
         │
    ┌────▼──────────────────┐
    │ ✅ Device Authenticated │
    │ ✅ Can send logs        │
    │ ✅ Can sync data        │
    └─────────────────────────┘
```

### Security Features

1. **Whitelist-Based**: Only pre-registered serial numbers are accepted
2. **Active Status Check**: Deactivated devices are immediately rejected
3. **School Assignment**: Device can only access data from assigned school
4. **Last Seen Tracking**: Monitor device connectivity in real-time

---

## API Integration

### For ZKTeco Device Developers

If you're programming the ZKTeco device or creating custom firmware:

#### Authentication Header

```http
POST /api/v1/device/sync/logs
Host: yourdomain.com
Content-Type: application/json
X-Device-Serial: ZK12345678

{
  "logs": [
    {
      "rfid_card": "1234567890",
      "timestamp": "2024-10-12T10:30:00Z"
    }
  ]
}
```

#### Accepted Header Names (for compatibility)
- `X-Device-Serial` (recommended)
- `X-Serial-Number`
- `X-API-Key` (backward compatibility)

#### Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Continue operation |
| 401 | Not registered | Register device in admin panel |
| 403 | Device deactivated | Contact administrator |
| 500 | Server error | Retry with exponential backoff |

---

## Admin Panel Features

### Device Management

**View Registered Devices:**
- Device Name & Location
- Serial Number
- School Assignment
- Status (Active/Inactive)
- Last Seen timestamp

**Actions:**
- **Deactivate**: Revoke device access (can be reactivated)
- **Copy Serial Number**: Quick copy to clipboard
- **View History**: See all logs from this device

### Device Status Indicators

🟢 **Active** - Device is registered and authorized
🔴 **Inactive** - Device is deactivated (cannot connect)
⏱️ **Last Seen** - Shows last connection time
   - Green: < 1 hour ago
   - Yellow: 1-24 hours ago
   - Red: > 24 hours ago

---

## Troubleshooting

### Device Cannot Connect

**Problem**: "Device not registered" error

**Solution**:
1. Verify serial number is correctly entered in admin panel
2. Check for typos (case-sensitive)
3. Ensure device is marked as "Active"
4. Verify network connectivity

---

### Wrong Serial Number Registered

**Problem**: Entered wrong serial number during registration

**Solution**:
1. Admin can deactivate the incorrect entry
2. Register again with correct serial number
3. Old entry can be deleted if needed

---

### Replacing Physical Hardware

**Problem**: Hardware device is broken/stolen, need to replace

**Solution**:
1. Deactivate old device in admin panel
2. Unbox new device and find its serial number
3. Register new device with same school/location
4. Old device cannot authenticate anymore

---

## Best Practices

### Security

✅ **Do:**
- Keep a physical record of all serial numbers
- Deactivate devices immediately if stolen
- Monitor "Last Seen" timestamps regularly
- Use HTTPS in production

❌ **Don't:**
- Share serial numbers publicly
- Register test devices in production
- Leave decommissioned devices active

### Organization

✅ **Naming Convention:**
- Use clear, descriptive names: "Main Entrance Scanner"
- Include building/location: "Building A - Ground Floor"
- Avoid generic names: ❌ "Device 1"

✅ **Documentation:**
- Photograph device labels during installation
- Maintain spreadsheet of Device Name ↔ Serial Number ↔ Location
- Document network configuration

---

## Migration from API Keys

If you previously used generated API keys, follow the migration process:

### Step 1: Run Database Migration

```bash
cd backend
node scripts/runMigration.js 001_update_devices_to_serial_number.sql
```

### Step 2: Update Existing Devices

Existing devices will continue to work temporarily (API keys copied to serial_number field).

For proper security:
1. Find the real serial number on each physical device
2. Update each device record with actual serial number
3. Reconfigure devices to send serial number

### Step 3: Verify

```sql
SELECT id, device_name, serial_number, school_id, is_active FROM devices;
```

---

## FAQ

**Q: Can I generate a serial number?**
A: No. Serial numbers are physical identifiers from the manufacturer.

**Q: What if I lose the device label?**
A: Contact ZKTeco support or check device system settings (may show SN on screen).

**Q: Can I reuse a serial number?**
A: Yes, but deactivate the old entry first. Each SN can only have one active registration.

**Q: Is the serial number case-sensitive?**
A: Yes. Enter exactly as shown on the label.

**Q: Can I use this with non-ZKTeco devices?**
A: Yes, any RFID device with a unique serial number can be registered.

---

## Support

For technical assistance:
- Check the [GitHub Issues](https://github.com/your-repo/issues)
- Email: support@yourcompany.com
- Documentation: https://docs.yourcompany.com

---

**Last Updated:** October 12, 2025
**Version:** 2.0 (Serial Number Authentication)
