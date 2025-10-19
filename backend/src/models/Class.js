const { query } = require('../config/database');

class Class {
  /**
   * Create a new class
   */
  static async create(classData, schoolId) {
    const {
      className,
      academicYear,
      description
    } = classData;

    const result = await query(
      `INSERT INTO classes (
        school_id, class_name, academic_year, description
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [schoolId, className, academicYear, description]
    );

    return result.rows[0];
  }

  /**
   * Get all classes for a school
   */
  static async findAll(schoolId, academicYear = null) {
    let sql = `
      SELECT
        c.*,
        COUNT(DISTINCT s.id) as section_count,
        COUNT(DISTINCT st.id) as student_count
      FROM classes c
      LEFT JOIN sections s ON c.id = s.class_id AND s.is_active = TRUE
      LEFT JOIN students st ON s.id = st.section_id AND st.is_active = TRUE
      WHERE c.school_id = $1 AND c.is_active = TRUE
    `;

    const params = [schoolId];

    if (academicYear) {
      sql += ` AND c.academic_year = $2`;
      params.push(academicYear);
    }

    sql += `
      GROUP BY c.id
      ORDER BY c.class_name
    `;

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Get a single class by ID with sections
   */
  static async findById(id) {
    const result = await query(
      `SELECT
        c.*,
        json_agg(
          json_build_object(
            'id', s.id,
            'section_name', s.section_name,
            'max_capacity', s.max_capacity,
            'current_strength', s.current_strength,
            'form_teacher_id', s.form_teacher_id,
            'room_number', s.room_number
          )
        ) FILTER (WHERE s.id IS NOT NULL) as sections
      FROM classes c
      LEFT JOIN sections s ON c.id = s.class_id AND s.is_active = TRUE
      WHERE c.id = $1
      GROUP BY c.id`,
      [id]
    );

    return result.rows[0];
  }

  /**
   * Update a class
   */
  static async update(id, updates) {
    const { className, academicYear, description, isActive } = updates;

    const result = await query(
      `UPDATE classes
       SET class_name = COALESCE($1, class_name),
           academic_year = COALESCE($2, academic_year),
           description = COALESCE($3, description),
           is_active = COALESCE($4, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [className, academicYear, description, isActive, id]
    );

    return result.rows[0];
  }

  /**
   * Delete (deactivate) a class
   */
  static async delete(id) {
    const result = await query(
      'UPDATE classes SET is_active = FALSE WHERE id = $1 RETURNING *',
      [id]
    );

    return result.rows[0];
  }

  /**
   * Get class statistics
   */
  static async getStatistics(schoolId, academicYear) {
    const result = await query(
      `SELECT
        COUNT(DISTINCT c.id) as total_classes,
        COUNT(DISTINCT s.id) as total_sections,
        COUNT(DISTINCT st.id) as total_students,
        COALESCE(AVG(s.current_strength), 0) as avg_students_per_section
      FROM classes c
      LEFT JOIN sections s ON c.id = s.class_id AND s.is_active = TRUE
      LEFT JOIN students st ON s.id = st.section_id AND st.is_active = TRUE
      WHERE c.school_id = $1 AND c.academic_year = $2 AND c.is_active = TRUE`,
      [schoolId, academicYear]
    );

    return result.rows[0];
  }
}

module.exports = Class;
