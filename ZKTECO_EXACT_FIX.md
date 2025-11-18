# 🔴 ZKTECO K40 PRO - EXACT FIX FOR VPS CONNECTION

## ❌ PROBLEM IDENTIFIED

Looking at your device images, I found the **EXACT issue**:

**Your device shows:**
- TCP COMM Port: `192.168.1.200` ← This is WRONG!
- This is a LOCAL IP, not your VPS server IP

**What you need:**
- Server Address: `165.22.214.208`
- Server Port: `5000` (or `80`)

---

## ✅ CORRECT CONFIGURATION (Step-by-Step)

Based on ZKTeco documentation, here's the **EXACT menu path**:

### **STEP 1: Access Cloud Server Settings**

On the ZKTeco K40 Pro device:

```
Press [M/OK] button
    ↓
Navigate to: COMM
    ↓
Select: Cloud Server (or ADMS)
    ↓
Press [OK] to enter
```

You should see a configuration screen like your images.

---

### **STEP 2: Configure Server Address**

**IMPORTANT**: There are TWO ways to configure this:

#### **METHOD A: Using Domain Name Mode (If available)**

```
Enable Domain Name: ON
Server Address: 165.22.214.208:5000
```

**Or combined format:**
```
Server Address: http://165.22.214.208:5000
```

#### **METHOD B: Separate IP and Port (Recommended)**

```
Enable Domain Name: OFF
Server Address: 165.22.214.208
Server Port: 5000
```

---

### **STEP 3: Additional Settings**

Make sure these settings are correct:

| Setting | Value | Why |
|---------|-------|-----|
| **Enable** | ON | Device will connect to server |
| **Protocol** | PUSH or HTTP | Required for cloud connection |
| **SSL/HTTPS** | OFF | Your server uses HTTP not HTTPS |
| **Proxy Server** | OFF | Not using proxy |
| **Upload Interval** | 1 minute | How often device syncs |

---

### **STEP 4: Network Settings (Critical!)**

Before cloud server works, device needs internet access:

```
Press [M/OK] button
    ↓
COMM → Ethernet
```

Configure these **NETWORK** settings:

```
IP Address:    192.168.1.200  ← Keep this (local network)
Subnet Mask:   255.255.255.0
Gateway:       192.168.1.1    ← Your router IP
DNS Server:    8.8.8.8        ← Google DNS
DHCP:          OFF
```

**CRITICAL**: The `192.168.1.200` is for **local network**, NOT cloud server!

---

## 🔧 VPS SERVER FIX

Your server logs show port 5000 is running, but we need to verify:

### **1. Open Firewall Port**

```bash
# SSH to VPS
ssh root@165.22.214.208

# Open port 5000
sudo ufw allow 5000/tcp

# Verify
sudo ufw status | grep 5000
```

**Expected output:**
```
5000/tcp                   ALLOW       Anywhere
```

---

### **2. Verify Backend is Accessible from Internet**

From your **Mac laptop** (NOT from VPS):

```bash
# Test if server is reachable
curl http://165.22.214.208:5000/

# Test device endpoint specifically
curl "http://165.22.214.208:5000/iclock/cdata?SN=GED7242600838&options=all"
```

**Expected response:**
```
GET OPTION FROM: GED7242600838
Stamp=0
OpStamp=0
PhotoStamp=0
TimeZone=330
...
```

**If you get "Connection refused"** → Port 5000 is blocked!

---

### **3. Alternative: Use Port 80 via Nginx**

If port 5000 doesn't work, use port **80** instead:

**Device configuration:**
```
Server Address: 165.22.214.208
Server Port: 80
```

**Test from laptop:**
```bash
curl "http://165.22.214.208/iclock/cdata?SN=GED7242600838&options=all"
```

**This should work** because Nginx is already configured to forward `/iclock` requests.

---

## 🎯 COMPLETE CONFIGURATION SUMMARY

### **On ZKTeco K40 Pro Device:**

**Network Settings (COMM → Ethernet):**
```
IP Address:    192.168.1.200
Gateway:       192.168.1.1
DNS:           8.8.8.8
```

**Cloud Server Settings (COMM → Cloud Server):**
```
Server Address: 165.22.214.208
Server Port:    80
Enable:         ON
Protocol:       PUSH
SSL:            OFF
```

### **On VPS Server:**

```bash
# 1. Open firewall (if using port 5000)
sudo ufw allow 5000/tcp

# 2. Verify backend is running
pm2 status

# 3. Watch logs
pm2 logs school-attendance-api --lines 0
```

---

## 🧪 TESTING PROCEDURE

### **Step 1: Test from Laptop First**

Before configuring device, verify server is accessible:

```bash
# From your Mac:
curl http://165.22.214.208:80/iclock/cdata?SN=TEST&options=all
```

**If this works** → Server is ready!

---

### **Step 2: Configure Device**

Follow the configuration steps above.

**Save settings and wait 1-2 minutes.**

---

### **Step 3: Check Device Status**

On device screen, look for **connection icon** in top-right corner:
- 📶 Icon present → Connected to server ✅
- ❌ No icon → Not connected ❌

---

### **Step 4: Do Test Scan**

1. Place finger on device
2. Device should scan
3. Check VPS logs immediately:

```bash
pm2 logs school-attendance-api --lines 20
```

**Expected logs:**
```
📥 /iclock/cdata from device: K40_Pro (SN: GED7242600838)
🔵 ========== HANDSHAKE START ==========
   Device: K40_Pro (SN: GED7242600838)
   Server Time (IST): ...
```

---

## 🚨 IF STILL NOT WORKING

### **Diagnostic Commands**

Run these on your **VPS server** and share output:

```bash
# 1. Check if port 5000 is listening
sudo ss -tulnp | grep 5000

# 2. Check firewall rules
sudo ufw status verbose

# 3. Test endpoint locally on server
curl http://localhost:5000/iclock/cdata?SN=TEST&options=all

# 4. Check Nginx config
sudo cat /etc/nginx/sites-enabled/default | grep -A 10 "/iclock"
```

### **From Your Laptop:**

```bash
# Test if you can reach server
ping 165.22.214.208

# Test port 80
curl -v http://165.22.214.208/iclock/cdata?SN=TEST&options=all

# Test port 5000
curl -v http://165.22.214.208:5000/iclock/cdata?SN=TEST&options=all
```

Share the output of these commands!

---

## 📱 DEVICE MENU NAVIGATION

Your device model might have slightly different menu names:

**Common variations:**
- "Cloud Server" or "ADMS" or "Cloud Setting"
- "PUSH" or "HTTP" or "ADMS Protocol"
- "Domain Name" or "URL Mode"

**Look for keywords:**
- Server Address
- Server Port
- Enable
- Protocol

---

## ⚡ QUICK FIX CHECKLIST

- [ ] Device connected to WiFi (internet access)
- [ ] Device DNS set to 8.8.8.8
- [ ] Cloud Server Address: `165.22.214.208`
- [ ] Cloud Server Port: `80` (or `5000`)
- [ ] Enable: ON
- [ ] SSL: OFF
- [ ] VPS firewall allows port 80 (always open) or 5000
- [ ] Backend running: `pm2 status` shows "online"
- [ ] Test from laptop works: `curl http://165.22.214.208/iclock/cdata?SN=TEST&options=all`

---

## 🎯 MOST LIKELY ISSUES

Based on your images and logs:

### **Issue #1: Port 5000 is Blocked**

**Solution:** Use port 80 instead
```
Server Port: 80
```

### **Issue #2: Wrong Menu Setting**

The `192.168.1.200` you showed is in **Network Settings**, NOT Cloud Server!

Make sure you're in: **COMM → Cloud Server** (not Ethernet)

### **Issue #3: Enable Domain Name is ON**

Turn it **OFF** and configure IP + Port separately:
```
Enable Domain Name: OFF
Server Address: 165.22.214.208
Server Port: 80
```

---

## ✅ FINAL ANSWER

**Use these EXACT settings on device:**

```
Menu Path: COMM → Cloud Server

Server Address: 165.22.214.208
Server Port: 80
Enable: ON
Protocol: PUSH
SSL: OFF
Enable Domain Name: OFF
```

**Save and wait 2 minutes.**

Then do a fingerprint scan and check VPS logs:
```bash
pm2 logs school-attendance-api
```

**You should see device connection logs!**

---

Let me know if you need help with any specific step! 🚀
