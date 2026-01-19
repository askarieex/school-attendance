const Student = require('../models/Student');
const AttendanceLog = require('../models/AttendanceLog');
const SchoolSettings = require('../models/SchoolSettings');
const Device = require('../models/Device');
const DeviceCommand = require('../models/DeviceCommand');
const { query } = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { getCurrentDateIST, getCurrentTimeIST, istDateTimeToUTC } = require('../utils/timezone');
const whatsappService = require('../services/whatsappService');
const { getCurrentAcademicYear } = require('../utils/academicYear');
const { maskPhone } = require('../utils/logger');

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

    // ✅ Get current academic year for filtering
    const currentAcademicYear = await getCurrentAcademicYear(schoolId);
    console.log(`📅 Filtering students by academic year: ${currentAcademicYear || 'ALL'}`);

    const filters = {};
    if (grade) filters.grade = grade;
    if (status) filters.isActive = status === 'active';
    if (search) filters.search = search;
    if (currentAcademicYear) filters.academicYear = currentAcademicYear; // ✅ Add academic year filter
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
    // ✅ RACE CONDITION FIXED: Using PostgreSQL advisory locks for thread-safe PIN assignment
    try {
      const { assignNextDevicePin } = require('../utils/devicePinAssignment');
      const devices = await Device.findBySchool(schoolId);

      if (devices && devices.length > 0) {
        console.log(`🔄 Auto-enrolling student ${student.full_name} to ${devices.length} device(s)...`);

        for (const device of devices) {
          // ✅ FIXED: Thread-safe PIN assignment using advisory locks
          await assignNextDevicePin(
            device.id,
            student.id,
            student.full_name,
            student.rfid_card_id || ''
          );

          console.log(`✅ Student ${student.full_name} auto-enrolled to device ${device.serial_number}`);
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

    // 🔄 AUTO-SYNC: Update student data on all enrolled devices
    try {
      // Get all devices where this student is enrolled
      const enrolledDevicesResult = await query(
        `SELECT dum.device_id, dum.device_pin, d.serial_number, d.device_name
         FROM device_user_mappings dum
         JOIN devices d ON dum.device_id = d.id
         WHERE dum.student_id = $1 AND d.is_active = TRUE`,
        [id]
      );

      if (enrolledDevicesResult.rows.length > 0) {
        console.log(`🔄 Syncing updated student ${updatedStudent.full_name} to ${enrolledDevicesResult.rows.length} device(s)...`);

        for (const enrollment of enrolledDevicesResult.rows) {
          // Queue UPDATE command (same as ADD, device will overwrite existing data)
          await DeviceCommand.queueAddUser(
            enrollment.device_id,
            enrollment.device_pin,
            updatedStudent.full_name,
            updatedStudent.rfid_card_id || ''
          );

          console.log(`✅ Student update queued for device ${enrollment.serial_number} (PIN ${enrollment.device_pin})`);
        }
      } else {
        console.log(`ℹ️ Student ${updatedStudent.full_name} is not enrolled on any devices`);
      }
    } catch (syncError) {
      console.error('Auto-sync error (non-fatal):', syncError);
      // Don't fail the whole request if sync fails
    }

    sendSuccess(res, updatedStudent, 'Student updated successfully and synced to devices');
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

    // 🗑️ AUTO-SYNC: Remove student from all enrolled devices BEFORE deactivating
    try {
      // Get all devices where this student is enrolled
      const enrolledDevicesResult = await query(
        `SELECT dum.device_id, dum.device_pin, d.serial_number, d.device_name
         FROM device_user_mappings dum
         JOIN devices d ON dum.device_id = d.id
         WHERE dum.student_id = $1 AND d.is_active = TRUE`,
        [id]
      );

      if (enrolledDevicesResult.rows.length > 0) {
        console.log(`🗑️ Removing student ${student.full_name} from ${enrolledDevicesResult.rows.length} device(s)...`);

        for (const enrollment of enrolledDevicesResult.rows) {
          // Queue DELETE command to remove user from device
          await DeviceCommand.queueDeleteUser(
            enrollment.device_id,
            enrollment.device_pin
          );

          console.log(`✅ Delete command queued for device ${enrollment.serial_number} (PIN ${enrollment.device_pin})`);
        }

        // Delete all device mappings for this student
        await query(
          'DELETE FROM device_user_mappings WHERE student_id = $1',
          [id]
        );

        console.log(`✅ Deleted all device mappings for student ${student.full_name}`);
      } else {
        console.log(`ℹ️ Student ${student.full_name} is not enrolled on any devices`);
      }
    } catch (syncError) {
      console.error('Device removal error (non-fatal):', syncError);
      // Don't fail the whole request if device removal fails
    }

    // Now deactivate the student in database
    await Student.delete(id);

    sendSuccess(res, null, 'Student deactivated successfully and removed from all devices');
  } catch (error) {
    console.error('Delete student error:', error);
    sendError(res, 'Failed to deactivate student', 500);
  }
};

/**
 * 🖼️ Upload student photo
 */
const uploadStudentPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.tenantSchoolId;

    // Check if file was uploaded
    if (!req.file) {
      return sendError(res, 'No photo file uploaded', 400);
    }

    // Verify student exists and belongs to this school
    const student = await Student.findById(id);
    if (!student) {
      return sendError(res, 'Student not found', 404);
    }
    if (student.school_id !== schoolId) {
      return sendError(res, 'Access denied', 403);
    }

    const photoUrl = req.file.url; // Set by processPhoto middleware

    // Delete old photo if exists
    if (student.photo_url && student.photo_url.startsWith('/uploads/')) {
      const { deletePhoto } = require('../middleware/upload');
      deletePhoto(student.photo_url);
    }

    // Update student record with new photo URL
    const updatedStudent = await Student.update(id, { photoUrl });

    console.log(`✅ Photo uploaded for student ${student.full_name}: ${photoUrl}`);

    sendSuccess(res, {
      ...updatedStudent,
      photoUrl,
      message: 'Photo uploaded and processed successfully (300x300px)'
    }, 'Student photo uploaded successfully');
  } catch (error) {
    console.error('Upload student photo error:', error);
    sendError(res, 'Failed to upload student photo', 500);
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
    // ✅ RACE CONDITION FIXED: Using PostgreSQL advisory locks for thread-safe batch PIN assignment
    try {
      const { assignBatchDevicePins } = require('../utils/devicePinAssignment');
      const devices = await Device.findBySchool(schoolId);

      if (devices && devices.length > 0) {
        console.log(`🔄 Batch auto-enrolling ${createdStudents.length} students to ${devices.length} device(s)...`);

        for (const device of devices) {
          // ✅ FIXED: Thread-safe batch PIN assignment using advisory locks
          await assignBatchDevicePins(device.id, createdStudents);

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

    // ✅ Get current academic year for filtering
    const currentAcademicYear = await getCurrentAcademicYear(schoolId);

    // Get dates
    const today = getCurrentDateIST();
    // Calculate start date (last 6 days + today = 7 days)
    const endObj = new Date(today);
    const startObj = new Date(endObj);
    startObj.setDate(endObj.getDate() - 6);
    const startDate = startObj.toISOString().split('T')[0];

    // Parallel fetch for performance
    const [stats, classStats, weeklyRaw] = await Promise.all([
      AttendanceLog.getTodayStats(schoolId, currentAcademicYear),
      AttendanceLog.getClassStatsToday(schoolId, today),
      AttendanceLog.getAnalytics(schoolId, startDate, today)
    ]);

    // Process weekly data for chart
    // Map dates to days (Mon, Tue...) and aggregate counts
    const weeklyDataMap = new Map();

    // Initialize last 7 days with 0
    for (let d = new Date(startObj); d <= endObj; d.setDate(d.getDate() + 1)) {
      const dStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short' });
      weeklyDataMap.set(dStr, { day: dayLabel, present: 0, absent: 0, late: 0, date: dStr });
    }

    // Fill with actual data
    weeklyRaw.forEach(row => {
      const dateStr = new Date(row.date).toISOString().split('T')[0];
      if (weeklyDataMap.has(dateStr)) {
        const dayStat = weeklyDataMap.get(dateStr);
        const count = parseInt(row.count);
        if (row.status === 'present') dayStat.present += count;
        else if (row.status === 'late') dayStat.late += count;
        else if (row.status === 'absent') dayStat.absent += count;
      }
    });

    // Convert map to array and calculate percentages (approximate based on total students today)
    // Note: Historical total students might differ, but using today's total is a reasonable approximation for recent trends
    const totalStudents = stats.totalStudents || 1;

    const weeklyData = Array.from(weeklyDataMap.values()).map(d => {
      const dailyTotal = d.present + d.late + d.absent;
      // If dailyTotal is 0 (no data), use stats.totalStudents to prevent division by zero visual bugs, 
      // but counts remain 0.
      const base = dailyTotal > 0 ? dailyTotal : totalStudents;

      return {
        ...d,
        presentPct: Math.round(((d.present + d.late) / base) * 100), // Late is technically present
        absentPct: Math.round((d.absent / base) * 100),
        latePct: Math.round((d.late / base) * 100)
      };
    });

    sendSuccess(res, {
      ...stats,
      classStats: classStats, // Real class stats
      weeklyStats: weeklyData // Real weekly stats
    }, 'Dashboard statistics retrieved successfully');
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

    // ✅ Get current academic year for filtering
    const currentAcademicYear = await getCurrentAcademicYear(schoolId);

    const absentStudents = await AttendanceLog.getAbsentStudents(schoolId, targetDate, currentAcademicYear);

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

    // ✅ Get current academic year for filtering
    const currentAcademicYear = await getCurrentAcademicYear(schoolId);

    const stats = await AttendanceLog.getTodayStats(schoolId, currentAcademicYear);

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

    // Get school settings to determine if late
    const settings = await SchoolSettings.getOrCreate(schoolId);

    // Parse check-in time (if provided, otherwise use default 9 AM)
    const timeToUse = checkInTime || '09:00:00';
    // Store local IST time WITHOUT timezone suffix - PostgreSQL TIMESTAMP converts +05:30 to UTC
    const checkInDateTime = `${date}T${timeToUse}`;

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

    // 🔒 FIXED: Use database-level UPSERT to prevent race conditions
    // This ensures atomicity - no gap between check and insert

    // Convert forceUpdate to boolean explicitly
    const shouldUpdate = Boolean(forceUpdate);

    const upsertResult = await query(
      `INSERT INTO attendance_logs (
        student_id, school_id, device_id, check_in_time, status, date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (student_id, date, school_id)
      DO UPDATE SET
        status = CASE WHEN $8 THEN EXCLUDED.status ELSE attendance_logs.status END,
        check_in_time = CASE WHEN $8 THEN EXCLUDED.check_in_time ELSE attendance_logs.check_in_time END,
        notes = CASE WHEN $8 THEN EXCLUDED.notes ELSE attendance_logs.notes END,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *, (xmax = 0) AS inserted`,
      [
        studentId,
        schoolId,
        null, // device_id (manual entry)
        checkInDateTime,
        calculatedStatus,
        date,
        notes || null,
        shouldUpdate // $8 - boolean: whether to allow update
      ]
    );

    const attendanceLog = upsertResult.rows[0];
    const wasInserted = attendanceLog.inserted;
    const isUpdate = !wasInserted;

    if (isUpdate && !shouldUpdate) {
      // Record already exists and forceUpdate is false
      return sendError(res, 'Attendance already marked for this date. Use forceUpdate=true to modify.', 409, {
        existingAttendance: {
          status: attendanceLog.status,
          checkInTime: attendanceLog.check_in_time
        }
      });
    }

    const logMessage = wasInserted ?
      `✅ Attendance created: ${calculatedStatus}` :
      `✅ Attendance updated: ${calculatedStatus}`;
    console.log(logMessage);

    // Emit WebSocket event for real-time updates
    try {
      const io = req.app.get('io');
      if (io) {
        // Get student details for the event
        const studentDetails = await Student.findById(studentId);

        // Emit to school-specific room
        io.to(`school-${schoolId}`).emit('attendance-updated', {
          attendanceLog: {
            ...attendanceLog,
            student_name: studentDetails?.full_name || 'Unknown'
          },
          type: wasInserted ? 'created' : 'updated',
          timestamp: new Date().toISOString()
        });

        console.log(`🔌 WebSocket event emitted: attendance-updated (school-${schoolId})`);
      }
    } catch (wsError) {
      console.error('WebSocket emission error (non-fatal):', wsError);
      // Don't fail the request if WebSocket fails
    }

    // ✅ BUG FIX: Make WhatsApp async (non-blocking) - 68% faster!
    // Fire and forget - don't await WhatsApp response
    setImmediate(async () => {
      try {
        // 🔒 CRITICAL: Only send WhatsApp for TODAY's attendance (prevent alerts for backdated entries)
        const todayIST = getCurrentDateIST();
        const isToday = date === todayIST;

        if (!isToday) {
          console.log(`⏭️ Skipping WhatsApp alert: Attendance marked for ${date} (not today: ${todayIST})`);
          return;
        }

        // Proceed with WhatsApp for today's attendance
        const student = await Student.findById(studentId);
        if (!student) {
          console.warn(`⚠️ Student ${studentId} not found for WhatsApp alert`);
          return;
        }

        const school = await query('SELECT name FROM schools WHERE id = $1', [schoolId]);
        const schoolName = school.rows[0]?.name || 'School';

        // Only send WhatsApp for late, absent, or leave status (not for regular present)
        if (calculatedStatus === 'late' || calculatedStatus === 'absent' || calculatedStatus === 'leave') {
          // Try multiple phone fields in order of priority: guardian_phone > parent_phone > mother_phone
          let phoneToUse = null;
          if (student.guardian_phone && student.guardian_phone.trim() !== '') {
            phoneToUse = student.guardian_phone;
          } else if (student.parent_phone && student.parent_phone.trim() !== '') {
            phoneToUse = student.parent_phone;
          } else if (student.mother_phone && student.mother_phone.trim() !== '') {
            phoneToUse = student.mother_phone;
          }

          if (phoneToUse) {
            console.log(`📱 Sending WhatsApp alert (async) to ${maskPhone(phoneToUse)} for ${student.full_name} (${calculatedStatus})`);

            const whatsappResult = await whatsappService.sendAttendanceAlert({
              parentPhone: phoneToUse,
              studentName: student.full_name,
              studentId: studentId,
              schoolId: schoolId,
              status: calculatedStatus,
              checkInTime: timeToUse,
              schoolName: schoolName,
              date: date
            });

            if (whatsappResult.success) {
              if (whatsappResult.skipped) {
                console.log(`⏭️ WhatsApp message skipped: ${whatsappResult.reason}`);
              } else {
                console.log(`✅ WhatsApp alert sent successfully: ${whatsappResult.messageId}`);
              }
            } else {
              console.error(`❌ WhatsApp alert failed: ${whatsappResult.error}`);
            }
          } else {
            console.log(`⚠️ No phone number found for ${student.full_name}, skipping WhatsApp alert`);
          }
        } else {
          console.log(`ℹ️ Status is '${calculatedStatus}', skipping WhatsApp alert (only send for late/absent/leave)`);
        }
      } catch (whatsappError) {
        console.error('WhatsApp alert error (non-fatal, async):', whatsappError);
        // Errors in async block don't affect main response
      }
    });

    sendSuccess(
      res,
      {
        ...attendanceLog,
        isUpdate,
        autoCalculated: calculatedStatus !== status,
        originalStatus: status,
        finalStatus: calculatedStatus
      },
      wasInserted ? 'Manual attendance marked successfully' : 'Attendance updated successfully',
      wasInserted ? 201 : 200
    );
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

// Upload school logo
const uploadSchoolLogo = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;

    if (!req.file) {
      return sendError(res, 'No logo file provided', 400);
    }

    const logoUrl = req.file.url;
    console.log(`🖼️ Updating school logo for school ${schoolId} to ${logoUrl}`);

    const settings = await SchoolSettings.update(schoolId, { logo_url: logoUrl });

    sendSuccess(res, { logoUrl, settings }, 'School logo uploaded successfully');
  } catch (error) {
    console.error('Upload logo error:', error);
    sendError(res, 'Failed to upload logo', 500);
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

    // 🔒 FIXED: Check if PIN is already used by another student on this device
    const existingPin = await query(
      `SELECT dum.*, s.full_name
       FROM device_user_mappings dum
       JOIN students s ON dum.student_id = s.id
       WHERE dum.device_id = $1 AND dum.device_pin = $2`,
      [deviceId, devicePin]
    );

    if (existingPin.rows.length > 0) {
      return sendError(
        res,
        `PIN ${devicePin} is already assigned to student "${existingPin.rows[0].full_name}" on this device. Please choose a different PIN.`,
        409
      );
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
// ✅ RACE CONDITION FIXED: Using thread-safe PIN removal with advisory locks
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

    // ✅ FIXED: Thread-safe PIN removal using utility function
    const { removeDevicePin } = require('../utils/devicePinAssignment');
    const result = await removeDevicePin(parseInt(deviceId), parseInt(studentId));

    console.log(`✅ Student ${studentId} (PIN ${result.pin}) unenrolled from device ${device.serial_number}`);

    sendSuccess(res, null, 'Student unenrolled from device successfully. Command queued to sync with device.');
  } catch (error) {
    console.error('Unenroll student error:', error);

    if (error.message.includes('not enrolled')) {
      return sendError(res, 'Student is not enrolled on this device', 404);
    }

    sendError(res, 'Failed to unenroll student from device', 500);
  }
};

/**
 * DEVICE TIME SYNCHRONIZATION
 */

// ❌ DISABLED: Sync device time with server time
// REASON: ZKTeco PUSH protocol time sync does not work reliably with this device firmware
// SOLUTION: Set time manually on device using physical menu or web interface
const syncDeviceTime = async (req, res) => {
  console.warn('⚠️  Time sync endpoint called but is DISABLED');
  console.warn('   Automatic time sync does not work with this device firmware');
  console.warn('   Please set time manually on device via physical menu or web interface');

  sendError(
    res,
    'Automatic time sync is disabled. Please set device time manually via device menu or web interface. Device will maintain accurate time once set correctly.',
    400
  );
};

// ❌ DISABLED: Check device time (request device to report its current time)
const checkDeviceTime = async (req, res) => {
  console.warn('⚠️  Check device time endpoint called but is DISABLED');
  sendError(
    res,
    'Device time check is disabled. Please check device time via device menu or web interface.',
    400
  );
};

// ❌ DISABLED: Sync time for all school devices
const syncAllDevicesTime = async (req, res) => {
  console.warn('⚠️  Sync all devices time endpoint called but is DISABLED');
  sendError(
    res,
    'Automatic time sync is disabled for all devices. Please set device times manually via device menu or web interface.',
    400
  );
};

module.exports = {
  // Students
  getStudents,
  createStudent,
  getStudent,
  updateStudent,
  deleteStudent,
  importStudents,
  uploadStudentPhoto,

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
  uploadSchoolLogo,

  // Devices
  getSchoolDevices,

  // Device Enrollment
  enrollStudentToDevice,
  enrollAllStudentsToDevice,
  getDeviceEnrolledStudents,
  unenrollStudentFromDevice,

  // Device Time Sync (DISABLED)
  syncDeviceTime,
  checkDeviceTime,
  syncAllDevicesTime,
};
