const { query } = require('../config/database');

class AcademicYear {
  /**
   * Create a new academic year
   */
  static async create(yearData, schoolId) {
    const {
      yearName,
      startDate,
      endDate,
      workingDays = 'Mon-Sat',
      weeklyHoliday = 'Sunday'
    } = yearData;

    const result = await query(
      `INSERT INTO academic_years (
        school_id, year_name, start_date, end_date, working_days, weekly_holiday, is_current
      ) VALUES ($1, $2, $3, $4, $5, $6, FALSE)
      RETURNING *`,
      [schoolId, yearName, startDate, endDate, workingDays, weeklyHoliday]
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
}

module.exports = AcademicYear;
