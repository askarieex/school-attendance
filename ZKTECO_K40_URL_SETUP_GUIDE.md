# 🔧 ZKTeco K40 Pro - Server URL Setup Guide
## Complete Step-by-Step Configuration for adtenz.site

---

## 📱 PART 1: Device Menu Navigation

### Step 1: Enter Main Menu
1. **Press `M/OK` button** on the device
2. Wait for main menu to appear

### Step 2: Navigate to Communication Settings
```
Main Menu
  → COMM (Communication)
     → Cloud Server (or ADMS or CloudServer)
```

**Navigation:**
- Use **↑ ↓** arrows to move
- Press **OK** to select
- Press **ESC** to go back

---

## 🌐 PART 2: Configure Server URL (adtenz.site)

### Method 1: Using Domain Name (RECOMMENDED)

#### Step 1: Enable Domain Name
```
Cloud Server Settings
  → Enable Domain Name: ON ✅
```

#### Step 2: Enter Server Address with Port
**In the "Server Address" field, enter:**
```
adtenz.site:3001
```

⚠️ **IMPORTANT**:
- Type the domain AND port together: `adtenz.site:3001`
- Do NOT use `https://` prefix
- Do NOT use `/` at the end
- Format: `domain:port`

#### Step 3: Port Field
**Leave the Port field EMPTY** or enter `3001`
(Port is already specified in Server Address)

---

### Method 2: Using IP Address (Alternative)

If domain name doesn't work, use IP:

#### Step 1: Get Server IP
```bash
# Run this command on your computer
ping adtenz.site
```
Example result: `159.89.166.123`

#### Step 2: Enter IP with Port
**In the "Server Address" field:**
```
159.89.166.123:3001
```

---

## ⚙️ PART 3: Additional Settings

### Configure These Settings:

```
Enable Domain Name:    ON ✅
Server Address:        adtenz.site:3001
Port:                  (leave empty or 3001)
Enable Proxy Server:   OFF ❌
HTTPS:                 OFF ❌
Protocol:              PUSH or ADMS
Upload Interval:       1 minute
```

---

## 🔍 PART 4: Complete Menu Configuration

### Full Device Configuration Screen:

```
┌─────────────────────────────────────────┐
│  Cloud Server Settings                  │
├─────────────────────────────────────────┤
│  Enable Domain Name:   [ON]   ← Set ON  │
│  Server Address:   adtenz.site:3001     │
│  Port:             [3001]  or [empty]   │
│  Enable Proxy:     [OFF]  ← Must be OFF │
│  HTTPS:            [OFF]  ← Must be OFF │
│  Protocol:         PUSH                 │
│  Upload Interval:  1                    │
│  Enable:           [ON]   ← Set ON      │
└─────────────────────────────────────────┘
```

---

## 📝 PART 5: Alternative Menu Paths

Different K40 Pro firmware versions may have different menu names:

### Option A:
```
M/OK → COMM → Cloud Server → [Configure Settings]
```

### Option B:
```
M/OK → COMM → ADMS → [Configure Settings]
```

### Option C:
```
M/OK → COMM → CloudServer → [Configure Settings]
```

### Option D:
```
M/OK → System → Communications → Cloud Server
```

---

## ✅ PART 6: Save and Test

### Step 1: Save Configuration
1. After entering all settings
2. Press **ESC** or **Back** button
3. Device will ask: "Save changes?"
4. Select **YES** or press **OK**

### Step 2: Restart Device (Optional but Recommended)
```
M/OK → System → Restart
```
Or manually power cycle the device.

### Step 3: Verify Connection
After restart:
```
M/OK → Info → Network Status
```

Look for:
- **Connection Status: Connected** ✅
- **Server: adtenz.site:3001**

---

## 🧪 PART 7: Test Connection

### Test 1: Check Device Display
After configuration, the device should show:
- Connected icon (WiFi or network symbol)
- No error messages

### Test 2: Test RFID Scan
1. **Scan any RFID card**
2. Device should show "Success" or "OK"
3. Data will upload to server

### Test 3: Monitor Server Logs
On your production server:
```bash
# SSH to server
ssh root@adtenz.site

# Watch logs in real-time
pm2 logs school-attendance-api --lines 50

# You should see:
# 📥 /iclock/cdata from device: K40_Pro
# 🔵 ========== HANDSHAKE START ==========
```

---

## 🔧 PART 8: Troubleshooting Different Scenarios

### Scenario 1: "Server Not Found" Error

**Solution:**
1. Enable Domain Name: **ON**
2. Try entering: `adtenz.site:3001`
3. Make sure NO `https://` prefix
4. Restart device

### Scenario 2: "Connection Timeout"

**Try Port 80 (HTTP Standard):**
```
Server Address: adtenz.site:80
```

**Or configure Nginx on server first**, then use:
```
Server Address: adtenz.site
Port: 80
```

### Scenario 3: Device Accepts Settings but Doesn't Connect

**Check on server:**
```bash
# Open port 3001
sudo ufw allow 3001/tcp
sudo ufw reload

# Verify backend is running
pm2 status
```

### Scenario 4: "Invalid Server Address" Error

**Try different formats:**
- Format 1: `adtenz.site:3001`
- Format 2: Server Address: `adtenz.site` | Port: `3001`
- Format 3: Use IP instead: `YOUR_SERVER_IP:3001`

---

## 📊 PART 9: URL Format Examples

### ✅ CORRECT Formats:
```
adtenz.site:3001          ← RECOMMENDED
159.89.166.123:3001       ← Using IP
adtenz.site               ← If port is 80
www.adtenz.site:3001      ← With www
```

### ❌ WRONG Formats:
```
https://adtenz.site:3001  ← NO https:// prefix
http://adtenz.site:3001   ← NO http:// prefix
adtenz.site:3001/         ← NO trailing slash
adtenz.site:3001/iclock   ← NO path
```

---

## 🎯 PART 10: Quick Reference Card

**Print and keep near device:**

```
┌───────────────────────────────────────────────┐
│  ZKTeco K40 Pro - Server Configuration        │
├───────────────────────────────────────────────┤
│  Menu Path:                                   │
│    M/OK → COMM → Cloud Server                 │
│                                               │
│  Settings:                                    │
│    Enable Domain Name:   ON                   │
│    Server Address:       adtenz.site:3001     │
│    Port:                 (empty or 3001)      │
│    Enable Proxy:         OFF                  │
│    HTTPS:                OFF                  │
│    Protocol:             PUSH                 │
│    Enable:               ON                   │
│                                               │
│  Save: ESC → YES                              │
│  Test: Scan RFID card                         │
└───────────────────────────────────────────────┘
```

---

## 🆘 PART 11: If Nothing Works

### Last Resort - Use IP Address + Port 80

#### Step 1: Configure Nginx on Server
```bash
# SSH to server
ssh root@adtenz.site

# Edit Nginx config
sudo nano /etc/nginx/sites-available/default

# Add this inside server block:
location /iclock {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# Save and reload
sudo nginx -t
sudo systemctl reload nginx
```

#### Step 2: Configure Device
```
Server Address: adtenz.site
Port: 80
Enable Domain Name: ON
```

Port 80 is standard HTTP and rarely blocked by firewalls.

---

## 📞 PART 12: Verification Checklist

Before you finish, verify:

- [ ] Domain Name enabled: **ON**
- [ ] Server address entered: **adtenz.site:3001**
- [ ] Proxy disabled: **OFF**
- [ ] HTTPS disabled: **OFF**
- [ ] Protocol set to: **PUSH**
- [ ] Settings saved: **YES**
- [ ] Device restarted: **YES**
- [ ] RFID test scan: **DONE**
- [ ] Server logs checked: **DONE**
- [ ] Attendance recorded in DB: **VERIFIED**

---

## 🎬 PART 13: Complete Setup Video Script

**What to do (narrate while doing):**

1. "Press M/OK button"
2. "Navigate to COMM using arrow keys, press OK"
3. "Select Cloud Server, press OK"
4. "Enable Domain Name - select ON"
5. "Server Address - type: adtenz.site:3001"
6. "Port - leave empty or type 3001"
7. "Enable Proxy - select OFF"
8. "HTTPS - select OFF"
9. "Protocol - select PUSH"
10. "Press ESC to go back"
11. "Select YES to save changes"
12. "Wait 10 seconds for device to connect"
13. "Scan RFID card to test"
14. "Check server logs - should see connection"

---

## ✅ SUCCESS INDICATORS

Your setup is successful when:

1. **Device shows**: No error messages ✅
2. **Network icon**: Shows connected ✅
3. **RFID scan**: Shows "Success" or "OK" ✅
4. **Server logs**: Shows device handshake ✅
5. **Database**: New attendance records appear ✅

---

## 📧 PART 14: Support

If still not working after following all steps:

1. Take a **photo of your device settings screen**
2. Run this on server and share output:
   ```bash
   pm2 logs school-attendance-api --lines 100
   ```
3. Check server is accessible:
   ```bash
   curl http://adtenz.site:3001/
   ```

---

**🎉 Configuration Complete!**

Your ZKTeco K40 Pro should now be connected to:
- **Server**: https://adtenz.site/
- **Backend Port**: 3001
- **Protocol**: PUSH/ADMS

All RFID scans will automatically upload to your production database! 🚀
