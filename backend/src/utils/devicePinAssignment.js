const { pool } = require('../config/database');

/**
 * Device PIN Assignment Utility
 *
 * Provides thread-safe PIN assignment using PostgreSQL advisory locks
 * to prevent race conditions when multiple admins create students concurrently.
 *
 * RACE CONDITION FIX:
 * Before: SELECT MAX(pin) FOR UPDATE → Lock released → INSERT fails
 * After:  Advisory lock → SELECT MAX → INSERT → Release lock
 *
 * @see PIN_RACE_CONDITION_DEEP_ANALYSIS.md for detailed explanation
 */

/**
 * Assign next available PIN for a device (thread-safe)
 *
 * Uses PostgreSQL advisory lock to ensure only ONE process can assign
 * PINs for a specific device at a time. This prevents the race condition
 * where multiple processes get the same max PIN and try to insert duplicates.
 *
 * @param {number} deviceId - Device ID to assign PIN for
 * @param {number} studentId - Student ID to enroll
 * @param {string} studentName - Student's full name (for device command)
 * @param {string} rfidCardId - RFID card ID (optional, for device command)
 * @returns {Promise<{success: boolean, pin: number}>}
 * @throws {Error} If database operation fails
 *
 * @example
 * const result = await assignNextDevicePin(1, 123, 'John Doe', 'ABC123');
 * console.log(`Assigned PIN: ${result.pin}`);
 */
async function assignNextDevicePin(deviceId, studentId, studentName, rfidCardId = '') {
  const client = await pool.connect();

  try {
    // Start transaction
    await client.query('BEGIN');

    // 🔒 Acquire exclusive advisory lock for this device
    // pg_advisory_xact_lock(lock_id):
    // - lock_id: deviceId (ensures only ONE process per device)
    // - "xact" means transaction-level (auto-released on COMMIT/ROLLBACK)
    // - Blocks other processes trying to get same lock
    // - Different devices can assign PINs concurrently (lock is per-device)
    await client.query('SELECT pg_advisory_xact_lock($1)', [deviceId]);

    console.log(`🔒 [PIN Assignment] Acquired exclusive lock for device ${deviceId}`);

    // Now we're GUARANTEED to be the only process assigning PINs for this device
    // No other process can execute this code for the same deviceId until we COMMIT

    // Get next available PIN (safely, no race condition)
    const result = await client.query(
      `SELECT COALESCE(MAX(device_pin), 0) + 1 as next_pin
       FROM device_user_mappings
       WHERE device_id = $1`,
      [deviceId]
    );

    const nextPin = result.rows[0].next_pin;

    console.log(`📍 [PIN Assignment] Next PIN for device ${deviceId}: ${nextPin}`);

    // Create device user mapping
    // ON CONFLICT UPDATE: If student already enrolled, update their PIN
    const mappingResult = await client.query(
      `INSERT INTO device_user_mappings (device_id, student_id, device_pin)
       VALUES ($1, $2, $3)
       ON CONFLICT (device_id, student_id)
       DO UPDATE SET
         device_pin = EXCLUDED.device_pin,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [deviceId, studentId, nextPin]
    );

    // Queue device command to sync with physical device
    // DeviceCommand must support passing client for transaction
    const DeviceCommand = require('../models/DeviceCommand');
    await DeviceCommand.queueAddUser(
      deviceId,
      nextPin,
      studentName,
      rfidCardId,
      client // Pass client to run in same transaction
    );

    // Commit transaction (advisory lock automatically released)
    await client.query('COMMIT');

    console.log(`✅ [PIN Assignment] Successfully assigned PIN ${nextPin} to student ${studentId} on device ${deviceId}`);

    return {
      success: true,
      pin: nextPin,
      mapping: mappingResult.rows[0]
    };

  } catch (error) {
    // Rollback on any error (lock automatically released)
    await client.query('ROLLBACK');
    console.error(`❌ [PIN Assignment] Failed to assign PIN for device ${deviceId}:`, error);
    throw error;
  } finally {
    // Always release connection back to pool
    client.release();
  }
}

/**
 * Batch assign PINs for multiple students (optimized)
 *
 * Assigns consecutive PINs to multiple students in a single transaction.
 * Much faster than calling assignNextDevicePin() in a loop.
 *
 * @param {number} deviceId - Device ID to assign PINs for
 * @param {Array<{id: number, full_name: string, rfid_card_id?: string}>} students - Students to enroll
 * @returns {Promise<{success: boolean, assignments: Array<{studentId: number, pin: number}>}>}
 * @throws {Error} If database operation fails
 *
 * @example
 * const students = [
 *   { id: 1, full_name: 'John Doe', rfid_card_id: 'ABC123' },
 *   { id: 2, full_name: 'Jane Smith', rfid_card_id: 'DEF456' }
 * ];
 * const result = await assignBatchDevicePins(1, students);
 * console.log(`Assigned ${result.assignments.length} PINs`);
 */
async function assignBatchDevicePins(deviceId, students) {
  if (!students || students.length === 0) {
    return { success: true, assignments: [] };
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Acquire exclusive lock for this device
    await client.query('SELECT pg_advisory_xact_lock($1)', [deviceId]);

    console.log(`🔒 [Batch PIN] Acquired exclusive lock for device ${deviceId}`);

    // Get starting PIN
    const result = await client.query(
      `SELECT COALESCE(MAX(device_pin), 0) + 1 as next_pin
       FROM device_user_mappings
       WHERE device_id = $1`,
      [deviceId]
    );

    let currentPin = result.rows[0].next_pin;
    const assignments = [];

    console.log(`📍 [Batch PIN] Starting PIN for device ${deviceId}: ${currentPin}`);
    console.log(`📦 [Batch PIN] Assigning PINs to ${students.length} students...`);

    // Build batch INSERT query
    // Example: INSERT INTO device_user_mappings VALUES (1,10,101),(1,11,102),(1,12,103)
    const values = students.map((student, idx) => {
      const pin = currentPin + idx;
      assignments.push({
        studentId: student.id,
        studentName: student.full_name,
        pin: pin
      });
      return `(${deviceId}, ${student.id}, ${pin})`;
    }).join(',');

    // Batch insert all mappings in one query (much faster!)
    await client.query(`
      INSERT INTO device_user_mappings (device_id, student_id, device_pin)
      VALUES ${values}
      ON CONFLICT (device_id, student_id)
      DO UPDATE SET
        device_pin = EXCLUDED.device_pin,
        updated_at = CURRENT_TIMESTAMP
    `);

    // Batch queue device commands
    const DeviceCommand = require('../models/DeviceCommand');
    const commandData = students.map((student, idx) => ({
      pin: currentPin + idx,
      name: student.full_name,
      cardNumber: student.rfid_card_id || ''
    }));

    await DeviceCommand.queueAddUsersBatch(deviceId, commandData, client);

    await client.query('COMMIT');

    console.log(`✅ [Batch PIN] Successfully assigned ${students.length} PINs (${currentPin} to ${currentPin + students.length - 1}) on device ${deviceId}`);

    return {
      success: true,
      assignments: assignments,
      startPin: currentPin,
      endPin: currentPin + students.length - 1
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ [Batch PIN] Failed to assign batch PINs for device ${deviceId}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Remove student from device (unenroll)
 *
 * Safely removes device-student mapping and queues delete command.
 * Uses transaction to ensure consistency.
 *
 * @param {number} deviceId - Device ID
 * @param {number} studentId - Student ID to unenroll
 * @returns {Promise<{success: boolean, pin: number}>}
 * @throws {Error} If student not enrolled or database error
 */
async function removeDevicePin(deviceId, studentId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get existing mapping
    const mappingResult = await client.query(
      `SELECT * FROM device_user_mappings
       WHERE device_id = $1 AND student_id = $2`,
      [deviceId, studentId]
    );

    if (mappingResult.rows.length === 0) {
      throw new Error(`Student ${studentId} is not enrolled on device ${deviceId}`);
    }

    const mapping = mappingResult.rows[0];

    // Delete mapping
    await client.query(
      `DELETE FROM device_user_mappings
       WHERE device_id = $1 AND student_id = $2`,
      [deviceId, studentId]
    );

    // Queue delete command
    const DeviceCommand = require('../models/DeviceCommand');
    await DeviceCommand.queueDeleteUser(deviceId, mapping.device_pin, client);

    await client.query('COMMIT');

    console.log(`✅ [PIN Removal] Removed PIN ${mapping.device_pin} for student ${studentId} from device ${deviceId}`);

    return {
      success: true,
      pin: mapping.device_pin
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ [PIN Removal] Failed to remove PIN for student ${studentId}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get currently assigned PINs for a device
 *
 * @param {number} deviceId - Device ID
 * @returns {Promise<Array<{studentId: number, pin: number, studentName: string}>>}
 */
async function getDevicePins(deviceId) {
  const { query } = require('../config/database');

  const result = await query(`
    SELECT
      dum.student_id,
      dum.device_pin as pin,
      s.full_name as student_name,
      s.rfid_card_id
    FROM device_user_mappings dum
    JOIN students s ON dum.student_id = s.id
    WHERE dum.device_id = $1
    ORDER BY dum.device_pin ASC
  `, [deviceId]);

  return result.rows;
}

/**
 * Get or assign PIN for a student on a device (without queuing command)
 *
 * This is a simpler version that just returns the PIN without queuing device commands.
 * Used when you want to queue commands manually.
 *
 * @param {number} deviceId - Device ID
 * @param {number} studentId - Student ID
 * @returns {Promise<number>} The assigned PIN
 */
async function assignDevicePin(deviceId, studentId) {
  const { query } = require('../config/database');

  // Check if student already has a PIN for this device
  const existingResult = await query(
    'SELECT device_pin FROM device_user_mappings WHERE device_id = $1 AND student_id = $2',
    [deviceId, studentId]
  );

  if (existingResult.rows.length > 0) {
    return existingResult.rows[0].device_pin;
  }

  // Get next available PIN
  const pinResult = await query(
    'SELECT COALESCE(MAX(device_pin), 0) + 1 as next_pin FROM device_user_mappings WHERE device_id = $1',
    [deviceId]
  );

  const nextPin = pinResult.rows[0].next_pin;

  // Create mapping
  await query(
    `INSERT INTO device_user_mappings (device_id, student_id, device_pin)
     VALUES ($1, $2, $3)
     ON CONFLICT (device_id, student_id) DO NOTHING`,
    [deviceId, studentId, nextPin]
  );

  return nextPin;
}

/**
 * Check for duplicate PINs (diagnostic function)
 *
 * This should NEVER return any results if the system is working correctly.
 * If duplicates found, indicates a serious bug.
 *
 * @param {number} deviceId - Device ID to check (optional, checks all if not provided)
 * @returns {Promise<Array<{deviceId: number, pin: number, count: number}>>}
 */
async function checkForDuplicatePins(deviceId = null) {
  const { query } = require('../config/database');

  let sql = `
    SELECT
      device_id,
      device_pin as pin,
      COUNT(*) as count,
      array_agg(student_id) as student_ids
    FROM device_user_mappings
  `;

  const params = [];
  if (deviceId) {
    sql += ' WHERE device_id = $1';
    params.push(deviceId);
  }

  sql += `
    GROUP BY device_id, device_pin
    HAVING COUNT(*) > 1
    ORDER BY device_id, device_pin
  `;

  const result = await query(sql, params);

  if (result.rows.length > 0) {
    console.error('🚨 DUPLICATE PINs FOUND:', result.rows);
  }

  return result.rows;
}

module.exports = {
  assignNextDevicePin,
  assignDevicePin, // Simple version - just assign PIN, no command queue
  assignBatchDevicePins,
  removeDevicePin,
  getDevicePins,
  checkForDuplicatePins,
  getDeviceUserMapping: getDevicePins, // Alias for backwards compatibility
};
