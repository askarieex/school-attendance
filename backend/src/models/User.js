const { query } = require('../config/database');
const { hashPassword } = require('../utils/auth');

class User {
  /**
   * Create a new user
   */
  static async create(userData) {
    const { email, password, role, schoolId, fullName } = userData;

    // Hash password
    const passwordHash = await hashPassword(password);

    const result = await query(
      `INSERT INTO users (email, password_hash, role, school_id, full_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, role, school_id, full_name, created_at`,
      [email, passwordHash, role, schoolId || null, fullName]
    );

    return result.rows[0];
  }

  /**
   * Find user by email (for login)
   */
  static async findByEmail(email) {
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
      [email]
    );

    return result.rows[0];
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    const result = await query(
      'SELECT id, email, role, school_id, full_name, last_login, created_at FROM users WHERE id = $1',
      [id]
    );

    return result.rows[0];
  }

  /**
   * Get all users (Super Admin only)
   */
  static async findAll(page = 1, limit = 10, filters = {}) {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;

    // Filter by role
    if (filters.role) {
      paramCount++;
      whereClause += ` AND role = $${paramCount}`;
      params.push(filters.role);
    }

    // Filter by school
    if (filters.schoolId) {
      paramCount++;
      whereClause += ` AND school_id = $${paramCount}`;
      params.push(filters.schoolId);
    }

    // Search by name or email
    if (filters.search) {
      paramCount++;
      whereClause += ` AND (full_name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    params.push(limit, offset);
    const result = await query(
      `SELECT id, email, role, school_id, full_name, last_login, is_active, created_at
       FROM users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      params
    );

    return {
      users: result.rows,
      total,
    };
  }

  /**
   * Update user
   */
  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    // Handle password separately
    if (updates.password) {
      updates.password_hash = await hashPassword(updates.password);
      delete updates.password;
    }

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
      `UPDATE users
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount + 1}
       RETURNING id, email, role, school_id, full_name, last_login, created_at`,
      values
    );

    return result.rows[0];
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(id) {
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  }

  /**
   * Deactivate user
   */
  static async deactivate(id) {
    const result = await query(
      'UPDATE users SET is_active = FALSE WHERE id = $1 RETURNING id, email',
      [id]
    );

    return result.rows[0];
  }
}

module.exports = User;
