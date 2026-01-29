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

  /**
   * Permanently delete school and ALL related data
   * ⚠️ DANGER: This cannot be undone!
   */
  static async permanentDelete(id) {
    const { getClient } = require('../config/database');
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Get counts before deletion for summary
      const studentsCount = await client.query(
        'SELECT COUNT(*) FROM students WHERE school_id = $1',
        [id]
      );
      const attendanceCount = await client.query(
        'SELECT COUNT(*) FROM attendance_logs WHERE school_id = $1',
        [id]
      );
      const devicesCount = await client.query(
        'SELECT COUNT(*) FROM devices WHERE school_id = $1',
        [id]
      );
      const usersCount = await client.query(
        'SELECT COUNT(*) FROM users WHERE school_id = $1',
        [id]
      );

      // Get school name for audit
      const schoolResult = await client.query(
        'SELECT name FROM schools WHERE id = $1',
        [id]
      );
      const schoolName = schoolResult.rows[0]?.name || 'Unknown';

      // Delete in order respecting constraints (or rely on CASCADE)
      // Most tables have ON DELETE CASCADE, but explicit is safer

      // Delete attendance logs first
      await client.query('DELETE FROM attendance_logs WHERE school_id = $1', [id]);

      // Delete device commands
      await client.query(
        'DELETE FROM device_commands WHERE device_id IN (SELECT id FROM devices WHERE school_id = $1)',
        [id]
      );

      // Delete devices
      await client.query('DELETE FROM devices WHERE school_id = $1', [id]);

      // Delete leaves
      await client.query(
        'DELETE FROM leaves WHERE student_id IN (SELECT id FROM students WHERE school_id = $1)',
        [id]
      );

      // Delete students
      await client.query('DELETE FROM students WHERE school_id = $1', [id]);

      // Delete teacher class assignments
      await client.query(
        'DELETE FROM teacher_class_assignments WHERE teacher_id IN (SELECT id FROM teachers WHERE school_id = $1)',
        [id]
      );

      // Delete teachers
      await client.query('DELETE FROM teachers WHERE school_id = $1', [id]);

      // Delete sections (need to clear form_teacher_id first)
      await client.query(
        'UPDATE sections SET form_teacher_id = NULL WHERE class_id IN (SELECT id FROM classes WHERE school_id = $1)',
        [id]
      );
      await client.query(
        'DELETE FROM sections WHERE class_id IN (SELECT id FROM classes WHERE school_id = $1)',
        [id]
      );

      // Delete classes
      await client.query('DELETE FROM classes WHERE school_id = $1', [id]);

      // Delete holidays
      await client.query('DELETE FROM holidays WHERE school_id = $1', [id]);

      // Delete academic years
      await client.query('DELETE FROM academic_years WHERE school_id = $1', [id]);

      // Delete school settings
      await client.query('DELETE FROM school_settings WHERE school_id = $1', [id]);

      // Delete users (school admins/teachers)
      await client.query('DELETE FROM users WHERE school_id = $1', [id]);

      // Finally, delete the school itself
      await client.query('DELETE FROM schools WHERE id = $1', [id]);

      await client.query('COMMIT');

      return {
        success: true,
        schoolName,
        deletedCounts: {
          students: parseInt(studentsCount.rows[0].count),
          attendanceLogs: parseInt(attendanceCount.rows[0].count),
          devices: parseInt(devicesCount.rows[0].count),
          users: parseInt(usersCount.rows[0].count),
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ==========================================
  // WHATSAPP CREDIT MANAGEMENT METHODS
  // ==========================================

  /**
   * Get WhatsApp status for a school
   */
  static async getWhatsAppStatus(schoolId) {
    const result = await query(
      `SELECT whatsapp_enabled, whatsapp_credits, whatsapp_credits_used, 
              whatsapp_last_refill, whatsapp_low_credit_threshold
       FROM schools WHERE id = $1`,
      [schoolId]
    );
    return result.rows[0];
  }

  /**
   * Check if school can send WhatsApp (enabled + has credits)
   * @returns {boolean} true if WhatsApp is enabled AND credits > 0
   */
  static async canSendWhatsApp(schoolId) {
    const result = await query(
      `SELECT whatsapp_enabled, whatsapp_credits 
       FROM schools WHERE id = $1`,
      [schoolId]
    );
    const school = result.rows[0];
    return school?.whatsapp_enabled === true && school?.whatsapp_credits > 0;
  }

  /**
   * Decrement credit by 1 and return remaining credits
   * Only decrements if credits > 0
   * @returns {number} remaining credits after decrement
   */
  static async decrementWhatsAppCredit(schoolId) {
    const result = await query(
      `UPDATE schools 
       SET whatsapp_credits = whatsapp_credits - 1,
           whatsapp_credits_used = COALESCE(whatsapp_credits_used, 0) + 1
       WHERE id = $1 AND whatsapp_credits > 0
       RETURNING whatsapp_credits, whatsapp_low_credit_threshold`,
      [schoolId]
    );

    if (result.rows.length === 0) {
      return 0; // No credits or decrement failed
    }

    const { whatsapp_credits, whatsapp_low_credit_threshold } = result.rows[0];

    // Log low credit warning
    if (whatsapp_credits <= (whatsapp_low_credit_threshold || 50)) {
      console.warn(`⚠️ [CREDITS] School ${schoolId} is LOW on credits: ${whatsapp_credits} remaining`);
    }

    return whatsapp_credits;
  }

  /**
   * Add credits to a school (top-up)
   */
  static async addWhatsAppCredits(schoolId, credits) {
    const result = await query(
      `UPDATE schools 
       SET whatsapp_credits = COALESCE(whatsapp_credits, 0) + $2,
           whatsapp_last_refill = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [schoolId, credits]
    );
    return result.rows[0];
  }

  /**
   * Enable or disable WhatsApp for a school
   */
  static async setWhatsAppEnabled(schoolId, enabled) {
    const result = await query(
      `UPDATE schools 
       SET whatsapp_enabled = $2
       WHERE id = $1
       RETURNING *`,
      [schoolId, enabled]
    );
    return result.rows[0];
  }

  /**
   * Get all schools with low credits (for alert system)
   */
  static async getSchoolsWithLowCredits() {
    const result = await query(
      `SELECT id, name, email, whatsapp_credits, whatsapp_low_credit_threshold
       FROM schools
       WHERE whatsapp_enabled = TRUE 
       AND whatsapp_credits <= COALESCE(whatsapp_low_credit_threshold, 50)
       AND is_active = TRUE`
    );
    return result.rows;
  }
}

module.exports = School;
