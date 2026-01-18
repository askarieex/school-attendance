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

    console.log('📝 Updating school settings for school', schoolId, 'with data:', updates);

    const fieldMapping = {
      // School profile fields
      school_name: 'school_name',
      address: 'address',
      city: 'city',
      state: 'state',
      pincode: 'pincode',
      phone: 'phone',
      email: 'email',
      website: 'website',
      logo_url: 'logo_url',

      // School timing fields
      school_open_time: 'school_open_time',
      school_close_time: 'school_close_time',
      late_threshold_minutes: 'late_threshold_minutes',
      working_days: 'working_days',
      weekly_holiday: 'weekly_holiday',

      // Break times
      first_break_start: 'first_break_start',
      first_break_end: 'first_break_end',
      lunch_break_start: 'lunch_break_start',
      lunch_break_end: 'lunch_break_end',

      // Check-in settings
      allow_early_checkin: 'allow_early_checkin',
      allow_late_checkin: 'allow_late_checkin',
      early_checkin_message: 'early_checkin_message',
      late_checkin_message: 'late_checkin_message',
      too_late_checkin_message: 'too_late_checkin_message',

      // SMS settings
      sms_enabled: 'sms_enabled',
      sms_provider: 'sms_provider',
      sms_api_key: 'sms_api_key',
      sms_balance: 'sms_balance',
      send_on_absent: 'send_on_absent',
      send_on_late: 'send_on_late',
      send_daily_summary: 'send_daily_summary',

      // Other
      timezone: 'timezone',
      academic_year: 'academic_year',
    };

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        paramCount++;
        const dbField = fieldMapping[key];

        if (!dbField) {
          console.warn(`⚠️ Skipping unknown field: ${key}`);
          paramCount--; // Don't increment if skipping
          return;
        }

        fields.push(`${dbField} = $${paramCount}`);
        values.push(updates[key]);
        console.log(`  ✅ Mapping ${key} -> ${dbField} = ${updates[key]}`);
      }
    });

    if (fields.length === 0) {
      console.warn('⚠️ No valid fields to update');
      // Just return current settings instead of throwing error
      return await this.findBySchool(schoolId);
    }

    values.push(schoolId);

    const sql = `UPDATE school_settings
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE school_id = $${paramCount + 1}
       RETURNING *`;

    console.log('📤 Executing SQL:', sql);
    console.log('📤 With values:', values);

    const result = await query(sql, values);

    if (result.rows.length === 0) {
      console.log('⚠️ No settings found, creating new...');
      await this.create(schoolId);
      return await this.update(schoolId, updates);
    }

    console.log('✅ Settings updated successfully:', result.rows[0]);
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
