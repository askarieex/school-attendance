const { query } = require('../config/database');
const parseAttendanceData = require('../services/attendanceParser');
const processAttendance = require('../services/attendanceProcessor');

/**
 * POST /iclock/cdata
 * Receives attendance data from ZKTeco devices
 */
const receiveAttendanceData = async (req, res) => {
  try {
    // Device is already authenticated by middleware
    const device = req.device;

    console.log(`\n📥 Receiving attendance data from device: ${device.device_name} (SN: ${device.serial_number})`);

    // Get raw body (plain text)
    const rawData = req.body;

    if (!rawData) {
      console.warn('⚠️  Empty attendance data received');
      res.set('Content-Type', 'text/plain');
      return res.send('OK'); // Still send OK to prevent retries
    }

    console.log('Raw data received:', rawData);

    // Parse the tab-separated attendance data
    const attendanceLogs = parseAttendanceData(rawData);

    if (attendanceLogs.length === 0) {
      console.warn('⚠️  No valid attendance logs parsed');
      res.set('Content-Type', 'text/plain');
      return res.send('OK');
    }
    console.log("____________________________")
    console.log(attendanceLogs)
    console.log("____________________________" )

    // Process each attendance record
    const results = {
      success: 0,
      duplicate: 0,
      failed: 0
    };

    for (const log of attendanceLogs) {
      const result = await processAttendance(log, device);

      if (result.success) {
        if (result.duplicate) {
          results.duplicate++;
        } else {
          results.success++;
        }
      } else {
        results.failed++;
      }
    }

    console.log(`\n✅ Attendance processing complete:`, results);

    // CRITICAL: Must respond with plain "OK" for device to confirm receipt
    res.set('Content-Type', 'text/plain');
    res.send('OK');

  } catch (error) {
    console.error('❌ Error in receiveAttendanceData:', error);
    // Still send OK to prevent device from retrying endlessly
    res.set('Content-Type', 'text/plain');
    res.send('OK');
  }
};
/**
 * GET /iclock/getrequest
 * Responds to device polling for commands
 *
 * Manual Enrollment Mode:
 * - Currently responds with "OK" (no commands)
 * - Students must be enrolled manually using ZKTeco desktop software
 * - Use Student Database ID as the device PIN when enrolling
 * - Backend will auto-create device_user_mapping on first scan
 */
const sendCommands = async (req, res) => {
  try {
    const device = req.device;

    console.log(`\n📡 Device polling: ${device.device_name} (SN: ${device.serial_number})`);

    // Manual enrollment mode - no commands to send
    res.set('Content-Type', 'text/plain');
    return res.send('OK');

  } catch (error) {
    console.error('❌ Error in sendCommands:', error);
    res.set('Content-Type', 'text/plain');
    return res.status(500).send('ERROR');
  }
};


/**
 * GET /iclock/getrequest
 * Sends commands to ZKTeco devices
 */
// const sendCommands = async (req, res) => {
//   try {
//     const device = req.device;

//     console.log(`\n📡 Device polling for commands: ${device.device_name} (SN: ${device.serial_number})`);

//     // Check for pending commands
//     const result = await query(
//       `SELECT * FROM device_commands
//        WHERE device_id = $1 AND status = 'pending'
//        ORDER BY priority DESC, created_at ASC
//        LIMIT 1`,
//       [device.id]
//     );

//     // If no commands, respond with OK
//     if (result.rows.length === 0) {
//       console.log('ℹ️  No pending commands');
//       res.set('Content-Type', 'text/plain');
//       return res.send('OK');
//     }

//     // Get the first pending command
//     const command = result.rows[0];

//     console.log(`\n📤 SENDING COMMAND TO DEVICE`);
//     console.log(`   Command ID: ${command.id}`);
//     console.log(`   Command Type: ${command.command_type}`);
//     console.log(`   Raw Command: ${command.command_string}`);
//     console.log(`   Command Length: ${command.command_string.length} bytes`);
//     console.log(`   Has TABs: ${command.command_string.includes('\t') ? 'YES' : 'NO'}`);
//     console.log(`   Response Headers: Content-Type: text/plain\n`);

//     // Mark command as sent
//     await query(
//       `UPDATE device_commands
//        SET status = 'sent', sent_at = CURRENT_TIMESTAMP
//        WHERE id = $1`,
//       [command.id]
//     );

//     // Send command string to device
//     res.set('Content-Type', 'text/plain');
//     res.send(command.command_string);

//     console.log(`✅ Command sent to device. Waiting for device to process...`);

//   } catch (error) {
//     console.error('❌ Error in sendCommands:', error);
//     res.set('Content-Type', 'text/plain');
//     res.status(500).send('ERROR');
//   }
// };

/**
 * POST /iclock/devicecmd
 * Receives command execution confirmations from ZKTeco devices
 */
const receiveCommandConfirmation = async (req, res) => {
  try {
    const device = req.device;
    const rawData = req.body;

    console.log(`\n📨 Command confirmation from device: ${device.device_name} (SN: ${device.serial_number})`);
    console.log(`   Confirmation data: ${rawData}`);

    // Device sends confirmation in format like: "ID=6&Return=0"
    // Return=0 means success

    // Parse the confirmation data
    if (rawData && rawData.includes('ID=')) {
      const idMatch = rawData.match(/ID=(\d+)/);
      const returnMatch = rawData.match(/Return=(-?\d+)/); // Match negative numbers too

      if (idMatch) {
        const commandId = parseInt(idMatch[1]);
        const returnCode = returnMatch ? parseInt(returnMatch[1]) : 0;

        console.log(`   Command ID: ${commandId}`);
        console.log(`   Return Code: ${returnCode} (${returnCode === 0 ? 'SUCCESS' : 'FAILED'})`);

        // Update command status based on return code
        if (returnCode === 0) {
          await query(
            `UPDATE device_commands
             SET status = 'completed', completed_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [commandId]
          );
          console.log(`✅ Command ${commandId} marked as completed`);
        } else {
          await query(
            `UPDATE device_commands
             SET status = 'failed', error_message = $2
             WHERE id = $1`,
            [commandId, `Device returned error code: ${returnCode}`]
          );
          console.log(`❌ Command ${commandId} marked as failed`);
        }
      }
    }

    // Always respond with OK
    res.set('Content-Type', 'text/plain');
    res.send('OK');

  } catch (error) {
    console.error('❌ Error in receiveCommandConfirmation:', error);
    res.set('Content-Type', 'text/plain');
    res.send('OK'); // Still send OK to prevent device retries
  }
};

module.exports = {
  receiveAttendanceData,
  sendCommands,
  receiveCommandConfirmation
};
