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

    console.log(`\n📥 /iclock/cdata from device: ${device?.device_name || 'UNKNOWN'} (SN: ${sn}) method=${req.method} query=${JSON.stringify(req.query)}`);

    // ----- Handshake: device requests options
    if ((req.method === 'GET' || req.method === 'POST') && (req.query.options === 'all')) {
      const optionsResponse = `GET OPTION FROM: ${sn}\nStamp=0\nOpStamp=0\nPhotoStamp=0\nErrorDelay=60\nDelay=20\nTransTimes=00:00;14:05\nTransInterval=1\n`;
      console.log(`[HANDSHAKE] replying options to SN=${sn}`);
      return res.status(200).type('text/plain; charset=utf-8').send(optionsResponse);
    }

    // ----- Data upload
    const rawData = (req.body || '').toString();
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

    const dbRes = await query(sql, [device.id]);

    if (!dbRes || dbRes.rows.length === 0) {
      // No commands
      // NOTE: must return plain OK
      console.log('ℹ️ No pending commands for device', device.serial_number);
      return sendOK(res);
    }

    const row = dbRes.rows[0];
    const cmdString = row.command_string || '';

    console.log(`📤 Sending command id=${row.id} to device ${device.serial_number} (len=${cmdString.length})`);
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

    console.log(`\n📨 Command confirmation from device: ${device?.device_name || 'UNKNOWN'} (SN: ${device?.serial_number || 'UNKNOWN'})`);
    console.log('   Raw confirmation payload:', rawBody);

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

    if (!id) {
      console.warn('⚠️ devicecmd missing ID after parsing:', params);
      return sendOK(res);
    }

    console.log(`   Command ID: ${id}, Return Code: ${returnCode}, CMD: ${cmdName}`);

    // Update DB status
    try {
      if (returnCode === 0) {
        await query(
          `UPDATE device_commands
           SET status = 'completed', completed_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [id]
        );
        console.log(`✅ Command ${id} marked as completed`);
      } else {
        await query(
          `UPDATE device_commands
           SET status = 'failed', error_message = $2
           WHERE id = $1`,
          [id, `Device returned code ${returnCode}`]
        );
        console.log(`❌ Command ${id} marked as failed (code=${returnCode})`);
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

module.exports = {
  receiveAttendanceData,
  sendCommands,
  receiveCommandConfirmation
};
