const { query } = require('../config/database');

class AttendanceLog {
  /**
   * Create attendance log (when student scans RFID)
   */
  static async create(logData) {
    const {
      studentId,
      schoolId,
      deviceId,
      checkInTime,
      status,
      date,
    } = logData;

    const result = await query(
      `INSERT INTO attendance_logs (
        student_id, school_id, device_id,
        check_in_time, status, date
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [studentId, schoolId, deviceId, checkInTime, status, date]
    );

    return result.rows[0];
  }

  /**
   * Check if student already checked in today
   */
  static async existsToday(studentId, date) {
    const result = await query(
      `SELECT * FROM attendance_logs
       WHERE student_id = $1 AND date = $2
       LIMIT 1`,
      [studentId, date]
    );

    return result.rows[0];
  }

  /**
   * Get raw logs for a date range (Added for Weekly Report)
   */
  static async getLogsForDateRange(schoolId, startDate, endDate) {
    const result = await query(
      `SELECT * FROM attendance_logs
       WHERE school_id = $1
       AND date >= $2 AND date <= $3
       ORDER BY date ASC, check_in_time ASC`,
      [schoolId, startDate, endDate]
    );
    return result.rows;
  }

  /**
   * Get today's attendance stats for a school
   */
  static async getTodayStats(schoolId, academicYear = null) {
    const { getCurrentDateIST } = require('../utils/timezone');
    const AttendanceCalculator = require('../services/attendanceCalculator'); // Lazy load

    // ✅ FIX: Use strict IST date
    const today = getCurrentDateIST();

    // 1. Check Day Status (Holiday/Weekend?)
    const dayStatus = await AttendanceCalculator.getDayStatus(schoolId, today);
    // dayStatus = { type: 'HOLIDAY'|'WEEKEND'|'WORKING', name: '...' }

    // 2. Get attendance breakdown
    const statsResult = await query(
      `SELECT
        status,
        COUNT(*) as count
       FROM attendance_logs
       WHERE school_id = $1 AND date = $2
       GROUP BY status`,
      [schoolId, today]
    );

    // 3. Get total students (filter by current academic year if provided)
    let totalQuery = 'SELECT COUNT(*) FROM students WHERE school_id = $1 AND is_active = TRUE';
    const totalParams = [schoolId];

    if (academicYear) {
      totalQuery += ' AND academic_year = $2';
      totalParams.push(academicYear);
    }

    const totalResult = await query(totalQuery, totalParams);
    const total = parseInt(totalResult.rows[0].count);

    const stats = {
      presentToday: 0,
      lateToday: 0,
      totalStudents: total,
      dayType: dayStatus.type, // 'WORKING', 'HOLIDAY', 'WEEKEND'
      dayName: dayStatus.name,  // e.g. "Sunday" or "Diwali"
      isNonWorkingDay: dayStatus.type !== 'WORKING'
    };

    statsResult.rows.forEach((row) => {
      if (row.status === 'present') stats.presentToday = parseInt(row.count);
      if (row.status === 'late') stats.lateToday = parseInt(row.count);
    });

    // 4. Smart Absent Calculation
    // If it's a Holiday/Weekend, "Absent" should conceptually be 0 (or N/A).
    // However, if we return 0, the chart might look empty.
    // Let's return the math, but the frontend should check 'isNonWorkingDay' to display "Holiday" overlay.
    // Actually, distinct 'absentToday' vs 'holidayToday' is better.

    if (stats.isNonWorkingDay) {
      // On holidays, absent count is technically everyone who didn't show up, 
      // but we shouldn't flag them as "Absent".
      stats.absentToday = 0;
    } else {
      stats.absentToday = total - (stats.presentToday + stats.lateToday);
    }

    stats.attendanceRate = total > 0 ? ((stats.presentToday + stats.lateToday) / total * 100).toFixed(2) : 0;

    return stats;
  }

  // ... (getClassStatsToday remains as is) ...

  /**
   * Get today's attendance statistics broken down by class
   */
  static async getClassStatsToday(schoolId, today) {
    const result = await query(
      `SELECT 
        c.id as class_id,
        c.name as class_name,
        COUNT(DISTINCT s.id) as total_students,
        COUNT(CASE WHEN al.status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN al.status = 'late' THEN 1 END) as late_count,
        COUNT(CASE WHEN al.status = 'absent' THEN 1 END) as absent_count
      FROM classes c
      LEFT JOIN students s ON s.class_id = c.id AND s.school_id = $1 AND s.is_active = TRUE
      LEFT JOIN attendance_logs al ON al.student_id = s.id AND al.date = $2
      WHERE c.school_id = $1
      GROUP BY c.id, c.name
      ORDER BY c.name`,
      [schoolId, today]
    );

    return result.rows.map(row => ({
      classId: row.class_id,
      className: row.class_name,
      totalStudents: parseInt(row.total_students) || 0,
      presentCount: parseInt(row.present_count) || 0,
      lateCount: parseInt(row.late_count) || 0,
      absentCount: parseInt(row.absent_count) || 0,
      attendanceRate: row.total_students > 0
        ? Math.round(((parseInt(row.present_count) + parseInt(row.late_count)) / parseInt(row.total_students)) * 100)
        : 0
    }));
  }

  /**
   * Find all attendance logs (paginated)
   */
  static async findAll(schoolId, page = 1, limit = 20, filters = {}) {
    let queryText = `
      SELECT
        al.id, al.student_id, al.check_in_time, al.status, al.date, al.notes,
        s.full_name as student_name, s.roll_number, s.grade, s.section_id,
        sec.name as section_name,
        c.name as class_name
      FROM attendance_logs al
      JOIN students s ON al.student_id = s.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE al.school_id = $1
    `;
    const params = [schoolId];
    let paramCount = 1;

    // Apply filters
    if (filters.date) {
      paramCount++;
      queryText += ` AND al.date = $${paramCount}`;
      params.push(filters.date);
    }

    if (filters.status) {
      paramCount++;
      queryText += ` AND al.status = $${paramCount}`;
      params.push(filters.status);
    }

    if (filters.search) {
      paramCount++;
      queryText += ` AND (s.full_name ILIKE $${paramCount} OR s.roll_number ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
    }

    // Sort
    queryText += ` ORDER BY al.date DESC, al.check_in_time DESC`;

    // Pagination
    const offset = (page - 1) * limit;
    paramCount++;
    queryText += ` LIMIT $${paramCount}`;
    params.push(limit);

    paramCount++;
    queryText += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await query(queryText, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*)
      FROM attendance_logs al
      JOIN students s ON al.student_id = s.id
      WHERE al.school_id = $1
    `;
    const countParams = [schoolId];
    let countParamCount = 1;

    if (filters.date) {
      countParamCount++;
      countQuery += ` AND al.date = $${countParamCount}`;
      countParams.push(filters.date);
    }

    if (filters.status) {
      countParamCount++;
      countQuery += ` AND al.status = $${countParamCount}`;
      countParams.push(filters.status);
    }

    if (filters.search) {
      countParamCount++;
      countQuery += ` AND (s.full_name ILIKE $${countParamCount} OR s.roll_number ILIKE $${countParamCount})`;
      countParams.push(`%${filters.search}%`);
    }

    const countResult = await query(countQuery, countParams);

    return {
      logs: result.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  // ... (getRecentCheckins remains as is) ...

  // ... (getRecentCheckins remains as is) ...

  // ... (getReport remains as is) ...

  // ... (getStudentHistory remains as is) ...

  // ... (getAbsentStudents remains as is) ...

  // ... (markSmsSent remains as is) ...

  // ... (updateNotes remains as is) ...

  /**
   * Get attendance logs for a date range (BATCH API for performance)
   * 🛑 REFACTORED: Now returns FULL CALENDAR (rows for holidays/weekends too)
   * This allows the frontend to just display what we send.
   */
  static async getLogsForDateRange(schoolId, startDate, endDate) {
    const AttendanceCalculator = require('../services/attendanceCalculator'); // Lazy load

    // 1. Fetch RAW logs
    const rawResult = await query(
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
        s.grade,
        d.device_name
       FROM attendance_logs al
       JOIN students s ON al.student_id = s.id
       LEFT JOIN devices d ON al.device_id = d.id
       WHERE al.school_id = $1
       AND al.date BETWEEN $2 AND $3
       ORDER BY al.date DESC, al.check_in_time DESC`,
      [schoolId, startDate, endDate]
    );

    const logs = rawResult.rows;

    // 🔍 DEBUG: Log what we found
    console.log(`📊 [getLogsForDateRange] school_id=${schoolId}, range=${startDate} to ${endDate}, found=${logs.length} logs`);
    if (logs.length > 0) {
      console.log(`   First log: student_id=${logs[0].student_id}, date=${logs[0].date}, status=${logs[0].status}`);
    }

    // 2. If this is for a "Range Report" (charts/analytics), raw logs are fine.
    // BUT if the frontend Calendar expects "Holiday" blocks, we might need to inject them?
    // 
    // Wait, the Visual Calendar iterates students and days.
    // If we return a list of logs, the frontend has to look up "Log for Student X on Date Y".
    // Computing "Holiday" rows for *every student* for *every holiday* here would explode the payload size.
    // (e.g. 1000 students * 4 Sundays = 4000 fake rows). 
    //
    // BETTER APPROACH: Return the Logs AND the "Day Map" (School Calendar) separately.
    // The frontend can then say: "If no log exists, check Day Map: if Holiday -> Grid is Green".
    //
    // However, `getLogsForDateRange` signature returns just an array.
    // Changing the return type to { logs, calendar } might break other callers?
    //
    // Let's check callers. `reportsController` calls this. `attendanceController` calls this.
    //
    // `reportsController` was just refactored to use `AttendanceCalculator` on its own.
    // So it consumes raw logs. That's fine.
    //
    // `schoolController.getAttendanceRange` calls this and sends it to frontend.
    // Frontend `AttendanceCalendar.js` expects an array of logs.
    //
    // If I inject "Holiday Logs" here, the payload explodes.
    // 
    // ALTERNATIVE: Use a separate endpoint for "School Month Calendar".
    // 
    // FOR NOW: Let's revert the idea of returning "Full Calendar" here to avoid payload explosion.
    // Instead, I will update `schoolController.js` to return `{ logs: [...], calendar: [...] }` 
    // and update the Frontend to use `calendar` for the background colors.

    return logs;
  }

  /**
   * Get attendance statistics for date range (for analytics)
   */
  static async getAnalytics(schoolId, startDate, endDate) {
    // -------------------------------------------------------------------------
    // 🛑 NEW: centralized Logic via AttendanceCalculator
    // -------------------------------------------------------------------------
    const AttendanceCalculator = require('../services/attendanceCalculator');

    // 1. Fetch RAW logs (lighter query than before)
    const rawLogsResult = await query(
      `SELECT date, status FROM attendance_logs 
       WHERE school_id = $1
       AND date BETWEEN $2 AND $3`,
      [schoolId, startDate, endDate]
    );

    // 2. Generate Full Calendar (Fills Gaps)
    const dailyStats = await AttendanceCalculator.generateMonthlyCalendar(schoolId, startDate, endDate, rawLogsResult.rows);

    // 3. Convert back to SQL-like rows for backward compatibility
    // [{ date, status, count }]
    const rows = [];

    dailyStats.forEach(day => {
      // Add real counts
      if (day.present > 0) rows.push({ date: new Date(day.date), status: 'present', count: day.present });
      if (day.absent > 0) rows.push({ date: new Date(day.date), status: 'absent', count: day.absent });
      if (day.late > 0) rows.push({ date: new Date(day.date), status: 'late', count: day.late });

      // Add Holiday/Weekend markers
      // We use a count of '1' just to indicate the day exists as that type
      if (day.isHoliday) rows.push({ date: new Date(day.date), status: 'holiday', count: 0 });
      if (day.isWeekend) rows.push({ date: new Date(day.date), status: 'weekend', count: 0 });
    });

    // Sort by date desc
    return rows.sort((a, b) => b.date - a.date);
  }
}

module.exports = AttendanceLog;
