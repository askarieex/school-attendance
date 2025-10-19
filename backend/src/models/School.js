const { query } = require('../config/database');

class School {
  /**
   * Create a new school
   */
  static async create(schoolData) {
    const { name, email, phone, address, plan = 'trial' } = schoolData;

    const result = await query(
      `INSERT INTO schools (name, email, phone, address, plan)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, email, phone, address, plan]
    );

    return result.rows[0];
  }

  /**
   * Find school by ID
   */
  static async findById(id) {
    const result = await query(
      'SELECT * FROM schools WHERE id = $1',
      [id]
    );

    return result.rows[0];
  }

  /**
   * Find school by email
   */
  static async findByEmail(email) {
    const result = await query(
      'SELECT * FROM schools WHERE email = $1',
      [email]
    );

    return result.rows[0];
  }

  /**
   * Get all schools with pagination
   */
  static async findAll(page = 1, limit = 10, search = '', status = null) {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;

    // Search filter
    if (search) {
      paramCount++;
      whereClause += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Status filter
    if (status !== null) {
      paramCount++;
      whereClause += ` AND is_active = $${paramCount}`;
      params.push(status);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM schools ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    params.push(limit, offset);
    const result = await query(
      `SELECT * FROM schools
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      params
    );

    return {
      schools: result.rows,
      total,
    };
  }

  /**
   * Update school
   */
  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        paramCount++;
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    const result = await query(
      `UPDATE schools
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Delete (deactivate) school
   */
  static async delete(id) {
    const result = await query(
      'UPDATE schools SET is_active = FALSE WHERE id = $1 RETURNING *',
      [id]
    );

    return result.rows[0];
  }

  /**
   * Get school statistics
   */
  static async getStats(schoolId) {
    // Get total students
    const studentsResult = await query(
      'SELECT COUNT(*) FROM students WHERE school_id = $1 AND is_active = TRUE',
      [schoolId]
    );

    // Get total devices
    const devicesResult = await query(
      'SELECT COUNT(*) FROM devices WHERE school_id = $1 AND is_active = TRUE',
      [schoolId]
    );

    // Get today's attendance
    const attendanceResult = await query(
      `SELECT COUNT(*) FROM attendance_logs
       WHERE school_id = $1 AND date = CURRENT_DATE`,
      [schoolId]
    );

    return {
      totalStudents: parseInt(studentsResult.rows[0].count),
      totalDevices: parseInt(devicesResult.rows[0].count),
      todayAttendance: parseInt(attendanceResult.rows[0].count),
    };
  }

  /**
   * Get platform-wide statistics (Super Admin)
   */
  static async getPlatformStats() {
    const schoolsResult = await query('SELECT COUNT(*) FROM schools WHERE is_active = TRUE');
    const studentsResult = await query('SELECT COUNT(*) FROM students WHERE is_active = TRUE');
    const devicesResult = await query('SELECT COUNT(*) FROM devices WHERE is_active = TRUE');

    return {
      totalSchools: parseInt(schoolsResult.rows[0].count),
      totalStudents: parseInt(studentsResult.rows[0].count),
      totalDevices: parseInt(devicesResult.rows[0].count),
    };
  }
}

module.exports = School;
