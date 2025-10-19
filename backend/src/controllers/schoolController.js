const Student = require('../models/Student');
const AttendanceLog = require('../models/AttendanceLog');
const SchoolSettings = require('../models/SchoolSettings');
const Device = require('../models/Device');
const DeviceCommand = require('../models/DeviceCommand');
const { query } = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

/**
 * STUDENT MANAGEMENT
 */

// Get all students for the school
const getStudents = async (req, res) => {
  try {
    const { page = 1, limit = 10, grade, status, search } = req.query;
    const schoolId = req.tenantSchoolId; // From multi-tenancy middleware

    const filters = {};
    if (grade) filters.grade = grade;
    if (status) filters.isActive = status === 'active';
    if (search) filters.search = search;

    const result = await Student.findAll(
      schoolId,
      parseInt(page),
      parseInt(limit),
      filters
    );

    sendPaginated(res, result.students, page, limit, result.total);
  } catch (error) {
    console.error('Get students error:', error);
    sendError(res, 'Failed to retrieve students', 500);
  }
};

// Create new student
const createStudent = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;
    const studentData = req.body;

    // Validate required fields
    if (!studentData.fullName) {
      return sendError(res, 'Student full name is required', 400);
    }

    const student = await Student.create(studentData, schoolId);

    // ✨ AUTO-ENROLLMENT: Automatically enroll student to all school devices
    try {
      const devices = await Device.findBySchool(schoolId);

      if (devices && devices.length > 0) {
        console.log(`🔄 Auto-enrolling student ${student.full_name} to ${devices.length} device(s)...`);

        for (const device of devices) {
          // Get next available PIN for this device
          const existingMappingsResult = await query(
            `SELECT MAX(device_pin) as max_pin FROM device_user_mappings WHERE device_id = $1`,
            [device.id]
          );

          const nextPin = (existingMappingsResult.rows[0]?.max_pin || 0) + 1;

          // Create device_user_mapping
          await query(
            `INSERT INTO device_user_mappings (device_id, student_id, device_pin)
             VALUES ($1, $2, $3)
             ON CONFLICT (device_id, student_id) DO NOTHING`,
            [device.id, student.id, nextPin]
          );

          // Queue command to send user data to device
          await DeviceCommand.queueAddUser(
            device.id,
            nextPin,
            student.full_name,
            student.rfid_card_id || ''
          );

          console.log(`✅ Student ${student.full_name} auto-enrolled to device ${device.serial_number} (PIN ${nextPin})`);
        }
      }
    } catch (enrollError) {
      console.error('Auto-enrollment error (non-fatal):', enrollError);
      // Don't fail the whole request if auto-enrollment fails
    }

    sendSuccess(res, student, 'Student created successfully and auto-enrolled to devices', 201);
  } catch (error) {
    console.error('Create student error:', error);

    if (error.code === '23505') {
      return sendError(res, 'RFID card ID already exists', 409);
    }

    sendError(res, 'Failed to create student', 500);
  }
};

// Get student by ID
const getStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 30 } = req.query;

    const student = await Student.getWithAttendance(id, days);

    if (!student) {
      return sendError(res, 'Student not found', 404);
    }

    // Verify student belongs to this school (multi-tenancy check)
    if (student.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    sendSuccess(res, student, 'Student retrieved successfully');
  } catch (error) {
    console.error('Get student error:', error);
    sendError(res, 'Failed to retrieve student', 500);
  }
};

// Update student
const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const student = await Student.findById(id);

    if (!student) {
      return sendError(res, 'Student not found', 404);
    }

    // Verify student belongs to this school
    if (student.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    const updatedStudent = await Student.update(id, updates);

    sendSuccess(res, updatedStudent, 'Student updated successfully');
  } catch (error) {
    console.error('Update student error:', error);

    if (error.code === '23505') {
      return sendError(res, 'RFID card ID already exists', 409);
    }

    sendError(res, 'Failed to update student', 500);
  }
};

// Delete (deactivate) student
const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findById(id);

    if (!student) {
      return sendError(res, 'Student not found', 404);
    }

    // Verify student belongs to this school
    if (student.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    await Student.delete(id);

    sendSuccess(res, null, 'Student deactivated successfully');
  } catch (error) {
    console.error('Delete student error:', error);
    sendError(res, 'Failed to deactivate student', 500);
  }
};

// Bulk import students (CSV)
const importStudents = async (req, res) => {
  try {
    const { students } = req.body; // Array of student objects
    const schoolId = req.tenantSchoolId;

    if (!Array.isArray(students) || students.length === 0) {
      return sendError(res, 'No students data provided', 400);
    }

    const createdStudents = await Student.bulkCreate(students, schoolId);

    // ✨ AUTO-ENROLLMENT: Automatically enroll all students to devices using BATCHED commands
    try {
      const devices = await Device.findBySchool(schoolId);

      if (devices && devices.length > 0) {
        console.log(`🔄 Batch auto-enrolling ${createdStudents.length} students to ${devices.length} device(s)...`);

        for (const device of devices) {
          // Get current max PIN for this device
          const existingMappingsResult = await query(
            `SELECT MAX(device_pin) as max_pin FROM device_user_mappings WHERE device_id = $1`,
            [device.id]
          );

          let currentPin = (existingMappingsResult.rows[0]?.max_pin || 0) + 1;

          // Process students in batches of 50 for efficiency
          const BATCH_SIZE = 50;
          const batches = [];

          for (let i = 0; i < createdStudents.length; i += BATCH_SIZE) {
            batches.push(createdStudents.slice(i, i + BATCH_SIZE));
          }

          console.log(`📦 Processing ${batches.length} batch(es) of students for device ${device.serial_number}`);

          for (const batch of batches) {
            const batchMappings = [];
            const batchCommands = [];

            for (const student of batch) {
              // Create mapping in database
              await query(
                `INSERT INTO device_user_mappings (device_id, student_id, device_pin)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (device_id, student_id) DO NOTHING`,
                [device.id, student.id, currentPin]
              );

              // Prepare batch command data
              batchCommands.push({
                pin: currentPin,
                name: student.full_name,
                cardNumber: student.rfid_card_id || ''
              });

              batchMappings.push({
                studentId: student.id,
                studentName: student.full_name,
                devicePin: currentPin
              });

              currentPin++;
            }

            // Queue ONE batched command for all students in this batch
            await DeviceCommand.queueAddUsersBatch(device.id, batchCommands);

            console.log(`✅ Batch of ${batch.length} students queued for device ${device.serial_number}`);
          }

          console.log(`✅ All ${createdStudents.length} students auto-enrolled to device ${device.serial_number}`);
        }
      }
    } catch (enrollError) {
      console.error('Batch auto-enrollment error (non-fatal):', enrollError);
      // Don't fail the whole request if auto-enrollment fails
    }

    sendSuccess(
      res,
      {
        count: createdStudents.length,
        students: createdStudents,
        message: 'Students imported and auto-enrolled to devices via batched commands'
      },
      'Students imported successfully',
      201
    );
  } catch (error) {
    console.error('Import students error:', error);
    sendError(res, 'Failed to import students', 500);
  }
};

/**
 * DASHBOARD & ATTENDANCE
 */

// Get today's attendance dashboard
const getDashboardToday = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;

    const stats = await AttendanceLog.getTodayStats(schoolId);

    sendSuccess(res, stats, 'Dashboard statistics retrieved successfully');
  } catch (error) {
    console.error('Get dashboard error:', error);
    sendError(res, 'Failed to retrieve dashboard statistics', 500);
  }
};

// Get recent check-ins
const getRecentCheckins = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const schoolId = req.tenantSchoolId;

    const checkins = await AttendanceLog.getRecentCheckins(schoolId, parseInt(limit));

    sendSuccess(res, checkins, 'Recent check-ins retrieved successfully');
  } catch (error) {
    console.error('Get recent check-ins error:', error);
    sendError(res, 'Failed to retrieve recent check-ins', 500);
  }
};

// Get absent students for today
const getAbsentStudents = async (req, res) => {
  try {
    const { date } = req.query;
    const schoolId = req.tenantSchoolId;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const absentStudents = await AttendanceLog.getAbsentStudents(schoolId, targetDate);

    sendSuccess(res, absentStudents, 'Absent students retrieved successfully');
  } catch (error) {
    console.error('Get absent students error:', error);
    sendError(res, 'Failed to retrieve absent students', 500);
  }
};

// Get attendance logs with pagination and filters
const getAttendanceLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, date, status, search } = req.query;
    const schoolId = req.tenantSchoolId;

    const filters = {};
    if (date) filters.date = date;
    if (status) filters.status = status;
    if (search) filters.search = search;

    const result = await AttendanceLog.findAll(
      schoolId,
      parseInt(page),
      parseInt(limit),
      filters
    );

    sendPaginated(res, result.logs, page, limit, result.total);
  } catch (error) {
    console.error('Get attendance logs error:', error);
    sendError(res, 'Failed to retrieve attendance logs', 500);
  }
};

// Get today's attendance logs (simple endpoint for dashboard)
const getTodayAttendance = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;
    const today = new Date().toISOString().split('T')[0];

    const result = await AttendanceLog.findAll(
      schoolId,
      1,
      100,
      { date: today }
    );

    sendSuccess(res, result.logs || [], 'Today\'s attendance retrieved successfully');
  } catch (error) {
    console.error('Get today attendance error:', error);
    sendError(res, 'Failed to retrieve today\'s attendance', 500);
  }
};

// Get today's attendance statistics
const getTodayAttendanceStats = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;
    const stats = await AttendanceLog.getTodayStats(schoolId);

    sendSuccess(res, stats, 'Today\'s attendance statistics retrieved successfully');
  } catch (error) {
    console.error('Get today attendance stats error:', error);
    sendError(res, 'Failed to retrieve today\'s attendance statistics', 500);
  }
};

/**
 * REPORTS
 */

// Get attendance report
const getAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate, grade, status } = req.query;
    const schoolId = req.tenantSchoolId;

    if (!startDate || !endDate) {
      return sendError(res, 'Start date and end date are required', 400);
    }

    const filters = {};
    if (grade) filters.grade = grade;
    if (status) filters.status = status;

    const report = await AttendanceLog.getReport(schoolId, startDate, endDate, filters);

    sendSuccess(res, report, 'Attendance report generated successfully');
  } catch (error) {
    console.error('Get attendance report error:', error);
    sendError(res, 'Failed to generate attendance report', 500);
  }
};

// Get analytics data
const getAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const schoolId = req.tenantSchoolId;

    if (!startDate || !endDate) {
      return sendError(res, 'Start date and end date are required', 400);
    }

    const analytics = await AttendanceLog.getAnalytics(schoolId, startDate, endDate);

    sendSuccess(res, analytics, 'Analytics data retrieved successfully');
  } catch (error) {
    console.error('Get analytics error:', error);
    sendError(res, 'Failed to retrieve analytics data', 500);
  }
};

/**
 * SCHOOL SETTINGS
 */

// Get school settings
const getSettings = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;

    const settings = await SchoolSettings.getOrCreate(schoolId);

    sendSuccess(res, settings, 'Settings retrieved successfully');
  } catch (error) {
    console.error('Get settings error:', error);
    sendError(res, 'Failed to retrieve settings', 500);
  }
};

// Update school settings
const updateSettings = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;
    const updates = req.body;

    const settings = await SchoolSettings.update(schoolId, updates);

    sendSuccess(res, settings, 'Settings updated successfully');
  } catch (error) {
    console.error('Update settings error:', error);
    sendError(res, 'Failed to update settings', 500);
  }
};

// Get school devices
const getSchoolDevices = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;

    const devices = await Device.findBySchool(schoolId);

    sendSuccess(res, devices, 'Devices retrieved successfully');
  } catch (error) {
    console.error('Get devices error:', error);
    sendError(res, 'Failed to retrieve devices', 500);
  }
};

/**
 * DEVICE USER ENROLLMENT
 */

// Enroll a single student to a device
const enrollStudentToDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { studentId, devicePin } = req.body;
    const schoolId = req.tenantSchoolId;

    // Validate inputs
    if (!studentId || !devicePin) {
      return sendError(res, 'Student ID and device PIN are required', 400);
    }

    // Verify device belongs to this school
    const device = await Device.findById(deviceId);
    if (!device) {
      return sendError(res, 'Device not found', 404);
    }
    if (device.school_id !== schoolId) {
      return sendError(res, 'Access denied', 403);
    }

    // Get student details
    const student = await Student.findById(studentId);
    if (!student) {
      return sendError(res, 'Student not found', 404);
    }
    if (student.school_id !== schoolId) {
      return sendError(res, 'Access denied', 403);
    }

    // Check if mapping already exists
    const existingMapping = await query(
      `SELECT * FROM device_user_mappings
       WHERE device_id = $1 AND student_id = $2`,
      [deviceId, studentId]
    );

    if (existingMapping.rows.length > 0) {
      return sendError(res, 'Student is already enrolled on this device', 409);
    }

    // Create device_user_mapping
    const mapping = await query(
      `INSERT INTO device_user_mappings (device_id, student_id, device_pin)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [deviceId, studentId, devicePin]
    );

    // Queue command to send user data to device
    await DeviceCommand.queueAddUser(
      parseInt(deviceId),
      parseInt(devicePin),
      student.full_name,
      student.rfid_card_id || ''
    );

    console.log(`✅ Student ${student.full_name} (PIN ${devicePin}) enrolled to device ${device.serial_number}`);

    sendSuccess(
      res,
      {
        mapping: mapping.rows[0],
        message: 'Student enrolled successfully. Command queued to sync with device.'
      },
      'Student enrolled to device successfully',
      201
    );
  } catch (error) {
    console.error('Enroll student to device error:', error);

    if (error.code === '23505') {
      return sendError(res, 'Device PIN already assigned to another student', 409);
    }

    sendError(res, 'Failed to enroll student to device', 500);
  }
};

// Enroll all students from school to a device (bulk enrollment)
const enrollAllStudentsToDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { startingPin = 1 } = req.body;
    const schoolId = req.tenantSchoolId;

    // Verify device belongs to this school
    const device = await Device.findById(deviceId);
    if (!device) {
      return sendError(res, 'Device not found', 404);
    }
    if (device.school_id !== schoolId) {
      return sendError(res, 'Access denied', 403);
    }

    // Get all active students for this school
    const studentsResult = await query(
      `SELECT id, full_name, rfid_card_id
       FROM students
       WHERE school_id = $1 AND is_active = TRUE
       ORDER BY id ASC`,
      [schoolId]
    );

    const students = studentsResult.rows;

    if (students.length === 0) {
      return sendError(res, 'No active students found', 404);
    }

    // Get existing mappings for this device to avoid duplicates
    const existingMappingsResult = await query(
      `SELECT student_id, device_pin FROM device_user_mappings
       WHERE device_id = $1`,
      [deviceId]
    );

    const existingStudentIds = new Set(existingMappingsResult.rows.map(m => m.student_id));
    const usedPins = new Set(existingMappingsResult.rows.map(m => m.device_pin));

    let currentPin = parseInt(startingPin);
    const enrolled = [];
    const skipped = [];

    for (const student of students) {
      // Skip if already enrolled
      if (existingStudentIds.has(student.id)) {
        skipped.push({ studentId: student.id, reason: 'Already enrolled' });
        continue;
      }

      // Find next available PIN
      while (usedPins.has(currentPin)) {
        currentPin++;
      }

      try {
        // Create mapping
        await query(
          `INSERT INTO device_user_mappings (device_id, student_id, device_pin)
           VALUES ($1, $2, $3)`,
          [deviceId, student.id, currentPin]
        );

        // Queue command
        await DeviceCommand.queueAddUser(
          parseInt(deviceId),
          currentPin,
          student.full_name,
          student.rfid_card_id || ''
        );

        enrolled.push({
          studentId: student.id,
          studentName: student.full_name,
          devicePin: currentPin
        });

        usedPins.add(currentPin);
        currentPin++;
      } catch (error) {
        console.error(`Failed to enroll student ${student.id}:`, error);
        skipped.push({ studentId: student.id, reason: error.message });
      }
    }

    console.log(`✅ Bulk enrollment complete: ${enrolled.length} students enrolled to device ${device.serial_number}`);

    sendSuccess(
      res,
      {
        enrolled: enrolled.length,
        skipped: skipped.length,
        details: { enrolled, skipped },
        message: `${enrolled.length} students enrolled successfully. Commands queued to sync with device.`
      },
      'Bulk enrollment completed',
      201
    );
  } catch (error) {
    console.error('Bulk enroll error:', error);
    sendError(res, 'Failed to enroll students to device', 500);
  }
};

// Get enrolled students for a device
const getDeviceEnrolledStudents = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const schoolId = req.tenantSchoolId;

    // Verify device belongs to this school
    const device = await Device.findById(deviceId);
    if (!device) {
      return sendError(res, 'Device not found', 404);
    }
    if (device.school_id !== schoolId) {
      return sendError(res, 'Access denied', 403);
    }

    // Get all enrolled students
    const result = await query(
      `SELECT
        dum.id as mapping_id,
        dum.device_pin,
        s.id as student_id,
        s.full_name,
        s.rfid_card_id,
        s.grade,
        s.class_id
       FROM device_user_mappings dum
       JOIN students s ON dum.student_id = s.id
       WHERE dum.device_id = $1
       ORDER BY dum.device_pin ASC`,
      [deviceId]
    );

    sendSuccess(res, result.rows, 'Enrolled students retrieved successfully');
  } catch (error) {
    console.error('Get enrolled students error:', error);
    sendError(res, 'Failed to retrieve enrolled students', 500);
  }
};

// Remove student from device (unenroll)
const unenrollStudentFromDevice = async (req, res) => {
  try {
    const { deviceId, studentId } = req.params;
    const schoolId = req.tenantSchoolId;

    // Verify device belongs to this school
    const device = await Device.findById(deviceId);
    if (!device) {
      return sendError(res, 'Device not found', 404);
    }
    if (device.school_id !== schoolId) {
      return sendError(res, 'Access denied', 403);
    }

    // Get mapping
    const mappingResult = await query(
      `SELECT * FROM device_user_mappings
       WHERE device_id = $1 AND student_id = $2`,
      [deviceId, studentId]
    );

    if (mappingResult.rows.length === 0) {
      return sendError(res, 'Student is not enrolled on this device', 404);
    }

    const mapping = mappingResult.rows[0];

    // Delete mapping
    await query(
      `DELETE FROM device_user_mappings
       WHERE device_id = $1 AND student_id = $2`,
      [deviceId, studentId]
    );

    // Queue delete command to remove user from device
    await DeviceCommand.queueDeleteUser(parseInt(deviceId), mapping.device_pin);

    console.log(`✅ Student ${studentId} (PIN ${mapping.device_pin}) unenrolled from device ${device.serial_number}`);

    sendSuccess(res, null, 'Student unenrolled from device successfully. Command queued to sync with device.');
  } catch (error) {
    console.error('Unenroll student error:', error);
    sendError(res, 'Failed to unenroll student from device', 500);
  }
};

module.exports = {
  // Students
  getStudents,
  createStudent,
  getStudent,
  updateStudent,
  deleteStudent,
  importStudents,

  // Dashboard
  getDashboardToday,
  getRecentCheckins,
  getAbsentStudents,
  getAttendanceLogs,
  getTodayAttendance,
  getTodayAttendanceStats,

  // Reports
  getAttendanceReport,
  getAnalytics,

  // Settings
  getSettings,
  updateSettings,
  getSchoolDevices,

  // Device Enrollment
  enrollStudentToDevice,
  enrollAllStudentsToDevice,
  getDeviceEnrolledStudents,
  unenrollStudentFromDevice,
};
