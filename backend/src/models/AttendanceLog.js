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
    const today = new Date().toISOString().split('T')[0];

    // Get attendance breakdown
    const statsResult = await query(
      `SELECT
        status,
        COUNT(*) as count
       FROM attendance_logs
       WHERE school_id = $1 AND date = $2
       GROUP BY status`,
      [schoolId, today]
    );

    // Get total students (filter by current academic year if provided)
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
    };

    statsResult.rows.forEach((row) => {
      if (row.status === 'present') stats.presentToday = parseInt(row.count);
      if (row.status === 'late') stats.lateToday = parseInt(row.count);
    });

    stats.absentToday = total - (stats.presentToday + stats.lateToday);
    stats.attendanceRate = total > 0 ? ((stats.presentToday + stats.lateToday) / total * 100).toFixed(2) : 0;

    return stats;
  }

  /**
   * Get all attendance logs with pagination and filters
   */
  static async findAll(schoolId, page = 1, limit = 20, filters = {}) {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE al.school_id = $1';
    const params = [schoolId];
    let paramCount = 1;

    // Filter by date
    if (filters.date) {
      paramCount++;
      whereClause += ` AND al.date = $${paramCount}`;
      params.push(filters.date);
    }

    // Filter by status
    if (filters.status) {
      paramCount++;
      whereClause += ` AND al.status = $${paramCount}`;
      params.push(filters.status);
    }

    // Filter by search (student name or RFID)
    if (filters.search) {
      paramCount++;
      whereClause += ` AND (s.full_name ILIKE $${paramCount} OR s.rfid_card_id ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM attendance_logs al
       JOIN students s ON al.student_id = s.id
       ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    params.push(limit, offset);
    const result = await query(
      `SELECT
        al.id,
        al.student_id,
        al.date,
        al.check_in_time,
        NULL as check_out_time,
        al.status,
        al.created_at as timestamp,
        s.full_name as student_name,
        s.rfid_card_id as rfid_uid,
        s.grade,
        d.device_name
       FROM attendance_logs al
       JOIN students s ON al.student_id = s.id
       LEFT JOIN devices d ON al.device_id = d.id
       ${whereClause}
       ORDER BY al.date DESC, al.check_in_time DESC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      params
    );

    return {
      logs: result.rows,
      total: total,
    };
  }

  /**
   * Get recent check-ins for a school
   */
  static async getRecentCheckins(schoolId, limit = 20) {
    const result = await query(
      `SELECT
        al.*,
        s.full_name,
        s.grade,
        s.photo_url
       FROM attendance_logs al
       JOIN students s ON al.student_id = s.id
       WHERE al.school_id = $1
       AND al.date = CURRENT_DATE
       ORDER BY al.check_in_time DESC
       LIMIT $2`,
      [schoolId, limit]
    );

    return result.rows;
  }

  /**
   * Get attendance report for a date range
   */
  static async getReport(schoolId, startDate, endDate, filters = {}) {
    let whereClause = 'WHERE al.school_id = $1 AND al.date BETWEEN $2 AND $3';
    const params = [schoolId, startDate, endDate];
    let paramCount = 3;

    // Filter by grade
    if (filters.grade) {
      paramCount++;
      whereClause += ` AND s.grade = $${paramCount}`;
      params.push(filters.grade);
    }

    // Filter by status
    if (filters.status) {
      paramCount++;
      whereClause += ` AND al.status = $${paramCount}`;
      params.push(filters.status);
    }

    const result = await query(
      `SELECT
        al.*,
        s.full_name,
        s.grade,
        s.rfid_card_id
       FROM attendance_logs al
       JOIN students s ON al.student_id = s.id
       ${whereClause}
       ORDER BY al.date DESC, al.check_in_time DESC`,
      params
    );

    return result.rows;
  }

  /**
   * Get student's attendance history
   */
  static async getStudentHistory(studentId, days = 30) {
    const result = await query(
      `SELECT * FROM attendance_logs
       WHERE student_id = $1
       AND date >= CURRENT_DATE - $2 * INTERVAL '1 day'
       ORDER BY date DESC`,
      [studentId, days]
    );

    return result.rows;
  }

  /**
   * Get absent students for a specific date
   */
  static async getAbsentStudents(schoolId, date, academicYear = null) {
    let whereClause = 'WHERE s.school_id = $1 AND s.is_active = TRUE';
    const params = [schoolId, date];

    // Filter by academic year if provided
    if (academicYear) {
      whereClause += ' AND s.academic_year = $3';
      params.push(academicYear);
    }

    const result = await query(
      `SELECT s.*
       FROM students s
       ${whereClause}
       AND NOT EXISTS (
         SELECT 1 FROM attendance_logs al
         WHERE al.student_id = s.id
         AND al.date = $2
       )
       ORDER BY s.full_name`,
      params
    );

    return result.rows;
  }

  /**
   * Mark SMS as sent
   */
  static async markSmsSent(id) {
    await query(
      'UPDATE attendance_logs SET sms_sent = TRUE WHERE id = $1',
      [id]
    );
  }

  /**
   * Update attendance log notes
   */
  static async updateNotes(id, notes) {
    const result = await query(
      'UPDATE attendance_logs SET notes = $1 WHERE id = $2 RETURNING *',
      [notes, id]
    );

    return result.rows[0];
  }

  /**
   * Get attendance logs for a date range (BATCH API for performance)
   * This replaces the need for 31 separate API calls
   */
  static async getLogsForDateRange(schoolId, startDate, endDate) {
    const result = await query(
      `SELECT
        al.id,
        al.student_id,
        al.date,
        al.check_in_time,
        NULL as check_out_time,
        al.status,
        al.created_at as timestamp,
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

    return result.rows;
  }

  /**
   * Get attendance statistics for date range (for analytics)
   */
  static async getAnalytics(schoolId, startDate, endDate) {
    const result = await query(
      `SELECT
        date,
        status,
        COUNT(*) as count
       FROM attendance_logs
       WHERE school_id = $1
       AND date BETWEEN $2 AND $3
       GROUP BY date, status
       ORDER BY date DESC`,
      [schoolId, startDate, endDate]
    );

    return result.rows;
  }
}

module.exports = AttendanceLog;
