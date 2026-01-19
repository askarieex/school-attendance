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

    // Get school prefix for manual code generation
    const schoolResult = await query('SELECT name FROM schools WHERE id = $1', [schoolId]);
    const schoolName = schoolResult.rows[0].name;
    const prefix = schoolName.substring(0, 3).toUpperCase();

    // Generate unique code: PRE-TIMESTAMP (e.g. MOH-172312)
    // We use manual generation to bypass the DB trigger which is causing duplicate key errors
    const teacherCode = `${prefix}-${Date.now().toString().slice(-6)}`;

    // Create teacher profile - Manual teacher_code to bypass trigger
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

    // ✅ FIXED: Get current academic year dynamically instead of hardcoded '2025-2026'
    const { getCurrentAcademicYear, calculateAcademicYearFromDate } = require('../utils/academicYear');
    let currentAcademicYear = await getCurrentAcademicYear(schoolId);

    // FALLBACK: If no academic year is set in school settings, calculate from current date
    if (!currentAcademicYear) {
      currentAcademicYear = calculateAcademicYearFromDate();
      console.log(`📅 No academic year set for school ${schoolId}, using calculated: ${currentAcademicYear}`);
    }

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
          WHERE tca.teacher_id = t.id AND tca.academic_year = $${paramCount + 3}
        ) as assignments
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...params, currentAcademicYear]
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

    // ✅ BUSINESS LOGIC FIX: Ensure teacher can only be form teacher for ONE class at a time
    if (isFormTeacher) {
      // Check if this teacher is already form teacher for another class
      const existingFormTeacherAssignment = await query(
        `SELECT id, section_id FROM teacher_class_assignments
         WHERE teacher_id = $1 AND is_form_teacher = TRUE AND section_id != $2`,
        [teacherId, sectionId]
      );

      if (existingFormTeacherAssignment.rows.length > 0) {
        const oldSectionId = existingFormTeacherAssignment.rows[0].section_id;

        console.log(`🔄 Teacher ${teacherId} is already form teacher for section ${oldSectionId}`);
        console.log(`🔄 Removing form teacher status from section ${oldSectionId}`);

        // Remove form teacher flag from old assignment
        await query(
          `UPDATE teacher_class_assignments
           SET is_form_teacher = FALSE, updated_at = CURRENT_TIMESTAMP
           WHERE teacher_id = $1 AND section_id = $2`,
          [teacherId, oldSectionId]
        );

        // Also remove from sections table
        await query(
          'UPDATE sections SET form_teacher_id = NULL WHERE id = $1',
          [oldSectionId]
        );

        console.log(`✅ Removed form teacher status from old section ${oldSectionId}`);
      }

      // Check if the NEW section already has a different form teacher
      const existingFormTeacher = await query(
        'SELECT form_teacher_id FROM sections WHERE id = $1',
        [sectionId]
      );

      if (existingFormTeacher.rows[0]?.form_teacher_id) {
        // Get the user_id of the current teacher to compare
        const currentTeacherResult = await query(
          'SELECT user_id FROM teachers WHERE id = $1',
          [teacherId]
        );

        const currentUserId = currentTeacherResult.rows[0]?.user_id;
        const existingUserId = existingFormTeacher.rows[0].form_teacher_id;

        // If it's a DIFFERENT teacher, auto-demote the previous form teacher
        if (currentUserId !== existingUserId) {
          console.log(`🔄 Section ${sectionId} already has form teacher (user_id: ${existingUserId}). Replacing with teacher ${teacherId} (user_id: ${currentUserId})`);

          // Remove form teacher flag from the old teacher's assignment
          await query(
            `UPDATE teacher_class_assignments
             SET is_form_teacher = FALSE, updated_at = CURRENT_TIMESTAMP
             WHERE section_id = $1 AND is_form_teacher = TRUE`,
            [sectionId]
          );

          console.log(`✅ Removed previous form teacher from section ${sectionId}`);
        }
      }
    }

    // ✅ FIXED: Get current academic year dynamically if not provided
    let finalAcademicYear = academicYear;
    if (!finalAcademicYear) {
      // Get school_id from teacher to fetch current academic year
      const teacherSchoolResult = await query(
        'SELECT school_id FROM teachers WHERE id = $1',
        [teacherId]
      );

      if (teacherSchoolResult.rows.length > 0) {
        const { getCurrentAcademicYear } = require('../utils/academicYear');
        finalAcademicYear = await getCurrentAcademicYear(teacherSchoolResult.rows[0].school_id);
      }

      // Fallback to calculating from current date if no academic year set
      if (!finalAcademicYear) {
        const { calculateAcademicYearFromDate } = require('../utils/academicYear');
        finalAcademicYear = calculateAcademicYearFromDate();
      }
    }

    const result = await query(
      `INSERT INTO teacher_class_assignments (
        teacher_id, section_id, subject, is_form_teacher, academic_year
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (teacher_id, section_id, subject, academic_year)
      DO UPDATE SET
        is_form_teacher = EXCLUDED.is_form_teacher,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [teacherId, sectionId, subject, isFormTeacher || false, finalAcademicYear]
    );

    // If form teacher, update sections table with user_id (not teacher_id)
    if (isFormTeacher) {
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
        console.log(`✅ Set teacher ${teacherId} as form teacher for section ${sectionId}`);
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
   * ✅ FIXED: Removed hardcoded default value, caller should provide academic year
   */
  static async getAssignments(teacherId, academicYear) {
    // If no academic year provided, return empty array (caller should provide it)
    if (!academicYear) {
      console.warn(`⚠️ getAssignments called without academic year for teacher ${teacherId}`);
      return [];
    }

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
