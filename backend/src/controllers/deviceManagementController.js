const { query } = require('../config/database');
const Device = require('../models/Device');
const DeviceCommand = require('../models/DeviceCommand');
const { assignDevicePin } = require('../utils/devicePinAssignment');
const { sendSuccess, sendError } = require('../utils/response');
const studentSyncService = require('../services/studentSyncVerification');

/**
 * DEVICE MANAGEMENT CONTROLLER
 *
 * Handles device-student synchronization and monitoring
 */

/**
 * Get sync status for a specific device
 * GET /api/v1/device-management/:deviceId/sync-status
 *
 * Returns detailed sync status including:
 * - Total students expected
 * - Students synced, pending, failed
 * - List of all students with their sync status
 */
const getSyncStatus = async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Verify device exists and user has access
    const deviceResult = await query(
      'SELECT id, serial_number, device_name, school_id, is_online, last_seen FROM devices WHERE id = $1',
      [deviceId]
    );

    if (deviceResult.rows.length === 0) {
      return sendError(res, 'Device not found', 404);
    }

    const device = deviceResult.rows[0];

    // Check authorization (school admins can only access their own school's devices)
    if (req.user.role === 'school_admin' && req.user.schoolId !== device.school_id) {
      return sendError(res, 'Access denied: This device belongs to another school', 403);
    }

    // Get detailed sync status
    const result = await query(`
      SELECT
        s.id,
        s.full_name,
        s.rfid_card_id,
        c.class_name,
        sec.section_name,
        COALESCE(dss.sync_status, 'not_synced') as sync_status,
        dss.last_sync_success,
        dss.last_sync_attempt,
        dss.sync_retries,
        dss.error_message,
        dum.device_pin
      FROM students s
      JOIN classes c ON s.class_id = c.id
      JOIN sections sec ON s.section_id = sec.id
      LEFT JOIN device_user_sync_status dss
        ON s.id = dss.student_id
        AND dss.device_id = $1
      LEFT JOIN device_user_mappings dum
        ON s.id = dum.student_id
        AND dum.device_id = $1
      WHERE s.school_id = $2
        AND s.is_active = TRUE
        AND s.rfid_card_id IS NOT NULL
      ORDER BY
        CASE dss.sync_status
          WHEN 'failed' THEN 1
          WHEN 'pending' THEN 2
          WHEN 'sent' THEN 3
          WHEN 'synced' THEN 4
          ELSE 5
        END,
        s.full_name
    `, [deviceId, device.school_id]);

    // Calculate summary statistics
    const summary = {
      total: result.rows.length,
      synced: result.rows.filter(r => r.sync_status === 'synced').length,
      pending: result.rows.filter(r => r.sync_status === 'pending').length,
      sent: result.rows.filter(r => r.sync_status === 'sent').length,
      failed: result.rows.filter(r => r.sync_status === 'failed').length,
      not_synced: result.rows.filter(r => r.sync_status === 'not_synced').length,
    };

    // Get pending commands count
    const pendingCommandsResult = await query(
      'SELECT COUNT(*) FROM device_commands WHERE device_id = $1 AND status = $2',
      [deviceId, 'pending']
    );

    sendSuccess(res, {
      device: {
        id: device.id,
        name: device.device_name || device.serial_number,
        serialNumber: device.serial_number,
        isOnline: device.is_online,
        lastSeen: device.last_seen,
      },
      summary: summary,
      students: result.rows,
      pendingCommands: parseInt(pendingCommandsResult.rows[0].count),
      syncHealthPercentage: summary.total > 0 ? Math.round((summary.synced / summary.total) * 100) : 0,
    }, 'Sync status retrieved successfully');

  } catch (error) {
    console.error('Get sync status error:', error);
    sendError(res, 'Failed to get sync status', 500);
  }
};

/**
 * Trigger full sync for a specific device
 * POST /api/v1/device-management/:deviceId/sync-students
 *
 * Queues add commands for ALL active students
 * Useful for initial setup or after device reset
 */
const fullSyncStudents = async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Verify device exists and user has access
    const deviceResult = await query(
      'SELECT id, serial_number, device_name, school_id, is_online FROM devices WHERE id = $1',
      [deviceId]
    );

    if (deviceResult.rows.length === 0) {
      return sendError(res, 'Device not found', 404);
    }

    const device = deviceResult.rows[0];

    // Check authorization
    if (req.user.role === 'school_admin' && req.user.schoolId !== device.school_id) {
      return sendError(res, 'Access denied: This device belongs to another school', 403);
    }

    console.log(`🔄 Full sync requested for device ${deviceId} by user ${req.user.email}`);

    // Get all active students for this school
    const studentsResult = await query(`
      SELECT id, rfid_card_id, full_name
      FROM students
      WHERE school_id = $1
        AND is_active = TRUE
        AND rfid_card_id IS NOT NULL
      ORDER BY full_name
    `, [device.school_id]);

    const students = studentsResult.rows;

    console.log(`   Total students to sync: ${students.length}`);

    if (students.length === 0) {
      return sendSuccess(res, {
        deviceId: deviceId,
        totalStudents: 0,
        commandsQueued: 0,
      }, 'No students found for this school');
    }

    // Queue add command for each student (only if not already synced)
    let queued = 0;
    let skipped = 0;
    let alreadySynced = 0;

    for (const student of students) {
      try {
        // Check if student is already synced to this device
        const existingSyncResult = await query(`
          SELECT dss.sync_status, dum.device_pin, dc.status as pending_command_status
          FROM device_user_sync_status dss
          LEFT JOIN device_user_mappings dum ON dss.device_id = dum.device_id AND dss.student_id = dum.student_id
          LEFT JOIN device_commands dc ON dc.device_id = dss.device_id
            AND dc.command_type = 'add_user'
            AND dc.command_string LIKE '%PIN=' || dum.device_pin || '%'
            AND dc.status = 'pending'
          WHERE dss.device_id = $1 AND dss.student_id = $2
        `, [deviceId, student.id]);

        // Skip if already synced or has pending command
        if (existingSyncResult.rows.length > 0) {
          const syncStatus = existingSyncResult.rows[0].sync_status;
          const hasPendingCommand = existingSyncResult.rows[0].pending_command_status === 'pending';

          if (syncStatus === 'synced') {
            console.log(`   ⏭️  Student ${student.full_name} already synced, skipping`);
            alreadySynced++;
            continue;
          }

          if (hasPendingCommand) {
            console.log(`   ⏳ Student ${student.full_name} has pending command, skipping`);
            skipped++;
            continue;
          }
        }

        // Get or assign device PIN
        const pin = await assignDevicePin(deviceId, student.id);

        // Queue add user command
        await DeviceCommand.queueAddUser(
          deviceId,
          pin,
          student.full_name,
          student.rfid_card_id
        );

        // Update or create sync status record
        await query(`
          INSERT INTO device_user_sync_status (
            device_id, student_id, device_pin, sync_status, last_sync_attempt
          ) VALUES ($1, $2, $3, 'pending', CURRENT_TIMESTAMP)
          ON CONFLICT (device_id, student_id)
          DO UPDATE SET
            sync_status = 'pending',
            last_sync_attempt = CURRENT_TIMESTAMP,
            sync_retries = CASE WHEN sync_status = 'failed' THEN 0 ELSE sync_retries END,
            error_message = NULL,
            updated_at = CURRENT_TIMESTAMP
        `, [deviceId, student.id, pin]);

        queued++;

      } catch (error) {
        console.error(`   ❌ Failed to queue student ${student.id}:`, error.message);
        skipped++;
      }
    }

    console.log(`   ✅ Queued: ${queued}, Already synced: ${alreadySynced}, Skipped: ${skipped}`);

    sendSuccess(
      res,
      {
        deviceId: deviceId,
        deviceName: device.device_name || device.serial_number,
        totalStudents: students.length,
        commandsQueued: queued,
        alreadySynced: alreadySynced,
        commandsSkipped: skipped,
        estimatedSyncTime: queued > 0 ? `${Math.ceil(queued / 5)} minutes` : 'No sync needed', // Device processes ~5 commands per minute
      },
      queued > 0
        ? `Full sync initiated for device ${device.device_name || device.serial_number}. ${queued} student(s) queued for sync.`
        : `Device ${device.device_name || device.serial_number} is already in sync. ${alreadySynced} student(s) already synced.`
    );

  } catch (error) {
    console.error('Full sync error:', error);
    sendError(res, 'Failed to initiate full sync', 500);
  }
};

/**
 * Trigger sync verification for a specific device
 * POST /api/v1/device-management/:deviceId/verify-sync
 *
 * Runs the sync verification service manually
 * Checks for missing/extra students and queues correction commands
 */
const verifySyncStatus = async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Verify device exists and user has access
    const deviceResult = await query(
      'SELECT id, serial_number, device_name, school_id FROM devices WHERE id = $1',
      [deviceId]
    );

    if (deviceResult.rows.length === 0) {
      return sendError(res, 'Device not found', 404);
    }

    const device = deviceResult.rows[0];

    // Check authorization
    if (req.user.role === 'school_admin' && req.user.schoolId !== device.school_id) {
      return sendError(res, 'Access denied: This device belongs to another school', 403);
    }

    console.log(`🔍 Sync verification requested for device ${deviceId} by user ${req.user.email}`);

    // Run manual sync verification
    const stats = await studentSyncService.manualSync(parseInt(deviceId));

    sendSuccess(
      res,
      {
        deviceId: deviceId,
        deviceName: device.device_name || device.serial_number,
        verification: stats,
        message: stats.missing > 0 || stats.extra > 0
          ? `Found ${stats.missing} missing and ${stats.extra} extra student(s). Correction commands queued.`
          : 'Device is in sync with database. No corrections needed.',
      },
      'Sync verification completed'
    );

  } catch (error) {
    console.error('Verify sync status error:', error);
    sendError(res, 'Failed to verify sync status', 500);
  }
};

/**
 * Trigger sync verification for all devices
 * POST /api/v1/device-management/verify-all
 *
 * Runs sync verification for all active devices
 * Superadmin only
 */
const verifyAllDevices = async (req, res) => {
  try {
    console.log(`🔍 Full sync verification requested by superadmin ${req.user.email}`);

    // Run manual sync verification for all devices
    await studentSyncService.manualSync();

    sendSuccess(
      res,
      {
        message: 'Sync verification initiated for all devices. Check server logs for details.',
      },
      'Full sync verification completed'
    );

  } catch (error) {
    console.error('Verify all devices error:', error);
    sendError(res, 'Failed to verify all devices', 500);
  }
};

module.exports = {
  getSyncStatus,
  fullSyncStudents,
  verifySyncStatus,
  verifyAllDevices,
};
