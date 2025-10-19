const { query } = require('../config/database');

/**
 * Process a single attendance log from the device
 * @param {Object} log - Parsed attendance log
 * @param {Object} device - Device information
 */
async function processAttendance(log, device) {
  try {
    const { userPin, timestamp, status } = log;

    // 1. Find the student by device PIN mapping OR by student ID directly
    let mappingResult = await query(
      `SELECT dum.*, s.full_name, s.rfid_card_id
       FROM device_user_mappings dum
       JOIN students s ON dum.student_id = s.id
       WHERE dum.device_id = $1 AND dum.device_pin = $2`,
      [device.id, userPin]
    );

    let studentId;
    let studentName;
    let studentRfid;

    if (mappingResult.rows.length === 0) {
      // No mapping found - Try to find student by ID directly (manual enrollment case)
      console.log(`ℹ️  No mapping found for PIN ${userPin}, checking if PIN matches student ID...`);

      const studentResult = await query(
        `SELECT id, full_name, rfid_card_id, school_id
         FROM students
         WHERE id = $1 AND school_id = $2`,
        [parseInt(userPin), device.school_id]
      );

      if (studentResult.rows.length === 0) {
        console.warn(`⚠️  Unknown user PIN ${userPin} on device ${device.serial_number} - No student found with this ID`);
        return { success: false, error: 'Student not found' };
      }

      // Student found! Auto-create the mapping for future use
      const student = studentResult.rows[0];
      studentId = student.id;
      studentName = student.full_name;
      studentRfid = student.rfid_card_id;

      console.log(`✨ Auto-creating device mapping: PIN ${userPin} → Student ${studentName} (ID: ${studentId})`);

      await query(
        `INSERT INTO device_user_mappings (device_id, student_id, device_pin)
         VALUES ($1, $2, $3)
         ON CONFLICT (device_id, student_id) DO NOTHING`,
        [device.id, studentId, parseInt(userPin)]
      );

    } else {
      // Mapping exists
      const mapping = mappingResult.rows[0];
      studentId = mapping.student_id;
      studentName = mapping.full_name;
      studentRfid = mapping.rfid_card_id;
    }

    // 2. Get school settings to determine if late
    const settingsResult = await query(
      'SELECT * FROM school_settings WHERE school_id = $1',
      [device.school_id]
    );

    const settings = settingsResult.rows[0] || {
      school_start_time: '08:00:00',
      late_threshold_min: 15
    };

    // 3. Determine attendance status (present, late, absent)
    const attendanceStatus = determineStatus(timestamp, settings);

    // 4. Extract date from timestamp
    const attendanceDate = timestamp.split(' ')[0]; // Get "2025-10-18" from "2025-10-18 08:45:30"

    // 5. Check if attendance already recorded for this student today
    const existingResult = await query(
      `SELECT id FROM attendance_logs
       WHERE student_id = $1 AND date = $2`,
      [studentId, attendanceDate]
    );

    if (existingResult.rows.length > 0) {
      console.log(`ℹ️  Attendance already recorded for student ${mapping.full_name} on ${attendanceDate}`);
      return { success: true, duplicate: true };
    }

    // 6. Save attendance record
    const insertResult = await query(
      `INSERT INTO attendance_logs (
        student_id, school_id, device_id, check_in_time, status, date, sms_sent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [studentId, device.school_id, device.id, timestamp, attendanceStatus, attendanceDate, false]
    );

    console.log(`✅ Attendance recorded: ${studentName} - ${attendanceStatus} at ${timestamp}`);

    return {
      success: true,
      attendance: insertResult.rows[0],
      student: {
        id: studentId,
        name: studentName,
        rfid: studentRfid
      }
    };

  } catch (error) {
    console.error('Error processing attendance:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Determine if student is on-time, late, or absent
 * @param {string} checkInTime - Timestamp when student scanned (e.g., "2025-10-18 08:45:30")
 * @param {Object} settings - School settings
 * @returns {string} 'present', 'late', or 'absent'
 */
function determineStatus(checkInTime, settings) {
  try {
    // Parse the check-in time
    const checkInDate = new Date(checkInTime);
    const checkInMinutes = checkInDate.getHours() * 60 + checkInDate.getMinutes();

    // Parse school start time (e.g., "08:00:00")
    const [startHour, startMinute] = settings.school_start_time.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;

    // Calculate difference in minutes
    const diffMinutes = checkInMinutes - startMinutes;

    // Apply late threshold (default: 15 minutes)
    const lateThreshold = settings.late_threshold_min || 15;

    if (diffMinutes <= 0) {
      return 'present'; // On time or early
    } else if (diffMinutes <= lateThreshold) {
      return 'present'; // Within grace period
    } else {
      return 'late'; // Beyond grace period
    }

  } catch (error) {
    console.error('Error determining status:', error);
    return 'present'; // Default to present if error
  }
}

module.exports = processAttendance;
