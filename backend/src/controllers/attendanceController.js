const Student = require('../models/Student');
const AttendanceLog = require('../models/AttendanceLog');
const SchoolSettings = require('../models/SchoolSettings');
const { sendSuccess, sendError } = require('../utils/response');
const { query } = require('../config/database');
const { getCurrentDateIST } = require('../utils/timezone');
const whatsappService = require('../services/whatsappService');

/**
 * Log attendance when student scans RFID card
 * POST /api/v1/attendance/log
 * Authenticated via device API key (X-API-Key header)
 */
const logAttendance = async (req, res) => {
  try {
    const { rfidCardId, timestamp } = req.body;
    const deviceId = req.device.id;
    const schoolId = req.device.schoolId;

    // Validate input
    if (!rfidCardId) {
      return sendError(res, 'RFID card ID is required', 400);
    }

    // Find student by RFID card
    const student = await Student.findByRfid(rfidCardId, schoolId);

    if (!student) {
      return sendError(res, 'Student not found or RFID card not registered', 404);
    }
    
    // Check if student already checked in today
    const today = new Date().toISOString().split('T')[0];
    const existingLog = await AttendanceLog.existsToday(student.id, today);

    if (existingLog) {
      return sendError(
        res,
        'Student already checked in today',
        409,
        {
          studentName: student.full_name,
          checkInTime: existingLog.check_in_time,
          status: existingLog.status,
        }
      );
    }

    // Get school settings to determine if late
    const settings = await SchoolSettings.getOrCreate(schoolId);

    // Parse check-in time
    const checkInTime = timestamp ? new Date(timestamp) : new Date();
    const checkInTimeOnly = checkInTime.toTimeString().split(' ')[0]; // HH:MM:SS

    // Determine status (present or late)
    let status = 'present';

    if (settings.school_start_time && settings.late_threshold_min) {
      // Parse school start time
      const [startHour, startMin] = settings.school_start_time.split(':').map(Number);
      const [checkHour, checkMin] = checkInTimeOnly.split(':').map(Number);

      const startMinutes = startHour * 60 + startMin;
      const checkMinutes = checkHour * 60 + checkMin;

      // Calculate difference in minutes
      const diffMinutes = checkMinutes - startMinutes;

      // If arrived after threshold, mark as late
      if (diffMinutes > settings.late_threshold_min) {
        status = 'late';
      }
    }

    // Create attendance log
    const attendanceLog = await AttendanceLog.create({
      studentId: student.id,
      schoolId: schoolId,
      deviceId: deviceId,
      checkInTime: checkInTime,
      status: status,
      date: today,
    });

    // 📱 WHATSAPP: Send attendance alert to parent for RFID device attendance
    try {
      // 🔒 SAFETY CHECK: Only send WhatsApp if this is today's attendance (devices should only scan for today, but verify)
      const todayIST = getCurrentDateIST();
      const isToday = today === todayIST;

      if (!isToday) {
        console.log(`⚠️ RFID attendance logged for non-today date: ${today} (today is ${todayIST})`);
      } else if (status === 'late') {
        // RFID devices only mark present or late (not absent/leave), so only send WhatsApp for late
        // Try multiple phone fields in order of priority
        let phoneToUse = null;
        if (student.guardian_phone && student.guardian_phone.trim() !== '') {
          phoneToUse = student.guardian_phone;
        } else if (student.parent_phone && student.parent_phone.trim() !== '') {
          phoneToUse = student.parent_phone;
        } else if (student.mother_phone && student.mother_phone.trim() !== '') {
          phoneToUse = student.mother_phone;
        }

        if (phoneToUse) {
          // Get school name for WhatsApp message
          const schoolResult = await query('SELECT name FROM schools WHERE id = $1', [schoolId]);
          const schoolName = schoolResult.rows[0]?.name || 'School';

          console.log(`📱 [RFID] Sending WhatsApp alert to ${phoneToUse} for ${student.full_name} (${status})`);

          const checkInTimeFormatted = checkInTime.toTimeString().split(' ')[0]; // HH:MM:SS

          const whatsappResult = await whatsappService.sendAttendanceAlert({
            parentPhone: phoneToUse,
            studentName: student.full_name,
            status: status,
            checkInTime: checkInTimeFormatted,
            schoolName: schoolName
          });

          if (whatsappResult.success) {
            console.log(`✅ [RFID] WhatsApp alert sent successfully: ${whatsappResult.messageId}`);
          } else {
            console.error(`❌ [RFID] WhatsApp alert failed: ${whatsappResult.error}`);
          }
        } else {
          console.log(`⚠️ [RFID] No phone number found for ${student.full_name}, skipping WhatsApp alert`);
        }
      } else {
        console.log(`ℹ️ [RFID] Student ${student.full_name} marked as '${status}', no WhatsApp alert needed`);
      }
    } catch (whatsappError) {
      console.error('[RFID] WhatsApp alert error (non-fatal):', whatsappError);
      // Don't fail the attendance logging if WhatsApp fails
    }

    // Return success response with student info (for device display)
    sendSuccess(
      res,
      {
        studentName: student.full_name,
        grade: student.grade,
        status: status,
        checkInTime: checkInTime,
        photoUrl: student.photo_url,
      },
      'Attendance logged successfully',
      201
    );
  } catch (error) {
    console.error('Log attendance error:', error);
    sendError(res, 'Failed to log attendance', 500);
  }
};

/**
 * Verify RFID card (quick lookup)
 * GET /api/v1/attendance/verify/:rfid
 * Used by device to verify card before logging
 */
const verifyRfid = async (req, res) => {
  try {
    const { rfid } = req.params;
    const schoolId = req.device.schoolId;

    const student = await Student.findByRfid(rfid, schoolId);

    if (!student) {
      return sendError(res, 'RFID card not found', 404);
    }

    sendSuccess(
      res,
      {
        studentName: student.full_name,
        grade: student.grade,
        photoUrl: student.photo_url,
      },
      'RFID card verified'
    );
  } catch (error) {
    console.error('Verify RFID error:', error);
    sendError(res, 'Failed to verify RFID card', 500);
  }
};

/**
 * Device health check
 * GET /api/v1/attendance/health
 */
const healthCheck = async (req, res) => {
  try {
    sendSuccess(
      res,
      {
        deviceId: req.device.id,
        deviceName: req.device.name,
        schoolId: req.device.schoolId,
        timestamp: new Date().toISOString(),
        status: 'online',
      },
      'Device is online'
    );
  } catch (error) {
    console.error('Health check error:', error);
    sendError(res, 'Health check failed', 500);
  }
};

module.exports = {
  logAttendance,
  verifyRfid,
  healthCheck,
};
