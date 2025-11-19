const { query } = require('../config/database');

class Device {
  static async create(deviceData, schoolId) {
    const {
      deviceName,
      serialNumber,
      location
    } = deviceData;

    const result = await query(
      'INSERT INTO devices (school_id, device_name, serial_number, location) VALUES ($1, $2, $3, $4) RETURNING *',
      [schoolId, deviceName, serialNumber, location]
    );

    return result.rows[0];
  }

  // For super admin - get all devices with pagination and filters
  static async findAll(page = 1, limit = 10, filters = {}) {
    const offset = (page - 1) * limit;
    const conditions = ['d.is_active = TRUE'];
    const params = [];
    let paramCount = 0;

    // Add filters
    if (filters.schoolId) {
      paramCount++;
      conditions.push(`d.school_id = $${paramCount}`);
      params.push(filters.schoolId);
    }

    if (filters.isActive !== undefined) {
      conditions.pop(); // Remove default is_active = TRUE
      paramCount++;
      conditions.push(`d.is_active = $${paramCount}`);
      params.push(filters.isActive);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM devices d ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get devices with school names
    paramCount++;
    params.push(limit);
    paramCount++;
    params.push(offset);

    const result = await query(
      `SELECT d.*, s.name as school_name,
        (SELECT COUNT(*) FROM attendance_logs WHERE device_id = d.id AND DATE(created_at) = CURRENT_DATE) as today_logs_count
       FROM devices d
       LEFT JOIN schools s ON d.school_id = s.id
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
      params
    );

    return {
      devices: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  // For school admin - get devices by school
  static async findAllBySchool(schoolId) {
    const result = await query(
      'SELECT *, (SELECT COUNT(*) FROM attendance_logs WHERE device_id = devices.id AND DATE(created_at) = CURRENT_DATE) as today_logs_count FROM devices WHERE school_id = $1 AND is_active = TRUE ORDER BY created_at DESC',
      [schoolId]
    );

    return result.rows;
  }

  static async findById(id) {
    const result = await query(
      'SELECT * FROM devices WHERE id = $1',
      [id]
    );

    return result.rows[0];
  }

  static async findBySerialNumber(serialNumber) {
    const result = await query(
      'SELECT * FROM devices WHERE serial_number = $1 AND is_active = TRUE',
      [serialNumber]
    );

    return result.rows[0];
  }

  static async findBySchool(schoolId) {
    const result = await query(
      `SELECT
        d.*,
        COUNT(DISTINCT dum.student_id) as total_users,
        CASE
          WHEN COUNT(DISTINCT dum.student_id) > 0 THEN
            ROUND((COUNT(DISTINCT CASE WHEN dss.sync_status = 'synced' THEN dum.student_id END)::NUMERIC /
                   COUNT(DISTINCT dum.student_id)::NUMERIC) * 100)
          ELSE 0
        END as sync_health
      FROM devices d
      LEFT JOIN device_user_mappings dum ON d.id = dum.device_id
      LEFT JOIN device_user_sync_status dss ON d.id = dss.device_id AND dum.student_id = dss.student_id
      WHERE d.school_id = $1 AND d.is_active = TRUE
      GROUP BY d.id
      ORDER BY d.created_at DESC`,
      [schoolId]
    );

    return result.rows;
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = ['device_name', 'serial_number', 'location', 'is_active', 'is_online', 'firmware_version'];

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
      `UPDATE devices SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount + 1} RETURNING *`,
      values
    );

    return result.rows[0];
  }

  static async delete(id) {
    const result = await query(
      'UPDATE devices SET is_active = FALSE WHERE id = $1 RETURNING *',
      [id]
    );

    return result.rows[0];
  }

  // Alias for delete method
  static async deactivate(id) {
    return this.delete(id);
  }

  static async updateLastSeen(identifier) {
    // Support both serialNumber and id
    const isNumeric = !isNaN(identifier) && identifier !== null;
    const field = isNumeric ? 'id' : 'serial_number';

    const result = await query(
      `UPDATE devices SET last_seen = CURRENT_TIMESTAMP, is_online = TRUE WHERE ${field} = $1 RETURNING *`,
      [identifier]
    );

    return result.rows[0];
  }

  static async updateLastSeenById(deviceId) {
    const result = await query(
      'UPDATE devices SET last_seen = CURRENT_TIMESTAMP, is_online = TRUE WHERE id = $1 RETURNING *',
      [deviceId]
    );

    return result.rows[0];
  }

  static async getStatistics(schoolId) {
    const result = await query(
      "SELECT COUNT(*) as total_devices, COUNT(*) FILTER (WHERE is_online = TRUE) as online_devices, COUNT(*) FILTER (WHERE is_online = FALSE OR last_seen IS NULL) as offline_devices FROM devices WHERE school_id = $1 AND is_active = TRUE",
      [schoolId]
    );

    return result.rows[0];
  }
}

module.exports = Device;
