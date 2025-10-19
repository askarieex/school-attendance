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
   * @param {string} commandString - The actual command string
   * @param {number} priority - Priority (higher = sent first)
   */
  static async queueCommand(deviceId, commandType, commandString, priority = 0) {
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
   */
  static async queueAddUser(deviceId, devicePin, studentName, rfidCard) {
    const commandString = CommandGenerator.addUser(devicePin, studentName, rfidCard);
    return await this.queueCommand(deviceId, 'add_user', commandString, 10);
  }

  /**
   * Queue "Delete User" command
   * @param {number} deviceId - Device ID
   * @param {number} devicePin - Student's PIN on this device
   */
  static async queueDeleteUser(deviceId, devicePin) {
    const commandString = CommandGenerator.deleteUser(devicePin);
    return await this.queueCommand(deviceId, 'delete_user', commandString, 5);
  }

  /**
   * Queue "Restart Device" command
   * @param {number} deviceId - Device ID
   */
  static async queueRestartDevice(deviceId) {
    const commandString = CommandGenerator.restartDevice();
    return await this.queueCommand(deviceId, 'restart', commandString, 100);
  }

  /**
   * Queue "Clear Logs" command
   * @param {number} deviceId - Device ID
   */
  static async queueClearLogs(deviceId) {
    const commandString = CommandGenerator.clearAttendanceLogs();
    return await this.queueCommand(deviceId, 'clear_logs', commandString, 50);
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

    const commandString = CommandGenerator.addUsersBatch(students);
    const commandType = `add_users_batch_${students.length}`;

    console.log(`📋 Batched command queued: ${students.length} students for device ${deviceId}`);

    return await this.queueCommand(deviceId, commandType, commandString, 10);
  }
}

module.exports = DeviceCommand;
