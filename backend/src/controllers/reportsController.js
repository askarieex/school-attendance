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
    const attendanceLogs = await AttendanceLog.findAll(schoolId, 1, 10000, { 
      startDate,
      endDate 
    });

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
    const bestDay = sortedDays[0];
    const worstDay = sortedDays[sortedDays.length - 1];

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

    // 3. Get class-wise breakdown
    const classWiseData = [];
    const classesResponse = await query(
      `SELECT c.id, c.class_name, COUNT(DISTINCT s.id) as student_count
       FROM classes c
       LEFT JOIN students s ON c.id = s.class_id AND s.school_id = $1 AND s.is_active = TRUE
       WHERE c.school_id = $1 AND c.is_active = TRUE
       GROUP BY c.id, c.class_name
       ORDER BY c.class_name`,
      [schoolId]
    );

    for (const cls of classesResponse.rows) {
      const classStudents = allStudents.students.filter(s => s.class_id === cls.id);
      const classLogs = attendanceLogs.logs.filter(log => {
        const student = allStudents.students.find(s => s.id === log.student_id);
        return student && student.class_id === cls.id;
      });
      
      const presentCount = classLogs.filter(log => log.status === 'present' || log.status === 'late').length;
      const maxPossible = classStudents.length * totalWorkingDays;
      const classAttendance = maxPossible > 0 ? ((presentCount / maxPossible) * 100).toFixed(1) : 0;
      
      classWiseData.push({
        classId: cls.id,
        className: cls.class_name,
        totalStudents: classStudents.length,
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

    // 5. Gender-wise breakdown
    const maleStudents = allStudents.students.filter(s => s.gender === 'male');
    const femaleStudents = allStudents.students.filter(s => s.gender === 'female');
    
    const maleLogs = attendanceLogs.logs.filter(log => {
      const student = allStudents.students.find(s => s.id === log.student_id);
      return student && student.gender === 'male' && (log.status === 'present' || log.status === 'late');
    });
    
    const femaleLogs = attendanceLogs.logs.filter(log => {
      const student = allStudents.students.find(s => s.id === log.student_id);
      return student && student.gender === 'female' && (log.status === 'present' || log.status === 'late');
    });

    const maleAttendance = (maleStudents.length * totalWorkingDays) > 0 
      ? ((maleLogs.length / (maleStudents.length * totalWorkingDays)) * 100).toFixed(1)
      : 0;
    
    const femaleAttendance = (femaleStudents.length * totalWorkingDays) > 0
      ? ((femaleLogs.length / (femaleStudents.length * totalWorkingDays)) * 100).toFixed(1)
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
          totalStudents: maleStudents.length,
          attendanceRate: parseFloat(maleAttendance)
        },
        female: {
          totalStudents: femaleStudents.length,
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
