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

    // ✅ SECURITY FIX: Verify student belongs to same school as device
    // This prevents cross-tenant data leakage
    const studentSchoolCheck = await query(
      'SELECT school_id FROM students WHERE id = $1',
      [studentId]
    );

    if (studentSchoolCheck.rows.length === 0) {
      console.error(`🚨 SECURITY: Student ${studentId} not found during school verification`);
      return { success: false, error: 'Student not found' };
    }

    const studentSchoolId = studentSchoolCheck.rows[0].school_id;

    if (studentSchoolId !== device.school_id) {
      console.error(`🚨 SECURITY VIOLATION: Cross-tenant attendance attempt detected!`);
      console.error(`   Device: ${device.device_name} (SN: ${device.serial_number})`);
      console.error(`   Device School ID: ${device.school_id}`);
      console.error(`   Student: ${studentName} (ID: ${studentId})`);
      console.error(`   Student School ID: ${studentSchoolId}`);
      console.error(`   This indicates a serious data integrity issue in device_user_mappings!`);

      // Log to security audit table (if exists)
      try {
        await query(
          `INSERT INTO security_logs (event_type, severity, description, device_id, student_id, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            'cross_tenant_violation',
            'critical',
            `Device from school ${device.school_id} attempted to mark attendance for student from school ${studentSchoolId}`,
            device.id,
            studentId
          ]
        );
      } catch (logError) {
        console.error('Failed to log security event:', logError.message);
      }

      return {
        success: false,
        error: 'Cross-tenant violation: Student and device belong to different schools'
      };
    }

    console.log(`✅ Security check passed: Student ${studentName} belongs to same school as device`);

    // 2. Get school name for notifications
    const schoolResult = await query(
      'SELECT name FROM schools WHERE id = $1',
      [device.school_id]
    );
    const schoolName = schoolResult.rows[0]?.name || 'School';

    // 3. Get school settings to determine if late
    const settingsResult = await query(
      'SELECT * FROM school_settings WHERE school_id = $1',
      [device.school_id]
    );

    // 🔒 FIXED: Use school_open_time (matches database schema) instead of school_start_time
    const settings = settingsResult.rows[0] || {
      school_open_time: '08:00:00',
      late_threshold_minutes: 15
    };

    // 3. Determine attendance status (present, late, absent)
    // 🔒 FIXED: Changed from const to let to allow reassignment for leave status
    let attendanceStatus = determineStatus(timestamp, settings);

    // 4. Extract date from timestamp
    const attendanceDate = timestamp.split(' ')[0]; // Get "2025-10-18" from "2025-10-18 08:45:30"

    // Store timestamp as-is (local IST time) - DO NOT add timezone suffix
    // PostgreSQL TIMESTAMP column would convert +05:30 to UTC, causing wrong display
    const checkInTimeIST = timestamp.replace(' ', 'T');

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
      [studentId, device.school_id, device.id, checkInTimeIST, attendanceStatus, attendanceDate, false]
    );

    const wasInserted = insertResult.rows[0].inserted;
    const action = wasInserted ? 'recorded' : 'updated (duplicate - keeping earliest time)';
    console.log(`✅ Attendance ${action}: ${studentName} - ${attendanceStatus} at ${timestamp}`);

    // 📱 SEND WHATSAPP/SMS NOTIFICATION TO PARENT
    // Check school's notification preferences to decide whether to send
    if (wasInserted) {
      try {
        // ✅ Load school notification preferences
        const SchoolSettings = require('../models/SchoolSettings');
        const schoolSettings = await SchoolSettings.findBySchool(device.school_id);

        // ✅ Check if this status should trigger a notification
        const shouldNotify = (
          (attendanceStatus === 'present' && schoolSettings?.send_on_present === true) ||
          (attendanceStatus === 'late' && schoolSettings?.send_on_late !== false) ||
          (attendanceStatus === 'absent' && schoolSettings?.send_on_absent !== false) ||
          (attendanceStatus === 'leave' && schoolSettings?.send_on_leave !== false)
        );

        if (!shouldNotify) {
          console.log(`ℹ️ [RFID] Notification skipped for ${studentName} (${attendanceStatus}) - disabled in school settings`);
        } else {
          // ✅ NEW: Import School model for credit checking
          const School = require('../models/School');

          // ✅ CREDIT GATEKEEPER: Check if school has WhatsApp enabled AND has credits
          const canSend = await School.canSendWhatsApp(device.school_id);

          if (!canSend) {
            // Get current status for detailed logging
            const whatsappStatus = await School.getWhatsAppStatus(device.school_id);
            if (!whatsappStatus?.whatsapp_enabled) {
              console.log(`⚠️ [RFID] WhatsApp DISABLED for school ${device.school_id}, skipping notification for ${studentName}`);
            } else if (whatsappStatus?.whatsapp_credits <= 0) {
              console.log(`⚠️ [RFID] OUT OF CREDITS for school ${device.school_id} (credits: ${whatsappStatus.whatsapp_credits}), skipping notification for ${studentName}`);
            }
            // TODO: Fallback to free push notification if available
          } else {
            // Get student phone numbers
            const studentPhoneResult = await query(
              'SELECT guardian_phone, parent_phone, mother_phone FROM students WHERE id = $1',
              [studentId]
            );

            if (studentPhoneResult.rows.length > 0) {
              const phoneData = studentPhoneResult.rows[0];

              // Try multiple phone fields in order of priority
              let phoneToUse = null;
              if (phoneData.guardian_phone && phoneData.guardian_phone.trim() !== '') {
                phoneToUse = phoneData.guardian_phone;
              } else if (phoneData.parent_phone && phoneData.parent_phone.trim() !== '') {
                phoneToUse = phoneData.parent_phone;
              } else if (phoneData.mother_phone && phoneData.mother_phone.trim() !== '') {
                phoneToUse = phoneData.mother_phone;
              }

              if (phoneToUse) {
                // ✅ SECURITY FIX (Bug #7): Mask phone number in logs
                const { maskPhone } = require('../utils/logger');
                console.log(`📱 [RFID] Sending notification to ${maskPhone(phoneToUse)} for ${studentName} (${attendanceStatus})`);

                // Import WhatsApp service
                const whatsappService = require('./whatsappService');

                // Format check-in time (extract HH:MM:SS from timestamp)
                const timeFormatted = timestamp.split(' ')[1] || timestamp;

                // Send alert (async, non-blocking)
                setImmediate(async () => {
                  try {
                    const result = await whatsappService.sendAttendanceAlert({
                      parentPhone: phoneToUse,
                      studentName: studentName,
                      studentId: studentId,
                      schoolId: device.school_id,
                      status: attendanceStatus,
                      checkInTime: timeFormatted,
                      schoolName: schoolName,
                      date: attendanceDate
                    });

                    if (result.success) {
                      if (result.skipped) {
                        console.log(`⏭️  [RFID] Notification skipped: ${result.reason}`);
                      } else {
                        console.log(`✅ [RFID] Notification sent successfully via ${result.sentVia}: ${result.messageId}`);

                        // ✅ NEW: Decrement WhatsApp credit on successful send
                        const remainingCredits = await School.decrementWhatsAppCredit(device.school_id);
                        console.log(`💰 [RFID] Credit used. School ${device.school_id} remaining credits: ${remainingCredits}`);

                        // Log low credit warning
                        if (remainingCredits <= 50 && remainingCredits > 0) {
                          console.warn(`⚠️ [CREDITS] LOW BALANCE ALERT: School ${device.school_id} has only ${remainingCredits} WhatsApp credits left!`);
                        } else if (remainingCredits === 0) {
                          console.warn(`🚨 [CREDITS] ZERO CREDITS: School ${device.school_id} has exhausted WhatsApp credits!`);
                        }
                      }
                    } else {
                      console.error(`❌ [RFID] Notification failed: ${result.error}`);
                      // Don't decrement credit if send failed
                    }
                  } catch (notifError) {
                    console.error('[RFID] Notification error (non-fatal):', notifError.message);
                  }
                });
              } else {
                console.log(`⚠️  [RFID] No phone number found for ${studentName}, skipping notification`);
              }
            }
          }
        }
      } catch (phoneError) {
        console.error('[RFID] Phone lookup/settings error (non-fatal):', phoneError.message);
        // Don't fail attendance processing if notification fails
      }
    }

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

    // 🔒 FIXED: Use school_open_time (matches database schema)
    const startTime = settings?.school_open_time || '08:00:00';
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;

    // Calculate difference in minutes
    const diffMinutes = checkInMinutes - startMinutes;

    // 🔒 FIXED: Use late_threshold_minutes (matches database schema)
    const lateThreshold = settings.late_threshold_minutes || 15;

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
