const { query } = require('../config/database');

class Holiday {
  /**
   * Create a new holiday
   */
  static async create(holidayData, schoolId) {
    const {
      holidayName,
      holidayDate,
      holidayType = 'national',
      description,
      isRecurring = false // New field
    } = holidayData;

    const result = await query(
      `INSERT INTO holidays (
        school_id, holiday_name, holiday_date, holiday_type, description, is_recurring
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [schoolId, holidayName, holidayDate, holidayType, description, isRecurring]
    );

    return result.rows[0];
  }

  /**
   * Get all holidays for a school
   */
  static async findAll(schoolId, filters = {}) {
    let whereClause = 'WHERE school_id = $1 AND is_active = TRUE';
    const params = [schoolId];
    let paramCount = 1;

    // Filter by year
    if (filters.year) {
      paramCount++;
      whereClause += ` AND EXTRACT(YEAR FROM holiday_date) = $${paramCount}`;
      params.push(filters.year);
    }

    // Filter by holiday type
    if (filters.holidayType) {
      paramCount++;
      whereClause += ` AND holiday_type = $${paramCount}`;
      params.push(filters.holidayType);
    }

    // Filter by date range
    if (filters.startDate && filters.endDate) {
      paramCount++;
      whereClause += ` AND holiday_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(filters.startDate, filters.endDate);
      paramCount++;
    }

    // For recurring holidays: match by month and day, ignoring year
    // For non-recurring: match by year AND (month/day OR explicit year filter)
    // This query returns:
    //   1. All non-recurring holidays for the specified year
    //   2. All recurring holidays (regardless of their stored year)
    const result = await query(
      `SELECT *, 
        CASE WHEN is_recurring THEN 
          TO_CHAR(holiday_date, 'MM-DD') 
        ELSE 
          TO_CHAR(holiday_date, 'YYYY-MM-DD') 
        END as sort_key
       FROM holidays
       ${whereClause}
       ORDER BY 
         CASE WHEN is_recurring THEN 
           EXTRACT(MONTH FROM holiday_date) * 100 + EXTRACT(DAY FROM holiday_date)
         ELSE 
           holiday_date 
         END ASC`,
      params
    );

    return result.rows;
  }

  /**
   * Find holiday by ID
   */
  static async findById(id) {
    const result = await query(
      'SELECT * FROM holidays WHERE id = $1',
      [id]
    );

    return result.rows[0];
  }

  /**
   * Update holiday
   */
  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = [
      'holiday_name',
      'holiday_date',
      'holiday_type',
      'description',
      'is_active',
      'is_recurring' // New field
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
      `UPDATE holidays
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Delete holiday
   */
  static async delete(id) {
    const result = await query(
      'UPDATE holidays SET is_active = FALSE WHERE id = $1 RETURNING *',
      [id]
    );

    return result.rows[0];
  }

  /**
   * Check if date is a holiday
   */
  static async isHoliday(date, schoolId) {
    const result = await query(
      `SELECT * FROM holidays
       WHERE school_id = $1 AND holiday_date = $2 AND is_active = TRUE`,
      [schoolId, date]
    );

    return result.rows.length > 0;
  }

  /**
   * Get holidays for current month
   */
  static async getCurrentMonthHolidays(schoolId) {
    const result = await query(
      `SELECT * FROM holidays
       WHERE school_id = $1
       AND EXTRACT(MONTH FROM holiday_date) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(YEAR FROM holiday_date) = EXTRACT(YEAR FROM CURRENT_DATE)
       AND is_active = TRUE
       ORDER BY holiday_date ASC`,
      [schoolId]
    );

    return result.rows;
  }

  /**
   * Bulk import holidays
   */
  static async bulkCreate(holidaysData, schoolId) {
    const values = [];
    const placeholders = [];

    holidaysData.forEach((holiday, index) => {
      const offset = index * 5;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
      );
      values.push(
        schoolId,
        holiday.holiday_name,
        holiday.holiday_date,
        holiday.holiday_type || 'national',
        holiday.description || null
      );
    });

    const result = await query(
      `INSERT INTO holidays (
        school_id, holiday_name, holiday_date, holiday_type, description
      ) VALUES ${placeholders.join(', ')}
      ON CONFLICT (school_id, holiday_date, holiday_name) DO NOTHING
      RETURNING *`,
      values
    );

    return result.rows;
  }
}

module.exports = Holiday;
