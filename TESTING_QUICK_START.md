# 🧪 TESTING QUICK START GUIDE

**Before Production Deployment - Step by Step Testing**

---

## 📋 QUICK TESTING CHECKLIST

### **Step 1: Backend is Running** ✅
Your backend is currently running on `http://localhost:3001`

Check status:
```bash
curl http://localhost:3001/api/v1/auth/login
# Should return: {"success":false,"message":"Email and password are required"}
```

---

## 🎯 MANUAL TESTING (10 Minutes)

### **1. Super Admin Login** (2 min)

1. Open browser: `http://localhost:3000`
2. Login with Super Admin:
   - Email: `hadi@gmail.com`
   - Password: `123456`
3. ✅ Should redirect to Dashboard
4. ✅ Should see schools, devices, users in sidebar

**If login fails:**
- Check backend logs: `tail -f /tmp/backend.log`
- Verify database is running
- Check `.env` file has correct credentials

---

### **2. School Creation** (3 min)

1. Click **"Schools"** in sidebar
2. Click **"+ Add School"** button
3. Fill in form:
   - School Name: `Test School ABC`
   - Email: `testschool@example.com`
   - Phone: `9876543210`
   - Address: `123 Test Street`
   - Plan: `Trial`
   - **Admin Account (Optional):**
     - Admin Name: `School Admin`
     - Admin Email: `admin@testschool.com`
     - Admin Password: `test123`
4. Click **"Create School"**

**Expected:**
- ✅ "School created successfully!" alert
- ✅ New school appears in table
- ✅ Status: Active
- ✅ Plan: Trial badge

**If creation fails:**
- Check if email already exists (duplicate check)
- Check backend logs for errors
- Verify password is at least 6 characters

---

### **3. Device Registration** (2 min)

1. Click **"Devices"** in sidebar
2. Click **"+ Register Device"** button
3. Fill in form:
   - Select School: `Test School ABC` (from dropdown)
   - Device Serial Number: `ZKTECO12345678`
   - Device Name: `Main Entrance Scanner`
   - Location: `Building A - Ground Floor`
4. Click **"Register Device"**

**Expected:**
- ✅ "Device registered successfully!" alert
- ✅ Device appears in table
- ✅ Serial number displayed
- ✅ Can copy serial number to clipboard
- ✅ Status: Active

**Important Notes:**
- Serial number must be at least 5 characters
- Serial number will be used for RFID device authentication
- Cannot change serial number after registration

---

### **4. User Management** (2 min)

1. Click **"Admins"** in sidebar
2. Verify you see list of users
3. Click **"+ Add Admin User"** button
4. Fill in form:
   - Full Name: `Test Admin`
   - Email: `testadmin@example.com`
   - Role: `School Admin`
   - Assigned School: `Test School ABC`
   - Password: `test123456`
5. Click **"Create User"**

**Expected:**
- ✅ "User created successfully!" alert
- ✅ New user appears in table
- ✅ Role: School Admin badge
- ✅ Assigned School: Test School ABC
- ✅ Status: Active

---

### **5. Test Search Functionality** (1 min)

**Schools Search:**
1. Go to Schools page
2. Type school name in search box
3. Press Enter
4. ✅ Should filter results

**Users Search:**
1. Go to Admins page
2. Type email in search box
3. ✅ Should filter results

**Devices Page:**
1. Go to Devices page
2. ✅ Should see all devices
3. ✅ Device status shows Active/Inactive

---

## 🤖 AUTOMATED TESTING (1 Minute)

Run the automated test script:

```bash
cd backend
./test-production-readiness.sh
```

**Expected Output:**
```
🚀 ========== PRODUCTION READINESS TESTING ==========

📋 1. AUTHENTICATION TESTS
----------------------------------------------------
✅ PASS: Super Admin login successful
✅ PASS: Invalid login correctly rejected

📋 2. SUPER ADMIN ENDPOINTS TESTS
----------------------------------------------------
✅ PASS: Schools list retrieved
✅ PASS: Devices list retrieved
✅ PASS: Users list retrieved
✅ PASS: Platform stats retrieved

📋 3. AUTHORIZATION TESTS
----------------------------------------------------
✅ PASS: Unauthorized access correctly blocked
✅ PASS: Invalid token correctly rejected

📋 4. INPUT VALIDATION TESTS
----------------------------------------------------
✅ PASS: Invalid school creation correctly rejected
✅ PASS: Invalid serial number correctly rejected

📋 5. DATABASE CONNECTIVITY
----------------------------------------------------
✅ PASS: Database connection successful

📋 6. ENVIRONMENT CONFIGURATION
----------------------------------------------------
✅ PASS: .env file found
✅ PASS: JWT_SECRET is strong (62 chars)
✅ PASS: DATABASE_URL is configured
✅ PASS: Twilio credentials found

📋 7. SECURITY CHECKS
----------------------------------------------------
✅ PASS: No hardcoded secrets found
✅ PASS: Acceptable amount of console.log statements

========================================================
🎯 TESTING SUMMARY
========================================================

✅ All critical tests completed!
```

---

## 🔧 RFID DEVICE TESTING (Advanced)

### **Simulate RFID Device Attendance:**

```bash
# Get device serial number from database or Super Admin panel
SERIAL_NUMBER="ZKTECO12345678"

# Test attendance data submission
curl -X POST "http://localhost:3001/iclock/cdata?SN=${SERIAL_NUMBER}&table=ATTLOG" \
  -H "X-Device-Serial: ${SERIAL_NUMBER}" \
  -H "Content-Type: text/plain" \
  -d "1	2025-11-08 08:30:00	0	0	0
2	2025-11-08 08:35:00	0	0	0
3	2025-11-08 09:00:00	0	0	0"
```

**Expected Response:**
```
OK
```

**Check backend logs:**
```bash
tail -f /tmp/backend.log
```

**Should see:**
```
📥 /iclock/cdata from device: Main Entrance Scanner (SN: ZKTECO12345678)
📋 Parsed 3 attendance record(s) from device
✅ Attendance recorded: Student Name - present at 2025-11-08 08:30:00
✅ Attendance recorded: Student Name - present at 2025-11-08 08:35:00
✅ Attendance recorded: Student Name - late at 2025-11-08 09:00:00
✅ Attendance processing complete: { success: 3, duplicate: 0, failed: 0 }
```

---

## 📱 SMS TESTING

### **Test Single SMS:**

```bash
cd backend
node test-sms-simple.js
```

**Expected:**
```
✅ SMS SENT SUCCESSFULLY!
   Message ID: SM1234567890abcdef
```

**Check your phone:** You should receive SMS at `+917889704442`

---

### **Test Batch SMS (200 students):**

```bash
node test-batch-sms.js
```

**Expected Output:**
```
🚀 ========== BATCH SMS PERFORMANCE TEST ==========

📊 Simulating 200 students
📱 All messages will go to: +917889704442

🔥 Starting batch send...

📦 Processing batch 1/10 (20 messages)
📦 Processing batch 2/10 (20 messages)
...
📦 Processing batch 10/10 (20 messages)

📊 ========== RESULTS ==========

✅ Total messages: 200
✅ Successfully sent: 200
⏭️ Skipped (duplicates): 0
❌ Failed: 0
⏱️ Total time: 35.2 seconds
⚡ Speed: 5.7 messages/second

📈 ========== PERFORMANCE COMPARISON ==========

Sequential (old way): ~300 seconds
Parallel (optimized): 35.2 seconds
⚡ Speed improvement: 8.5x faster!
```

**Important:** This will send 200 actual SMS messages to your phone number, costing ~$10. Only run this test when you want to verify batch performance!

---

## 🗄️ DATABASE INTEGRITY CHECK

### **Run Database Fixes:**

```bash
# Login to PostgreSQL
psql -U postgres -d school_attendance

# Run the production fixes script
\i PRODUCTION_FIXES.sql

# Verify constraints were added
\d devices
\d students
\d schools
\d users
```

**Expected Output:**
```
Indexes:
    "devices_pkey" PRIMARY KEY, btree (id)
    "devices_serial_number_unique" UNIQUE CONSTRAINT, btree (serial_number)
    ...

Constraints:
    "devices_serial_number_unique" UNIQUE (serial_number)
```

---

## 🐛 TROUBLESHOOTING

### **Problem: Backend not responding**

**Solution:**
```bash
# Check if backend is running
lsof -i :3001

# If not running, start it
cd backend
npm start

# Check logs
tail -f /tmp/backend.log
```

---

### **Problem: Login fails with "Invalid token"**

**Solution:**
```bash
# Check JWT_SECRET in .env
cat .env | grep JWT_SECRET

# Should be at least 32 characters
# If too short, generate new one:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Update .env with new JWT_SECRET
# Restart backend
```

---

### **Problem: SMS not sending**

**Solution:**
```bash
# Check Twilio credentials in .env
cat .env | grep TWILIO

# Verify all three are set:
# TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# TWILIO_PHONE_NUMBER=+19124206711

# Check WhatsApp is disabled in database
psql -U postgres -d school_attendance -c "SELECT setting_value FROM platform_settings WHERE setting_key = 'whatsapp_enabled';"

# Should return: false

# Test simple SMS
node test-sms-simple.js
```

---

### **Problem: Device authentication fails**

**Solution:**
```bash
# Verify device exists in database
psql -U postgres -d school_attendance -c "SELECT * FROM devices WHERE serial_number = 'ZKTECO12345678';"

# Check device is active (is_active = true)
# Check device serial number matches exactly (case-sensitive)

# Test device endpoint
curl -X GET "http://localhost:3001/iclock/getrequest?SN=ZKTECO12345678" \
  -H "X-Device-Serial: ZKTECO12345678"

# Should return: OK (if no pending commands)
```

---

### **Problem: Cross-tenant violation error**

**Solution:**
```bash
# This is a security feature - verify:
# 1. Student belongs to same school as device
# 2. Device is registered to correct school
# 3. device_user_mappings has correct school_id

# Check student school
psql -U postgres -d school_attendance -c "SELECT id, full_name, school_id FROM students WHERE id = 1;"

# Check device school
psql -U postgres -d school_attendance -c "SELECT id, device_name, school_id FROM devices WHERE id = 1;"

# Should match!
```

---

## ✅ FINAL CHECKLIST BEFORE PRODUCTION

- [ ] All manual tests passed
- [ ] Automated test script shows all ✅ PASS
- [ ] SMS sending works (tested with test-sms-simple.js)
- [ ] Database constraints added (ran PRODUCTION_FIXES.sql)
- [ ] JWT_SECRET is strong (32+ characters)
- [ ] CORS configured for production domain
- [ ] HTTPS/SSL certificate ready
- [ ] Backup strategy in place
- [ ] Monitoring tools configured
- [ ] Password validation enabled (change to strict)

---

## 📞 TESTING SUPPORT

If you encounter issues during testing, check:

1. **Backend logs:** `tail -f /tmp/backend.log`
2. **Database logs:** `psql` connection and query errors
3. **Browser console:** For frontend errors
4. **Network tab:** Check API responses

**Everything working? You're ready to deploy!** 🚀

---

**Next Step:** Read `PRODUCTION_READINESS_COMPLETE_AUDIT.md` for deployment guide
