const Student = require('../models/Student');
const AttendanceLog = require('../models/AttendanceLog');
const Device = require('../models/Device');
const SchoolSettings = require('../models/SchoolSettings');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * INTELLIGENT HYBRID MODEL IMPLEMENTATION
 *
 * This controller handles the sync mechanism for offline-first RFID devices
 */

/**
 * Sync RFID card list to device
 * GET /api/v1/device/sync/cards
 *
 * Returns a lightweight list of valid RFID card IDs for local validation
 * Device caches this list and checks locally for instant feedback
 */
const syncCardList = async (req, res) => {
  try {
    const deviceId = req.device.id;
    const schoolId = req.device.schoolId;

    // Get all active students' RFID cards for this school
    const { query } = require('../config/database');
    const result = await query(
      `SELECT
        rfid_card_id,
        id as student_id
       FROM students
       WHERE school_id = $1
       AND is_active = TRUE
       AND rfid_card_id IS NOT NULL
       ORDER BY rfid_card_id`,
      [schoolId]
    );

    // Get school settings for late calculation on device
    const settings = await SchoolSettings.getOrCreate(schoolId);

    // Format response for device
    const syncData = {
      cards: result.rows.map(row => ({
        rfid: row.rfid_card_id,
        studentId: row.student_id,
      })),
      settings: {
        startTime: settings.school_start_time,
        lateThresholdMin: settings.late_threshold_min,
      },
      syncTimestamp: new Date().toISOString(),
      totalCards: result.rows.length,
    };

    // Update device last_seen
    await Device.updateLastSeen(deviceId);

    sendSuccess(
      res,
      syncData,
      `Synced ${result.rows.length} RFID cards successfully`
    );
  } catch (error) {
    console.error('Sync card list error:', error);
    sendError(res, 'Failed to sync card list', 500);
  }
};

/**
 * Batch upload attendance logs (for offline queue)
 * POST /api/v1/device/sync/logs
 *
 * Device sends multiple logs at once when reconnecting after being offline
 * Logs are processed in order and duplicates are handled
 */
const batchUploadLogs = async (req, res) => {
  try {
    const { logs } = req.body; // Array of logs
    const deviceId = req.device.id;
    const schoolId = req.device.schoolId;

    if (!Array.isArray(logs) || logs.length === 0) {
      return sendError(res, 'No logs provided', 400);
    }

    const results = {
      processed: 0,
      duplicates: 0,
      errors: 0,
      details: [],
    };

    // Process each log
    for (const log of logs) {
      try {
        const { rfidCardId, timestamp, localId } = log;

        // Validate required fields
        if (!rfidCardId || !timestamp) {
          results.errors++;
          results.details.push({
            localId,
            status: 'error',
            message: 'Missing rfidCardId or timestamp',
          });
          continue;
        }

        // Find student by RFID
        const student = await Student.findByRfid(rfidCardId, schoolId);

        if (!student) {
          results.errors++;
          results.details.push({
            localId,
            rfid: rfidCardId,
            status: 'error',
            message: 'Student not found',
          });
          continue;
        }

        // Parse timestamp and date
        const checkInTime = new Date(timestamp);
        const date = checkInTime.toISOString().split('T')[0];

        // Check if already logged (prevent duplicates)
        const existing = await AttendanceLog.existsToday(student.id, date);

        if (existing) {
          results.duplicates++;
          results.details.push({
            localId,
            studentId: student.id,
            status: 'duplicate',
            message: 'Already logged for this date',
          });
          continue;
        }

        // Calculate status (present or late)
        const settings = await SchoolSettings.getOrCreate(schoolId);
        let status = 'present';

        if (settings.school_start_time && settings.late_threshold_min) {
          const checkTimeStr = checkInTime.toTimeString().split(' ')[0];
          const [startHour, startMin] = settings.school_start_time.split(':').map(Number);
          const [checkHour, checkMin] = checkTimeStr.split(':').map(Number);

          const startMinutes = startHour * 60 + startMin;
          const checkMinutes = checkHour * 60 + checkMin;
          const diffMinutes = checkMinutes - startMinutes;

          if (diffMinutes > settings.late_threshold_min) {
            status = 'late';
          }
        }

        // Create attendance log
        await AttendanceLog.create({
          studentId: student.id,
          schoolId: schoolId,
          deviceId: deviceId,
          checkInTime: checkInTime,
          status: status,
          date: date,
        });

        results.processed++;
        results.details.push({
          localId,
          studentId: student.id,
          status: 'success',
          message: 'Log created',
        });

      } catch (logError) {
        console.error('Error processing log:', logError);
        results.errors++;
        results.details.push({
          localId: log.localId,
          status: 'error',
          message: logError.message,
        });
      }
    }

    sendSuccess(
      res,
      results,
      `Batch upload complete: ${results.processed} processed, ${results.duplicates} duplicates, ${results.errors} errors`,
      201
    );
  } catch (error) {
    console.error('Batch upload error:', error);
    sendError(res, 'Failed to upload logs', 500);
  }
};

/**
 * Quick validation endpoint
 * POST /api/v1/device/sync/validate
 *
 * Device can quickly check if an RFID is valid without logging
 * Used for pre-validation before showing green light
 */
const quickValidate = async (req, res) => {
  try {
    const { rfidCardId } = req.body;
    const schoolId = req.device.schoolId;

    if (!rfidCardId) {
      return sendError(res, 'RFID card ID required', 400);
    }

    const student = await Student.findByRfid(rfidCardId, schoolId);

    if (!student) {
      return sendError(res, 'Invalid RFID card', 404);
    }

    // Check if already logged today
    const today = new Date().toISOString().split('T')[0];
    const existing = await AttendanceLog.existsToday(student.id, today);

    sendSuccess(
      res,
      {
        valid: true,
        studentId: student.id,
        alreadyLogged: !!existing,
        timestamp: new Date().toISOString(),
      },
      'RFID validated'
    );
  } catch (error) {
    console.error('Quick validate error:', error);
    sendError(res, 'Validation failed', 500);
  }
};

/**
 * Device status/heartbeat
 * POST /api/v1/device/sync/heartbeat
 *
 * Device sends periodic heartbeat with status info
 * Helps monitor device health and connectivity
 */
const deviceHeartbeat = async (req, res) => {
  try {
    const deviceId = req.device.id;
    const { queueSize, lastSync, batteryLevel, errorCount } = req.body;

    // Update device last_seen
    await Device.updateLastSeen(deviceId);

    // Log device status (could store in separate table for monitoring)
    console.log(`Device ${deviceId} heartbeat:`, {
      queueSize: queueSize || 0,
      lastSync,
      batteryLevel,
      errorCount: errorCount || 0,
    });

    sendSuccess(
      res,
      {
        serverTime: new Date().toISOString(),
        syncRecommended: queueSize > 50, // Recommend sync if queue is large
      },
      'Heartbeat received'
    );
  } catch (error) {
    console.error('Heartbeat error:', error);
    sendError(res, 'Heartbeat failed', 500);
  }
};

/**
 * Get sync status
 * GET /api/v1/device/sync/status
 *
 * Returns information about last sync and any pending updates
 */
const getSyncStatus = async (req, res) => {
  try {
    const schoolId = req.device.schoolId;

    // Get total active students
    const { query } = require('../config/database');
    const totalResult = await query(
      'SELECT COUNT(*) FROM students WHERE school_id = $1 AND is_active = TRUE AND rfid_card_id IS NOT NULL',
      [schoolId]
    );

    // Get device info
    const device = await Device.findById(req.device.id);

    sendSuccess(
      res,
      {
        totalActiveCards: parseInt(totalResult.rows[0].count),
        deviceLastSeen: device.last_seen,
        serverTime: new Date().toISOString(),
        syncAvailable: true,
      },
      'Sync status retrieved'
    );
  } catch (error) {
    console.error('Get sync status error:', error);
    sendError(res, 'Failed to get sync status', 500);
  }
};

module.exports = {
  syncCardList,
  batchUploadLogs,
  quickValidate,
  deviceHeartbeat,
  getSyncStatus,
};
