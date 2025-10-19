const AttendanceLog = require('../models/AttendanceLog');
const Student = require('../models/Student');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * REPORTS MANAGEMENT
 */

// Get daily attendance report
const getDailyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const schoolId = req.tenantSchoolId;

    if (!date) {
      return sendError(res, 'Date parameter is required', 400);
    }

    // Get all students
    const allStudents = await Student.findAll(schoolId, 1, 10000, { status: 'active' });

    // Get attendance logs for the date
    const attendanceLogs = await AttendanceLog.findAll(schoolId, 1, 10000, { date });

    // Create a map of student attendance
    const attendanceMap = new Map();
    attendanceLogs.logs.forEach(log => {
      attendanceMap.set(log.student_id, log);
    });

    // Build report with present and absent students
    const present = [];
    const absent = [];

    allStudents.students.forEach(student => {
      if (attendanceMap.has(student.id)) {
        const log = attendanceMap.get(student.id);
        present.push({
          ...student,
          checkInTime: log.check_in_time,
          checkOutTime: log.check_out_time,
          status: log.status
        });
      } else {
        absent.push(student);
      }
    });

    const report = {
      date,
      totalStudents: allStudents.total,
      presentCount: present.length,
      absentCount: absent.length,
      attendanceRate: allStudents.total > 0 ? ((present.length / allStudents.total) * 100).toFixed(2) : 0,
      present,
      absent
    };

    sendSuccess(res, report, 'Daily report generated successfully');
  } catch (error) {
    console.error('Get daily report error:', error);
    sendError(res, 'Failed to generate daily report', 500);
  }
};

// Get monthly attendance report
const getMonthlyReport = async (req, res) => {
  try {
    const { year, month } = req.query;
    const schoolId = req.tenantSchoolId;

    if (!year || !month) {
      return sendError(res, 'Year and month parameters are required', 400);
    }

    // Calculate start and end dates for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    // Get attendance data for the month
    const report = await AttendanceLog.getReport(schoolId, startDate, endDate, {});

    sendSuccess(res, report, 'Monthly report generated successfully');
  } catch (error) {
    console.error('Get monthly report error:', error);
    sendError(res, 'Failed to generate monthly report', 500);
  }
};

// Get student-specific report
const getStudentReport = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate } = req.query;
    const schoolId = req.tenantSchoolId;

    if (!startDate || !endDate) {
      return sendError(res, 'Start date and end date are required', 400);
    }

    // Get student details
    const student = await Student.findById(studentId);

    if (!student) {
      return sendError(res, 'Student not found', 404);
    }

    // Verify student belongs to this school
    if (student.school_id !== schoolId) {
      return sendError(res, 'Access denied', 403);
    }

    // Get attendance logs for the student
    const logs = await AttendanceLog.findAll(schoolId, 1, 10000, {
      startDate,
      endDate,
      search: student.full_name
    });

    // Calculate statistics
    const totalDays = logs.logs.length;
    const presentDays = logs.logs.filter(log => log.status === 'present').length;
    const lateDays = logs.logs.filter(log => log.status === 'late').length;
    const absentDays = logs.logs.filter(log => log.status === 'absent').length;

    const report = {
      student,
      dateRange: { startDate, endDate },
      statistics: {
        totalDays,
        presentDays,
        lateDays,
        absentDays,
        attendanceRate: totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(2) : 0
      },
      logs: logs.logs
    };

    sendSuccess(res, report, 'Student report generated successfully');
  } catch (error) {
    console.error('Get student report error:', error);
    sendError(res, 'Failed to generate student report', 500);
  }
};

// Get class-specific report
const getClassReport = async (req, res) => {
  try {
    const { classId } = req.params;
    const { startDate, endDate } = req.query;
    const schoolId = req.tenantSchoolId;

    if (!startDate || !endDate) {
      return sendError(res, 'Start date and end date are required', 400);
    }

    // Get all students in the class
    const students = await Student.findAll(schoolId, 1, 10000, {
      grade: classId,
      status: 'active'
    });

    // Get attendance data for the date range
    const report = await AttendanceLog.getReport(schoolId, startDate, endDate, {
      grade: classId
    });

    const classReport = {
      classId,
      dateRange: { startDate, endDate },
      totalStudents: students.total,
      ...report
    };

    sendSuccess(res, classReport, 'Class report generated successfully');
  } catch (error) {
    console.error('Get class report error:', error);
    sendError(res, 'Failed to generate class report', 500);
  }
};

// Export report (placeholder for future implementation)
const exportReport = async (req, res) => {
  try {
    const { type } = req.params;
    const params = req.query;

    // This is a placeholder - actual export implementation would generate CSV/PDF/Excel
    sendError(res, 'Export functionality not yet implemented', 501);
  } catch (error) {
    console.error('Export report error:', error);
    sendError(res, 'Failed to export report', 500);
  }
};

module.exports = {
  getDailyReport,
  getMonthlyReport,
  getStudentReport,
  getClassReport,
  exportReport,
};
