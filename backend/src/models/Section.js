const { query } = require('../config/database');

class Section {
  /**
   * Create a new section
   */
  static async create(sectionData) {
    const {
      classId,
      sectionName,
      maxCapacity,
      formTeacherId,
      roomNumber
    } = sectionData;

    const result = await query(
      `INSERT INTO sections (
        class_id, section_name, max_capacity, form_teacher_id, room_number
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [classId, sectionName, maxCapacity || 40, formTeacherId, roomNumber]
    );

    return result.rows[0];
  }

  /**
   * Get all sections for a class
   */
  static async findByClass(classId) {
    const result = await query(
      `SELECT
        s.*,
        u.full_name as form_teacher_name,
        COUNT(st.id) as student_count
      FROM sections s
      LEFT JOIN users u ON s.form_teacher_id = u.id
      LEFT JOIN students st ON s.id = st.section_id AND st.is_active = TRUE
      WHERE s.class_id = $1 AND s.is_active = TRUE
      GROUP BY s.id, u.full_name
      ORDER BY s.section_name`,
      [classId]
    );

    return result.rows;
  }

  /**
   * Get a single section by ID
   */
  static async findById(id) {
    const result = await query(
      `SELECT
        s.*,
        c.class_name,
        c.academic_year,
        u.full_name as form_teacher_name,
        u.email as form_teacher_email
      FROM sections s
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN users u ON s.form_teacher_id = u.id
      WHERE s.id = $1`,
      [id]
    );

    return result.rows[0];
  }

  /**
   * Get sections with students
   */
  static async findByIdWithStudents(id) {
    const result = await query(
      `SELECT
        s.*,
        json_agg(
          json_build_object(
            'id', st.id,
            'full_name', st.full_name,
            'rfid_card_id', st.rfid_card_id,
            'roll_number', st.roll_number,
            'photo_url', st.photo_url
          ) ORDER BY st.roll_number, st.full_name
        ) FILTER (WHERE st.id IS NOT NULL) as students
      FROM sections s
      LEFT JOIN students st ON s.id = st.section_id AND st.is_active = TRUE
      WHERE s.id = $1
      GROUP BY s.id`,
      [id]
    );

    return result.rows[0];
  }

  /**
   * Update a section
   */
  static async update(id, updates) {
    const {
      sectionName,
      maxCapacity,
      formTeacherId,
      roomNumber,
      isActive
    } = updates;

    const result = await query(
      `UPDATE sections
       SET section_name = COALESCE($1, section_name),
           max_capacity = COALESCE($2, max_capacity),
           form_teacher_id = COALESCE($3, form_teacher_id),
           room_number = COALESCE($4, room_number),
           is_active = COALESCE($5, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [sectionName, maxCapacity, formTeacherId, roomNumber, isActive, id]
    );

    return result.rows[0];
  }

  /**
   * Assign form teacher to section
   */
  static async assignFormTeacher(id, teacherId) {
    const result = await query(
      `UPDATE sections
       SET form_teacher_id = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [teacherId, id]
    );

    return result.rows[0];
  }

  /**
   * Remove form teacher from section
   */
  static async removeFormTeacher(id) {
    const result = await query(
      `UPDATE sections
       SET form_teacher_id = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return result.rows[0];
  }

  /**
   * Delete (deactivate) a section
   */
  static async delete(id) {
    const result = await query(
      'UPDATE sections SET is_active = FALSE WHERE id = $1 RETURNING *',
      [id]
    );

    return result.rows[0];
  }

  /**
   * Get sections by school (all classes)
   */
  static async findBySchool(schoolId) {
    const result = await query(
      `SELECT
        s.*,
        c.class_name,
        c.academic_year,
        u.full_name as form_teacher_name
      FROM sections s
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN users u ON s.form_teacher_id = u.id
      WHERE c.school_id = $1 AND s.is_active = TRUE AND c.is_active = TRUE
      ORDER BY c.class_name, s.section_name`,
      [schoolId]
    );

    return result.rows;
  }
}

module.exports = Section;
