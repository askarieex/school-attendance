# ZKTeco Cloud Management - Timezone Fix Guide

## Problem
Device shows wrong time despite backend NOT sending time sync commands.
Physical device display shows incorrect time even though device web interface shows correct time.

## Root Cause
**ZKTeco Cloud Management (time.xmzkteco.com:8097) has WRONG timezone configured:**
- Current Setting: `Etc/GMT+5` (UTC+5:00)
- Required Setting: `Asia/Kolkata` (UTC+5:30 = IST)
- Time Difference: 30 minutes wrong

## Solution

### Step 1: Login to ZKTeco Cloud Management
1. Navigate to: https://time.xmzkteco.com:8097
2. Login with your cloud account credentials
3. Go to Device Configurations page

### Step 2: Fix Timezone Setting
1. Find your device: **GED7242600838** (alias: "cps divice")
2. Locate the "Default Timezone" dropdown
3. **Change from**: `Etc/GMT+5`
4. **Change to**: `Asia/Kolkata` or `Asia/Calcutta`

   Alternative options if above not available:
   - `IST`
   - `GMT+5:30`
   - `UTC+05:30`

5. Click **Save** or **Update** button

### Step 3: Verify Settings
After saving, ensure these settings:
- ✅ Data Sync Mode: Real-Time
- ✅ PUSH Heartbeat: 10 Seconds
- ✅ Transfer Mode: Real-Time
- ✅ Transfer Interval: 10 Minutes
- ✅ Default Timezone: **Asia/Kolkata** ← CRITICAL FIX

### Step 4: Wait for Configuration Push
- Cloud system will push new configuration to device
- Wait 1-2 minutes for sync to complete
- Device should update automatically

### Step 5: Verify Time is Correct
1. **Check Physical Device Display**: Should now show correct IST time
2. **Check Device Web Interface**: http://192.168.1.6/csl/check → Should show correct time
3. **Check Backend Logs**: Should continue showing `ℹ️ No pending commands` (this is correct)

## Understanding Time Sync Hierarchy

Your device has THREE time sources:

### 1. Cloud Management (time.xmzkteco.com) ← HIGHEST PRIORITY
- Sets timezone and time sync rules
- **Overrides local device settings** when device is in "Auto" mode
- **This was your problem**: Wrong timezone (GMT+5 instead of GMT+5:30)

### 2. Local Device Web Interface (192.168.1.6)
- Shows time that device thinks is correct
- Gets overridden by cloud when "Adjust Mode: Auto"
- Manual time setting only works when "Adjust Mode: Manual"

### 3. Backend PUSH Protocol (Your Node.js server) ← DISABLED
- We've completely DISABLED automatic time sync ✅
- Backend does NOT send time commands anymore ✅
- Backend logs correctly show: `ℹ️ No pending commands`

## Why Time Was Changing When Backend Started

**Initial Suspicion**: Backend was sending wrong time commands
**Reality**: Backend connects device → Device registers with cloud → Cloud pushes wrong timezone → Time becomes incorrect

**Backend was innocent!** The issue was cloud configuration, not backend code.

## Current Status

### ✅ Fixed:
- Backend automatic time sync service disabled
- Backend does NOT send time commands anymore
- No pending time sync commands in database
- Backend logs correctly show no commands being sent

### ⏳ Remaining Issue:
- **ZKTeco Cloud timezone setting is wrong**
- Need to change from `Etc/GMT+5` to `Asia/Kolkata`
- This fix must be done in cloud management portal

## Technical Details

### IST (Indian Standard Time)
- Timezone: Asia/Kolkata or Asia/Calcutta
- UTC Offset: **+05:30** (5 hours 30 minutes ahead of UTC)
- No daylight saving time

### Common Timezone Mistakes
- ❌ `Etc/GMT+5` = UTC+5:00 (30 minutes behind IST)
- ❌ `GMT+5` = UTC+5:00 (30 minutes behind IST)
- ✅ `Asia/Kolkata` = UTC+5:30 (correct for India)
- ✅ `IST` = UTC+5:30 (correct for India)

### Device Model
- Model: K40 Pro / eFeeder RFID
- Serial Number: GED7242600838
- Device Name: "cps divice"
- Firmware: ZKTeco PUSH/ADMS Protocol

## Expected Result After Fix

Once cloud timezone is corrected to `Asia/Kolkata`:
1. ✅ Physical device display shows correct IST time
2. ✅ Device web interface shows correct IST time
3. ✅ Backend does NOT interfere with device time
4. ✅ Time remains stable when backend starts/stops
5. ✅ Device maintains correct time after reboot

## Alternative Solution (If Cloud Fix Doesn't Work)

If you cannot change timezone in cloud portal, you can:

### Option A: Switch Device to Standalone Mode
1. Remove device from cloud management
2. Configure device as standalone (not cloud-managed)
3. Set time manually via device web interface
4. Set "Adjust Mode: Manual" in device settings
5. Backend will only receive attendance logs, not manage device

### Option B: Use Different Cloud Server
1. Check if there's a different ZKTeco cloud server for India
2. Some regions have dedicated cloud servers with correct timezone presets
3. Contact ZKTeco support for India-specific cloud server

## Contact Information

If you need further assistance:
- ZKTeco India Support: Check device manual for support contact
- Cloud Management Support: May have different support team

## Summary

**Problem**: Wrong timezone in ZKTeco cloud management (GMT+5 instead of GMT+5:30)
**Solution**: Change timezone to `Asia/Kolkata` in cloud management portal
**Expected Result**: Device displays correct IST time on physical display and web interface
**Backend Status**: Working correctly, NOT causing time changes ✅
