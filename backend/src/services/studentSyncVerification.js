const cron = require('node-cron');
const { query, pool } = require('../config/database');
const Device = require('../models/Device');
const DeviceCommand = require('../models/DeviceCommand');
const { assignDevicePin, getDeviceUserMapping } = require('../utils/devicePinAssignment');

/**
 * STUDENT SYNC VERIFICATION SERVICE
 *
 * Purpose: Ensure biometric devices always have the correct student list
 * Schedule: Runs every 2 hours
 *
 * How it works:
 * 1. Get all active devices
 * 2. For each device:
 *    a. Get students that SHOULD be in device (from database)
 *    b. Get students that ARE in device (from sync_status table)
 *    c. Find missing students → Queue add commands
 *    d. Find extra students → Queue delete commands
 * 3. Log results
 */
class StudentSyncVerification {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
  }

  /**
   * Start the sync verification service
   */
  start() {
    // Run every 2 hours: "0 */2 * * *"
    // For testing: every 5 minutes: "*/5 * * * *"
    const schedule = process.env.SYNC_VERIFICATION_SCHEDULE || '0 */2 * * *';

    this.cronJob = cron.schedule(schedule, async () => {
      if (this.isRunning) {
        console.log('⏭️  Sync verification already running, skipping...');
        return;
      }

      try {
        this.isRunning = true;
        console.log('🔄 ========== STUDENT SYNC VERIFICATION START ==========');
        console.log(`   Time: ${new Date().toISOString()}`);
        await this.verifyAllDevices();
        console.log('✅ ========== STUDENT SYNC VERIFICATION COMPLETE ==========\n');
      } catch (error) {
        console.error('❌ Sync verification error:', error);
      } finally {
        this.isRunning = false;
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata' // IST timezone
    });

    console.log(`✅ Student Sync Verification scheduled: ${schedule} (IST)`);

    // Run immediately on startup (optional - comment out if you don't want this)
    setTimeout(() => {
      console.log('🔄 Running initial sync verification check...');
      this.verifyAllDevices().catch(err => {
        console.error('❌ Initial sync verification failed:', err);
      });
    }, 5000); // Wait 5 seconds after server starts
  }

  /**
   * Stop the sync verification service
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('⏹️  Student Sync Verification stopped');
    }
  }

  /**
   * Verify sync status for all devices
   */
  async verifyAllDevices() {
    try {
      // Get all active devices
      const result = await query(`
        SELECT id, serial_number, device_name, school_id, is_online
        FROM devices
        WHERE is_active = TRUE
        ORDER BY id
      `);

      const devices = result.rows;

      if (devices.length === 0) {
        console.log('ℹ️  No active devices found');
        return;
      }

      console.log(`📱 Found ${devices.length} active device(s) to verify`);

      let totalMissing = 0;
      let totalExtra = 0;
      let totalSynced = 0;

      for (const device of devices) {
        const stats = await this.verifyDevice(device.id, device.school_id, device.device_name || device.serial_number);
        totalMissing += stats.missing;
        totalExtra += stats.extra;
        totalSynced += stats.synced;
      }

      console.log('📊 SYNC VERIFICATION SUMMARY:');
      console.log(`   Total synced: ${totalSynced}`);
      console.log(`   Total missing: ${totalMissing} (added to queue)`);
      console.log(`   Total extra: ${totalExtra} (queued for deletion)`);

    } catch (error) {
      console.error('❌ Error in verifyAllDevices:', error);
      throw error;
    }
  }

  /**
   * Verify sync status for a specific device
   *
   * @param {number} deviceId - Device ID
   * @param {number} schoolId - School ID
   * @param {string} deviceName - Device name for logging
   * @returns {Object} Stats: { missing, extra, synced }
   */
  async verifyDevice(deviceId, schoolId, deviceName) {
    console.log(`\n🔍 Verifying device: ${deviceName} (ID: ${deviceId}, School: ${schoolId})`);

    try {
      // Step 1: Get students that SHOULD be in device (from database)
      const expectedResult = await query(`
        SELECT id, rfid_card_id, full_name
        FROM students
        WHERE school_id = $1
          AND is_active = TRUE
          AND rfid_card_id IS NOT NULL
        ORDER BY id
      `, [schoolId]);

      const expectedStudents = expectedResult.rows;

      console.log(`   Expected students in database: ${expectedStudents.length}`);

      // Step 2: Get students that ARE synced to device (from sync_status table)
      const syncedResult = await query(`
        SELECT
          dss.student_id,
          dss.device_pin,
          dss.sync_status,
          dss.last_sync_success,
          s.full_name
        FROM device_user_sync_status dss
        JOIN students s ON dss.student_id = s.id
        WHERE dss.device_id = $1
          AND dss.sync_status IN ('synced', 'sent', 'pending')
        ORDER BY dss.student_id
      `, [deviceId]);

      const syncedStudents = syncedResult.rows;

      console.log(`   Synced students in device: ${syncedStudents.length}`);

      // Step 3: Find MISSING students (in DB but not in device)
      const syncedStudentIds = syncedStudents.map(s => s.student_id);
      const missingStudents = expectedStudents.filter(
        s => !syncedStudentIds.includes(s.id)
      );

      // Step 4: Find EXTRA students (in device but not in DB or inactive)
      const expectedStudentIds = expectedStudents.map(s => s.id);
      const extraStudents = syncedStudents.filter(
        s => !expectedStudentIds.includes(s.student_id)
      );

      console.log(`   Missing students: ${missingStudents.length}`);
      console.log(`   Extra students: ${extraStudents.length}`);

      // Step 5: Queue add commands for missing students
      if (missingStudents.length > 0) {
        console.log(`   ⚠️  Adding ${missingStudents.length} missing student(s) to device...`);

        for (const student of missingStudents) {
          try {
            // Assign device PIN
            const pin = await assignDevicePin(deviceId, student.id);

            // Queue add user command
            await DeviceCommand.queueAddUser(
              deviceId,
              pin,
              student.full_name,
              student.rfid_card_id
            );

            // Create sync status record
            await query(`
              INSERT INTO device_user_sync_status (
                device_id, student_id, device_pin, sync_status, last_sync_attempt
              ) VALUES ($1, $2, $3, 'pending', CURRENT_TIMESTAMP)
              ON CONFLICT (device_id, student_id)
              DO UPDATE SET
                sync_status = 'pending',
                last_sync_attempt = CURRENT_TIMESTAMP,
                sync_retries = device_user_sync_status.sync_retries + 1,
                updated_at = CURRENT_TIMESTAMP
            `, [deviceId, student.id, pin]);

            console.log(`      ➕ Queued add: ${student.full_name} (PIN: ${pin}, RFID: ${student.rfid_card_id})`);

          } catch (error) {
            console.error(`      ❌ Failed to queue add for student ${student.id}:`, error.message);
          }
        }
      }

      // Step 6: Queue delete commands for extra students
      if (extraStudents.length > 0) {
        console.log(`   ⚠️  Removing ${extraStudents.length} extra student(s) from device...`);

        for (const student of extraStudents) {
          try {
            // Queue delete user command
            await DeviceCommand.queueDeleteUser(deviceId, student.device_pin);

            // Update sync status
            await query(`
              UPDATE device_user_sync_status
              SET
                sync_status = 'deleted',
                last_sync_attempt = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
              WHERE device_id = $1 AND student_id = $2
            `, [deviceId, student.student_id]);

            console.log(`      ➖ Queued delete: ${student.full_name} (PIN: ${student.device_pin})`);

          } catch (error) {
            console.error(`      ❌ Failed to queue delete for student ${student.student_id}:`, error.message);
          }
        }
      }

      // Step 7: Check for failed syncs and retry
      const failedResult = await query(`
        SELECT student_id, device_pin, sync_retries, error_message
        FROM device_user_sync_status
        WHERE device_id = $1
          AND sync_status = 'failed'
          AND sync_retries < 3
      `, [deviceId]);

      if (failedResult.rows.length > 0) {
        console.log(`   🔄 Retrying ${failedResult.rows.length} failed sync(s)...`);

        for (const failed of failedResult.rows) {
          try {
            // Get student info
            const studentResult = await query(
              'SELECT full_name, rfid_card_id FROM students WHERE id = $1',
              [failed.student_id]
            );

            if (studentResult.rows.length === 0) continue;

            const student = studentResult.rows[0];

            // Retry add command
            await DeviceCommand.queueAddUser(
              deviceId,
              failed.device_pin,
              student.full_name,
              student.rfid_card_id
            );

            // Update sync status
            await query(`
              UPDATE device_user_sync_status
              SET
                sync_status = 'pending',
                last_sync_attempt = CURRENT_TIMESTAMP,
                sync_retries = $3,
                updated_at = CURRENT_TIMESTAMP
              WHERE device_id = $1 AND student_id = $2
            `, [deviceId, failed.student_id, failed.sync_retries + 1]);

            console.log(`      🔄 Retry ${failed.sync_retries + 1}/3: Student ${failed.student_id}`);

          } catch (error) {
            console.error(`      ❌ Failed to retry student ${failed.student_id}:`, error.message);
          }
        }
      }

      console.log(`   ✅ Verification complete for device: ${deviceName}`);

      return {
        missing: missingStudents.length,
        extra: extraStudents.length,
        synced: syncedStudents.filter(s => expectedStudentIds.includes(s.student_id)).length,
      };

    } catch (error) {
      console.error(`❌ Error verifying device ${deviceId}:`, error);
      return { missing: 0, extra: 0, synced: 0 };
    }
  }

  /**
   * Manual trigger for sync verification (for API endpoint)
   *
   * @param {number} deviceId - Optional device ID. If not provided, verifies all devices.
   */
  async manualSync(deviceId = null) {
    console.log('🔄 Manual sync verification triggered');

    if (deviceId) {
      const deviceResult = await query(
        'SELECT id, serial_number, device_name, school_id FROM devices WHERE id = $1',
        [deviceId]
      );

      if (deviceResult.rows.length === 0) {
        throw new Error(`Device ${deviceId} not found`);
      }

      const device = deviceResult.rows[0];
      return await this.verifyDevice(device.id, device.school_id, device.device_name || device.serial_number);
    } else {
      await this.verifyAllDevices();
      return { message: 'All devices verified' };
    }
  }
}

// Export singleton instance
module.exports = new StudentSyncVerification();
