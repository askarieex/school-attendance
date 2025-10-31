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
    // FIXED: Added is_active check to prevent deleted students from scanning
    let mappingResult = await query(
      `SELECT dum.*, s.full_name, s.rfid_card_id, s.is_active
       FROM device_user_mappings dum
       JOIN students s ON dum.student_id = s.id
       WHERE dum.device_id = $1 AND dum.device_pin = $2 AND s.is_active = TRUE`,
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

    // 5. Check if student is on leave (FIXED: Integrated leave system)
    const leaveCheck = await query(
      `SELECT id, leave_type FROM leaves
       WHERE student_id = $1
       AND start_date <= $2
       AND end_date >= $2
       AND status = 'approved'
       AND school_id = $3`,
      [studentId, attendanceDate, device.school_id]
    );

    if (leaveCheck.rows.length > 0) {
      const leaveType = leaveCheck.rows[0].leave_type;
      console.log(`ℹ️  Student ${studentName} is on ${leaveType} leave on ${attendanceDate} - Recording as leave`);
      // Mark as leave status instead of rejecting
      attendanceStatus = 'leave';
    }

    // 6. Save attendance record using UPSERT (FIXED: Prevents duplicates even in race conditions)
    const insertResult = await query(
      `INSERT INTO attendance_logs (
        student_id, school_id, device_id, check_in_time, status, date, sms_sent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (student_id, date, school_id)
      DO UPDATE SET
        check_in_time = CASE
          WHEN attendance_logs.check_in_time > EXCLUDED.check_in_time
          THEN EXCLUDED.check_in_time
          ELSE attendance_logs.check_in_time
        END,
        device_id = EXCLUDED.device_id,
        status = EXCLUDED.status
      RETURNING *, (xmax = 0) AS inserted`,
      [studentId, device.school_id, device.id, timestamp, attendanceStatus, attendanceDate, false]
    );

    const wasInserted = insertResult.rows[0].inserted;
    const action = wasInserted ? 'recorded' : 'updated (duplicate - keeping earliest time)';
    console.log(`✅ Attendance ${action}: ${studentName} - ${attendanceStatus} at ${timestamp}`);

    return {
      success: true,
      duplicate: !wasInserted,
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

    // Parse school start time (e.g., "08:00:00") with safe fallback
    const startTime = settings?.school_start_time || '08:00:00';
    const [startHour, startMinute] = startTime.split(':').map(Number);
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
