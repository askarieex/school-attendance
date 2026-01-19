const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { enforceSchoolTenancy } = require('../middleware/multiTenant');
const {
  requireTeacher,
  validateTeacherSectionAccess,
  validateTeacherStudentAccess
} = require('../middleware/teacherAuth');
const { body, validationResult } = require('express-validator'); // ✅ SECURITY FIX: Add validation
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const { getCurrentDateIST } = require('../utils/timezone');
const whatsappService = require('../services/whatsappService');
const { getCurrentAcademicYear } = require('../utils/academicYear');
const { maskPhone } = require('../utils/logger');

/**
 * Teacher-specific Routes
 * Base path: /api/v1/teacher
 * These routes are for teachers to access their assigned classes and students
 *
 * 🔒 SECURITY: All routes protected with teacher authorization middleware
 */

// Apply authentication, multi-tenancy, and teacher-specific authorization
router.use(authenticate);
router.use(enforceSchoolTenancy);
router.use(requireTeacher);

/**
 * GET /api/v1/teacher/sections/:sectionId/students
 * Get students in a section that the teacher is assigned to
 * 🔒 Protected: validateTeacherSectionAccess middleware
 */
router.get(
  '/sections/:sectionId/students',
  validateTeacherSectionAccess('params', 'sectionId'),
  async (req, res) => {
    try {
      const { sectionId } = req.params;
      const schoolId = req.tenantSchoolId;

      // Authorization already validated by middleware
      // Get students in this section
      const studentsResult = await query(
        `SELECT s.*,
                c.class_name,
                sec.section_name
         FROM students s
         LEFT JOIN classes c ON s.class_id = c.id
         LEFT JOIN sections sec ON s.section_id = sec.id
         WHERE s.section_id = $1
           AND s.school_id = $2
           AND s.is_active = TRUE
         ORDER BY
           CASE WHEN s.roll_number ~ '^[0-9]+$'
                THEN CAST(s.roll_number AS INTEGER)
                ELSE 999999
           END ASC,
           s.roll_number ASC,
           s.full_name ASC`,
        [sectionId, schoolId]
      );

      sendSuccess(res, studentsResult.rows, 'Students retrieved successfully');
    } catch (error) {
      console.error('Get section students error:', error);
      sendError(res, 'Failed to retrieve students', 500);
    }
  }
);

/**
 * GET /api/v1/teacher/my-sections
 * Get all sections assigned to the logged-in teacher
 * 🔒 Protected: requireTeacher middleware (applied globally)
 */
router.get('/my-sections', async (req, res) => {
  try {
    const userId = req.user.id;
    const schoolId = req.tenantSchoolId;

    // Get teacher_id from user_id
    const teacherResult = await query(
      'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2 AND is_active = TRUE',
      [userId, schoolId]
    );

    if (teacherResult.rows.length === 0) {
      return sendError(res, 'Teacher profile not found', 404);
    }

    const teacherId = teacherResult.rows[0].id;

    // Get current academic year dynamically
    const currentAcademicYear = await getCurrentAcademicYear(schoolId);

    if (!currentAcademicYear) {
      console.warn(`⚠️ No current academic year set for school ${schoolId}`);
      return sendError(res, 'No active academic year found. Please contact school administration.', 400);
    }

    console.log(`📅 Using academic year: ${currentAcademicYear} for school ${schoolId}`);

    // Get teacher assignments for current academic year
    const assignments = await Teacher.getAssignments(teacherId, currentAcademicYear);

    sendSuccess(res, assignments, 'Sections retrieved successfully');
  } catch (error) {
    console.error('Get teacher sections error:', error);
    sendError(res, 'Failed to retrieve sections', 500);
  }
});

/**
 * POST /api/v1/teacher/sections/:sectionId/attendance
 * Mark attendance for a student (teacher can mark their assigned students)
 * 🔒 Protected: validateTeacherSectionAccess middleware
 * ✅ SECURITY FIX: Added input validation
 */
router.post(
  '/sections/:sectionId/attendance',
  validateTeacherSectionAccess('params', 'sectionId'),
  [
    // ✅ SECURITY FIX: Validate all inputs
    body('studentId')
      .notEmpty().withMessage('Student ID is required')
      .isInt({ min: 1 }).withMessage('Student ID must be a positive integer'),

    body('date')
      .notEmpty().withMessage('Date is required')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be in YYYY-MM-DD format')
      .custom((value) => {
        const date = new Date(value);
        const today = new Date();
        if (date > today) {
          throw new Error('Cannot mark attendance for future dates');
        }
        return true;
      }),

    body('status')
      .notEmpty().withMessage('Status is required')
      .isIn(['present', 'absent', 'late', 'leave']).withMessage('Status must be: present, absent, late, or leave'),

    body('checkInTime')
      .optional()
      .matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/).withMessage('Check-in time must be in HH:MM:SS format'),

    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
  ],
  async (req, res) => {
    try {
      // ✅ SECURITY FIX: Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendError(res, errors.array()[0].msg, 400);
      }

      const { sectionId } = req.params;
      const { studentId, date, status, notes, checkInTime } = req.body;
      const userId = req.user.id;
      const schoolId = req.tenantSchoolId;

      // Authorization already validated by middleware
      // Input validation already done by express-validator above

      // ✅ BUSINESS LOGIC: Validate date is not Sunday
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const attendanceDate = new Date(date);
      attendanceDate.setHours(0, 0, 0, 0);

      // ✅ BUSINESS LOGIC FIX: Validate date is not Sunday
      const dayOfWeek = attendanceDate.getDay();
      if (dayOfWeek === 0) {  // Sunday = 0
        console.log(`❌ Rejected Sunday: ${date}`);
        return sendError(res, 'Cannot mark attendance on Sundays', 400);
      }

      // ✅ BUSINESS LOGIC FIX: Validate date is not a holiday
      const holidayCheck = await query(
        'SELECT id, holiday_name FROM holidays WHERE school_id = $1 AND holiday_date = $2 AND is_active = TRUE',
        [schoolId, date]
      );
      if (holidayCheck.rows.length > 0) {
        const holidayName = holidayCheck.rows[0].holiday_name;
        console.log(`❌ Rejected holiday: ${date} (${holidayName})`);
        return sendError(res, `Cannot mark attendance on holiday: ${holidayName}`, 400);
      }

      // Use provided checkInTime or default to 09:00:00
      const timeToUse = checkInTime || '09:00:00';
      const checkInDateTime = `${date}T${timeToUse}`;

      console.log(`📝 Marking attendance: student=${studentId}, date=${date}, status=${status}, time=${timeToUse}`);

      // 🔒 Authorization already validated by middleware
      // Verify student belongs to this section (additional data validation)
      const studentCheck = await query(
        'SELECT id FROM students WHERE id = $1 AND section_id = $2 AND school_id = $3',
        [studentId, sectionId, schoolId]
      );

      if (studentCheck.rows.length === 0) {
        return sendError(res, 'Student not found in this section', 404);
      }

      // Check if attendance already exists
      const existingResult = await query(
        'SELECT id, status FROM attendance_logs WHERE student_id = $1 AND date = $2',
        [studentId, date]
      );

      // Auto-calculate late status if marking as 'present'
      let finalStatus = status;

      if (status === 'present') {
        // Get school settings to auto-calculate late
        const settingsResult = await query(
          'SELECT school_open_time, late_threshold_minutes FROM school_settings WHERE school_id = $1',
          [schoolId]
        );

        if (settingsResult.rows.length > 0 && settingsResult.rows[0].school_open_time) {
          const settings = settingsResult.rows[0];
          const [startHour, startMin] = settings.school_open_time.split(':').map(Number);
          const [checkHour, checkMin] = timeToUse.split(':').map(Number);

          const startMinutes = startHour * 60 + startMin;
          const checkMinutes = checkHour * 60 + checkMin;
          const diffMinutes = checkMinutes - startMinutes;

          // If late threshold exceeded, mark as late
          if (diffMinutes > (settings.late_threshold_minutes || 15)) {
            finalStatus = 'late';
            console.log(`🕐 Auto-calculated as LATE (arrived ${diffMinutes} min after start, threshold: ${settings.late_threshold_minutes} min)`);
          } else {
            console.log(`✅ Auto-calculated as PRESENT (arrived on time)`);
          }
        }
      }

      if (existingResult.rows.length > 0) {
        // Update existing attendance
        const existingId = existingResult.rows[0].id;

        await query(
          `UPDATE attendance_logs 
         SET status = $1, check_in_time = $2, notes = $3, is_manual = TRUE, marked_by = $4
         WHERE id = $5`,
          [finalStatus, checkInDateTime, notes || null, userId, existingId]
        );

        console.log(`✅ Updated attendance for student ${studentId} on ${date} to ${finalStatus}`);
      } else {
        // Insert new attendance
        await query(
          `INSERT INTO attendance_logs 
         (student_id, school_id, check_in_time, status, date, is_manual, marked_by, notes, sms_sent)
         VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7, FALSE)`,
          [studentId, schoolId, checkInDateTime, finalStatus, date, userId, notes || null]
        );

        console.log(`✅ Created new attendance for student ${studentId} on ${date} as ${finalStatus}`);
      }

      // 📱 WHATSAPP: Send attendance alert to parent (teacher-marked attendance)
      try {
        // 🔒 CRITICAL: Only send WhatsApp for TODAY's attendance (prevent alerts for backdated entries)
        const todayIST = getCurrentDateIST();
        const isToday = date === todayIST;

        if (!isToday) {
          console.log(`⏭️ [TEACHER] Skipping WhatsApp alert: Attendance marked for ${date} (not today: ${todayIST})`);
        } else if (finalStatus === 'late' || finalStatus === 'absent' || finalStatus === 'leave') {
          // Only send WhatsApp for late, absent, or leave status
          // Get student details for phone numbers
          const studentResult = await query(
            'SELECT full_name, guardian_phone, parent_phone, mother_phone FROM students WHERE id = $1',
            [studentId]
          );

          if (studentResult.rows.length > 0) {
            const studentData = studentResult.rows[0];

            // Try multiple phone fields in order of priority
            let phoneToUse = null;
            if (studentData.guardian_phone && studentData.guardian_phone.trim() !== '') {
              phoneToUse = studentData.guardian_phone;
            } else if (studentData.parent_phone && studentData.parent_phone.trim() !== '') {
              phoneToUse = studentData.parent_phone;
            } else if (studentData.mother_phone && studentData.mother_phone.trim() !== '') {
              phoneToUse = studentData.mother_phone;
            }

            if (phoneToUse) {
              // Get school name
              const schoolResult = await query('SELECT name FROM schools WHERE id = $1', [schoolId]);
              const schoolName = schoolResult.rows[0]?.name || 'School';

              console.log(`📱 [TEACHER] Sending WhatsApp alert to ${maskPhone(phoneToUse)} for ${studentData.full_name} (${finalStatus})`);

              const whatsappResult = await whatsappService.sendAttendanceAlert({
                parentPhone: phoneToUse,
                studentName: studentData.full_name,
                studentId: studentId,
                schoolId: schoolId,
                status: finalStatus,
                checkInTime: timeToUse,
                schoolName: schoolName,
                date: date
              });

              if (whatsappResult.success) {
                if (whatsappResult.skipped) {
                  console.log(`⏭️ [TEACHER] WhatsApp message skipped: ${whatsappResult.reason}`);
                } else {
                  console.log(`✅ [TEACHER] WhatsApp alert sent successfully: ${whatsappResult.messageId}`);
                }
              } else {
                console.error(`❌ [TEACHER] WhatsApp alert failed: ${whatsappResult.error}`);
              }
            } else {
              console.log(`⚠️ [TEACHER] No phone number found for student ${studentId}, skipping WhatsApp alert`);
            }
          }
        } else {
          console.log(`ℹ️ [TEACHER] Student marked as '${finalStatus}', no WhatsApp alert needed`);
        }
      } catch (whatsappError) {
        console.error('[TEACHER] WhatsApp alert error (non-fatal):', whatsappError);
        // Don't fail the request if WhatsApp fails
      }

      sendSuccess(res, { studentId, date, status: finalStatus }, 'Attendance marked successfully');
    } catch (error) {
      console.error('Mark attendance error:', error);
      console.error('Error details:', error.message);
      sendError(res, 'Failed to mark attendance', 500);
    }
  });

/**
 * GET /api/v1/teacher/sections/:sectionId/attendance
 * Get attendance logs for a specific date and section
 * Query params: date (YYYY-MM-DD)
 * 🔒 SECURITY FIX: Added validateTeacherSectionAccess middleware
 */
router.get(
  '/sections/:sectionId/attendance',
  validateTeacherSectionAccess('params', 'sectionId'),
  async (req, res) => {
    try {
      const { sectionId } = req.params;
      const { date } = req.query;
      const userId = req.user.id;
      const schoolId = req.tenantSchoolId;

      // Verify user is a teacher
      if (req.user.role !== 'teacher') {
        return sendError(res, 'Access denied. Teachers only.', 403);
      }

      if (!date) {
        return sendError(res, 'Date parameter is required (YYYY-MM-DD)', 400);
      }

      // Get teacher_id from user_id
      const teacherResult = await query(
        'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2 AND is_active = TRUE',
        [userId, schoolId]
      );

      if (teacherResult.rows.length === 0) {
        return sendError(res, 'Teacher profile not found', 404);
      }

      const teacherId = teacherResult.rows[0].id;

      // Verify teacher is assigned to this section
      const assignmentCheck = await query(
        'SELECT id FROM teacher_class_assignments WHERE teacher_id = $1 AND section_id = $2',
        [teacherId, sectionId]
      );

      if (assignmentCheck.rows.length === 0) {
        return sendError(res, 'You are not assigned to this section', 403);
      }

      // Get attendance logs for the date
      // Use TO_CHAR to avoid timezone conversion issues
      const logsResult = await query(
        `SELECT
        al.id,
        al.student_id,
        al.status,
        al.check_in_time,
        TO_CHAR(al.date, 'YYYY-MM-DD') as date,
        al.is_manual,
        al.notes,
        s.full_name as student_name,
        s.roll_number
       FROM attendance_logs al
       JOIN students s ON al.student_id = s.id
       WHERE al.school_id = $1
         AND s.section_id = $2
         AND al.date = $3
       ORDER BY s.roll_number ASC, al.check_in_time ASC`,
        [schoolId, sectionId, date]
      );

      console.log(`✅ Found ${logsResult.rows.length} attendance logs for section ${sectionId} on ${date}`);

      sendSuccess(res, logsResult.rows, 'Attendance logs retrieved successfully');
    } catch (error) {
      console.error('Get attendance logs error:', error);
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
      sendError(res, 'Failed to retrieve attendance logs', 500);
    }
  });

/**
 * GET /api/v1/teacher/holidays
 * Get holidays for the teacher's school
 * Query params: year (optional)
 */
router.get('/holidays', async (req, res) => {
  try {
    const { year } = req.query;
    const schoolId = req.tenantSchoolId;

    // Verify user is a teacher
    if (req.user.role !== 'teacher') {
      return sendError(res, 'Access denied. Teachers only.', 403);
    }

    let queryText = `
      SELECT id, holiday_name, TO_CHAR(holiday_date, 'YYYY-MM-DD') as holiday_date, holiday_type, description
      FROM holidays
      WHERE school_id = $1 AND is_active = TRUE
    `;

    const params = [schoolId];

    if (year) {
      queryText += ` AND EXTRACT(YEAR FROM holiday_date) = $2`;
      params.push(year);
    }

    queryText += ` ORDER BY holiday_date ASC`;

    const result = await query(queryText, params);

    console.log(`✅ Found ${result.rows.length} holidays for school ${schoolId}${year ? ` in year ${year}` : ''}`);

    sendSuccess(res, result.rows, 'Holidays retrieved successfully');
  } catch (error) {
    console.error('Get holidays error:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    sendError(res, 'Failed to retrieve holidays', 500);
  }
});

/**
 * GET /api/v1/teacher/dashboard/batch-attendance-stats
 * Get attendance statistics for multiple sections in a single request
 * Query params:
 * - sectionIds: comma-separated list of section IDs (e.g., 1,2,3)
 * - date: YYYY-MM-DD (optional, defaults to today)
 * Returns object with sectionId as key and stats as value
 */
router.get('/dashboard/batch-attendance-stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const schoolId = req.tenantSchoolId;
    const { sectionIds: sectionIdsParam, date } = req.query;

    if (!sectionIdsParam) {
      return sendError(res, 'sectionIds query parameter is required', 400);
    }

    const sectionIds = sectionIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

    if (sectionIds.length === 0) {
      return sendError(res, 'Invalid sectionIds provided', 400);
    }

    // Get teacher_id
    const teacherResult = await query(
      'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2 AND is_active = TRUE',
      [userId, schoolId]
    );

    if (teacherResult.rows.length === 0) {
      return sendError(res, 'Teacher profile not found', 404);
    }

    const teacherId = teacherResult.rows[0].id;

    // Verify teacher has access to these sections
    const accessResult = await query(
      `SELECT section_id FROM teacher_class_assignments 
       WHERE teacher_id = $1 AND section_id = ANY($2::int[])`,
      [teacherId, sectionIds]
    );

    const allowedSectionIds = accessResult.rows.map(r => r.section_id);

    // Filter requested IDs to only allowed ones
    const validSectionIds = sectionIds.filter(id => allowedSectionIds.includes(id));

    if (validSectionIds.length === 0) {
      return sendSuccess(res, {}, 'No valid sections found for this teacher');
    }

    // Determine date
    let queryDate = new Date();
    if (date) {
      queryDate = new Date(date);
    }
    const dateStr = queryDate.toISOString().split('T')[0];
    const isSunday = queryDate.getDay() === 0;

    // Initialize stats object
    const batchStats = {};
    validSectionIds.forEach(id => {
      batchStats[id] = {
        totalStudents: 0,
        present: 0,
        late: 0,
        absent: 0,
        leave: 0,
        notMarked: 0,
        attendancePercentage: 0
      };
    });

    // 1. Get total students per section
    const studentsResult = await query(
      `SELECT section_id, COUNT(*) as count
       FROM students
       WHERE section_id = ANY($1::int[]) AND school_id = $2 AND is_active = TRUE
       GROUP BY section_id`,
      [validSectionIds, schoolId]
    );

    studentsResult.rows.forEach(row => {
      if (batchStats[row.section_id]) {
        batchStats[row.section_id].totalStudents = parseInt(row.count);
        batchStats[row.section_id].notMarked = parseInt(row.count); // Default all to not marked
      }
    });

    // 2. Get attendance logs if not Sunday
    if (!isSunday) {
      const attendanceResult = await query(
        `SELECT 
           s.section_id,
           COUNT(CASE WHEN al.status = 'present' THEN 1 END) as present,
           COUNT(CASE WHEN al.status = 'late' THEN 1 END) as late,
           COUNT(CASE WHEN al.status = 'absent' THEN 1 END) as absent,
           COUNT(CASE WHEN al.status = 'leave' THEN 1 END) as leave,
           COUNT(*) as total_marked
         FROM attendance_logs al
         JOIN students s ON al.student_id = s.id
         WHERE s.section_id = ANY($1::int[]) 
           AND al.school_id = $2 
           AND al.date = $3
           AND s.is_active = TRUE
         GROUP BY s.section_id`,
        [validSectionIds, schoolId, dateStr]
      );

      attendanceResult.rows.forEach(row => {
        const secId = row.section_id;
        if (batchStats[secId]) {
          const stats = batchStats[secId];
          stats.present = parseInt(row.present);
          stats.late = parseInt(row.late);
          stats.absent = parseInt(row.absent);
          stats.leave = parseInt(row.leave);

          const totalMarked = parseInt(row.total_marked);
          stats.notMarked = Math.max(0, stats.totalStudents - totalMarked);

          // Calculate percentage
          const attended = stats.present + stats.late;
          stats.attendancePercentage = stats.totalStudents > 0
            ? Math.round((attended / stats.totalStudents) * 100)
            : 0;
        }
      });
    }

    sendSuccess(res, batchStats, 'Batch attendance stats retrieved');

  } catch (error) {
    console.error('Batch stats error:', error);
    sendError(res, 'Failed to retrieve batch statistics', 500);
  }
});

/**
 * GET /api/v1/teacher/dashboard/stats
 * Get comprehensive dashboard statistics for teacher's form teacher classes
 * Returns: student counts by gender, today's attendance stats, attendance percentage
 */
router.get('/dashboard/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const schoolId = req.tenantSchoolId;

    // Verify user is a teacher
    if (req.user.role !== 'teacher') {
      return sendError(res, 'Access denied. Teachers only.', 403);
    }

    // Get teacher_id
    const teacherResult = await query(
      'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2 AND is_active = TRUE',
      [userId, schoolId]
    );

    if (teacherResult.rows.length === 0) {
      return sendError(res, 'Teacher profile not found', 404);
    }

    const teacherId = teacherResult.rows[0].id;

    // Get teacher's ALL assigned section IDs (not just form teacher)
    const sectionsResult = await query(
      `SELECT section_id FROM teacher_class_assignments
       WHERE teacher_id = $1`,
      [teacherId]
    );

    const sectionIds = sectionsResult.rows.map(row => row.section_id);

    if (sectionIds.length === 0) {
      // No assigned classes, return zeros
      return sendSuccess(res, {
        totalStudents: 0,
        boysCount: 0,
        girlsCount: 0,
        presentToday: 0,
        lateToday: 0,
        absentToday: 0,
        leaveToday: 0,
        notMarkedToday: 0,
        attendancePercentage: 100,
      }, 'No classes assigned');
    }

    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dayOfWeek = today.getDay();
    const isSunday = dayOfWeek === 0;

    // Build section IDs string for SQL IN clause
    const sectionIdsStr = sectionIds.map((id, idx) => `$${idx + 2}`).join(',');

    // Get total student counts by gender
    const studentCountsResult = await query(
      `SELECT
         COUNT(*) as total,
         COUNT(CASE WHEN gender = 'male' THEN 1 END) as boys,
         COUNT(CASE WHEN gender = 'female' THEN 1 END) as girls
       FROM students
       WHERE section_id IN (${sectionIdsStr})
         AND school_id = $1
         AND is_active = TRUE`,
      [schoolId, ...sectionIds]
    );

    const studentCounts = studentCountsResult.rows[0];
    const totalStudents = parseInt(studentCounts.total || 0);
    const boysCount = parseInt(studentCounts.boys || 0);
    const girlsCount = parseInt(studentCounts.girls || 0);

    let todayStats = {
      presentToday: 0,
      lateToday: 0,
      absentToday: 0,
      leaveToday: 0,
      notMarkedToday: totalStudents,
      attendancePercentage: totalStudents > 0 ? 100 : 0,
    };

    // Only fetch today's attendance if not Sunday
    if (!isSunday && totalStudents > 0) {
      const attendanceResult = await query(
        `SELECT
           COUNT(CASE WHEN status = 'present' THEN 1 END) as present,
           COUNT(CASE WHEN status = 'late' THEN 1 END) as late,
           COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent,
           COUNT(CASE WHEN status = 'leave' THEN 1 END) as leave,
           COUNT(*) as total_marked
         FROM attendance_logs al
         JOIN students s ON al.student_id = s.id
         WHERE s.section_id IN (${sectionIdsStr})
           AND al.school_id = $1
           AND al.date = $${sectionIds.length + 2}
           AND s.is_active = TRUE`,
        [schoolId, ...sectionIds, todayStr]
      );

      const attendance = attendanceResult.rows[0];
      const presentCount = parseInt(attendance.present || 0);
      const lateCount = parseInt(attendance.late || 0);
      const absentCount = parseInt(attendance.absent || 0);
      const leaveCount = parseInt(attendance.leave || 0);
      const totalMarked = parseInt(attendance.total_marked || 0);
      const notMarked = totalStudents - totalMarked;

      // Calculate attendance percentage (present + late) / total * 100
      const attendedCount = presentCount + lateCount;
      const attendancePercentage = totalStudents > 0
        ? Math.round((attendedCount / totalStudents) * 100)
        : 100;

      todayStats = {
        presentToday: presentCount,
        lateToday: lateCount,
        absentToday: absentCount,
        leaveToday: leaveCount,
        notMarkedToday: notMarked,
        attendancePercentage: attendancePercentage,
      };
    }

    const responseData = {
      totalStudents,
      boysCount,
      girlsCount,
      ...todayStats,
    };

    console.log(`📊 Dashboard stats for teacher ${teacherId}: ${JSON.stringify(responseData)}`);

    sendSuccess(res, responseData, 'Dashboard statistics retrieved successfully');
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    sendError(res, 'Failed to retrieve dashboard statistics', 500);
  }
});

/**
 * GET /api/v1/teacher/sections/:sectionId/attendance/range
 * Get attendance logs for date range (BATCH API for teacher calendar)
 * Query params: startDate, endDate (YYYY-MM-DD)
 * 🔒 SECURITY FIX: Added validateTeacherSectionAccess middleware
 */
router.get(
  '/sections/:sectionId/attendance/range',
  validateTeacherSectionAccess('params', 'sectionId'),
  async (req, res) => {
    try {
      const { sectionId } = req.params;
      const { startDate, endDate } = req.query;
      const userId = req.user.id;
      const schoolId = req.tenantSchoolId;

      // Verify user is a teacher
      if (req.user.role !== 'teacher') {
        return sendError(res, 'Access denied. Teachers only.', 403);
      }

      if (!startDate || !endDate) {
        return sendError(res, 'startDate and endDate are required (YYYY-MM-DD)', 400);
      }

      // ✅ PERFORMANCE FIX: Validate date range size
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

      if (daysDiff < 0) {
        return sendError(res, 'End date must be after or equal to start date', 400);
      }

      if (daysDiff > 90) {
        console.log(`❌ Rejected large date range: ${daysDiff} days (${startDate} to ${endDate})`);
        return sendError(res, 'Date range cannot exceed 90 days. Please select a smaller range.', 400);
      }

      // Get teacher_id from user_id
      const teacherResult = await query(
        'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2 AND is_active = TRUE',
        [userId, schoolId]
      );

      if (teacherResult.rows.length === 0) {
        return sendError(res, 'Teacher profile not found', 404);
      }

      const teacherId = teacherResult.rows[0].id;

      // Verify teacher is assigned to this section
      const assignmentCheck = await query(
        'SELECT id FROM teacher_class_assignments WHERE teacher_id = $1 AND section_id = $2',
        [teacherId, sectionId]
      );

      if (assignmentCheck.rows.length === 0) {
        return sendError(res, 'You are not assigned to this section', 403);
      }

      // Get attendance logs for the date range
      // Use TO_CHAR to avoid timezone conversion issues
      const logsResult = await query(
        `SELECT
        al.id,
        al.student_id,
        al.status,
        al.check_in_time,
        TO_CHAR(al.date, 'YYYY-MM-DD') as date,
        al.is_manual,
        al.notes,
        s.full_name as student_name,
        s.roll_number
       FROM attendance_logs al
       JOIN students s ON al.student_id = s.id
       WHERE al.school_id = $1
         AND s.section_id = $2
         AND al.date >= $3
         AND al.date <= $4
       ORDER BY al.date ASC, s.roll_number ASC`,
        [schoolId, sectionId, startDate, endDate]
      );

      console.log(`✅ Found ${logsResult.rows.length} attendance logs for section ${sectionId} from ${startDate} to ${endDate}`);

      sendSuccess(res, logsResult.rows, 'Attendance range retrieved successfully');
    } catch (error) {
      console.error('Get attendance range error:', error);
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
      sendError(res, 'Failed to retrieve attendance range', 500);
    }
  });

module.exports = router;
