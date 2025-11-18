const { query } = require('../config/database');

/**
 * Subject Model
 *
 * Manages school-specific subject library and teacher-subject assignments
 */
class Subject {
  /**
   * Create a new subject
   */
  static async create(subjectData, schoolId) {
    const {
      subjectName,
      subjectCode,
      description,
      isActive = true
    } = subjectData;

    const result = await query(
      `INSERT INTO subjects (
        school_id, subject_name, subject_code, description, is_active
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [schoolId, subjectName, subjectCode, description, isActive]
    );

    return result.rows[0];
  }

  /**
   * Get all subjects for a school
   */
  static async findAll(schoolId, options = {}) {
    const { includeInactive = false, includeStats = false } = options;

    let sql = `
      SELECT
        s.*
    `;

    if (includeStats) {
      sql += `,
        COUNT(DISTINCT tca.id) as assignment_count,
        COUNT(DISTINCT tca.teacher_id) as teacher_count,
        COUNT(DISTINCT tca.section_id) as section_count
      `;
    }

    sql += `
      FROM subjects s
    `;

    if (includeStats) {
      sql += `
        LEFT JOIN teacher_class_assignments tca ON tca.subject_id = s.id
      `;
    }

    sql += `WHERE s.school_id = $1`;

    if (!includeInactive) {
      sql += ` AND s.is_active = TRUE`;
    }

    if (includeStats) {
      sql += ` GROUP BY s.id`;
    }

    sql += ` ORDER BY s.subject_name`;

    const result = await query(sql, [schoolId]);
    return result.rows;
  }

  /**
   * Get a single subject by ID
   */
  static async findById(id, schoolId = null) {
    let sql = `
      SELECT
        s.*,
        COUNT(DISTINCT tca.id) as assignment_count,
        COUNT(DISTINCT tca.teacher_id) as teacher_count,
        json_agg(
          DISTINCT jsonb_build_object(
            'teacher_id', t.id,
            'teacher_name', u.name,
            'section_id', sec.id,
            'section_name', sec.section_name,
            'class_name', c.class_name
          )
        ) FILTER (WHERE t.id IS NOT NULL) as assignments
      FROM subjects s
      LEFT JOIN teacher_class_assignments tca ON tca.subject_id = s.id
      LEFT JOIN teachers t ON tca.teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN sections sec ON tca.section_id = sec.id
      LEFT JOIN classes c ON sec.class_id = c.id
      WHERE s.id = $1
    `;

    const params = [id];

    if (schoolId) {
      sql += ` AND s.school_id = $2`;
      params.push(schoolId);
    }

    sql += ` GROUP BY s.id`;

    const result = await query(sql, params);
    return result.rows[0];
  }

  /**
   * Find subject by name for a school
   */
  static async findByName(subjectName, schoolId) {
    const result = await query(
      `SELECT * FROM subjects
       WHERE school_id = $1
         AND LOWER(subject_name) = LOWER($2)
       LIMIT 1`,
      [schoolId, subjectName]
    );

    return result.rows[0];
  }

  /**
   * Update a subject
   */
  static async update(id, updates, schoolId = null) {
    const { subjectName, subjectCode, description, isActive } = updates;

    let sql = `
      UPDATE subjects
      SET subject_name = COALESCE($1, subject_name),
          subject_code = COALESCE($2, subject_code),
          description = COALESCE($3, description),
          is_active = COALESCE($4, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `;

    const params = [subjectName, subjectCode, description, isActive, id];

    if (schoolId) {
      sql += ` AND school_id = $6`;
      params.push(schoolId);
    }

    sql += ` RETURNING *`;

    const result = await query(sql, params);
    return result.rows[0];
  }

  /**
   * Delete (deactivate) a subject
   */
  static async delete(id, schoolId = null) {
    let sql = `UPDATE subjects SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1`;
    const params = [id];

    if (schoolId) {
      sql += ` AND school_id = $2`;
      params.push(schoolId);
    }

    sql += ` RETURNING *`;

    const result = await query(sql, params);
    return result.rows[0];
  }

  /**
   * Hard delete a subject (only if no assignments)
   */
  static async hardDelete(id, schoolId = null) {
    // Check if subject has any assignments
    const checkResult = await query(
      `SELECT COUNT(*) as count
       FROM teacher_class_assignments
       WHERE subject_id = $1`,
      [id]
    );

    if (parseInt(checkResult.rows[0].count) > 0) {
      throw new Error('Cannot delete subject with existing assignments. Deactivate instead.');
    }

    let sql = `DELETE FROM subjects WHERE id = $1`;
    const params = [id];

    if (schoolId) {
      sql += ` AND school_id = $2`;
      params.push(schoolId);
    }

    sql += ` RETURNING *`;

    const result = await query(sql, params);
    return result.rows[0];
  }

  /**
   * Get subjects assigned to a specific teacher
   */
  static async findByTeacher(teacherId, schoolId) {
    const result = await query(
      `SELECT DISTINCT
        s.*,
        json_agg(
          jsonb_build_object(
            'section_id', sec.id,
            'section_name', sec.section_name,
            'class_name', c.class_name,
            'is_form_teacher', tca.is_form_teacher
          )
        ) as sections
      FROM subjects s
      JOIN teacher_class_assignments tca ON tca.subject_id = s.id
      JOIN sections sec ON tca.section_id = sec.id
      JOIN classes c ON sec.class_id = c.id
      WHERE tca.teacher_id = $1
        AND s.school_id = $2
        AND s.is_active = TRUE
      GROUP BY s.id
      ORDER BY s.subject_name`,
      [teacherId, schoolId]
    );

    return result.rows;
  }

  /**
   * Get subjects for a specific section
   */
  static async findBySection(sectionId, schoolId) {
    const result = await query(
      `SELECT
        s.*,
        t.id as teacher_id,
        u.name as teacher_name,
        tca.is_form_teacher
      FROM subjects s
      JOIN teacher_class_assignments tca ON tca.subject_id = s.id
      JOIN teachers t ON tca.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE tca.section_id = $1
        AND s.school_id = $2
        AND s.is_active = TRUE
      ORDER BY s.subject_name`,
      [sectionId, schoolId]
    );

    return result.rows;
  }

  /**
   * Bulk create default subjects for a school
   */
  static async createDefaults(schoolId) {
    const defaultSubjects = [
      { name: 'Mathematics', code: 'MATH' },
      { name: 'English', code: 'ENG' },
      { name: 'Science', code: 'SCI' },
      { name: 'Social Studies', code: 'SOC' },
      { name: 'Computer Science', code: 'CS' },
      { name: 'Physical Education', code: 'PE' },
      { name: 'Art', code: 'ART' },
      { name: 'Music', code: 'MUS' }
    ];

    const created = [];

    for (const subject of defaultSubjects) {
      try {
        const result = await query(
          `INSERT INTO subjects (school_id, subject_name, subject_code)
           VALUES ($1, $2, $3)
           ON CONFLICT (school_id, subject_name) DO NOTHING
           RETURNING *`,
          [schoolId, subject.name, subject.code]
        );

        if (result.rows[0]) {
          created.push(result.rows[0]);
        }
      } catch (error) {
        console.warn(`Failed to create subject ${subject.name}:`, error.message);
      }
    }

    return created;
  }

  /**
   * Get subject statistics for a school
   */
  static async getStatistics(schoolId) {
    const result = await query(
      `SELECT
        COUNT(DISTINCT s.id) as total_subjects,
        COUNT(DISTINCT s.id) FILTER (WHERE s.is_active = TRUE) as active_subjects,
        COUNT(DISTINCT tca.id) as total_assignments,
        COUNT(DISTINCT tca.teacher_id) as teachers_with_subjects
      FROM subjects s
      LEFT JOIN teacher_class_assignments tca ON tca.subject_id = s.id
      WHERE s.school_id = $1`,
      [schoolId]
    );

    return result.rows[0];
  }

  /**
   * Check if subject name is unique for a school (case-insensitive)
   */
  static async isNameUnique(subjectName, schoolId, excludeId = null) {
    let sql = `
      SELECT COUNT(*) as count
      FROM subjects
      WHERE school_id = $1
        AND LOWER(subject_name) = LOWER($2)
    `;

    const params = [schoolId, subjectName];

    if (excludeId) {
      sql += ` AND id != $3`;
      params.push(excludeId);
    }

    const result = await query(sql, params);
    return parseInt(result.rows[0].count) === 0;
  }
}

module.exports = Subject;
