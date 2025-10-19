const { query } = require('../config/database');

class SchoolSettings {
  /**
   * Create default settings for a new school
   */
  static async create(schoolId) {
    const result = await query(
      `INSERT INTO school_settings (school_id)
       VALUES ($1)
       RETURNING *`,
      [schoolId]
    );

    return result.rows[0];
  }

  /**
   * Get settings for a school
   */
  static async findBySchool(schoolId) {
    const result = await query(
      'SELECT * FROM school_settings WHERE school_id = $1',
      [schoolId]
    );

    return result.rows[0];
  }

  /**
   * Update school settings
   */
  static async update(schoolId, updates) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    const fieldMapping = {
      schoolStartTime: 'school_start_time',
      lateThresholdMin: 'late_threshold_min',
      smsEnabled: 'sms_enabled',
      academicYear: 'academic_year',
    };

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        paramCount++;
        const dbField = fieldMapping[key] || key;
        fields.push(`${dbField} = $${paramCount}`);
        values.push(updates[key]);
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(schoolId);
    const result = await query(
      `UPDATE school_settings
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE school_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Get or create settings (ensures settings exist)
   */
  static async getOrCreate(schoolId) {
    let settings = await this.findBySchool(schoolId);

    if (!settings) {
      settings = await this.create(schoolId);
    }

    return settings;
  }
}

module.exports = SchoolSettings;
