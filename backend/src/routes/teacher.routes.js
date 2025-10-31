const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { enforceSchoolTenancy } = require('../middleware/multiTenant');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Teacher-specific Routes
 * Base path: /api/v1/teacher
 * These routes are for teachers to access their assigned classes and students
 */

// Apply authentication and multi-tenancy (but NOT requireSchoolAdmin)
router.use(authenticate);
router.use(enforceSchoolTenancy);

/**
 * GET /api/v1/teacher/sections/:sectionId/students
 * Get students in a section that the teacher is assigned to
 */
router.get('/sections/:sectionId/students', async (req, res) => {
  try {
    const { sectionId } = req.params;
    const userId = req.user.id;
    const schoolId = req.tenantSchoolId;

    // Verify user is a teacher
    if (req.user.role !== 'teacher') {
      return sendError(res, 'Access denied. Teachers only.', 403);
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
});

/**
 * GET /api/v1/teacher/my-sections
 * Get all sections assigned to the logged-in teacher
 */
router.get('/my-sections', async (req, res) => {
  try {
    const userId = req.user.id;
    const schoolId = req.tenantSchoolId;

    // Verify user is a teacher
    if (req.user.role !== 'teacher') {
      return sendError(res, 'Access denied. Teachers only.', 403);
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

    // Get teacher assignments
    const assignments = await Teacher.getAssignments(teacherId, '2025-2026');

    sendSuccess(res, assignments, 'Sections retrieved successfully');
  } catch (error) {
    console.error('Get teacher sections error:', error);
    sendError(res, 'Failed to retrieve sections', 500);
  }
});

/**
 * POST /api/v1/teacher/sections/:sectionId/attendance
 * Mark attendance for a student (teacher can mark their assigned students)
 */
router.post('/sections/:sectionId/attendance', async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { studentId, date, status, notes, checkInTime } = req.body;
    const userId = req.user.id;
    const schoolId = req.tenantSchoolId;

    // Verify user is a teacher
    if (req.user.role !== 'teacher') {
      return sendError(res, 'Access denied. Teachers only.', 403);
    }

    if (!studentId || !date || !status) {
      return sendError(res, 'studentId, date, and status are required', 400);
    }
    
    // Use provided checkInTime or default to 09:00:00
    const timeToUse = checkInTime || '09:00:00';
    const checkInDateTime = `${date}T${timeToUse}`;
    
    console.log(`📝 Marking attendance: student=${studentId}, date=${date}, status=${status}, time=${timeToUse}`);

    // Get teacher_id
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

    // Verify student belongs to this section
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
 */
router.get('/sections/:sectionId/attendance', async (req, res) => {
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
    const logsResult = await query(
      `SELECT 
        al.id,
        al.student_id,
        al.status,
        al.check_in_time,
        al.date,
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
      SELECT id, holiday_name, holiday_date, holiday_type, description, is_recurring
      FROM holidays
      WHERE school_id = $1
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
    sendError(res, 'Failed to retrieve holidays', 500);
  }
});

module.exports = router;
