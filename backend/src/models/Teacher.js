const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

class Teacher {
  /**
   * Create a new teacher (with user account)
   */
  static async create(teacherData, schoolId) {
    const {
      fullName,
      email,
      phone,
      dateOfBirth,
      dateOfJoining,
      subjectSpecialization,
      qualification,
      address,
      emergencyContact,
      password
    } = teacherData;

    // Hash password
    const passwordHash = await bcrypt.hash(password || 'teacher123', 10);

    // Create user account first
    const userResult = await query(
      `INSERT INTO users (email, password_hash, full_name, role, school_id)
       VALUES ($1, $2, $3, 'teacher', $4)
       RETURNING id`,
      [email, passwordHash, fullName, schoolId]
    );

    const userId = userResult.rows[0].id;

    // Generate unique teacher code
    const teacherCode = `TCH-${schoolId}-${Date.now().toString(36).toUpperCase()}`;

    // Create teacher profile
    const teacherResult = await query(
      `INSERT INTO teachers (
        user_id, school_id, teacher_code, phone, date_of_birth, date_of_joining,
        subject_specialization, qualification, address, emergency_contact
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        userId,
        schoolId,
        teacherCode,
        phone,
        dateOfBirth,
        dateOfJoining,
        subjectSpecialization,
        qualification,
        address,
        emergencyContact
      ]
    );

    return teacherResult.rows[0];
  }

  /**
   * Get all teachers for a school
   */
  static async findAll(schoolId, page = 1, limit = 20, filters = {}) {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE t.school_id = $1 AND t.is_active = TRUE';
    const params = [schoolId];
    let paramCount = 1;

    // Filter by subject
    if (filters.subject) {
      paramCount++;
      whereClause += ` AND t.subject_specialization ILIKE $${paramCount}`;
      params.push(`%${filters.subject}%`);
    }

    // Filter by search (name or email)
    if (filters.search) {
      paramCount++;
      whereClause += ` AND (u.full_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM teachers t
       JOIN users u ON t.user_id = u.id
       ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    params.push(limit, offset);
    const result = await query(
      `SELECT
        t.*,
        u.full_name,
        u.email,
        u.is_active as user_active,
        (
          SELECT COUNT(DISTINCT tca.section_id)
          FROM teacher_class_assignments tca
          WHERE tca.teacher_id = t.id
        ) as classes_count,
        (
          SELECT json_agg(
            json_build_object(
              'id', tca.id,
              'section_id', tca.section_id,
              'class_name', c.class_name,
              'section_name', s.section_name,
              'subject', tca.subject,
              'is_form_teacher', tca.is_form_teacher
            )
          )
          FROM teacher_class_assignments tca
          JOIN sections s ON tca.section_id = s.id
          JOIN classes c ON s.class_id = c.id
          WHERE tca.teacher_id = t.id AND tca.academic_year = '2025-2026'
        ) as assignments
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      params
    );

    return {
      teachers: result.rows,
      total: total
    };
  }

  /**
   * Get a single teacher by ID
   */
  static async findById(id) {
    const result = await query(
      `SELECT
        t.*,
        u.full_name,
        u.email,
        u.is_active as user_active,
        (
          SELECT json_agg(
            json_build_object(
              'id', tca.id,
              'section_id', tca.section_id,
              'class_name', c.class_name,
              'section_name', s.section_name,
              'subject', tca.subject,
              'is_form_teacher', tca.is_form_teacher,
              'academic_year', tca.academic_year
            )
          )
          FROM teacher_class_assignments tca
          JOIN sections s ON tca.section_id = s.id
          JOIN classes c ON s.class_id = c.id
          WHERE tca.teacher_id = t.id
        ) as assignments
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      WHERE t.id = $1`,
      [id]
    );

    return result.rows[0];
  }

  /**
   * Update a teacher
   */
  static async update(id, updates) {
    const {
      fullName,
      email,
      phone,
      dateOfBirth,
      dateOfJoining,
      subjectSpecialization,
      qualification,
      address,
      emergencyContact,
      isActive
    } = updates;

    // Update user table if name or email changed
    if (fullName || email) {
      await query(
        `UPDATE users u
         SET full_name = COALESCE($1, u.full_name),
             email = COALESCE($2, u.email)
         FROM teachers t
         WHERE u.id = t.user_id AND t.id = $3`,
        [fullName, email, id]
      );
    }

    // Update teacher table
    const result = await query(
      `UPDATE teachers
       SET phone = COALESCE($1, phone),
           date_of_birth = COALESCE($2, date_of_birth),
           date_of_joining = COALESCE($3, date_of_joining),
           subject_specialization = COALESCE($4, subject_specialization),
           qualification = COALESCE($5, qualification),
           address = COALESCE($6, address),
           emergency_contact = COALESCE($7, emergency_contact),
           is_active = COALESCE($8, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [
        phone,
        dateOfBirth,
        dateOfJoining,
        subjectSpecialization,
        qualification,
        address,
        emergencyContact,
        isActive,
        id
      ]
    );

    return result.rows[0];
  }

  /**
   * Delete (deactivate) a teacher
   */
  static async delete(id) {
    // Deactivate teacher
    await query(
      'UPDATE teachers SET is_active = FALSE WHERE id = $1',
      [id]
    );

    // Deactivate user account
    await query(
      `UPDATE users SET is_active = FALSE
       FROM teachers t
       WHERE users.id = t.user_id AND t.id = $1`,
      [id]
    );

    return { success: true };
  }

  /**
   * Assign teacher to section
   */
  static async assignToSection(teacherId, assignmentData) {
    const {
      sectionId,
      subject,
      isFormTeacher,
      academicYear
    } = assignmentData;

    const result = await query(
      `INSERT INTO teacher_class_assignments (
        teacher_id, section_id, subject, is_form_teacher, academic_year
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (teacher_id, section_id, subject, academic_year)
      DO UPDATE SET
        is_form_teacher = EXCLUDED.is_form_teacher,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [teacherId, sectionId, subject, isFormTeacher || false, academicYear || '2025-2026']
    );

    // If form teacher, update sections table with user_id (not teacher_id)
    if (isFormTeacher) {
      // Check if section already has a form teacher
      const existingFormTeacher = await query(
        'SELECT form_teacher_id FROM sections WHERE id = $1',
        [sectionId]
      );

      if (existingFormTeacher.rows[0]?.form_teacher_id) {
        throw new Error('This section already has a form teacher. Please remove the existing form teacher first.');
      }

      // Get the user_id for this teacher
      const teacherResult = await query(
        'SELECT user_id FROM teachers WHERE id = $1',
        [teacherId]
      );

      if (teacherResult.rows.length > 0) {
        const userId = teacherResult.rows[0].user_id;
        await query(
          'UPDATE sections SET form_teacher_id = $1 WHERE id = $2',
          [userId, sectionId]
        );
      }
    }

    return result.rows[0];
  }

  /**
   * Remove teacher assignment
   */
  static async removeAssignment(assignmentId) {
    // Get assignment details first
    const assignment = await query(
      'SELECT * FROM teacher_class_assignments WHERE id = $1',
      [assignmentId]
    );

    if (assignment.rows.length === 0) {
      return null;
    }

    const { section_id, is_form_teacher } = assignment.rows[0];

    // If was form teacher, remove from sections table
    if (is_form_teacher) {
      await query(
        'UPDATE sections SET form_teacher_id = NULL WHERE id = $1',
        [section_id]
      );
    }

    // Delete assignment
    const result = await query(
      'DELETE FROM teacher_class_assignments WHERE id = $1 RETURNING *',
      [assignmentId]
    );

    return result.rows[0];
  }

  /**
   * Get teacher's assigned sections
   */
  static async getAssignments(teacherId, academicYear = '2025-2026') {
    const result = await query(
      `SELECT
        tca.*,
        c.class_name,
        s.section_name,
        s.current_strength as student_count
      FROM teacher_class_assignments tca
      JOIN sections s ON tca.section_id = s.id
      JOIN classes c ON s.class_id = c.id
      WHERE tca.teacher_id = $1 AND tca.academic_year = $2
      ORDER BY c.class_name, s.section_name`,
      [teacherId, academicYear]
    );

    return result.rows;
  }

  /**
   * Reset teacher password
   */
  static async resetPassword(id, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await query(
      `UPDATE users u
       SET password_hash = $1
       FROM teachers t
       WHERE u.id = t.user_id AND t.id = $2`,
      [passwordHash, id]
    );

    return { success: true };
  }
}

module.exports = Teacher;
