const { query } = require('../config/database');

class AcademicYear {
  /**
   * Create a new academic year
   */
  static async create(yearData, schoolId) {
    // Accept both camelCase and snake_case
    const {
      year_name,
      yearName = year_name,
      start_date,
      startDate = start_date,
      end_date,
      endDate = end_date,
      working_days = 'Mon-Sat',
      workingDays = working_days,
      weekly_holiday = 'Sunday',
      weeklyHoliday = weekly_holiday
    } = yearData;

    const result = await query(
      `INSERT INTO academic_years (
        school_id, year_name, start_date, end_date, working_days, weekly_holiday, is_current
      ) VALUES ($1, $2, $3, $4, $5, $6, FALSE)
      RETURNING *`,
      [schoolId, yearName || year_name, startDate || start_date, endDate || end_date, workingDays || working_days, weeklyHoliday || weekly_holiday]
    );

    return result.rows[0];
  }

  /**
   * Get all academic years for a school
   */
  static async findAll(schoolId) {
    const result = await query(
      `SELECT * FROM academic_years
       WHERE school_id = $1
       ORDER BY start_date DESC`,
      [schoolId]
    );

    return result.rows;
  }

  /**
   * Get current academic year
   */
  static async getCurrent(schoolId) {
    const result = await query(
      `SELECT * FROM academic_years
       WHERE school_id = $1 AND is_current = TRUE
       LIMIT 1`,
      [schoolId]
    );

    return result.rows[0];
  }

  /**
   * Find academic year by ID
   */
  static async findById(id) {
    const result = await query(
      'SELECT * FROM academic_years WHERE id = $1',
      [id]
    );

    return result.rows[0];
  }

  /**
   * Update academic year
   */
  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = [
      'year_name',
      'start_date',
      'end_date',
      'working_days',
      'weekly_holiday'
    ];

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined && allowedFields.includes(key)) {
        paramCount++;
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
      }
    });

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);
    const result = await query(
      `UPDATE academic_years
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Set as current academic year
   * ✅ FIX: Also migrates teacher class assignments to the new year
   */
  static async setCurrent(id, schoolId) {
    // First, unset all other years as current for this school
    await query(
      'UPDATE academic_years SET is_current = FALSE WHERE school_id = $1',
      [schoolId]
    );

    // Then set this year as current
    const result = await query(
      `UPDATE academic_years
       SET is_current = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    const newYear = result.rows[0];

    // ✅ AUTO-MIGRATE: Update all teacher class assignments to the new academic year
    if (newYear) {
      const migrateResult = await query(
        `UPDATE teacher_class_assignments tca
         SET academic_year = $1, updated_at = CURRENT_TIMESTAMP
         FROM teachers t
         WHERE tca.teacher_id = t.id
         AND t.school_id = $2
         AND tca.academic_year != $1`,
        [newYear.year_name, schoolId]
      );

      const migratedCount = migrateResult.rowCount || 0;
      if (migratedCount > 0) {
        console.log(`✅ Migrated ${migratedCount} teacher assignments to ${newYear.year_name}`);
      }
    }

    return result.rows[0];
  }

  /**
   * Delete academic year
   */
  static async delete(id) {
    const result = await query(
      'DELETE FROM academic_years WHERE id = $1 RETURNING *',
      [id]
    );

    return result.rows[0];
  }

  /**
   * Get vacation periods for academic year
   */
  static async getVacationPeriods(academicYearId) {
    const result = await query(
      `SELECT * FROM vacation_periods
       WHERE academic_year_id = $1
       ORDER BY start_date ASC`,
      [academicYearId]
    );

    return result.rows;
  }

  /**
   * Add vacation period
   */
  static async addVacationPeriod(vacationData, academicYearId, schoolId) {
    const { vacationName, startDate, endDate, description } = vacationData;

    const result = await query(
      `INSERT INTO vacation_periods (
        school_id, academic_year_id, vacation_name, start_date, end_date, description
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [schoolId, academicYearId, vacationName, startDate, endDate, description]
    );

    return result.rows[0];
  }

  /**
   * Delete vacation period
   */
  static async deleteVacationPeriod(id) {
    const result = await query(
      'DELETE FROM vacation_periods WHERE id = $1 RETURNING *',
      [id]
    );

    return result.rows[0];
  }

  /**
   * Promote students to new academic year
   * This updates the academic_year field for all active students
   *
   * @param {number} schoolId - School ID
   * @param {string} fromYear - Source academic year (e.g., "2025-2026")
   * @param {string} toYear - Target academic year (e.g., "2026-2027")
   * @returns {Object} - Promotion statistics
   */
  static async promoteStudents(schoolId, fromYear, toYear) {
    try {
      // 1. Validate both academic years exist
      const fromYearCheck = await query(
        'SELECT id FROM academic_years WHERE school_id = $1 AND year_name = $2',
        [schoolId, fromYear]
      );

      const toYearCheck = await query(
        'SELECT id FROM academic_years WHERE school_id = $1 AND year_name = $2',
        [schoolId, toYear]
      );

      if (fromYearCheck.rows.length === 0) {
        throw new Error(`Source academic year "${fromYear}" not found`);
      }

      if (toYearCheck.rows.length === 0) {
        throw new Error(`Target academic year "${toYear}" not found`);
      }

      // 2. Get count of students to be promoted
      const countResult = await query(
        `SELECT COUNT(*) as total
         FROM students
         WHERE school_id = $1
         AND academic_year = $2
         AND is_active = TRUE`,
        [schoolId, fromYear]
      );

      const totalStudents = parseInt(countResult.rows[0].total);

      if (totalStudents === 0) {
        return {
          success: true,
          studentsPromoted: 0,
          message: `No active students found in academic year ${fromYear}`
        };
      }

      // 3. Disable the trigger temporarily to prevent it from reverting our changes
      await query('ALTER TABLE students DISABLE TRIGGER set_student_academic_year_trigger');

      let promotedStudents;
      try {
        // 4. Update students' academic year
        const updateResult = await query(
          `UPDATE students
           SET academic_year = $1, updated_at = CURRENT_TIMESTAMP
           WHERE school_id = $2
           AND academic_year = $3
           AND is_active = TRUE
           RETURNING id, full_name, roll_number`,
          [toYear, schoolId, fromYear]
        );

        promotedStudents = updateResult.rows;
      } finally {
        // 5. Always re-enable the trigger
        await query('ALTER TABLE students ENABLE TRIGGER set_student_academic_year_trigger');
      }

      // 4. Log the promotion action
      await query(
        `INSERT INTO system_logs (
          event_type, severity, description, school_id, created_at
        ) VALUES ($1, $2, $3, $4, NOW())`,
        [
          'academic_year_promotion',
          'info',
          `Promoted ${promotedStudents.length} students from ${fromYear} to ${toYear}`,
          schoolId
        ]
      );

      return {
        success: true,
        studentsPromoted: promotedStudents.length,
        fromYear,
        toYear,
        message: `Successfully promoted ${promotedStudents.length} students from ${fromYear} to ${toYear}`,
        students: promotedStudents
      };

    } catch (error) {
      console.error('Error promoting students:', error);
      throw error;
    }
  }

  /**
   * Get promotion preview - shows how many students will be promoted
   *
   * @param {number} schoolId - School ID
   * @param {string} fromYear - Source academic year
   * @returns {Object} - Preview statistics
   */
  static async getPromotionPreview(schoolId, fromYear) {
    try {
      // Get students by class breakdown
      const result = await query(
        `SELECT
          c.class_name,
          COUNT(s.id) as student_count
         FROM students s
         LEFT JOIN classes c ON s.class_id = c.id
         WHERE s.school_id = $1
         AND s.academic_year = $2
         AND s.is_active = TRUE
         GROUP BY c.class_name
         ORDER BY c.class_name`,
        [schoolId, fromYear]
      );

      const totalResult = await query(
        `SELECT COUNT(*) as total
         FROM students
         WHERE school_id = $1
         AND academic_year = $2
         AND is_active = TRUE`,
        [schoolId, fromYear]
      );

      return {
        totalStudents: parseInt(totalResult.rows[0].total),
        byClass: result.rows,
        fromYear
      };

    } catch (error) {
      console.error('Error getting promotion preview:', error);
      throw error;
    }
  }
}

module.exports = AcademicYear;
