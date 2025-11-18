#!/bin/bash

# =====================================================
# ZKTeco Integration - cURL Testing Commands
# Simulates device communication with server
# =====================================================

# Configuration - UPDATE THESE VALUES
SERVER_IP="192.168.1.7"
SERVER_PORT="3001"
DEVICE_SN="GED7242600838"
COMMAND_ID="1001"  # Update with actual command ID from database

BASE_URL="http://${SERVER_IP}:${SERVER_PORT}/iclock"

echo "======================================================"
echo "ZKTeco Device Simulation Tests"
echo "Server: ${BASE_URL}"
echo "Device SN: ${DEVICE_SN}"
echo "======================================================"
echo ""

# =====================================================
# TEST 1: Device Handshake (GET with options=all)
# =====================================================
echo "TEST 1: Device Handshake (Request Options)"
echo "------------------------------------------------------"
echo "Request: GET ${BASE_URL}/cdata?SN=${DEVICE_SN}&options=all"
echo ""

curl -v "${BASE_URL}/cdata?SN=${DEVICE_SN}&options=all" \
  -H "Content-Type: text/plain"

echo ""
echo "Expected Response: GET OPTION FROM: ${DEVICE_SN}"
echo "Expected Response should contain: Stamp=0, Delay=20, TransTimes=..."
echo ""
read -p "Press Enter to continue..."
echo ""


# =====================================================
# TEST 2: Device Polls for Commands (GET /getrequest)
# =====================================================
echo "TEST 2: Device Polls for Commands"
echo "------------------------------------------------------"
echo "Request: GET ${BASE_URL}/getrequest?SN=${DEVICE_SN}"
echo ""

RESPONSE=$(curl -s "${BASE_URL}/getrequest?SN=${DEVICE_SN}")
echo "Response: ${RESPONSE}"

if [ "$RESPONSE" == "OK" ]; then
  echo "✅ No pending commands (expected if you haven't inserted any)"
  echo "ℹ️  Insert a command using SQL_TESTING_COMMANDS.sql (STEP 3)"
else
  echo "✅ Received command: ${RESPONSE}"
  echo "ℹ️  Device should execute this command now"
fi

echo ""
read -p "Press Enter to continue..."
echo ""


# =====================================================
# TEST 3: Device Confirms Command Execution (Success)
# =====================================================
echo "TEST 3: Device Confirms Command (Return=0 = Success)"
echo "------------------------------------------------------"
echo "Request: POST ${BASE_URL}/devicecmd?SN=${DEVICE_SN}"
echo "Body: ID=${COMMAND_ID}&Return=0&CMD=DATA"
echo ""

curl -X POST "${BASE_URL}/devicecmd?SN=${DEVICE_SN}" \
  -H "Content-Type: text/plain" \
  --data "ID=${COMMAND_ID}&Return=0&CMD=DATA"

echo ""
echo "Expected Response: OK"
echo "Check server logs for: ✅ Command ${COMMAND_ID} marked as completed"
echo "Check DB: SELECT status FROM device_commands WHERE id=${COMMAND_ID};"
echo ""
read -p "Press Enter to continue..."
echo ""


# =====================================================
# TEST 4: Device Confirms Command Execution (Failed)
# =====================================================
echo "TEST 4: Device Confirms Command (Return=-1004 = Failed)"
echo "------------------------------------------------------"
echo "Request: POST ${BASE_URL}/devicecmd?SN=${DEVICE_SN}"
echo "Body: ID=${COMMAND_ID}&Return=-1004&CMD=DATA"
echo ""

# Note: This simulates a device error
curl -X POST "${BASE_URL}/devicecmd?SN=${DEVICE_SN}" \
  -H "Content-Type: text/plain" \
  --data "ID=${COMMAND_ID}&Return=-1004&CMD=DATA"

echo ""
echo "Expected Response: OK"
echo "Check server logs for: ❌ Command ${COMMAND_ID} marked as failed"
echo "Check DB: SELECT status, error_message FROM device_commands WHERE id=${COMMAND_ID};"
echo ""
read -p "Press Enter to continue..."
echo ""


# =====================================================
# TEST 5: Device Uploads Attendance Data
# =====================================================
echo "TEST 5: Device Uploads Attendance Data"
echo "------------------------------------------------------"
echo "Request: POST ${BASE_URL}/cdata?SN=${DEVICE_SN}&table=ATTLOG&Stamp=9999"
echo "Body: Tab-separated attendance record"
echo ""

# Attendance format: PIN\tTimestamp\tStatus\tVerifyMethod\tWorkCode\tReserved
# Example: Student with PIN 101 scans at 8:30 AM
ATTENDANCE_DATA="101	2025-10-23 08:30:00	1	15	0	0"

curl -X POST "${BASE_URL}/cdata?SN=${DEVICE_SN}&table=ATTLOG&Stamp=9999" \
  -H "Content-Type: text/plain" \
  --data-binary "${ATTENDANCE_DATA}"

echo ""
echo "Expected Response: OK"
echo "Check server logs for: 📋 Parsed 1 attendance record(s)"
echo "Check server logs for: ✅ Attendance recorded: [Name] - present at ..."
echo "Check DB: SELECT * FROM attendance_logs WHERE date=CURRENT_DATE ORDER BY created_at DESC LIMIT 5;"
echo ""
read -p "Press Enter to continue..."
echo ""


# =====================================================
# TEST 6: Device Uploads Multiple Attendance Records
# =====================================================
echo "TEST 6: Device Uploads Multiple Attendance Records"
echo "------------------------------------------------------"

# Multiple students scanning
MULTI_ATTENDANCE="101	2025-10-23 08:30:00	1	15	0	0
102	2025-10-23 08:31:15	1	15	0	0
103	2025-10-23 08:32:30	1	15	0	0"

curl -X POST "${BASE_URL}/cdata?SN=${DEVICE_SN}&table=ATTLOG&Stamp=9999" \
  -H "Content-Type: text/plain" \
  --data-binary "${MULTI_ATTENDANCE}"

echo ""
echo "Expected: 📋 Parsed 3 attendance record(s)"
echo ""
read -p "Press Enter to continue..."
echo ""


# =====================================================
# TEST 7: Invalid Device Serial Number
# =====================================================
echo "TEST 7: Invalid Device (Should Return Error)"
echo "------------------------------------------------------"
echo "Request: GET ${BASE_URL}/getrequest?SN=INVALID_SERIAL"
echo ""

curl -v "${BASE_URL}/getrequest?SN=INVALID_SERIAL" 2>&1 | grep -E "(< HTTP|ERROR)"

echo ""
echo "Expected: 401 Unauthorized or ERROR message"
echo ""
read -p "Press Enter to continue..."
echo ""


# =====================================================
# TEST 8: Missing Serial Number
# =====================================================
echo "TEST 8: Missing Serial Number (Should Return Error)"
echo "------------------------------------------------------"
echo "Request: GET ${BASE_URL}/getrequest (no SN param)"
echo ""

curl -v "${BASE_URL}/getrequest" 2>&1 | grep -E "(< HTTP|ERROR)"

echo ""
echo "Expected: 401 Unauthorized or ERROR message"
echo ""


# =====================================================
# SUMMARY
# =====================================================
echo ""
echo "======================================================"
echo "Testing Complete!"
echo "======================================================"
echo ""
echo "Check your server logs for detailed output"
echo "Check your database for updated records"
echo ""
echo "Common Issues:"
echo "- Connection refused: Server not running or wrong IP/port"
echo "- 401 Unauthorized: Device not registered in database"
echo "- No pending commands: Insert commands using SQL scripts"
echo "- rowCount=0 warnings: Command ID mismatch (check logs)"
echo ""
echo "Next Steps:"
echo "1. Review server logs for errors"
echo "2. Run SQL queries from SQL_TESTING_COMMANDS.sql"
echo "3. Configure real ZKTeco device with server IP"
echo "4. Monitor real device communication"
echo ""


# =====================================================
# BONUS: Quick Status Check
# =====================================================
echo ""
echo "Quick Status Check:"
echo "------------------------------------------------------"

# Check if server is responding
if curl -s --max-time 2 "${BASE_URL}/getrequest?SN=${DEVICE_SN}" > /dev/null; then
  echo "✅ Server is responding"
else
  echo "❌ Server is not responding - check if server is running"
fi

# Check if device can authenticate
RESPONSE=$(curl -s --max-time 2 "${BASE_URL}/getrequest?SN=${DEVICE_SN}")
if [[ "$RESPONSE" == "ERROR"* ]]; then
  echo "❌ Device authentication failed - check if device exists in DB"
elif [[ "$RESPONSE" == "OK" ]] || [[ "$RESPONSE" == "C:"* ]]; then
  echo "✅ Device authentication successful"
else
  echo "⚠️  Unexpected response: ${RESPONSE}"
fi

echo ""
echo "======================================================"
