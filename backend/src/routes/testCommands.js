const express = require('express');
const router = express.Router();
const db = require('../config/database');
const CommandGenerator = require('../services/commandGenerator');

/**
 * 🌍 TIMEZONE MANAGEMENT ENDPOINTS
 * Complete timezone configuration for ZKTeco K40 Pro devices
 */

/**
 * POST /api/v1/test/timezone/setup/:deviceId
 *
 * 🚀 ONE-SHOT TIMEZONE SETUP
 * Sends complete timezone configuration sequence to device:
 * 1. Set timezone offset (default: +0530 for IST)
 * 2. Disable DST (prevent time drift)
 * 3. Save to flash (persist across reboots)
 *
 * Body (optional): { "timezone": "+0530" }
 */
router.post('/timezone/setup/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { timezone = '+0530' } = req.body;

    // Validate timezone format
    const timezoneRegex = /^[+-]\d{4}$/;
    if (!timezoneRegex.test(timezone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid timezone format. Use ±HHMM (e.g., +0530 for IST)'
      });
    }

    // Get device info
    const deviceResult = await db.query(
      'SELECT * FROM devices WHERE id = $1',
      [deviceId]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    const device = deviceResult.rows[0];

    console.log(`\n🌍 ========== TIMEZONE SETUP REQUEST ==========`);
    console.log(`   Device: ${device.device_name} (SN: ${device.serial_number})`);
    console.log(`   Timezone: ${timezone}`);
    console.log(`   Commands to send: 3`);
    console.log(`==============================================\n`);

    // Generate complete timezone setup commands
    const baseCommandId = Date.now() % 100000;
    const commands = CommandGenerator.completeTimeZoneSetup(timezone, baseCommandId);

    // Insert all commands into database
    const insertedCommands = [];
    for (const cmd of commands) {
      const result = await db.query(`
        INSERT INTO device_commands (
          device_id,
          command_type,
          command_string,
          status,
          priority
        ) VALUES ($1, $2, $3, 'pending', $4)
        RETURNING *
      `, [deviceId, cmd.type, cmd.commandString, cmd.priority]);

      insertedCommands.push({
        id: result.rows[0].id,
        type: cmd.type,
        command: cmd.commandString,
        description: cmd.description,
        status: 'pending'
      });

      console.log(`✅ Queued: ${cmd.description} (ID: ${result.rows[0].id})`);
    }

    console.log(`\n⏳ Device will execute commands on next poll (within 30 seconds)\n`);

    res.json({
      success: true,
      message: 'Timezone setup commands queued successfully',
      data: {
        deviceId: deviceId,
        deviceName: device.device_name,
        serialNumber: device.serial_number,
        timezone: timezone,
        commandsQueued: insertedCommands.length,
        commands: insertedCommands,
        nextSteps: [
          '1. Wait 30-90 seconds for device to poll and execute all 3 commands',
          '2. Verify timezone: GET /api/v1/test/timezone/verify/:deviceId',
          '3. Check device display - time should match IST',
          '4. Reboot device to confirm settings survive restart',
          '5. After reboot, logs should have correct timezone offset'
        ],
        timeline: {
          '0-30s': 'Command 1 (SET TIMEZONE) sent to device',
          '30-60s': 'Command 2 (DISABLE DST) sent to device',
          '60-90s': 'Command 3 (SAVE TO FLASH) sent to device',
          '90s+': 'All settings saved permanently'
        }
      }
    });

  } catch (error) {
    console.error('❌ Timezone setup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to setup timezone',
      details: error.message
    });
  }
});

/**
 * POST /api/v1/test/timezone/verify/:deviceId
 *
 * 📥 VERIFY TIMEZONE CONFIGURATION
 * Sends GET OPTIONS TimeZone command to query device's current timezone
 * Device will respond via POST /iclock/cdata with TimeZone=<offset>
 */
router.post('/timezone/verify/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Get device info
    const deviceResult = await db.query(
      'SELECT * FROM devices WHERE id = $1',
      [deviceId]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    const device = deviceResult.rows[0];

    console.log(`\n📥 ========== VERIFY TIMEZONE REQUEST ==========`);
    console.log(`   Device: ${device.device_name} (SN: ${device.serial_number})`);
    console.log(`   Action: Query current timezone setting`);
    console.log(`===============================================\n`);

    // Generate GET TIMEZONE command
    const commandId = Date.now() % 100000;
    const commandString = CommandGenerator.getTimeZone(commandId);

    // Insert command
    const result = await db.query(`
      INSERT INTO device_commands (
        device_id,
        command_type,
        command_string,
        status,
        priority
      ) VALUES ($1, 'GET_TIMEZONE', $2, 'pending', 5)
      RETURNING *
    `, [deviceId, commandString]);

    console.log(`✅ Verification command queued (ID: ${result.rows[0].id})`);
    console.log(`⏳ Watch backend logs for device response...\n`);

    res.json({
      success: true,
      message: 'Timezone verification command queued',
      data: {
        commandId: result.rows[0].id,
        deviceId: deviceId,
        deviceName: device.device_name,
        command: commandString,
        status: 'pending',
        instructions: [
          '1. Wait 30 seconds for device to poll',
          '2. Watch backend console for "TimeZone=" in POST /iclock/cdata',
          '3. Device will respond with current timezone offset',
          '4. Expected for IST: TimeZone=+0530',
          '5. If shows +0000, timezone setup failed - retry setup'
        ]
      }
    });

  } catch (error) {
    console.error('❌ Timezone verify error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify timezone',
      details: error.message
    });
  }
});

/**
 * POST /api/v1/test/timezone/set/:deviceId
 *
 * 🌍 SET CUSTOM TIMEZONE
 * Set any timezone offset manually
 * Body: { "timezone": "+0530" }  (required)
 */
router.post('/timezone/set/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { timezone } = req.body;

    if (!timezone) {
      return res.status(400).json({
        success: false,
        error: 'Timezone is required in request body',
        example: { timezone: '+0530' }
      });
    }

    // Validate timezone format
    const timezoneRegex = /^[+-]\d{4}$/;
    if (!timezoneRegex.test(timezone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid timezone format. Use ±HHMM',
        examples: ['+0530 (IST)', '+0545 (Nepal)', '+0600 (Bangladesh)', '-0500 (EST)']
      });
    }

    const commandId = Date.now() % 100000;
    const commandString = CommandGenerator.setTimeZone(timezone, commandId);

    const result = await db.query(`
      INSERT INTO device_commands (
        device_id,
        command_type,
        command_string,
        status,
        priority
      ) VALUES ($1, 'SET_TIMEZONE', $2, 'pending', 10)
      RETURNING *
    `, [deviceId, commandString]);

    res.json({
      success: true,
      message: `Timezone set to ${timezone}`,
      data: {
        commandId: result.rows[0].id,
        timezone: timezone,
        warning: '⚠️  Remember to save to flash: POST /api/v1/test/timezone/save/:deviceId'
      }
    });

  } catch (error) {
    console.error('❌ Set timezone error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set timezone',
      details: error.message
    });
  }
});

/**
 * POST /api/v1/test/timezone/save/:deviceId
 *
 * 💾 SAVE SETTINGS TO FLASH
 * CRITICAL: Must be called after timezone/DST changes to persist them
 */
router.post('/timezone/save/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    const commandId = Date.now() % 100000;
    const commandString = CommandGenerator.saveToFlash(commandId);

    const result = await db.query(`
      INSERT INTO device_commands (
        device_id,
        command_type,
        command_string,
        status,
        priority
      ) VALUES ($1, 'SAVE_FLASH', $2, 'pending', 8)
      RETURNING *
    `, [deviceId, commandString]);

    console.log(`💾 SAVE TO FLASH command queued (ID: ${result.rows[0].id})`);
    console.log(`   This will persist all recent settings to device flash memory`);

    res.json({
      success: true,
      message: 'Save to flash command queued',
      data: {
        commandId: result.rows[0].id,
        description: 'Settings will be saved permanently to device flash memory',
        effect: 'Timezone and other settings will survive device reboot'
      }
    });

  } catch (error) {
    console.error('❌ Save flash error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to queue save command',
      details: error.message
    });
  }
});

/**
 * POST /api/v1/test/timezone/disable-dst/:deviceId
 *
 * 🔒 DISABLE DAYLIGHT SAVING TIME
 * Prevents automatic DST adjustments (recommended for stable timestamps)
 */
router.post('/timezone/disable-dst/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    const commandId = Date.now() % 100000;
    const commandString = CommandGenerator.disableDST(commandId);

    const result = await db.query(`
      INSERT INTO device_commands (
        device_id,
        command_type,
        command_string,
        status,
        priority
      ) VALUES ($1, 'DISABLE_DST', $2, 'pending', 9)
      RETURNING *
    `, [deviceId, commandString]);

    res.json({
      success: true,
      message: 'DST disabled',
      data: {
        commandId: result.rows[0].id,
        recommendation: 'Call save endpoint to persist: POST /api/v1/test/timezone/save/:deviceId'
      }
    });

  } catch (error) {
    console.error('❌ Disable DST error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable DST',
      details: error.message
    });
  }
});

/**
 * TEST ENDPOINT: Force send a test command to device
 * Use this to verify if device actually executes commands
 */
router.post('/force-time-sync/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    // Get current IST time
    const now = new Date();
    const istTime = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    
    // Calculate timestamps
    const unixTimestamp = Math.floor(now.getTime() / 1000);
    const adjustedTimestamp = unixTimestamp - (2.5 * 3600); // Minus 2h 30m
    
    // Create unique command ID
    const testCommandId = Date.now() % 100000;
    
    // Insert test command
    const result = await db.query(`
      INSERT INTO device_commands (
        device_id,
        command_type,
        command_string,
        status
      ) VALUES ($1, 'SET_TIME', $2, 'pending')
      RETURNING *
    `, [deviceId, `C:${testCommandId}:SET OPTIONS DateTime=${adjustedTimestamp}`]);
    
    console.log('\n🧪 TEST COMMAND CREATED:');
    console.log(`   Command ID: ${testCommandId}`);
    console.log(`   Device ID: ${deviceId}`);
    console.log(`   IST Time: ${istTime}`);
    console.log(`   Unix Timestamp: ${unixTimestamp}`);
    console.log(`   Adjusted (minus 2h 30m): ${adjustedTimestamp}`);
    console.log(`   Command: ${result.rows[0].command_string}`);
    console.log(`   Status: ${result.rows[0].status}`);
    console.log('\n⏳ Waiting for device to poll... (within 30 seconds)\n');
    
    res.json({
      success: true,
      message: 'Test command queued. Device will receive it on next poll (within 30 seconds).',
      data: {
        commandId: result.rows[0].id,
        testCommandId: testCommandId,
        deviceId: deviceId,
        istTime: istTime,
        unixTimestamp: unixTimestamp,
        adjustedTimestamp: adjustedTimestamp,
        commandString: result.rows[0].command_string,
        status: result.rows[0].status,
        nextSteps: [
          '1. Wait 30 seconds for device to poll',
          '2. Check device display - should show: ' + istTime,
          '3. Check backend logs for "Command confirmation"',
          '4. Call GET /api/v1/test/check-command/:commandId to verify'
        ]
      }
    });
    
  } catch (error) {
    console.error('❌ Test command error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test command',
      error: error.message
    });
  }
});

/**
 * Check if test command was executed
 */
router.get('/check-command/:commandId', async (req, res) => {
  try {
    const { commandId } = req.params;
    
    const result = await db.query(`
      SELECT 
        dc.*,
        d.device_name,
        d.serial_number
      FROM device_commands dc
      JOIN devices d ON dc.device_id = d.id
      WHERE dc.id = $1
    `, [commandId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Command not found'
      });
    }
    
    const cmd = result.rows[0];
    const isPending = cmd.status === 'pending';
    const isCompleted = cmd.status === 'completed';
    const isFailed = cmd.status === 'failed';
    
    console.log('\n🔍 COMMAND STATUS CHECK:');
    console.log(`   Command ID: ${cmd.id}`);
    console.log(`   Device: ${cmd.device_name} (${cmd.serial_number})`);
    console.log(`   Status: ${cmd.status}`);
    console.log(`   Created: ${cmd.created_at}`);
    console.log(`   Completed: ${cmd.completed_at || 'Not yet'}\n`);
    
    res.json({
      success: true,
      data: {
        commandId: cmd.id,
        device: {
          name: cmd.device_name,
          serialNumber: cmd.serial_number
        },
        command: cmd.command_string,
        status: cmd.status,
        isPending: isPending,
        isCompleted: isCompleted,
        isFailed: isFailed,
        createdAt: cmd.created_at,
        completedAt: cmd.completed_at,
        interpretation: isPending 
          ? '⏳ Still waiting for device to poll and receive command'
          : isCompleted 
            ? '✅ Device received and executed command successfully!'
            : isFailed
              ? '❌ Command failed - check backend logs'
              : '❓ Unknown status'
      }
    });
    
  } catch (error) {
    console.error('❌ Check command error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check command',
      error: error.message
    });
  }
});

/**
 * List all devices for testing
 */
router.get('/devices', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        device_name,
        serial_number,
        is_online,
        last_seen
      FROM devices
      WHERE is_active = true
      ORDER BY device_name
    `);
    
    res.json({
      success: true,
      data: result.rows,
      message: 'Use device ID to test: POST /api/v1/test/force-time-sync/:deviceId'
    });
    
  } catch (error) {
    console.error('❌ Get devices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get devices',
      error: error.message
    });
  }
});

module.exports = router;
