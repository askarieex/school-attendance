const { query } = require('../config/database');

class Leave {
  /**
   * Create a new leave request
   */
  static async create(leaveData, schoolId) {
    const {
      studentId,
      leaveType,
      startDate,
      endDate,
      reason,
      appliedVia = 'manual',
      status = 'approved' // Auto-approve manual leaves from school admin
    } = leaveData;

    const result = await query(
      `INSERT INTO leaves (
        student_id, school_id, leave_type, start_date, end_date,
        reason, status, applied_via
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [studentId, schoolId, leaveType, startDate, endDate, reason, status, appliedVia]
    );

    return result.rows[0];
  }

  /**
   * Get all leaves for a school with filters
   */
  static async findAll(schoolId, filters = {}) {
    let whereClause = 'WHERE l.school_id = $1 AND l.is_active = TRUE';
    const params = [schoolId];
    let paramCount = 1;

    // Filter by student
    if (filters.studentId) {
      paramCount++;
      whereClause += ` AND l.student_id = $${paramCount}`;
      params.push(filters.studentId);
    }

    // Filter by status
    if (filters.status) {
      paramCount++;
      whereClause += ` AND l.status = $${paramCount}`;
      params.push(filters.status);
    }

    // Filter by date range
    if (filters.startDate && filters.endDate) {
      paramCount++;
      whereClause += ` AND (
        (l.start_date BETWEEN $${paramCount} AND $${paramCount + 1}) OR
        (l.end_date BETWEEN $${paramCount} AND $${paramCount + 1}) OR
        (l.start_date <= $${paramCount} AND l.end_date >= $${paramCount + 1})
      )`;
      params.push(filters.startDate, filters.endDate);
      paramCount++;
    }

    // Filter by month
    if (filters.month && filters.year) {
      paramCount++;
      whereClause += ` AND (
        EXTRACT(MONTH FROM l.start_date) = $${paramCount} OR
        EXTRACT(MONTH FROM l.end_date) = $${paramCount}
      ) AND (
        EXTRACT(YEAR FROM l.start_date) = $${paramCount + 1} OR
        EXTRACT(YEAR FROM l.end_date) = $${paramCount + 1}
      )`;
      params.push(filters.month, filters.year);
      paramCount++;
    }

    const result = await query(
      `SELECT l.*,
        s.full_name as student_name,
        s.roll_number,
        c.class_name,
        sec.section_name
       FROM leaves l
       JOIN students s ON l.student_id = s.id
       LEFT JOIN classes c ON s.class_id = c.id
       LEFT JOIN sections sec ON s.section_id = sec.id
       ${whereClause}
       ORDER BY l.start_date DESC`,
      params
    );

    return result.rows;
  }

  /**
   * Get leave by ID
   */
  static async findById(id) {
    const result = await query(
      `SELECT l.*,
        s.full_name as student_name,
        s.roll_number,
        c.class_name,
        sec.section_name
       FROM leaves l
       JOIN students s ON l.student_id = s.id
       LEFT JOIN classes c ON s.class_id = c.id
       LEFT JOIN sections sec ON s.section_id = sec.id
       WHERE l.id = $1`,
      [id]
    );

    return result.rows[0];
  }

  /**
   * Update leave
   */
  static async update(id, updates, userId = null) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = [
      'leave_type',
      'start_date',
      'end_date',
      'reason',
      'status'
    ];

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined && allowedFields.includes(key)) {
        paramCount++;
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
      }
    });

    // If status is being updated to approved, set approval metadata
    if (updates.status === 'approved' && userId) {
      paramCount++;
      fields.push(`approved_by = $${paramCount}`);
      values.push(userId);

      paramCount++;
      fields.push(`approved_at = $${paramCount}`);
      values.push(new Date());
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);
    const result = await query(
      `UPDATE leaves
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Delete leave (soft delete)
   */
  static async delete(id) {
    const result = await query(
      'UPDATE leaves SET is_active = FALSE WHERE id = $1 RETURNING *',
      [id]
    );

    return result.rows[0];
  }

  /**
   * Check if student has leave on specific date
   */
  static async hasLeaveOnDate(studentId, date) {
    const result = await query(
      `SELECT * FROM leaves
       WHERE student_id = $1
       AND start_date <= $2
       AND end_date >= $2
       AND status = 'approved'
       AND is_active = TRUE`,
      [studentId, date]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Get leaves for a specific month
   */
  static async getMonthlyLeaves(schoolId, year, month) {
    const result = await query(
      `SELECT l.*,
        s.full_name as student_name,
        s.id as student_id
       FROM leaves l
       JOIN students s ON l.student_id = s.id
       WHERE l.school_id = $1
       AND l.status = 'approved'
       AND l.is_active = TRUE
       AND (
         (EXTRACT(MONTH FROM l.start_date) = $2 AND EXTRACT(YEAR FROM l.start_date) = $3) OR
         (EXTRACT(MONTH FROM l.end_date) = $2 AND EXTRACT(YEAR FROM l.end_date) = $3) OR
         (l.start_date <= DATE($3 || '-' || $2 || '-01') AND l.end_date >= (DATE($3 || '-' || $2 || '-01') + INTERVAL '1 month - 1 day'))
       )
       ORDER BY l.start_date ASC`,
      [schoolId, month, year]
    );

    return result.rows;
  }
}

module.exports = Leave;
