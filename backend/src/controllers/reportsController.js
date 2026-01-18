const AttendanceLog = require('../models/AttendanceLog');
const Student = require('../models/Student');
const { sendSuccess, sendError } = require('../utils/response');
const { query } = require('../config/database');

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

    console.log('📅 Generating monthly report for:', year, month);

    // Calculate start and end dates for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    // Get all students
    const allStudents = await Student.findAll(schoolId, 1, 10000, { status: 'active' });

    // Get attendance logs for the entire month
    const logs = await AttendanceLog.getLogsForDateRange(schoolId, startDate, endDate);
    const attendanceLogs = { logs };

    // Get holidays for the month to exclude from working days
    const holidaysResponse = await query(
      `SELECT holiday_date FROM holidays 
       WHERE school_id = $1 
       AND holiday_date >= $2 
       AND holiday_date <= $3
       AND is_active = TRUE`,
      [schoolId, startDate, endDate]
    );

    console.log(`🎉 Found ${holidaysResponse.rows.length} holidays in ${year}-${month}`);

    const holidayDates = new Set(
      holidaysResponse.rows.map(h => new Date(h.holiday_date).toISOString().split('T')[0])
    );

    // Build daily data
    const dailyData = [];
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalWorkingDays = 0;
    let totalHolidays = 0;
    let totalSundays = 0;

    for (let day = 1; day <= lastDay; day++) {
      const currentDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = new Date(currentDate).getDay();

      // Skip Sundays (0 = Sunday)
      if (dayOfWeek === 0) {
        totalSundays++;
        continue;
      }

      // Skip Holidays
      if (holidayDates.has(currentDate)) {
        totalHolidays++;
        continue;
      }

      totalWorkingDays++;

      // Count attendance for this day
      const dayLogs = attendanceLogs.logs.filter(log => {
        const logDate = new Date(log.date).toISOString().split('T')[0];
        return logDate === currentDate;
      });

      const present = dayLogs.filter(log => log.status === 'present' || log.status === 'late').length;
      const absent = allStudents.total - present;
      const percentage = allStudents.total > 0 ? Math.round((present / allStudents.total) * 100) : 0;

      totalPresent += present;
      totalAbsent += absent;

      dailyData.push({
        date: currentDate,
        dayOfWeek: new Date(currentDate).toLocaleDateString('en-IN', { weekday: 'short' }),
        present,
        absent,
        percentage,
        isWeekend: false,
        isHoliday: false
      });
    }

    const averageAttendance = totalWorkingDays > 0
      ? ((totalPresent / (totalWorkingDays * allStudents.total)) * 100).toFixed(1)
      : 0;

    // Calculate additional analytics

    // 1. Best and Worst Days
    const sortedDays = [...dailyData].sort((a, b) => b.percentage - a.percentage);
    const bestDay = sortedDays[0] || { date: null, percentage: 0, present: 0, absent: 0 };
    const worstDay = sortedDays[sortedDays.length - 1] || { date: null, percentage: 0, present: 0, absent: 0 };

    // 2. Weekly breakdown
    const weeks = [];
    let currentWeek = { days: [], total: 0, present: 0 };
    dailyData.forEach((day, index) => {
      const dayOfWeek = new Date(day.date).getDay();
      currentWeek.days.push(day);
      currentWeek.total += (day.present + day.absent);
      currentWeek.present += day.present;

      if (dayOfWeek === 6 || index === dailyData.length - 1) { // Saturday or last day
        weeks.push({
          weekNumber: weeks.length + 1,
          startDate: currentWeek.days[0].date,
          endDate: currentWeek.days[currentWeek.days.length - 1].date,
          avgAttendance: currentWeek.total > 0 ? Math.round((currentWeek.present / currentWeek.total) * 100) : 0,
          totalPresent: currentWeek.present,
          totalAbsent: currentWeek.total - currentWeek.present
        });
        currentWeek = { days: [], total: 0, present: 0 };
      }
    });

    // ✅ CRITICAL FIX: Use single JOIN query instead of O(n²) filtering (Bug #4)
    // Old code had nested loops: for each class, filter all students, then filter all logs
    // This caused 30-60 second timeouts for large schools
    const classWiseData = [];
    const classWiseQuery = await query(
      `SELECT
        c.id as class_id,
        c.class_name,
        COUNT(DISTINCT s.id) as total_students,
        COUNT(DISTINCT CASE
          WHEN al.status IN ('present', 'late') THEN al.id
          ELSE NULL
        END) as present_count
       FROM classes c
       LEFT JOIN students s ON c.id = s.class_id AND s.school_id = $1 AND s.is_active = TRUE
       LEFT JOIN attendance_logs al ON s.id = al.student_id
         AND al.school_id = $1
         AND al.date >= $2
         AND al.date <= $3
       WHERE c.school_id = $1 AND c.is_active = TRUE
       GROUP BY c.id, c.class_name
       ORDER BY c.class_name`,
      [schoolId, startDate, endDate]
    );

    for (const cls of classWiseQuery.rows) {
      const maxPossible = parseInt(cls.total_students) * totalWorkingDays;
      const presentCount = parseInt(cls.present_count);
      const classAttendance = maxPossible > 0 ? ((presentCount / maxPossible) * 100).toFixed(1) : 0;

      classWiseData.push({
        classId: cls.class_id,
        className: cls.class_name,
        totalStudents: parseInt(cls.total_students),
        presentCount,
        absentCount: maxPossible - presentCount,
        attendanceRate: parseFloat(classAttendance)
      });
    }

    // 4. Get students needing attention (below 75%)
    const studentsNeedingAttention = [];
    const perfectAttendance = [];

    for (const student of allStudents.students) {
      const studentLogs = attendanceLogs.logs.filter(log => log.student_id === student.id);
      const presentDays = studentLogs.filter(log => log.status === 'present' || log.status === 'late').length;
      const studentAttendance = totalWorkingDays > 0 ? ((presentDays / totalWorkingDays) * 100).toFixed(1) : 0;

      if (parseFloat(studentAttendance) < 75) {
        studentsNeedingAttention.push({
          ...student,
          presentDays,
          absentDays: totalWorkingDays - presentDays,
          attendanceRate: parseFloat(studentAttendance)
        });
      } else if (parseFloat(studentAttendance) === 100) {
        perfectAttendance.push({
          ...student,
          presentDays,
          attendanceRate: 100
        });
      }
    }

    // ✅ CRITICAL FIX: Use single query instead of O(n²) filtering for gender breakdown
    const genderQuery = await query(
      `SELECT
        s.gender,
        COUNT(DISTINCT s.id) as total_students,
        COUNT(DISTINCT CASE
          WHEN al.status IN ('present', 'late') THEN al.id
          ELSE NULL
        END) as present_count
       FROM students s
       LEFT JOIN attendance_logs al ON s.id = al.student_id
         AND al.school_id = $1
         AND al.date >= $2
         AND al.date <= $3
       WHERE s.school_id = $1 AND s.is_active = TRUE
       GROUP BY s.gender`,
      [schoolId, startDate, endDate]
    );

    const genderMap = new Map(genderQuery.rows.map(row => [row.gender, row]));
    const maleData = genderMap.get('Male') || genderMap.get('male') || { total_students: 0, present_count: 0 };
    const femaleData = genderMap.get('Female') || genderMap.get('female') || { total_students: 0, present_count: 0 };

    const maleStudentsCount = parseInt(maleData.total_students);
    const femaleStudentsCount = parseInt(femaleData.total_students);

    const maleAttendance = (maleStudentsCount * totalWorkingDays) > 0
      ? ((parseInt(maleData.present_count) / (maleStudentsCount * totalWorkingDays)) * 100).toFixed(1)
      : 0;

    const femaleAttendance = (femaleStudentsCount * totalWorkingDays) > 0
      ? ((parseInt(femaleData.present_count) / (femaleStudentsCount * totalWorkingDays)) * 100).toFixed(1)
      : 0;

    const report = {
      // Basic Info
      year: parseInt(year),
      month: parseInt(month),
      reportGeneratedAt: new Date().toISOString(),

      // Summary Statistics
      summary: {
        totalStudents: allStudents.total,
        totalDaysInMonth: lastDay,
        totalWorkingDays,
        totalSundays,
        totalHolidays,
        totalNonWorkingDays: totalSundays + totalHolidays,
        averageAttendance: parseFloat(averageAttendance),
        totalPresent,
        totalAbsent,
        totalLate: attendanceLogs.logs.filter(log => log.status === 'late').length,
        attendanceRate: parseFloat(averageAttendance),
        // Additional calculations
        maxPossibleAttendance: totalWorkingDays * allStudents.total,
        actualAttendance: totalPresent,
        attendanceGap: (totalWorkingDays * allStudents.total) - totalPresent
      },

      // Daily Data
      dailyData,

      // Day Analysis
      dayAnalysis: {
        bestDay: {
          date: bestDay.date,
          percentage: bestDay.percentage,
          present: bestDay.present
        },
        worstDay: {
          date: worstDay.date,
          percentage: worstDay.percentage,
          absent: worstDay.absent
        }
      },

      // Weekly Breakdown
      weeklyBreakdown: weeks,

      // Class-wise Performance
      classWisePerformance: classWiseData.sort((a, b) => b.attendanceRate - a.attendanceRate),

      // Gender-wise Breakdown
      genderBreakdown: {
        male: {
          totalStudents: maleStudentsCount,
          attendanceRate: parseFloat(maleAttendance)
        },
        female: {
          totalStudents: femaleStudentsCount,
          attendanceRate: parseFloat(femaleAttendance)
        }
      },

      // Alerts & Actions
      alerts: {
        studentsNeedingAttention: studentsNeedingAttention.sort((a, b) => a.attendanceRate - b.attendanceRate),
        perfectAttendance: perfectAttendance,
        lowAttendanceDays: dailyData.filter(day => day.percentage < 75).length
      },

      // Insights
      insights: {
        trend: weeks.length > 1 ?
          (weeks[weeks.length - 1].avgAttendance > weeks[0].avgAttendance ? 'improving' : 'declining') : 'stable',
        criticalStudents: studentsNeedingAttention.length,
        excellentStudents: perfectAttendance.length,
        averageClassPerformance: classWiseData.length > 0
          ? (classWiseData.reduce((sum, c) => sum + c.attendanceRate, 0) / classWiseData.length).toFixed(1)
          : 0
      }
    };

    console.log('📊 Comprehensive monthly report generated:', {
      totalDays: lastDay,
      sundays: totalSundays,
      holidays: totalHolidays,
      workingDays: totalWorkingDays,
      avgAttendance: averageAttendance,
      calculation: `${lastDay} - ${totalSundays} sundays - ${totalHolidays} holidays = ${totalWorkingDays} working days`,
      weeks: weeks.length,
      classes: classWiseData.length
    });

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
      studentId: studentId
    });

    // Calculate working days in the date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    let totalWorkingDays = 0;

    // Get holidays
    const holidaysResponse = await query(
      `SELECT holiday_date FROM holidays 
       WHERE school_id = $1 
       AND holiday_date >= $2 
       AND holiday_date <= $3
       AND is_active = TRUE`,
      [schoolId, startDate, endDate]
    );

    const holidayDates = new Set(
      holidaysResponse.rows.map(h => new Date(h.holiday_date).toISOString().split('T')[0])
    );

    // Count working days (exclude Sundays and holidays)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const dateStr = d.toISOString().split('T')[0];

      if (dayOfWeek !== 0 && !holidayDates.has(dateStr)) {
        totalWorkingDays++;
      }
    }

    // Calculate statistics
    const presentDays = logs.logs.filter(log => log.status === 'present').length;
    const lateDays = logs.logs.filter(log => log.status === 'late').length;
    const absentDays = totalWorkingDays - presentDays - lateDays;

    // Create detailed logs with all working days
    const detailedLogs = [];
    const logMap = new Map(logs.logs.map(log => [
      new Date(log.date).toISOString().split('T')[0],
      log
    ]));

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const dateStr = d.toISOString().split('T')[0];

      if (dayOfWeek === 0) {
        detailedLogs.push({
          date: dateStr,
          status: 'weekend',
          check_in_time: null,
          check_out_time: null,
          day: 'Sunday'
        });
      } else if (holidayDates.has(dateStr)) {
        detailedLogs.push({
          date: dateStr,
          status: 'holiday',
          check_in_time: null,
          check_out_time: null,
          day: new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short' })
        });
      } else {
        const log = logMap.get(dateStr);
        if (log) {
          detailedLogs.push({
            ...log,
            day: new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short' })
          });
        } else {
          detailedLogs.push({
            date: dateStr,
            status: 'absent',
            check_in_time: null,
            check_out_time: null,
            day: new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short' })
          });
        }
      }
    }

    const report = {
      student,
      dateRange: { startDate, endDate },
      statistics: {
        totalWorkingDays,
        presentDays,
        lateDays,
        absentDays,
        attendanceRate: totalWorkingDays > 0 ? ((presentDays + lateDays) / totalWorkingDays * 100).toFixed(1) : 0,
        // Additional stats
        totalDaysInRange: Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1,
        weekends: detailedLogs.filter(l => l.status === 'weekend').length,
        holidays: detailedLogs.filter(l => l.status === 'holiday').length
      },
      logs: detailedLogs
    };

    console.log(`📊 Student report for ${student.full_name}:`, {
      workingDays: totalWorkingDays,
      present: presentDays,
      late: lateDays,
      absent: absentDays,
      rate: report.statistics.attendanceRate
    });

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

    // Get class details
    const classData = await query(
      `SELECT * FROM classes WHERE id = $1 AND school_id = $2`,
      [classId, schoolId]
    );

    if (classData.rows.length === 0) {
      return sendError(res, 'Class not found', 404);
    }

    // Get all students in the class
    const students = await Student.findAll(schoolId, 1, 10000, {
      grade: classId,
      status: 'active'
    });

    // Get attendance data for the date range
    const logs = await AttendanceLog.getLogsForDateRange(schoolId, startDate, endDate);

    // Filter logs for this class
    const classLogs = logs.filter(log => String(log.grade) === String(classId) || String(log.class_id) === String(classId));

    // Process daily stats
    const dailyStats = {};
    let totalPresent = 0;
    let totalLate = 0;
    let totalAbsent = 0;

    classLogs.forEach(log => {
      const date = log.date.split('T')[0];
      if (!dailyStats[date]) dailyStats[date] = { present: 0, late: 0 };

      if (log.status === 'present') {
        dailyStats[date].present++;
        totalPresent++;
      } else if (log.status === 'late') {
        dailyStats[date].late++;
        totalLate++;
      }
    });

    const report = {
      classInfo: classData.rows[0],
      dateRange: { startDate, endDate },
      totalStudents: students.total,
      summary: {
        totalPresent,
        totalLate,
        avgAttendance: students.total > 0 ? ((totalPresent + totalLate) / (students.total * 30) * 100).toFixed(1) : 0 // Approx based on month
      },
      dailyStats
    };

    sendSuccess(res, report, 'Class report generated successfully');
  } catch (error) {
    console.error('Get class report error:', error);
    sendError(res, 'Failed to generate class report', 500);
  }
};

// Get weekly summary report (Optimized)
const getWeeklySummary = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;
    const { startDate } = req.query;

    if (!startDate) {
      return sendError(res, 'Start date is required', 400);
    }

    // Calculate total range: 4 weeks back
    const currentWeekStart = new Date(startDate);
    const rangeEndDate = new Date(currentWeekStart);
    rangeEndDate.setDate(rangeEndDate.getDate() + 6); // End of current week

    const rangeStartDate = new Date(currentWeekStart);
    rangeStartDate.setDate(rangeStartDate.getDate() - 21); // Start of 4th week back

    console.log(`📅 Generating weekly summary from ${rangeStartDate.toISOString()} to ${rangeEndDate.toISOString()}`);

    // Fetch ALL logs for the 4-week period in one query
    const logs = await AttendanceLog.getLogsForDateRange(
      schoolId,
      rangeStartDate.toISOString().split('T')[0],
      rangeEndDate.toISOString().split('T')[0]
    );

    const allStudents = await Student.findAll(schoolId, 1, 1, { status: 'active' });
    const totalStudents = allStudents.total;

    const weeks = [];

    // Process 4 weeks
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(weekStart.getDate() - (i * 7));

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const sTime = weekStart.getTime();
      const eTime = weekEnd.getTime();

      // Filter logs for this week in memory
      const weekLogs = logs.filter(log => {
        const logTime = new Date(log.date).getTime();
        return logTime >= sTime && logTime <= eTime;
      });

      // Calculate stats
      let totalPresent = 0;
      const presentSet = new Set();

      weekLogs.forEach(log => {
        if (log.status === 'present' || log.status === 'late') {
          totalPresent++;
          // SAFE DATE HANDLING: Convert log.date to ISO string before using it
          const logDateStr = new Date(log.date).toISOString().split('T')[0];
          presentSet.add(log.student_id + '_' + logDateStr); // Unique check-in per day
        }
      });

      // Assume 6 working days
      const maxPossible = totalStudents * 6;
      const avgAttendance = maxPossible > 0 ? Math.round((totalPresent / maxPossible) * 100) : 0;

      weeks.push({
        weekNumber: 4 - i,
        period: `${weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0],
        avgAttendance,
        totalPresent,
        totalAbsent: maxPossible - totalPresent,
        status: avgAttendance >= 90 ? 'Excellent' : avgAttendance >= 75 ? 'Good' : 'Poor'
      });
    }

    sendSuccess(res, { weeks: weeks.reverse() }, 'Weekly summary generated successfully');
  } catch (error) {
    console.error('Get weekly summary error:', error);
    sendError(res, 'Failed to generate weekly summary: ' + error.message, 500);
  }
};

// Get low attendance report
const getLowAttendance = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;
    const { threshold = 75 } = req.query; // Default 75%

    // Get date range (last 30 days)
    const endDate = new Date().toISOString().split('T')[0];
    const startDateObj = new Date();
    startDateObj.setDate(startDateObj.getDate() - 30);
    const startDate = startDateObj.toISOString().split('T')[0];

    // Get all students
    const allStudents = await Student.findAll(schoolId, 1, 10000, { status: 'active' });

    // Get attendance logs
    const logsList = await AttendanceLog.getLogsForDateRange(schoolId, startDate, endDate);

    const studentStats = {};

    // Initialize stats
    allStudents.students.forEach(s => {
      studentStats[s.id] = {
        ...s,
        present: 0,
        total: 30 // Approx working days calculation - simplified
      };
    });

    // Count present
    logsList.forEach(log => {
      if (studentStats[log.student_id]) {
        if (log.status === 'present' || log.status === 'late') {
          studentStats[log.student_id].present++;
        }
      }
    });

    // Filter low attendance
    const lowAttendanceStudents = Object.values(studentStats)
      .map(s => {
        const rate = Math.round((s.present / 24) * 100); // Assuming 24 working days in 30 days
        return {
          ...s,
          attendanceRate: rate,
          absentDays: 24 - s.present,
          totalDays: 24
        };
      })
      .filter(s => s.attendanceRate < threshold)
      .sort((a, b) => a.attendanceRate - b.attendanceRate);

    sendSuccess(res, {
      threshold,
      studentsCount: lowAttendanceStudents.length,
      students: lowAttendanceStudents
    }, 'Low attendance report generated');
  } catch (error) {
    console.error('Get low attendance error:', error);
    sendError(res, 'Failed to generate low attendance report', 500);
  }
};

// Get perfect attendance report
const getPerfectAttendance = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;

    // Get date range (current month)
    const date = new Date();
    const startDate = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    const endDate = date.toISOString().split('T')[0];

    // Get all students
    const allStudents = await Student.findAll(schoolId, 1, 10000, { status: 'active' });

    // Get attendance logs
    const logsList = await AttendanceLog.getLogsForDateRange(schoolId, startDate, endDate);

    const studentStats = {};
    const presentStudentIds = new Set();

    logsList.forEach(log => {
      if (log.status === 'present' || log.status === 'late') {
        presentStudentIds.add(log.student_id);
      }
      // If a student has ANY 'absent' log, they are disqualified
      // But here we just count presents
      if (!studentStats[log.student_id]) studentStats[log.student_id] = 0;
      if (log.status === 'present' || log.status === 'late') studentStats[log.student_id]++;
    });

    // Calculate working days passed roughly
    const daysPassed = new Date().getDate();
    const workingDaysEstimate = Math.max(1, daysPassed - Math.floor(daysPassed / 7)); // Exclude Sundays rough calc

    const perfectStudents = [];
    allStudents.students.forEach(student => {
      const presentDays = studentStats[student.id] || 0;
      // Simple check: if present days is close to working days estimate
      // Ideally we need exact working days count from holidays table
      if (presentDays >= workingDaysEstimate - 1) { // Tolerate 1 day discrepancy
        perfectStudents.push({
          ...student,
          attendanceRate: 100,
          presentDays,
          totalDays: workingDaysEstimate
        });
      }
    });

    sendSuccess(res, {
      studentsCount: perfectStudents.length,
      students: perfectStudents,
      dateRange: { startDate, endDate }
    }, 'Perfect attendance report generated');
  } catch (error) {
    console.error('Get perfect attendance error:', error);
    sendError(res, 'Failed to generate perfect attendance report', 500);
  }
};



// Get Day Pattern Analysis
const getDayPatternAnalysis = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) return sendError(res, 'Date range required', 400);

    const logs = await AttendanceLog.getLogsForDateRange(schoolId, startDate, endDate);
    const dayStats = {
      'Monday': { total: 0, count: 0 },
      'Tuesday': { total: 0, count: 0 },
      'Wednesday': { total: 0, count: 0 },
      'Thursday': { total: 0, count: 0 },
      'Friday': { total: 0, count: 0 },
      'Saturday': { total: 0, count: 0 },
      'Sunday': { total: 0, count: 0 }
    };

    // Calculate attendance per day
    const dayCounts = {}; // Track how many Mondays, Tuesdays etc passed

    logs.forEach(log => {
      if (log.status === 'present' || log.status === 'late') {
        const day = new Date(log.date).toLocaleDateString('en-US', { weekday: 'long' });
        if (dayStats[day]) {
          dayStats[day].total++;
        }
      }
    });

    // We need to know how many of each weekday were in the range to calculate average
    let d = new Date(startDate);
    const e = new Date(endDate);
    while (d <= e) {
      const day = d.toLocaleDateString('en-US', { weekday: 'long' });
      if (dayStats[day]) dayStats[day].count++;
      d.setDate(d.getDate() + 1);
    }

    const result = Object.keys(dayStats).map(day => ({
      day,
      avgAttendance: dayStats[day].count > 0 ? Math.round(dayStats[day].total / dayStats[day].count) : 0,
      totalDays: dayStats[day].count
    })).filter(d => d.totalDays > 0).sort((a, b) => b.avgAttendance - a.avgAttendance);

    sendSuccess(res, {
      dayWiseData: result,
      bestDay: result.length > 0 ? result[0].day : 'N/A',
      worstDay: result.length > 0 ? result[result.length - 1].day : 'N/A'
    }, 'Day pattern analysis generated');
  } catch (error) {
    console.error('Day pattern error:', error);
    sendError(res, 'Failed', 500);
  }
};

// Get Teacher Performance Report
const getTeacherPerformance = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;

    // Get all classes
    const classesRes = await query(`SELECT * FROM classes WHERE school_id = $1`, [schoolId]);
    const classes = classesRes.rows;

    // Get attendance for last 30 days
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const sDate = startDate.toISOString().split('T')[0];

    const logs = await AttendanceLog.getLogsForDateRange(schoolId, sDate, endDate);

    const classStats = {};
    classes.forEach(c => {
      classStats[c.id] = {
        teacherName: c.form_teacher_name || 'Not Assigned',
        className: c.class_name,
        present: 0,
        totalLogs: 0
      };
    });

    logs.forEach(log => {
      const cls = classes.find(c => c.class_name === log.grade || c.id === log.grade);
      if (cls && classStats[cls.id]) {
        classStats[cls.id].totalLogs++;
        if (log.status === 'present' || log.status === 'late') classStats[cls.id].present++;
      }
    });

    const data = Object.values(classStats).map(c => ({
      teacherName: c.teacherName,
      className: c.className,
      attendanceRate: c.totalLogs > 0 ? ((c.present / c.totalLogs) * 100).toFixed(1) : 0
    })).sort((a, b) => b.attendanceRate - a.attendanceRate);

    sendSuccess(res, { teachers: data }, 'Teacher performance generated');
  } catch (error) {
    console.error('Teacher performance error:', error);
    sendError(res, 'Failed', 500);
  }
};

// Get Late Arrival Analysis
const getLateArrivalsAnalysis = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;
    const { startDate, endDate } = req.query;

    const logs = await AttendanceLog.getLogsForDateRange(schoolId, startDate || new Date().toISOString().split('T')[0], endDate || new Date().toISOString().split('T')[0]);

    const lateLogs = logs.filter(l => l.status === 'late');

    // Calculate peak time
    const timeSlots = { '08:00-08:30': 0, '08:30-09:00': 0, '09:00-09:30': 0, '09:30+': 0 };
    lateLogs.forEach(l => {
      const time = l.check_in_time; // Format HH:MM:SS
      if (time >= '08:00' && time < '08:30') timeSlots['08:00-08:30']++;
      else if (time >= '08:30' && time < '09:00') timeSlots['08:30-09:00']++;
      else if (time >= '09:00' && time < '09:30') timeSlots['09:00-09:30']++;
      else timeSlots['09:30+']++;
    });

    // Frequent latecomers
    const lateStudents = {};
    lateLogs.forEach(l => {
      if (!lateStudents[l.student_id]) lateStudents[l.student_id] = { name: l.student_name, count: 0, class: l.grade };
      lateStudents[l.student_id].count++;
    });

    const topLate = Object.values(lateStudents).sort((a, b) => b.count - a.count).slice(0, 10);

    sendSuccess(res, {
      totalLate: lateLogs.length,
      peakTime: Object.keys(timeSlots).reduce((a, b) => timeSlots[a] > timeSlots[b] ? a : b),
      timeDistribution: timeSlots,
      frequentLateStudents: topLate
    }, 'Late analysis generated');
  } catch (error) {
    console.error('Late analysis error:', error);
    sendError(res, 'Failed', 500);
  }
};

// Get SMS Analytics
const getSmsAnalytics = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;
    const today = new Date().toISOString().split('T')[0];
    const logs = await AttendanceLog.findAll(schoolId, 1, 10000, { date: today });

    // Estimate SMS stats (since we don't have sms_logs table yet)
    let sent = 0;
    let typeBreakdown = { absent: 0, late: 0, notice: 0 };

    logs.logs.forEach(l => {
      if (l.status === 'late') { sent++; typeBreakdown.late++; }
    });

    const absentStudents = await AttendanceLog.getAbsentStudents(schoolId, today);
    sent += absentStudents.length;
    typeBreakdown.absent = absentStudents.length;

    sendSuccess(res, {
      totalSent: sent,
      delivered: Math.round(sent * 0.98),
      failed: Math.round(sent * 0.02),
      costEstimate: sent * 0.25,
      breakdown: typeBreakdown
    }, 'SMS analytics generated');
  } catch (error) {
    console.error('SMS analytics error:', error);
    sendError(res, 'Failed', 500);
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
  getWeeklySummary,
  getLowAttendance,
  getPerfectAttendance,
  getDayPatternAnalysis,
  getTeacherPerformance,
  getLateArrivalsAnalysis,
  getSmsAnalytics
};
