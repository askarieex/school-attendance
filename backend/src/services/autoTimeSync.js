/**
 * Automatic Device Time Synchronization Service
 * Automatically syncs time for all active devices daily
 */

const cron = require('node-cron');
const { query } = require('../config/database');
const CommandGenerator = require('./commandGenerator');

class AutoTimeSyncService {
  
  /**
   * Start automatic time sync scheduler
   * Runs daily at 2:00 AM to sync time for all devices
   *
   * ✅ USES TWO-STAGE TIME SYNC PROTOCOL ✅
   * Stage 1: Server sends "C:<ID>:SET OPTIONS DateTime=<timestamp>"
   * Stage 2: Device requests "/iclock/rtdata?type=time"
   *          Server responds with "DateTime=<timestamp>,ServerTZ=+0530"
   */
  static start() {
    console.log('🕐 Auto Time Sync Service: ❌ DISABLED ❌');
    console.log('   → Time sync via PUSH protocol is not reliable for this device firmware');
    console.log('   → Please set time manually on device web interface');
    console.log('   → Device will maintain time accurately once set');

    // ❌ DISABLED - Time sync commands don't work correctly with this device
    // The device firmware has internal timezone handling that conflicts with PUSH protocol

    /* ORIGINAL CODE - DOES NOT WORK:
    // Run daily at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('\n⏰ ========== AUTO TIME SYNC JOB STARTED ==========');
      console.log(`⏰ Server Time: ${new Date().toISOString()}`);

      try {
        await this.syncAllDevices();
      } catch (error) {
        console.error('❌ Auto time sync job failed:', error);
      }

      console.log('⏰ ========== AUTO TIME SYNC JOB COMPLETED ==========\n');
    });

    // Also run immediately on server start (for testing)
    console.log('🕐 Running initial time sync on startup...');
    setTimeout(() => {
      this.syncAllDevices().catch(err => {
        console.error('❌ Initial time sync failed:', err);
      });
    }, 5000); // Wait 5 seconds after server starts
    */
  }
  
  /**
   * Sync time for all active devices across all schools
   */
  static async syncAllDevices() {
    try {
      // Get all active devices
      const result = await query(
        `SELECT id, serial_number, device_name, school_id, is_online
         FROM devices
         WHERE is_active = TRUE
         ORDER BY school_id, id`
      );
      
      const devices = result.rows;
      
      if (!devices || devices.length === 0) {
        console.log('ℹ️  No active devices found for time sync');
        return { success: true, synced: 0 };
      }
      
      console.log(`📡 Found ${devices.length} active device(s) to sync`);
      
      const currentTime = new Date();
      const unixTimestamp = Math.floor(currentTime.getTime() / 1000);
      let syncedCount = 0;
      let failedCount = 0;
      
      for (const device of devices) {
        try {
          // STEP 1: First, disable Auto time sync (set device to Manual mode)
          const disableSyncResult = await query(
            `INSERT INTO device_commands (
              device_id,
              command_type,
              command_string,
              priority,
              status,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING id`,
            [device.id, 'DISABLE_AUTO_SYNC', 'PLACEHOLDER', 10, 'pending'] // High priority
          );

          const disableCmdId = disableSyncResult.rows[0].id;
          const disableCommand = CommandGenerator.disableAutoTimeSync(disableCmdId);

          await query(
            'UPDATE device_commands SET command_string = $1 WHERE id = $2',
            [disableCommand, disableCmdId]
          );

          console.log(`  🔒 ${device.device_name} - Disable Auto Sync queued (ID: ${disableCmdId})`);

          // STEP 2: Then, send the time sync command
          const cmdResult = await query(
            `INSERT INTO device_commands (
              device_id,
              command_type,
              command_string,
              priority,
              status,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING id`,
            [device.id, 'SET_TIME', 'PLACEHOLDER', 5, 'pending']
          );

          const commandId = cmdResult.rows[0].id;
          const commandString = CommandGenerator.setDeviceTime(currentTime, commandId);

          await query(
            'UPDATE device_commands SET command_string = $1 WHERE id = $2',
            [commandString, commandId]
          );

          syncedCount++;

          console.log(`  ✅ ${device.device_name} (${device.serial_number}) - Time sync queued (ID: ${commandId})`);

        } catch (error) {
          failedCount++;
          console.error(`  ❌ ${device.device_name} (${device.serial_number}) - Failed:`, error.message);
        }
      }
      
      console.log(`\n📊 Time Sync Summary:`);
      console.log(`   - Total Devices: ${devices.length}`);
      console.log(`   - Commands Queued: ${syncedCount}`);
      console.log(`   - Failed: ${failedCount}`);
      console.log(`   - Server Time: ${currentTime.toISOString()}`);
      console.log(`   - Unix Timestamp: ${unixTimestamp}`);
      
      return {
        success: true,
        total: devices.length,
        synced: syncedCount,
        failed: failedCount,
        timestamp: currentTime.toISOString()
      };
      
    } catch (error) {
      console.error('❌ Error in syncAllDevices:', error);
      throw error;
    }
  }
  
  /**
   * Sync time for devices of a specific school
   * @param {number} schoolId - School ID
   */
  static async syncSchoolDevices(schoolId) {
    try {
      // Get all active devices for this school
      const result = await query(
        `SELECT id, serial_number, device_name, is_online
         FROM devices
         WHERE is_active = TRUE AND school_id = $1
         ORDER BY id`,
        [schoolId]
      );
      
      const devices = result.rows;
      
      if (!devices || devices.length === 0) {
        console.log(`ℹ️  No active devices found for school ${schoolId}`);
        return { success: true, synced: 0 };
      }
      
      console.log(`📡 Syncing time for ${devices.length} device(s) in school ${schoolId}`);
      
      const currentTime = new Date();
      let syncedCount = 0;
      
      for (const device of devices) {
        try {
          // STEP 1: Disable Auto sync
          const disableSyncResult = await query(
            `INSERT INTO device_commands (
              device_id,
              command_type,
              command_string,
              priority,
              status,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING id`,
            [device.id, 'DISABLE_AUTO_SYNC', 'PLACEHOLDER', 10, 'pending']
          );

          const disableCmdId = disableSyncResult.rows[0].id;
          const disableCommand = CommandGenerator.disableAutoTimeSync(disableCmdId);

          await query(
            'UPDATE device_commands SET command_string = $1 WHERE id = $2',
            [disableCommand, disableCmdId]
          );

          // STEP 2: Set time
          const cmdResult = await query(
            `INSERT INTO device_commands (
              device_id,
              command_type,
              command_string,
              priority,
              status,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING id`,
            [device.id, 'SET_TIME', 'PLACEHOLDER', 5, 'pending']
          );

          const commandId = cmdResult.rows[0].id;
          const commandString = CommandGenerator.setDeviceTime(currentTime, commandId);

          await query(
            'UPDATE device_commands SET command_string = $1 WHERE id = $2',
            [commandString, commandId]
          );

          syncedCount++;
          console.log(`  ✅ ${device.device_name} - Time sync queued (ID: ${commandId})`);

        } catch (error) {
          console.error(`  ❌ ${device.device_name} - Failed:`, error.message);
        }
      }
      
      return {
        success: true,
        schoolId: schoolId,
        total: devices.length,
        synced: syncedCount
      };
      
    } catch (error) {
      console.error(`❌ Error syncing school ${schoolId} devices:`, error);
      throw error;
    }
  }
  
  /**
   * Sync time for a specific device
   * @param {number} deviceId - Device ID
   */
  static async syncSingleDevice(deviceId) {
    try {
      const result = await query(
        'SELECT id, serial_number, device_name, school_id FROM devices WHERE id = $1 AND is_active = TRUE',
        [deviceId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Device not found or inactive');
      }
      
      const device = result.rows[0];
      const currentTime = new Date();

      // STEP 1: Disable Auto sync
      const disableSyncResult = await query(
        `INSERT INTO device_commands (
          device_id,
          command_type,
          command_string,
          priority,
          status,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id`,
        [device.id, 'DISABLE_AUTO_SYNC', 'PLACEHOLDER', 10, 'pending']
      );

      const disableCmdId = disableSyncResult.rows[0].id;
      const disableCommand = CommandGenerator.disableAutoTimeSync(disableCmdId);

      await query(
        'UPDATE device_commands SET command_string = $1 WHERE id = $2',
        [disableCommand, disableCmdId]
      );

      console.log(`🔒 Disable Auto Sync queued for device ${device.serial_number} - Command ID: ${disableCmdId}`);

      // STEP 2: Set time
      const cmdResult = await query(
        `INSERT INTO device_commands (
          device_id,
          command_type,
          command_string,
          priority,
          status,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id`,
        [device.id, 'SET_TIME', 'PLACEHOLDER', 5, 'pending']
      );

      const commandId = cmdResult.rows[0].id;
      const commandString = CommandGenerator.setDeviceTime(currentTime, commandId);

      await query(
        'UPDATE device_commands SET command_string = $1 WHERE id = $2',
        [commandString, commandId]
      );

      console.log(`⏰ Time sync queued for device ${device.serial_number} (${device.device_name}) - Command ID: ${commandId}`);
      console.log(`   Server Time: ${currentTime.toISOString()}`);
      
      return {
        success: true,
        device: {
          id: device.id,
          name: device.device_name,
          serial: device.serial_number
        },
        timestamp: currentTime.toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Error syncing device ${deviceId}:`, error);
      throw error;
    }
  }
  
  /**
   * Check if automatic time sync is enabled
   */
  static isEnabled() {
    return true; // Always enabled
  }
  
  /**
   * Get time sync statistics
   */
  static async getStats() {
    try {
      const result = await query(
        `SELECT 
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'sent') as sent,
          MAX(created_at) as last_sync
         FROM device_commands
         WHERE command_type = 'SET_TIME'
         AND created_at >= NOW() - INTERVAL '7 days'`
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error getting time sync stats:', error);
      return null;
    }
  }
}

module.exports = AutoTimeSyncService;
