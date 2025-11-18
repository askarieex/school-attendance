# 🔧 ZKTECO K40 PRO - VPS CONNECTION FIX

## ❌ PROBLEM: Device works locally but NOT on VPS

**What works:**
- ✅ Laptop (192.168.1.X) + ZKTeco K40 Pro (same WiFi) → **WORKS**
- ✅ Backend running on `localhost:3001` → **WORKS**

**What doesn't work:**
- ❌ VPS Server (165.22.214.208) + ZKTeco K40 Pro → **DOESN'T WORK**
- ❌ Device cannot reach cloud server

---

## 🔍 ROOT CAUSE

The ZKTeco K40 Pro **CANNOT directly connect** to a VPS server because:

1. **Different Networks**: Your device is on LOCAL network (192.168.1.X), VPS is on INTERNET (165.22.214.208)
2. **NAT/Router Blocking**: Your router doesn't forward device traffic to VPS
3. **Firewall**: VPS firewall might block device port
4. **Device Configuration**: Wrong port or protocol settings

---

## ✅ SOLUTION: 3 Options (Choose ONE)

### **OPTION 1: Port Forwarding (Recommended for Single Location)**

If device and server are in DIFFERENT locations, you need port forwarding on the **device's network**.

**Requirements:**
- Access to device network's router/modem
- Static public IP or Dynamic DNS
- Port forwarding enabled

**Steps:**

#### 1. Find Your Public IP (Where Device is Located)
```bash
# On any computer connected to same WiFi as device:
curl ifconfig.me

# Example output: 103.45.67.89
```

#### 2. Configure Router Port Forwarding

**Login to your router** (usually http://192.168.1.1):

**Example for common routers:**

| Setting | Value |
|---------|-------|
| Service Name | ZKTeco-Backend |
| External Port | 5000 |
| Internal IP | 165.22.214.208 |
| Internal Port | 5000 |
| Protocol | TCP |

**Note**: This WON'T WORK because your VPS is external!

---

### **OPTION 2: VPN Tunnel (Best for Multiple Locations) ⭐ RECOMMENDED**

Create a VPN between device network and VPS server.

**Why this works:**
- Device thinks VPS is on "local" network
- Secure encrypted connection
- Works for multiple branches

**Setup WireGuard VPN:**

#### On VPS Server (165.22.214.208):
```bash
# Install WireGuard
sudo apt update
sudo apt install wireguard -y

# Generate server keys
wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key

# Create WireGuard config
sudo nano /etc/wireguard/wg0.conf
```

**Paste this config:**
```ini
[Interface]
PrivateKey = <SERVER_PRIVATE_KEY_FROM_ABOVE>
Address = 10.0.0.1/24
ListenPort = 51820
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

[Peer]
# Client (device network gateway)
PublicKey = <CLIENT_PUBLIC_KEY_WILL_ADD_LATER>
AllowedIPs = 10.0.0.2/32, 192.168.1.0/24
```

```bash
# Enable IP forwarding
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Start WireGuard
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0

# Open firewall
sudo ufw allow 51820/udp
```

#### On Device Network (Router or Gateway PC):

Install WireGuard client and connect to VPS.

**This is COMPLEX** - Skip to Option 3 if you're not technical.

---

### **OPTION 3: Reverse Proxy via Local Bridge (EASIEST) ⭐⭐ EASIEST**

Run a lightweight bridge on device network that forwards requests to VPS.

**How it works:**
```
ZKTeco Device (192.168.1.100:5000)
         ↓
Local Bridge PC (192.168.1.50) ← Same WiFi
         ↓ (Internet)
VPS Server (165.22.214.208:5000)
```

#### Step-by-Step:

**1. Setup Bridge PC (Any laptop/PC on same WiFi as device)**

```bash
# On Mac/Linux:
ssh -R 5000:localhost:5000 root@165.22.214.208

# This creates reverse SSH tunnel:
# Device → Local PC → VPS
```

**For permanent bridge, use systemd service:**

Create file `/etc/systemd/system/zkteco-bridge.service`:
```ini
[Unit]
Description=ZKTeco VPS Bridge
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/ssh -N -R 5000:192.168.1.100:5000 root@165.22.214.208
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable zkteco-bridge
sudo systemctl start zkteco-bridge
```

**❌ PROBLEM with this approach**: SSH tunnel is fragile and not recommended for production.

---

## ⭐ **RECOMMENDED SOLUTION: Static Public IP + Direct Connection**

The BEST and SIMPLEST solution:

### **Prerequisites:**
1. ✅ VPS has public IP: `165.22.214.208`
2. ✅ VPS backend running on port `5000`
3. ✅ Device has internet access
4. ❌ **MISSING**: Device cannot reach VPS port 5000

### **The ACTUAL Problem:**

Your backend is running on port **5000** but:
- Nginx is NOT forwarding `/iclock` requests properly
- Firewall is blocking port 5000
- OR device is configured incorrectly

---

## 🔥 REAL FIX (What You Need to Do)

Based on your logs, backend is running on port 5000 internally.

### **Step 1: Check if Backend Port is Accessible from Internet**

From your **local laptop** (not server), run:

```bash
# Test if port 5000 is open
curl -v http://165.22.214.208:5000/

# Test /iclock endpoint
curl -v "http://165.22.214.208:5000/iclock/cdata?SN=TEST&options=all"
```

**Expected result:**
```json
{"success":true,"message":"School Attendance API is running",...}
```

**If you get "Connection refused" or timeout:**
→ Port 5000 is NOT accessible from internet (FIREWALL ISSUE)

---

### **Step 2: Open Port 5000 in Firewall**

Your VPS uses `ufw` firewall:

```bash
# SSH to VPS
ssh root@165.22.214.208

# Check current firewall rules
sudo ufw status

# Open port 5000
sudo ufw allow 5000/tcp

# Verify it's open
sudo ufw status | grep 5000
```

**Output should show:**
```
5000/tcp                   ALLOW       Anywhere
```

---

### **Step 3: Update Nginx to Forward Port 80 → 5000**

Your current Nginx config forwards port 80 → 5000 for `/iclock`, but we need to ensure it's correct.

**Edit Nginx config:**
```bash
sudo nano /etc/nginx/sites-available/default
```

**Ensure this section exists:**
```nginx
server {
    listen 80;
    server_name 165.22.214.208;

    # Forward /iclock to backend
    location /iclock/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # Important for device communication
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
```

**Test and reload:**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

### **Step 4: Configure ZKTeco K40 Pro Device**

Now configure device to connect to VPS.

**On device menu:**

#### **Option A: Using Port 80 (via Nginx) - RECOMMENDED**

```
Menu → Communication → Cloud Server

Server Address: 165.22.214.208
Server Port: 80
Protocol: PUSH (or HTTP)
Enable: ON
```

#### **Option B: Using Port 5000 (Direct) - If port opened**

```
Menu → Communication → Cloud Server

Server Address: 165.22.214.208
Server Port: 5000
Protocol: PUSH (or HTTP)
Enable: ON
```

---

### **Step 5: Test Connection**

**From VPS server, watch logs:**
```bash
pm2 logs school-attendance-api --lines 0
```

**On device:**
1. Save cloud server settings
2. Device should connect automatically
3. Do a test fingerprint scan

**Watch server logs, you should see:**
```
📥 /iclock/cdata from device: K40_Pro (SN: GED7242600838)
🔵 ========== HANDSHAKE START ==========
```

---

## 🎯 QUICK DIAGNOSTIC

Run this from your **local laptop**:

```bash
# Test 1: Can you reach VPS backend?
curl http://165.22.214.208:5000/

# Test 2: Can you reach via Nginx (port 80)?
curl http://165.22.214.208/iclock/cdata?SN=TEST&options=all

# Test 3: Is port 5000 open?
telnet 165.22.214.208 5000
```

**Results will tell you:**
- ✅ Test 1 works → Backend is accessible, use port 5000 on device
- ❌ Test 1 fails, ✅ Test 2 works → Use port 80 on device
- ❌ Both fail → Firewall issue, open port in ufw

---

## 📋 FINAL CHECKLIST

- [ ] VPS firewall allows port 5000 (or 80 via Nginx)
- [ ] Nginx forwards `/iclock` to backend port 5000
- [ ] Backend is running: `pm2 status` shows "online"
- [ ] Device configured with correct IP and port
- [ ] Device has internet access (can ping 8.8.8.8)
- [ ] Test from laptop: `curl http://165.22.214.208/iclock/cdata?SN=TEST&options=all`

---

## 🚨 COMMON MISTAKES

### ❌ Mistake 1: Using HTTPS for Device
ZKTeco devices often don't support HTTPS. Use **HTTP only** (port 80 or 5000).

### ❌ Mistake 2: Wrong Port
You said port 3001 locally but VPS uses 5000. Device must use **5000** or **80** (via Nginx).

### ❌ Mistake 3: Firewall Not Opened
Must run: `sudo ufw allow 5000/tcp`

### ❌ Mistake 4: Device on Different WiFi
If device and server aren't reachable, VPN or port forwarding is required.

---

## ✅ SUMMARY

**For your case:**

1. **Open firewall port:**
   ```bash
   sudo ufw allow 5000/tcp
   ```

2. **Configure device:**
   ```
   Server: 165.22.214.208
   Port: 80 (or 5000 if firewall opened)
   ```

3. **Test:**
   ```bash
   curl http://165.22.214.208/iclock/cdata?SN=TEST&options=all
   ```

4. **Monitor:**
   ```bash
   pm2 logs school-attendance-api
   ```

**That's it!** Device should connect now.

---

## 📞 Need More Help?

Run these diagnostic commands and share output:

```bash
# 1. Check firewall
sudo ufw status

# 2. Check Nginx config
sudo nginx -t
cat /etc/nginx/sites-available/default | grep -A 10 "/iclock"

# 3. Check backend status
pm2 status

# 4. Test endpoint
curl -v http://165.22.214.208/iclock/cdata?SN=TEST&options=all
```

Share the output and I'll help you fix it! 🚀
