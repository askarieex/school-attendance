/**
 * iclockController.js
 * Improved ZKTeco PUSH/ADMS controller
 *
 * Requirements:
 * - ../config/database should export `query` (pg wrapper)
 * - ../services/attendanceParser should parse raw body -> attendance logs array
 * - ../services/attendanceProcessor should process each log and return { success, duplicate }
 */

const { query } = require('../config/database');
const parseAttendanceData = require('../services/attendanceParser');
const processAttendance = require('../services/attendanceProcessor');

/**
 * Helper: send plain text OK with utf-8
 */
const sendOK = (res, body = 'OK') => {
  res.status(200).type('text/plain; charset=utf-8').send(body);
};

/**
 * GET/POST /iclock/cdata
 * - If options=all -> return GET OPTION FROM block (handshake)
 * - If table=... -> accept data upload and parse attendance logs
 */
const receiveAttendanceData = async (req, res) => {
  try {
    const device = req.device; // set by deviceAuth middleware
    const sn = (req.query.SN || req.query.sn || (device && device.serial_number) || 'UNKNOWN').toString();
    const rawData = (req.body || '').toString();

    // 🕐 LOG DEVICE TIME - Print current server time and device serial
    const serverNow = new Date();
    const serverIST = serverNow.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    console.log(`\n📥 /iclock/cdata from device: ${device?.device_name || 'UNKNOWN'} (SN: ${sn}) method=${req.method}`);
    console.log(`🕐 SERVER TIME (IST): ${serverIST}`);

    // ----- Check if device is responding with DateTime (GET OPTIONS response)
    if (req.query.DateTime || (rawData && rawData.includes('DateTime='))) {
      const dateTimeMatch = (req.query.DateTime || rawData).match(/DateTime=(\d+)/);
      if (dateTimeMatch) {
        const deviceTimestamp = parseInt(dateTimeMatch[1], 10);
        const deviceDate = new Date(deviceTimestamp * 1000);
        const serverDate = new Date();
        const diffSeconds = Math.abs(Math.floor((serverDate.getTime() / 1000) - deviceTimestamp));

        console.log(`\n⏰ ========== DEVICE TIME REPORT ==========`);
        console.log(`   Device Serial: ${sn}`);
        console.log(`   Device Timestamp: ${deviceTimestamp}`);
        console.log(`   Device Time (UTC): ${deviceDate.toUTCString()}`);
        console.log(`   Device Time (IST): ${deviceDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
        console.log(`   Server Time (IST): ${serverDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
        console.log(`   Time Difference: ${diffSeconds} seconds (${Math.floor(diffSeconds / 60)} minutes)`);
        console.log(`⏰ ========================================\n`);

        return sendOK(res);
      }
    }

    // ----- 🌍 Check if device is responding with TimeZone (GET OPTIONS TimeZone response)
    if (req.query.TimeZone || (rawData && rawData.includes('TimeZone='))) {
      const timezoneMatch = (req.query.TimeZone || rawData).match(/TimeZone=([+-]\d{4})/);
      if (timezoneMatch) {
        const timezone = timezoneMatch[1];

        console.log(`\n🌍 ========== DEVICE TIMEZONE REPORT ==========`);
        console.log(`   Device Serial: ${sn}`);
        console.log(`   Device Name: ${device?.device_name || 'UNKNOWN'}`);
        console.log(`   Timezone Offset: ${timezone}`);
        console.log(`   Expected for IST: +0530`);

        if (timezone === '+0530') {
          console.log(`   ✅ TIMEZONE CORRECT - Device is using IST timezone!`);
        } else if (timezone === '+0000') {
          console.log(`   ❌ TIMEZONE WRONG - Device is still on UTC (default)`);
          console.log(`   💡 Run: POST /api/v1/test/timezone/setup/${device?.id || 'DEVICE_ID'}`);
        } else {
          console.log(`   ⚠️  TIMEZONE MISMATCH - Expected +0530, got ${timezone}`);
        }

        console.log(`🌍 ============================================\n`);

        return sendOK(res);
      }
    }

    // ----- 🔒 Check if device is responding with DST status
    if (req.query.DaylightSavings || (rawData && rawData.includes('DaylightSavings='))) {
      const dstMatch = (req.query.DaylightSavings || rawData).match(/DaylightSavings=(\d+)/);
      if (dstMatch) {
        const dstEnabled = dstMatch[1] === '1';

        console.log(`\n🔒 ========== DEVICE DST STATUS ==========`);
        console.log(`   Device Serial: ${sn}`);
        console.log(`   DST Status: ${dstEnabled ? 'ENABLED ❌' : 'DISABLED ✅'}`);

        if (dstEnabled) {
          console.log(`   ⚠️  WARNING: DST is enabled - may cause time jumps!`);
          console.log(`   💡 Disable DST: POST /api/v1/test/timezone/disable-dst/${device?.id || 'DEVICE_ID'}`);
        } else {
          console.log(`   ✅ Good - DST is disabled (recommended)`);
        }

        console.log(`🔒 ========================================\n`);

        return sendOK(res);
      }
    }

    // ----- Handshake: device requests options
    if ((req.method === 'GET' || req.method === 'POST') && (req.query.options === 'all')) {
      // ✅ FIX: Added TimeZone=330 for IST (+5.5 hours = 330 minutes)
      // This tells the device what timezone it's in, so attendance timestamps are correct
      const optionsResponse = `GET OPTION FROM: ${sn}
Stamp=0
OpStamp=0
PhotoStamp=0
TimeZone=330
ErrorDelay=60
Delay=20
TransTimes=00:00;14:05
TransInterval=1
`;

      console.log(`\n🔵 ========== HANDSHAKE START ==========`);
      console.log(`   Device: ${device?.device_name || 'UNKNOWN'} (SN: ${sn})`);
      console.log(`   Server Time (IST): ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      console.log(`   Method: ${req.method}`);
      console.log(`   Query: ${JSON.stringify(req.query)}`);
      console.log(`   TimeZone: 330 minutes (IST +05:30) ✅`);
      console.log(`🔵 ========== HANDSHAKE RESPONSE ==========`);
      console.log(`   Response: GET OPTION FROM with TimeZone=330`);
      console.log(`   ✅ Device will now use IST timezone for attendance logs`);
      console.log(`🔵 ==========================================\n`);

      return res.status(200).type('text/plain; charset=utf-8').send(optionsResponse);
    }

    // ----- Data upload
    if (!rawData || rawData.trim().length === 0) {
      console.warn('⚠️ Empty attendance payload received — replying OK to prevent retries');
      return sendOK(res);
    }

    console.log('Raw data received (first 500 chars):', rawData.slice(0, 500));

    // Parse the tab-separated attendance logs
    const attendanceLogs = parseAttendanceData(rawData);

    if (!Array.isArray(attendanceLogs) || attendanceLogs.length === 0) {
      console.warn('⚠️ No valid attendance logs parsed');
      return sendOK(res);
    }

    console.log(`📋 Parsed ${attendanceLogs.length} attendance record(s) from device`);

    // Process each attendance record sequentially (so DB updates are consistent)
    const results = { success: 0, duplicate: 0, failed: 0 };

    for (const log of attendanceLogs) {
      try {
        const r = await processAttendance(log, device);
        if (r && r.success) {
          if (r.duplicate) results.duplicate++; else results.success++;
        } else {
          results.failed++;
        }
      } catch (err) {
        results.failed++;
        console.error('Error processing attendance record:', err);
      }
    }

    console.log(`\n✅ Attendance processing complete:`, results);

    // Respond plain OK (device expects plain text)
    return sendOK(res);

  } catch (error) {
    console.error('❌ Error in receiveAttendanceData:', error);
    // Must still reply OK so device doesn't retry continuously
    return sendOK(res);
  }
};

/**
 * GET /iclock/getrequest
 * - Atomically fetch 1 pending command for this device, mark it sent, and return the command string
 * - If no commands pending, return OK
 */
const sendCommands = async (req, res) => {
  try {
    const device = req.device;
    if (!device) {
      console.warn('sendCommands: missing req.device (deviceAuth may have failed)');
      return sendOK(res);
    }

    console.log(`\n📡 Device polling: ${device.device_name} (SN: ${device.serial_number})`);

    // Ensure we have a valid device ID (defensive lookup if needed)
    let deviceId = device.id;
    if (!deviceId && device.serial_number) {
      console.warn(`⚠️ device.id missing, looking up by serial_number: ${device.serial_number}`);
      const devRes = await query('SELECT id FROM devices WHERE serial_number = $1 LIMIT 1', [device.serial_number]);
      if (devRes && devRes.rows && devRes.rows[0]) {
        deviceId = devRes.rows[0].id;
        console.log(`✅ Found device id=${deviceId} for SN=${device.serial_number}`);
      }
    }

    if (!deviceId) {
      console.error('❌ sendCommands: no device id available, cannot fetch commands');
      return sendOK(res);
    }

    // Atomic pick & mark sent (Postgres): UPDATE ... RETURNING
    const sql = `
      WITH sel AS (
        SELECT id FROM device_commands
        WHERE device_id = $1 AND status = 'pending'
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
      )
      UPDATE device_commands
      SET status = 'sent', sent_at = CURRENT_TIMESTAMP
      FROM sel
      WHERE device_commands.id = sel.id
      RETURNING device_commands.id, device_commands.command_string;
    `;

    const dbRes = await query(sql, [deviceId]);

    if (!dbRes || dbRes.rows.length === 0) {
      // No commands
      // NOTE: must return plain OK
      console.log('ℹ️ No pending commands for device', device.serial_number);
      return sendOK(res);
    }

    const row = dbRes.rows[0];
    const cmdString = row.command_string || '';

    console.log(`\n🟡 ========== SENDING COMMAND ==========`);
    console.log(`   Device: ${device.device_name} (SN: ${device.serial_number})`);
    console.log(`   Server Time (IST): ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`   Command ID: ${row.id}`);
    console.log(`   Command String: ${cmdString}`);
    console.log(`   Command Length: ${cmdString.length}`);
    console.log(`   ⚠️  CHECK DEVICE TIME NOW - Before sending command`);
    console.log(`🟡 ========================================\n`);

    // Ensure Content-Type is plain/text; charset utf-8
    res.set('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(cmdString);

  } catch (error) {
    console.error('❌ Error in sendCommands:', error);
    // Device expects OK or ERROR; return ERROR so device logs it but don't crash device loop
    res.set('Content-Type', 'text/plain; charset=utf-8');
    return res.status(500).send('ERROR');
  }
};

/**
 * POST /iclock/devicecmd
 * Device confirms execution of a command. Body like: "ID=1001&Return=0&CMD=DATA"
 * We parse ID and Return and update device_commands row accordingly.
 */
const receiveCommandConfirmation = async (req, res) => {
  try {
    const device = req.device;
    const rawBody = (req.body || '').toString().trim();

    console.log(`\n🟢 ========== COMMAND CONFIRMATION ==========`);
    console.log(`   Device: ${device?.device_name || 'UNKNOWN'} (SN: ${device?.serial_number || 'UNKNOWN'})`);
    console.log(`   Server Time (IST): ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`   Raw confirmation: ${rawBody}`);

    if (!rawBody || !rawBody.includes('ID=')) {
      console.warn('⚠️ devicecmd body missing ID= - ignoring but responding OK');
      return sendOK(res);
    }

    // Parse URL-like key=value pairs
    // Device sometimes sends "ID=1001&Return=0&CMD=DATA" or similar
    const parts = rawBody.split('&').map(p => p.split('='));
    const params = {};
    for (const p of parts) {
      if (p.length >= 2) {
        const k = p[0].trim();
        const v = p.slice(1).join('=').trim(); // allow = inside value
        params[k] = v;
      }
    }

    const id = params.ID || params.id;
    const retCodeRaw = params.Return || params.return || '0';
    const cmdName = params.CMD || params.cmd || null;

    const returnCode = parseInt(retCodeRaw, 10);
    const commandId = parseInt(id, 10);

    if (!id || isNaN(commandId)) {
      console.warn('⚠️ devicecmd missing or invalid ID after parsing:', params);
      return sendOK(res);
    }

    console.log(`   Command ID: ${commandId}`);
    console.log(`   Return Code: ${returnCode}`);
    console.log(`   CMD Type: ${cmdName}`);
    console.log(`   ⚠️  CHECK DEVICE TIME NOW - After command confirmation`);

    // Update DB status
    try {
      if (returnCode === 0) {
        const result = await query(
          `UPDATE device_commands
           SET status = 'completed', completed_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [commandId]
        );
        if (result.rowCount === 0) {
          console.warn(`⚠️ Command ${commandId} not found in DB - may have been deleted or never existed`);
        } else {
          console.log(`✅ Command ${commandId} marked as COMPLETED`);
          console.log(`   Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
          console.log(`🟢 ==========================================\n`);
        }
      } else {
        const result = await query(
          `UPDATE device_commands
           SET status = 'failed', error_message = $2
           WHERE id = $1`,
          [commandId, `Device returned code ${returnCode}`]
        );
        if (result.rowCount === 0) {
          console.warn(`⚠️ Command ${commandId} not found in DB - may have been deleted or never existed`);
        } else {
          console.log(`❌ Command ${commandId} marked as failed (code=${returnCode})`);
        }
      }
    } catch (dbErr) {
      console.error('❌ DB error while updating command status:', dbErr);
    }

    return sendOK(res);
  } catch (error) {
    console.error('❌ Error in receiveCommandConfirmation:', error);
    return sendOK(res);
  }
};

/**
 * GET /iclock/rtdata
 * Second stage of time synchronization protocol
 * Device requests current time after receiving SET OPTIONS DateTime command
 * Query params: type=time, SN=<serial_number>
 *
 * Response format: DateTime=<UnixTimestamp>,ServerTZ=<±HHMM>
 * Example: DateTime=1699282347,ServerTZ=+0530
 */
const sendRealTimeData = async (req, res) => {
  try {
    const device = req.device;
    const requestType = req.query.type;
    const sn = req.query.SN || req.query.sn || device?.serial_number || 'UNKNOWN';

    console.log(`\n🟣 ========== STAGE 2: RTDATA REQUEST ==========`);
    console.log(`   Device: ${device?.device_name || 'UNKNOWN'} (SN: ${sn})`);
    console.log(`   Request Type: ${requestType}`);
    console.log(`   ⚠️  CHECK DEVICE TIME NOW - Device is requesting time`);

    if (requestType === 'time') {
      // Get current server time
      const now = new Date();
      const unixTimestamp = Math.floor(now.getTime() / 1000);

      // IST timezone offset: +05:30
      const serverTZ = '+0530';

      // Format response exactly as protocol requires
      const response = `DateTime=${unixTimestamp},ServerTZ=${serverTZ}`;

      console.log(`🟣 ========== STAGE 2: RTDATA RESPONSE ==========`);
      console.log(`   Current IST time: ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      console.log(`   Unix timestamp: ${unixTimestamp}`);
      console.log(`   Server timezone: ${serverTZ}`);
      console.log(`   Response: ${response}`);
      console.log(`   ⚠️  CHECK DEVICE TIME NOW - After rtdata response`);
      console.log(`   ⚠️  DEVICE SHOULD NOW UPDATE ITS TIME`);
      console.log(`🟣 ============================================\n`);

      // Send response with exact Content-Type as protocol requires
      return res.status(200).type('text/plain; charset=utf-8').send(response);
    } else {
      // Unknown request type
      console.warn(`⚠️ Unknown rtdata request type: ${requestType}`);
      return sendOK(res);
    }
  } catch (error) {
    console.error('❌ Error in sendRealTimeData:', error);
    return sendOK(res);
  }
};

module.exports = {
  receiveAttendanceData,
  sendCommands,
  receiveCommandConfirmation,
  sendRealTimeData
};
