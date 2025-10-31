const Student = require('../models/Student');
const AttendanceLog = require('../models/AttendanceLog');
const SchoolSettings = require('../models/SchoolSettings');
const Device = require('../models/Device');
const DeviceCommand = require('../models/DeviceCommand');
const { query } = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { getCurrentDateIST, getCurrentTimeIST, istDateTimeToUTC } = require('../utils/timezone');

/**
 * STUDENT MANAGEMENT
 */

// Get all students for the school
const getStudents = async (req, res) => {
  try {
    const { page = 1, grade, status, search, classId, sectionId } = req.query;
    // Enforce maximum limit to prevent DOS attacks
    const limit = Math.min(parseInt(req.query.limit) || 10, 1000);
    const schoolId = req.tenantSchoolId; // From multi-tenancy middleware

    console.log('📥 getStudents query params:', { grade, status, search, classId, sectionId, limit });

    const filters = {};
    if (grade) filters.grade = grade;
    if (status) filters.isActive = status === 'active';
    if (search) filters.search = search;
    if (classId) {
      filters.classId = parseInt(classId);
      console.log('✅ Filtering by classId:', filters.classId);
    }
    if (sectionId) {
      filters.sectionId = parseInt(sectionId);
      console.log('✅ Filtering by sectionId:', filters.sectionId);
    }

    const result = await Student.findAll(
      schoolId,
      parseInt(page),
      parseInt(limit),
      filters
    );

    console.log(`📊 Found ${result.total} students with filters:`, filters);

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

    // Check for duplicate roll number in the same class/section
    if (studentData.rollNumber && studentData.classId) {
      const duplicateCheck = await query(
        `SELECT id, full_name FROM students 
         WHERE roll_number = $1 
         AND class_id = $2 
         AND section_id = $3 
         AND school_id = $4 
         AND is_active = TRUE`,
        [studentData.rollNumber, studentData.classId, studentData.sectionId || null, schoolId]
      );

      if (duplicateCheck.rows.length > 0) {
        return sendError(
          res, 
          `Roll number ${studentData.rollNumber} is already assigned to ${duplicateCheck.rows[0].full_name} in this class/section`, 
          409
        );
      }
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

    // Check for duplicate roll number in the same class/section (if updating roll number)
    if (updates.rollNumber && updates.classId) {
      const duplicateCheck = await query(
        `SELECT id, full_name FROM students 
         WHERE roll_number = $1 
         AND class_id = $2 
         AND section_id = $3 
         AND school_id = $4 
         AND id != $5
         AND is_active = TRUE`,
        [updates.rollNumber, updates.classId, updates.sectionId || student.section_id || null, req.tenantSchoolId, id]
      );

      if (duplicateCheck.rows.length > 0) {
        return sendError(
          res, 
          `Roll number ${updates.rollNumber} is already assigned to ${duplicateCheck.rows[0].full_name} in this class/section`, 
          409
        );
      }
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
    // Use IST timezone for accurate date in India
    const targetDate = date || getCurrentDateIST();

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
    const { page = 1, date, status, search } = req.query;
    // Enforce maximum limit to prevent DOS attacks
    const limit = Math.min(parseInt(req.query.limit) || 20, 1000);
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
    // Use IST timezone for accurate date in India
    const today = getCurrentDateIST();

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

// Get attendance logs for date range (BATCH API for performance)
const getAttendanceRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const schoolId = req.tenantSchoolId;

    if (!startDate || !endDate) {
      return sendError(res, 'Start date and end date are required', 400);
    }

    const logs = await AttendanceLog.getLogsForDateRange(schoolId, startDate, endDate);

    sendSuccess(res, logs, 'Attendance logs retrieved successfully');
  } catch (error) {
    console.error('Get attendance range error:', error);
    sendError(res, 'Failed to retrieve attendance logs', 500);
  }
};

/**
 * MANUAL ATTENDANCE
 */

// Mark manual attendance (for admin to manually mark student attendance)
const markManualAttendance = async (req, res) => {
  try {
    const { studentId, date, checkInTime, status, notes, forceUpdate } = req.body;
    const schoolId = req.tenantSchoolId;

    // Validate inputs
    if (!studentId || !date) {
      return sendError(res, 'Student ID and date are required', 400);
    }

    // Verify student belongs to this school
    const student = await Student.findById(studentId);
    if (!student) {
      return sendError(res, 'Student not found', 404);
    }
    if (student.school_id !== schoolId) {
      return sendError(res, 'Access denied', 403);
    }

    // Check if attendance already exists for this date
    const existing = await AttendanceLog.existsToday(studentId, date);

    if (existing && !forceUpdate) {
      return sendError(res, 'Attendance already marked for this date', 409);
    }

    // If updating existing attendance
    if (existing && forceUpdate) {
      console.log(`✏️ Updating existing attendance for student ${studentId} on ${date} from ${existing.status} to ${status}`);
    }

    // Get school settings to determine if late
    const settings = await SchoolSettings.getOrCreate(schoolId);

    // Parse check-in time (if provided, otherwise use default 9 AM)
    const timeToUse = checkInTime || '09:00:00';
    const checkInDateTime = new Date(`${date}T${timeToUse}`);

    // AUTO-CALCULATE STATUS based on school settings
    let calculatedStatus = status || 'present'; // Use provided status or default to present

    console.log(`📝 Marking attendance: student=${studentId}, date=${date}, checkInTime=${timeToUse}, initialStatus=${calculatedStatus}`);

    // ALWAYS auto-calculate if marking as "present" (regardless of what user selected)
    // Only skip auto-calculation for "absent" and "leave"
    if ((calculatedStatus === 'present' || !status) && settings.school_open_time && settings.late_threshold_minutes) {
      // Parse times
      const [startHour, startMin] = settings.school_open_time.split(':').map(Number);
      const [checkHour, checkMin, checkSec = 0] = timeToUse.split(':').map(Number);

      const startMinutes = startHour * 60 + startMin;
      const checkMinutes = checkHour * 60 + checkMin;

      // Calculate difference in minutes
      const diffMinutes = checkMinutes - startMinutes;

      console.log(`⏰ Time calculation: school_start=${startMinutes}min, check_in=${checkMinutes}min, diff=${diffMinutes}min, threshold=${settings.late_threshold_minutes}min`);

      // If arrived after threshold, mark as late
      if (diffMinutes > settings.late_threshold_minutes) {
        calculatedStatus = 'late';
        console.log(`🕐 Auto-calculated status as 'late' (arrived ${diffMinutes} min after start time, threshold: ${settings.late_threshold_minutes} min)`);
      } else if (diffMinutes < 0) {
        // Arrived before school starts (negative difference)
        calculatedStatus = 'present';
        console.log(`⚠️ Arrived before school starts (${Math.abs(diffMinutes)} min early), marking as 'present'`);
      } else {
        calculatedStatus = 'present';
        console.log(`✅ Auto-calculated status as 'present' (arrived on time, ${diffMinutes} min after start)`);
      }
    } else if (calculatedStatus === 'absent') {
      console.log(`❌ Student is absent`);
    } else if (calculatedStatus === 'leave') {
      console.log(`🏖️ Student is on leave`);
    } else {
      console.log(`ℹ️ Using provided status: ${calculatedStatus}`);
    }

    let attendanceLog;

    // UPDATE existing attendance if forceUpdate is true
    if (existing && forceUpdate) {
      // Update the existing record using raw SQL
      const { query } = require('../config/database');
      
      const updateResult = await query(
        `UPDATE attendance_logs 
         SET status = $1, 
             check_in_time = $2
         WHERE student_id = $3 
           AND date = $4 
           AND school_id = $5
         RETURNING *`,
        [calculatedStatus, checkInDateTime, studentId, date, schoolId]
      );

      attendanceLog = updateResult.rows[0];

      // Update notes if provided
      if (notes) {
        await query(
          `UPDATE attendance_logs SET notes = $1 WHERE id = $2`,
          [notes, attendanceLog.id]
        );
        attendanceLog.notes = notes;
      }

      console.log(`✅ Updated attendance: ${existing.status} → ${calculatedStatus}`);

      sendSuccess(
        res,
        {
          ...attendanceLog,
          isUpdate: true,
          previousStatus: existing.status,
          autoCalculated: calculatedStatus !== status,
          originalStatus: status,
          finalStatus: calculatedStatus
        },
        'Attendance updated successfully',
        200
      );
    } else {
      // CREATE new attendance log
      attendanceLog = await AttendanceLog.create({
        studentId: studentId,
        schoolId: schoolId,
        deviceId: null, // Manual entry, no device
        checkInTime: checkInDateTime,
        status: calculatedStatus, // Use auto-calculated status
        date: date,
      });

      // Update notes if provided
      if (notes) {
        await AttendanceLog.updateNotes(attendanceLog.id, notes);
      }

      sendSuccess(
        res,
        {
          ...attendanceLog,
          isUpdate: false,
          autoCalculated: calculatedStatus !== status, // Let frontend know if status was auto-calculated
          originalStatus: status,
          finalStatus: calculatedStatus
        },
        'Manual attendance marked successfully',
        201
      );
    }
  } catch (error) {
    console.error('Mark manual attendance error:', error);
    sendError(res, 'Failed to mark manual attendance', 500);
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

    // VALIDATION: Prevent wrong school timing
    if (updates.school_open_time) {
      const timeStr = updates.school_open_time;
      const [hours] = timeStr.split(':').map(Number);
      
      // School should start in morning (before 12 PM)
      if (hours >= 12) {
        return sendError(res, 'School start time must be in the morning (before 12:00 PM). Did you mean 09:00 instead of 21:00?', 400);
      }
      
      // School should start after 6 AM (reasonable)
      if (hours < 6) {
        return sendError(res, 'School start time should be after 6:00 AM', 400);
      }
      
      console.log(`✅ School start time validated: ${timeStr} (${hours}:00 AM)`);
    }
    
    // VALIDATION: Late threshold should be reasonable
    if (updates.late_threshold_minutes !== undefined) {
      const threshold = parseInt(updates.late_threshold_minutes);
      
      if (threshold < 0 || threshold > 60) {
        return sendError(res, 'Late threshold must be between 0 and 60 minutes', 400);
      }
      
      console.log(`✅ Late threshold validated: ${threshold} minutes`);
    }
    
    // VALIDATION: School close time should be in afternoon/evening
    if (updates.school_close_time) {
      const timeStr = updates.school_close_time;
      const [hours] = timeStr.split(':').map(Number);
      
      if (hours < 12) {
        return sendError(res, 'School close time should be in afternoon/evening (after 12:00 PM)', 400);
      }
      
      console.log(`✅ School close time validated: ${timeStr}`);
    }

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
  getAttendanceRange,

  // Manual Attendance
  markManualAttendance,

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
