# 🔧 ZKTeco K40 Pro - Production Server Configuration Guide

## 📋 Overview

This guide explains how to configure your ZKTeco K40 Pro biometric device to connect to your **production server** at `adtenz.site` instead of localhost.

---

## 🌐 Production Server Details

- **Domain**: `adtenz.site`
- **IP Address**: Get IP by running: `ping adtenz.site`
- **Port**: `3001` (or `80` if using Nginx proxy on port 80)
- **Protocol**: PUSH/ADMS (HTTP)
- **Endpoint**: `/iclock/cdata`

---

## 🔍 Step 1: Find Your Server's IP Address

On your production server, run:

```bash
# Get server IP
curl ifconfig.me
# OR
hostname -I
```

**Example**: If result is `159.89.166.123`, use this IP.

Alternatively, get IP from domain:
```bash
ping adtenz.site
```

---

## ⚙️ Step 2: Configure Device Network Settings

### 2.1 Access Device Menu

1. **Press `M/OK` button** on the device
2. Navigate to: **Comm** → **Ethernet**

### 2.2 Configure Basic Network (Local Network)

Set the following network parameters:

```
IP Address:    192.168.1.201   (or any available IP on your local network)
Subnet Mask:   255.255.255.0
Gateway:       192.168.1.1     (your router's IP)
DNS Server:    8.8.8.8         (Google DNS) or 1.1.1.1
DHCP:          OFF             (use static IP)
```

**Important**:
- The device IP (192.168.1.201) is for **local network access**
- This is NOT the server address
- The server address is configured separately in PUSH settings

---

## 📡 Step 3: Configure PUSH/ADMS Server Settings

### 3.1 Access PUSH Settings

1. Press `M/OK` button
2. Navigate to: **Comm** → **CloudServer** (or **ADMS** or **PUSH**)
3. You'll see fields for server configuration

### 3.2 Enter Production Server Details

**Option A: Using Domain Name (Recommended)**
```
Server Address:  adtenz.site
Port:           3001
```

**Option B: Using IP Address (If domain doesn't work)**
```
Server Address:  YOUR_SERVER_IP     (e.g., 159.89.166.123)
Port:           3001
```

### 3.3 Additional PUSH Settings

```
Protocol:       PUSH (or ADMS)
Upload Interval: 1 minute
Enable:         ON / YES
SSL/TLS:        OFF (unless you have HTTPS on port 3001)
```

---

## 🔐 Step 4: Verify Server Configuration

### 4.1 Check if Port 3001 is Open

On your production server, verify the backend is running:

```bash
# SSH to production server
ssh root@adtenz.site

# Check if backend is running
pm2 status

# Should show:
# school-attendance-api │ online

# Check if port 3001 is listening
lsof -i :3001
# OR
netstat -tuln | grep 3001

# Test backend is responding
curl http://localhost:3001/
# Should return: {"success":true,"message":"School Attendance API is running",...}
```

### 4.2 Open Firewall Port (If Needed)

If your server has a firewall, open port 3001:

```bash
# For UFW (Ubuntu)
sudo ufw allow 3001/tcp
sudo ufw reload

# For firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload

# For iptables
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
sudo service iptables save
```

### 4.3 Check Nginx Configuration (If Using)

If you're using Nginx as a reverse proxy on port 80:

```bash
# Edit Nginx config
sudo nano /etc/nginx/sites-available/default

# Add this location block:
location /iclock {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

# Test config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

**If using Nginx proxy**, change device port to `80`:
```
Server Address:  adtenz.site
Port:           80
```

---

## 🧪 Step 5: Test Connection

### 5.1 Test from Device

1. After configuring PUSH settings, press **Back** to save
2. Device should automatically connect to server
3. Check device display for connection status

### 5.2 Monitor Server Logs

On production server:

```bash
# Watch PM2 logs in real-time
pm2 logs school-attendance-api --lines 100

# You should see:
# 📥 /iclock/cdata from device: K40_Pro (SN: YOUR_SERIAL)
# 🔵 ========== HANDSHAKE START ==========
```

### 5.3 Test RFID Scan

1. **Scan an RFID card** on the device
2. **Check server logs immediately**:

```bash
pm2 logs school-attendance-api --lines 50
```

You should see:
```
📥 /iclock/cdata from device: K40_Pro (SN: XXXXXX)
📋 Parsed 1 attendance record(s) from device
✅ Attendance processing complete: { success: 1, duplicate: 0, failed: 0 }
```

---

## 🔧 Step 6: Device Menu Navigation Guide

### Complete Menu Path

```
Main Menu
  └── Comm (Communication Settings)
       ├── Ethernet (Network Settings)
       │    ├── IP Address
       │    ├── Subnet Mask
       │    ├── Gateway
       │    ├── DNS Server
       │    └── DHCP
       │
       └── CloudServer / ADMS / PUSH
            ├── Server Address
            ├── Port
            ├── Protocol
            ├── Enable
            └── Upload Interval
```

### Quick Access Keys

- **M/OK**: Enter menu
- **↑↓**: Navigate menu items
- **OK**: Select/Enter
- **ESC**: Go back one level
- **MENU**: Quick menu access

---

## 🚨 Troubleshooting

### Issue 1: Device Not Connecting

**Check:**
1. ✅ Device can access internet (ping google.com from device network)
2. ✅ Server firewall allows port 3001
3. ✅ Backend server is running: `pm2 status`
4. ✅ Domain resolves correctly: `ping adtenz.site`

**Test from device network:**
```bash
# From a computer on same network as device
curl http://adtenz.site:3001/
# Should return API response
```

### Issue 2: Connection Timeout

**Possible causes:**
- Server firewall blocking port 3001
- Wrong server IP/domain
- Device not connected to internet
- ISP blocking port 3001

**Solution:**
Use Nginx proxy on port 80 (HTTP standard port - rarely blocked)

### Issue 3: Device Shows "Server Error"

**Check server logs:**
```bash
pm2 logs school-attendance-api --lines 100 --err
```

**Common causes:**
- Device serial number not registered in database
- Database connection error
- Missing device authentication

### Issue 4: RFID Scans Not Reaching Server

**Verify:**
1. Device shows "OK" or "Success" after scan
2. Check device upload queue: **Menu → Info → Upload**
3. Check server logs for incoming data

**Force upload:**
- Menu → System → Upload Data

---

## 📊 Production Server Monitoring

### Real-time Monitoring

```bash
# Monitor logs continuously
pm2 logs school-attendance-api --lines 0

# Monitor specific events
pm2 logs school-attendance-api | grep "attendance"

# Check server status
pm2 status
pm2 info school-attendance-api
```

### Check Database

```bash
# Connect to database
sudo -u postgres psql school_attendance

# Check recent attendance
SELECT
  s.full_name,
  al.check_in_time,
  al.status,
  al.created_at
FROM attendance_logs al
JOIN students s ON al.student_id = s.id
ORDER BY al.created_at DESC
LIMIT 10;
```

---

## 🎯 Quick Reference Card

**Print this and keep near device:**

```
┌──────────────────────────────────────────────┐
│  ZKTeco K40 Pro - Production Config          │
├──────────────────────────────────────────────┤
│  Server:  adtenz.site                        │
│  Port:    3001                               │
│                                              │
│  Device IP:     192.168.1.201                │
│  Subnet:        255.255.255.0                │
│  Gateway:       192.168.1.1                  │
│  DNS:           8.8.8.8                      │
│                                              │
│  Menu Access:   Press M/OK button            │
│  Settings:      Comm → CloudServer           │
└──────────────────────────────────────────────┘
```

---

## ✅ Configuration Checklist

- [ ] Get server IP address: `ping adtenz.site`
- [ ] Configure device network (192.168.1.201)
- [ ] Configure PUSH server (adtenz.site:3001)
- [ ] Open server firewall port 3001
- [ ] Verify backend is running: `pm2 status`
- [ ] Test RFID scan
- [ ] Monitor server logs: `pm2 logs`
- [ ] Verify attendance in database
- [ ] Test WhatsApp notifications (if enabled)

---

## 🆘 Support

If you encounter issues:

1. **Check server logs**: `pm2 logs school-attendance-api`
2. **Check device connection**: Menu → Info → Network
3. **Test from browser**: http://adtenz.site:3001/
4. **Review this guide**: All settings must match exactly

---

**✅ Configuration Complete!**

Your ZKTeco K40 Pro is now connected to production server `adtenz.site`.
All RFID scans will be sent to your production database automatically.
