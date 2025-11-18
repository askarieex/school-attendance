const { query } = require('../config/database');
const CommandGenerator = require('../services/commandGenerator');

/**
 * DeviceCommand Model
 * Helper functions for managing device commands queue
 */
class DeviceCommand {

  /**
   * Queue a command for a device
   * @param {number} deviceId - Device ID
   * @param {string} commandType - Type of command (add_user, delete_user, etc.)
   * @param {string} commandString - The actual command string (must include C:${id}: prefix)
   * @param {number} priority - Priority (higher = sent first)
   * @deprecated Use specific methods like queueAddUser() instead - they handle ID properly
   */
  static async queueCommand(deviceId, commandType, commandString, priority = 0) {
    // ⚠️ WARNING: This method is deprecated because it doesn't ensure proper C:${id}: prefix
    // Use queueAddUser(), queueDeleteUser(), etc. instead
    console.warn('⚠️ DEPRECATED: queueCommand() called. Use specific queue methods instead.');
    
    const result = await query(
      `INSERT INTO device_commands (device_id, command_type, command_string, priority, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [deviceId, commandType, commandString, priority]
    );

    console.log(`📋 Command queued: ${commandType} for device ${deviceId}`);
    return result.rows[0];
  }

  /**
   * Queue "Add User" command for a student
   * @param {number} deviceId - Device ID
   * @param {number} devicePin - Student's PIN on this device
   * @param {string} studentName - Student's full name
   * @param {string} rfidCard - RFID card number
   * @param {object} client - Optional database client for transactions
   */
  static async queueAddUser(deviceId, devicePin, studentName, rfidCard, client = null) {
    // Use transaction client if provided, otherwise use global query
    const queryFn = client ? client.query.bind(client) : query;

    // First insert to get the DB-generated ID
    const result = await queryFn(
      `INSERT INTO device_commands (device_id, command_type, command_string, priority, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [deviceId, 'add_user', 'PLACEHOLDER', 10]
    );

    const commandId = result.rows[0].id;

    // Now generate the command string with the correct ID
    const commandString = CommandGenerator.addUser(devicePin, studentName, rfidCard, commandId);

    // Update the command string
    await queryFn(
      'UPDATE device_commands SET command_string = $1 WHERE id = $2',
      [commandString, commandId]
    );

    console.log(`📋 Command queued: add_user (id=${commandId}) for device ${deviceId}`);
    return result.rows[0];
  }

  /**
   * Queue "Delete User" command
   * @param {number} deviceId - Device ID
   * @param {number} devicePin - Student's PIN on this device
   * @param {object} client - Optional database client for transactions
   */
  static async queueDeleteUser(deviceId, devicePin, client = null) {
    // Use transaction client if provided, otherwise use global query
    const queryFn = client ? client.query.bind(client) : query;

    // First insert to get the DB-generated ID
    const result = await queryFn(
      `INSERT INTO device_commands (device_id, command_type, command_string, priority, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [deviceId, 'delete_user', 'PLACEHOLDER', 5]
    );

    const commandId = result.rows[0].id;

    // Now generate the command string with the correct ID
    const commandString = CommandGenerator.deleteUser(devicePin, commandId);

    // Update the command string
    await queryFn(
      'UPDATE device_commands SET command_string = $1 WHERE id = $2',
      [commandString, commandId]
    );

    console.log(`📋 Command queued: delete_user (id=${commandId}) for device ${deviceId}`);
    return result.rows[0];
  }

  /**
   * Queue "Restart Device" command
   * @param {number} deviceId - Device ID
   */
  static async queueRestartDevice(deviceId) {
    // First insert to get the DB-generated ID
    const result = await query(
      `INSERT INTO device_commands (device_id, command_type, command_string, priority, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [deviceId, 'restart', 'PLACEHOLDER', 100]
    );
    
    const commandId = result.rows[0].id;
    
    // Now generate the command string with the correct ID
    const commandString = CommandGenerator.restartDevice(commandId);
    
    // Update the command string
    await query(
      'UPDATE device_commands SET command_string = $1 WHERE id = $2',
      [commandString, commandId]
    );
    
    console.log(`📋 Command queued: restart (id=${commandId}) for device ${deviceId}`);
    return result.rows[0];
  }

  /**
   * Queue "Clear Logs" command
   * @param {number} deviceId - Device ID
   */
  static async queueClearLogs(deviceId) {
    // First insert to get the DB-generated ID
    const result = await query(
      `INSERT INTO device_commands (device_id, command_type, command_string, priority, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [deviceId, 'clear_logs', 'PLACEHOLDER', 50]
    );
    
    const commandId = result.rows[0].id;
    
    // Now generate the command string with the correct ID
    const commandString = CommandGenerator.clearAttendanceLogs(commandId);
    
    // Update the command string
    await query(
      'UPDATE device_commands SET command_string = $1 WHERE id = $2',
      [commandString, commandId]
    );
    
    console.log(`📋 Command queued: clear_logs (id=${commandId}) for device ${deviceId}`);
    return result.rows[0];
  }

  /**
   * Get all pending commands for a device
   * @param {number} deviceId - Device ID
   */
  static async getPendingCommands(deviceId) {
    const result = await query(
      `SELECT * FROM device_commands
       WHERE device_id = $1 AND status = 'pending'
       ORDER BY priority DESC, created_at ASC`,
      [deviceId]
    );

    return result.rows;
  }

  /**
   * Mark command as sent
   * @param {number} commandId - Command ID
   */
  static async markAsSent(commandId) {
    const result = await query(
      `UPDATE device_commands
       SET status = 'sent', sent_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [commandId]
    );

    return result.rows[0];
  }

  /**
   * Mark command as completed
   * @param {number} commandId - Command ID
   */
  static async markAsCompleted(commandId) {
    const result = await query(
      `UPDATE device_commands
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [commandId]
    );

    return result.rows[0];
  }

  /**
   * Mark command as failed
   * @param {number} commandId - Command ID
   * @param {string} errorMessage - Error details
   */
  static async markAsFailed(commandId, errorMessage) {
    const result = await query(
      `UPDATE device_commands
       SET status = 'failed', error_message = $2
       WHERE id = $1
       RETURNING *`,
      [commandId, errorMessage]
    );

    return result.rows[0];
  }

  /**
   * Get command statistics for a device
   * @param {number} deviceId - Device ID
   */
  static async getStats(deviceId) {
    const result = await query(
      `SELECT
        status,
        COUNT(*) as count
       FROM device_commands
       WHERE device_id = $1
       GROUP BY status`,
      [deviceId]
    );

    return result.rows;
  }

  /**
   * Queue batched "Add Users" command for multiple students
   * More efficient than individual commands
   * @param {number} deviceId - Device ID
   * @param {Array} students - Array of {pin, name, cardNumber}
   */
  static async queueAddUsersBatch(deviceId, students) {
    if (!students || students.length === 0) {
      return null;
    }

    const commandType = `add_users_batch_${students.length}`;

    // First insert to get the DB-generated ID
    const result = await query(
      `INSERT INTO device_commands (device_id, command_type, command_string, priority, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [deviceId, commandType, 'PLACEHOLDER', 10]
    );

    const commandId = result.rows[0].id;

    // Now generate the command string with the correct ID
    const commandString = CommandGenerator.addUsersBatch(students, commandId);

    // Update the command string
    await query(
      'UPDATE device_commands SET command_string = $1 WHERE id = $2',
      [commandString, commandId]
    );

    console.log(`📋 Batched command queued: ${students.length} students (id=${commandId}) for device ${deviceId}`);

    return result.rows[0];
  }

  /**
   * Queue "Set Device Time" command
   * Synchronizes device clock with server time
   * @param {number} deviceId - Device ID
   * @param {Date} datetime - Date/time to set (defaults to current server time)
   */
  static async queueSetDeviceTime(deviceId, datetime = new Date()) {
    // First insert to get the DB-generated ID
    const result = await query(
      `INSERT INTO device_commands (device_id, command_type, command_string, priority, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [deviceId, 'set_time', 'PLACEHOLDER', 90]
    );

    const commandId = result.rows[0].id;

    // Now generate the command string with the correct ID
    const commandString = CommandGenerator.setDeviceTime(datetime, commandId);

    // Update the command string
    await query(
      'UPDATE device_commands SET command_string = $1 WHERE id = $2',
      [commandString, commandId]
    );

    const unixTimestamp = Math.floor(datetime.getTime() / 1000);
    console.log(`⏰ Command queued: set_time (id=${commandId}) for device ${deviceId} to ${datetime.toISOString()} (Unix: ${unixTimestamp})`);
    return result.rows[0];
  }

  /**
   * Queue "Get Device Time" command
   * Requests current device time (device will respond with POST to /iclock/cdata)
   * @param {number} deviceId - Device ID
   */
  static async queueGetDeviceTime(deviceId) {
    // First insert to get the DB-generated ID
    const result = await query(
      `INSERT INTO device_commands (device_id, command_type, command_string, priority, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [deviceId, 'get_time', 'PLACEHOLDER', 80]
    );

    const commandId = result.rows[0].id;

    // Now generate the command string with the correct ID
    const commandString = CommandGenerator.getDeviceTime(commandId);

    // Update the command string
    await query(
      'UPDATE device_commands SET command_string = $1 WHERE id = $2',
      [commandString, commandId]
    );

    console.log(`⏰ Command queued: get_time (id=${commandId}) for device ${deviceId}`);
    return result.rows[0];
  }
}

module.exports = DeviceCommand;
