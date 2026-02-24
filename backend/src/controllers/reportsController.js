const AttendanceLog = require('../models/AttendanceLog');
const Student = require('../models/Student');
const AttendanceCalculator = require('../services/attendanceCalculator');
const { sendSuccess, sendError } = require('../utils/response');
const { query } = require('../config/database');
const { getCurrentDateIST } = require('../utils/timezone');

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

    // -------------------------------------------------------------------------
    // 🛑 REFACTORED: Use AttendanceCalculator to get Day Status (Holiday/Weekend)
    // -------------------------------------------------------------------------
    // Check if the requested date is Working/Holiday/Weekend
    const dayStatus = await AttendanceCalculator.getDayStatus(schoolId, date);
    // dayStatus = { type: 'HOLIDAY'|'WEEKEND'|'WORKING', name: '...' }

    // Build report with present and absent students
    const present = [];
    const absent = []; // Renamed contextually: "absent or holiday/weekend"

    allStudents.students.forEach(student => {
      // 1. Check for Log (Present/Late/Absent/Leave/Holiday)
      if (attendanceMap.has(student.id)) {
        const log = attendanceMap.get(student.id);
        const studentDataToPush = {
          ...student,
          checkInTime: log.check_in_time,
          checkOutTime: log.check_out_time,
          status: log.status
        };

        if (log.status === 'present' || log.status === 'late') {
          present.push(studentDataToPush);
        } else {
          // If the DB explicitly says 'absent', 'holiday', or 'weekend' in the log
          absent.push(studentDataToPush);
        }
      } else {
        // 2. No Log Found -> Check Day Status
        let status = 'absent'; // Default
        let notes = null;

        if (dayStatus.type === 'HOLIDAY') {
          status = 'holiday';
          notes = dayStatus.name;
        } else if (dayStatus.type === 'WEEKEND') {
          status = 'weekend';
          notes = dayStatus.name;
        }

        // Push to "absent" list but with correct status
        absent.push({
          ...student,
          status: status,
          notes: notes
        });
      }
    });


    // Calculate separate counts for On-Time vs Late
    const onTimeStudents = present.filter(s => s.status === 'present');
    const lateStudents = present.filter(s => s.status === 'late');

    // ✅ FIX D2: On holidays/weekends, attendance rate should be 'N/A' not 0%
    const isNonWorkingDay = dayStatus.type !== 'WORKING';
    const trueAbsentCount = absent.filter(s => s.status === 'absent').length;

    const report = {
      date,
      dayType: dayStatus.type, // 'WORKING', 'HOLIDAY', 'WEEKEND'
      dayName: dayStatus.name, // e.g. "Republic Day" or "Sunday"
      isNonWorkingDay,
      totalStudents: allStudents.total,
      presentCount: present.length, // Total Present (On-Time + Late)
      onTimeCount: onTimeStudents.length, // Students who arrived on time
      lateCount: lateStudents.length, // Students who arrived late
      absentCount: trueAbsentCount, // Only true absents
      holidayCount: absent.filter(s => s.status === 'holiday').length,
      weekendCount: absent.filter(s => s.status === 'weekend').length,
      attendanceRate: isNonWorkingDay ? 'N/A' : (allStudents.total > 0 ? ((present.length / allStudents.total) * 100).toFixed(2) : 0),
      punctualityRate: isNonWorkingDay ? 'N/A' : (allStudents.total > 0 ? ((onTimeStudents.length / allStudents.total) * 100).toFixed(2) : 0),
      present,
      absent: isNonWorkingDay ? [] : absent.filter(s => s.status === 'absent') // ✅ FIX D1: Only send truly absent students
    };

    console.log(`📊 Daily Report for ${date}:`, {
      dayType: dayStatus.type,
      totalStudents: allStudents.total,
      logsFound: attendanceLogs.logs.length,
      presentCount: present.length,
      absentCount: absent.filter(s => s.status === 'absent').length,
      holidayCount: absent.filter(s => s.status === 'holiday').length,
      weekendCount: absent.filter(s => s.status === 'weekend').length,
      presentStudents: present.map(s => `${s.full_name} (${s.status})`),
      absentStudents: absent.map(s => `${s.full_name} (${s.status})`)
    });

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

    // -------------------------------------------------------------------------
    // 🛑 REFACTORED: Use AttendanceCalculator for Daily Stats & Working Day Logic
    // -------------------------------------------------------------------------
    const dailyStats = await AttendanceCalculator.generateMonthlyCalendar(schoolId, startDate, endDate, logs);

    // Build daily data from Calculator results
    const dailyData = [];
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalWorkingDays = 0;
    let totalHolidays = 0;
    let totalSundays = 0; // Keeping variable name, but now tracks 'Weekends'

    // Get today's exact IST date string for robust comparison
    const todayIST = getCurrentDateIST();

    dailyStats.forEach(dayStat => {
      // ✅ Deep Fix: Avoid JS Date local timezone shifting by using string comparison
      // "2026-02-24" > "2026-02-23" is lexicographically correct
      if (dayStat.date > todayIST) {
        return; // Skip this day
      }

      // 1. Handle Weekends
      if (dayStat.isWeekend) {
        totalSundays++; // (Tracks all weekends like Sat/Sun)
        return;
      }

      // 2. Handle Holidays
      if (dayStat.isHoliday) {
        totalHolidays++;
        return;
      }

      // 3. Working Day
      totalWorkingDays++;

      const present = dayStat.present + dayStat.late;
      const absent = allStudents.total - present; // Calculate absent based on total students
      // Note: dayStat.absent comes from explicit "absent" logs (e.g. auto–absence). 
      // Implicit absence (no log) is covered by (Total - Present).

      const percentage = allStudents.total > 0 ? Math.round((present / allStudents.total) * 100) : 0;

      totalPresent += present;
      totalAbsent += absent;

      dailyData.push({
        date: dayStat.date,
        dayOfWeek: new Date(dayStat.date).toLocaleDateString('en-IN', { weekday: 'short' }),
        present,
        absent,
        percentage,
        isWeekend: false,
        isHoliday: false
      });
    });

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
      // ✅ Deep Fix: Use getUTCDay() for "YYYY-MM-DD" dates parsed as UTC midnight
      const dayOfWeek = new Date(day.date).getUTCDay();
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
    // ✅ FIX M3: Count unique student+date combos instead of al.id to prevent duplicate scan inflation
    const classWiseData = [];
    const classWiseQuery = await query(
      `SELECT
        c.id as class_id,
        c.class_name,
        COUNT(DISTINCT s.id) as total_students,
        COUNT(DISTINCT CASE
          WHEN al.status IN ('present', 'late') THEN CONCAT(al.student_id, '_', al.date)
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
      const studentLogs = logs.filter(log => log.student_id === student.id);
      const presentDays = studentLogs.filter(log => log.status === 'present' || log.status === 'late').length;
      const studentAttendance = totalWorkingDays > 0 ? ((presentDays / totalWorkingDays) * 100).toFixed(1) : 0;

      if (totalWorkingDays > 0) {
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
    }

    // ✅ CRITICAL FIX: Use single query instead of O(n²) filtering for gender breakdown
    // ✅ FIX: Count unique student+date combos to prevent duplicate scan inflation
    const genderQuery = await query(
      `SELECT
        s.gender,
        COUNT(DISTINCT s.id) as total_students,
        COUNT(DISTINCT CASE
          WHEN al.status IN ('present', 'late') THEN CONCAT(al.student_id, '_', al.date)
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
        // ✅ FIX M1: Only count on-time/late from working days (exclude holiday/weekend scans)
        totalOnTime: (() => {
          const workingDates = new Set(dailyData.map(d => d.date));
          return logs.filter(log => {
            const logDate = typeof log.date === 'string' ? log.date.split('T')[0] : new Date(log.date).toISOString().split('T')[0];
            return log.status === 'present' && workingDates.has(logDate);
          }).length;
        })(),
        totalLate: (() => {
          const workingDates = new Set(dailyData.map(d => d.date));
          return logs.filter(log => {
            const logDate = typeof log.date === 'string' ? log.date.split('T')[0] : new Date(log.date).toISOString().split('T')[0];
            return log.status === 'late' && workingDates.has(logDate);
          }).length;
        })(),
        punctualityRate: totalPresent > 0
          ? (((() => {
            const workingDates = new Set(dailyData.map(d => d.date));
            return logs.filter(log => {
              const logDate = typeof log.date === 'string' ? log.date.split('T')[0] : new Date(log.date).toISOString().split('T')[0];
              return log.status === 'present' && workingDates.has(logDate);
            }).length;
          })() / totalPresent) * 100).toFixed(1)
          : 0,
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

    // ✅ FIX S3: Use SQL-level filtering for student_id instead of fetching all school logs
    const studentLogs = await query(
      `SELECT
        al.id, al.student_id,
        TO_CHAR(al.date, 'YYYY-MM-DD') as date,
        al.check_in_time,
        NULL as check_out_time,
        al.status,
        al.created_at as timestamp,
        al.notes,
        s.full_name as student_name,
        s.rfid_card_id as rfid_uid,
        s.grade
       FROM attendance_logs al
       JOIN students s ON al.student_id = s.id
       WHERE al.school_id = $1
       AND al.student_id = $2
       AND al.date BETWEEN $3 AND $4
       ORDER BY al.date ASC, al.check_in_time ASC`,
      [schoolId, studentId, startDate, endDate]
    );
    const studentLogRows = studentLogs.rows;

    // -------------------------------------------------------------------------
    // 🛑 REFACTORED: Use AttendanceCalculator for Single Student logic
    // -------------------------------------------------------------------------
    const dailyStats = await AttendanceCalculator.generateMonthlyCalendar(schoolId, startDate, endDate, studentLogRows);

    // ✅ FIX S2: Skip future dates using robust IST string compare
    const todayIST = getCurrentDateIST();

    let totalWorkingDays = 0;
    const detailedLogs = [];

    dailyStats.forEach(dayStat => {
      const dateStr = dayStat.date;
      const dayName = new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short' });

      // Skip future dates using string compare
      if (dateStr > todayIST) return;

      // 1. Weekend
      if (dayStat.isWeekend) {
        detailedLogs.push({
          date: dateStr,
          status: 'weekend',
          check_in_time: null,
          check_out_time: null,
          day: dayName // e.g. "Sun" or "Fri" depending on setting
        });
        return;
      }

      // 2. Holiday
      if (dayStat.isHoliday) {
        detailedLogs.push({
          date: dateStr,
          status: 'holiday',
          check_in_time: null,
          check_out_time: null,
          day: dayName
        });
        return;
      }

      // 3. Working Day
      totalWorkingDays++;

      // Check if we have a log (Present/Late/Absent)
      // The calculator aggregates counts, but for detailed logs we want the actual log object if possible.
      // However, calculator result 'dayStat' implies status.
      // But we lost the 'check_in_time' in the calculator's aggregation?
      // Wait, AttendanceCalculator.generateMonthlyCalendar returns aggregated stats, NOT the raw log details.
      // 
      // FIX: We need to find the raw log for this date to get check_in_time.
      const originalLog = studentLogRows.find(l => {
        const logDate = typeof l.date === 'string' ? l.date.split('T')[0] : new Date(l.date).toISOString().split('T')[0];
        return logDate === dateStr;
      });

      if (originalLog) {
        detailedLogs.push({
          ...originalLog,
          day: dayName
        });
      } else {
        // No log found on a working day -> Implied Absent
        detailedLogs.push({
          date: dateStr,
          status: 'absent',
          check_in_time: null,
          check_out_time: null,
          day: dayName
        });
      }
    });

    // Calculate statistics from detailedLogs
    const presentDays = detailedLogs.filter(l => l.status === 'present').length;
    const lateDays = detailedLogs.filter(l => l.status === 'late').length;
    const absentDays = detailedLogs.filter(l => l.status === 'absent').length;
    const start = new Date(startDate);
    const end = new Date(endDate);

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

    // -------------------------------------------------------------------------
    // 🛑 REFACTORED: Use AttendanceCalculator Class-Wise Logic
    // -------------------------------------------------------------------------
    // 1. Get total working days count for the range
    const calendar = await AttendanceCalculator.generateMonthlyCalendar(schoolId, startDate, endDate, logs);
    let totalWorkingDays = 0;
    calendar.forEach(d => {
      if (!d.isWeekend && !d.isHoliday) totalWorkingDays++;
    });

    // 2. Process dails per class (keep for potential future use)
    const dailyStats = {};

    // 3. Process Per-Student Data (This is what the frontend actually needs!)
    let classTotalPresent = 0;
    let classTotalLate = 0;
    let classTotalAbsent = 0;
    let classTotalOnLeave = 0;

    const processedStudents = students.students.map(student => {
      // Find all logs for this specific student in the date range
      const sLogs = classLogs.filter(log => String(log.student_id) === String(student.id));

      let sPresent = 0;
      let sLate = 0;
      let sAbsent = 0;
      let sLeave = 0;

      // We only count absence against working days. 
      // A student's total attendance should be checked against totalWorkingDays.
      sLogs.forEach(l => {
        if (l.status === 'present') sPresent++;
        else if (l.status === 'late') sLate++;
        else if (l.status === 'absent') sAbsent++;
      });

      // Calculate missing absent days (if a student has no log on a working day, they are absent)
      const mappedDays = sPresent + sLate + sAbsent + sLeave;
      if (mappedDays < totalWorkingDays) {
        sAbsent += (totalWorkingDays - mappedDays);
      }

      classTotalPresent += sPresent;
      classTotalLate += sLate;
      classTotalAbsent += sAbsent;
      classTotalOnLeave += sLeave;

      const totalStudentLogs = sPresent + sLate;
      const sRate = totalWorkingDays > 0 ? ((totalStudentLogs / totalWorkingDays) * 100).toFixed(1) : 0;

      return {
        id: student.id,
        name: student.full_name,
        rollNumber: student.roll_number,
        present: sPresent,
        late: sLate,
        absent: sAbsent,
        onLeave: sLeave,
        attendanceRate: parseFloat(sRate)
      };
    });

    const maxPossibleAttendance = students.total * totalWorkingDays;
    const avgAttendance = maxPossibleAttendance > 0
      ? (((classTotalPresent + classTotalLate) / maxPossibleAttendance) * 100).toFixed(1)
      : 0;

    // The Frontend `renderClassReport` expects: classInfo, attendanceStats, students
    const report = {
      classInfo: {
        ...classData.rows[0],
        totalStudents: students.total
      },
      dateRange: { startDate, endDate },
      attendanceStats: {
        totalWorkingDays, // Just for reference
        present: classTotalPresent,
        late: classTotalLate,
        absent: classTotalAbsent,
        onLeave: classTotalOnLeave,
        attendanceRate: parseFloat(avgAttendance)
      },
      students: processedStudents, // Expected to have: rollNumber, name, present, absent, late, attendanceRate
      dailyStats // Keeping it in case other logic needs it
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

      // -------------------------------------------------------------------------
      // 🛑 REFACTORED: Use AttendanceCalculator to get true Working Days Count
      // -------------------------------------------------------------------------
      // We need to know how many working days were in THIS week (excluding Sun/Holidays)
      // Note: This forces a loop inside a loop, but for 4 weeks it's okay (4 calls).
      const weeklyCalendar = await AttendanceCalculator.generateMonthlyCalendar(
        schoolId,
        weekStart.toISOString().split('T')[0],
        weekEnd.toISOString().split('T')[0],
        weekLogs // Pass pre-filtered logs to avoid re-fetching
      );

      let workingDaysInWeek = 0;
      weeklyCalendar.forEach(day => {
        if (!day.isWeekend && !day.isHoliday) {
          workingDaysInWeek++;
        }
      });

      // Calculate stats
      let totalPresent = 0;

      // We can count distinct present students from the calendar aggregation
      // dailyStats has 'present + late' count for each day.
      // Total Present Man-Days = Sum (Daily Present Counts)
      // This is better than Set approach because a student present on Mon and Tue counts as 2 "Present Man-Days".
      // The previous logic counted "Attendance Rate" as (Total Present / Max Possible Man-Days).

      totalPresent = weeklyCalendar.reduce((sum, day) => sum + day.present + day.late, 0);

      // Max Possible = Total Students * Working Days
      const maxPossible = totalStudents * workingDaysInWeek;
      const avgAttendance = maxPossible > 0 ? Math.round((totalPresent / maxPossible) * 100) : 0;

      weeks.push({
        weekNumber: 4 - i,
        period: `${weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0],
        avgAttendance,
        totalPresent,
        totalAbsent: maxPossible - totalPresent,
        workingDays: workingDaysInWeek, // Added for clarity
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

    // -------------------------------------------------------------------------
    // 🛑 REFACTORED: Use AttendanceCalculator for Low Attendance
    // -------------------------------------------------------------------------
    const calendar = await AttendanceCalculator.generateMonthlyCalendar(schoolId, startDate, endDate, logsList);
    let totalWorkingDays = 0;
    calendar.forEach(d => {
      if (!d.isWeekend && !d.isHoliday) totalWorkingDays++;
    });

    const studentStats = {};

    // Initialize stats
    allStudents.students.forEach(s => {
      studentStats[s.id] = {
        ...s,
        present: 0,
        total: totalWorkingDays // Accurate!
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
        const rate = s.total > 0 ? Math.round((s.present / s.total) * 100) : 0;
        return {
          ...s,
          attendanceRate: rate,
          absentDays: s.total - s.present,
          totalDays: s.total
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

    // -------------------------------------------------------------------------
    // 🛑 REFACTORED: Use AttendanceCalculator for Perfect Attendance
    // -------------------------------------------------------------------------
    const calendar = await AttendanceCalculator.generateMonthlyCalendar(schoolId, startDate, endDate, logsList);
    let totalWorkingDays = 0;
    calendar.forEach(d => {
      if (!d.isWeekend && !d.isHoliday) totalWorkingDays++;
    });

    const perfectStudents = [];
    allStudents.students.forEach(student => {
      const presentDays = studentStats[student.id] || 0;

      // Strict Check: Must be present for ALL working days
      if (totalWorkingDays > 0 && presentDays === totalWorkingDays) {
        perfectStudents.push({
          ...student,
          attendanceRate: 100,
          presentDays,
          totalDays: totalWorkingDays
        });
      }
      // Tolerance of 0 days (Perfect means Perfect)
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

    // Fix: Calculate absent students correctly without missing method
    const allStudents = await Student.findAll(schoolId, 1, 10000, { status: 'active' });
    const presentCount = logs.logs.filter(l => l.status === 'present' || l.status === 'late').length;
    const absentCount = Math.max(0, allStudents.total - presentCount);

    sent += absentCount;
    typeBreakdown.absent = absentCount;

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
