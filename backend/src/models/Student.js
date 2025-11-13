const { query } = require('../config/database');

class Student {
  /**
   * Create a new student
   */
// File: /backend/src/models/Student.js

static async create(studentData, schoolId) {
  // 1. Read the incoming camelCase keys from the request body
  const {
    fullName,
    rfidCardId,
    classId,
    sectionId,
    rollNumber,
    gender,
    dob,
    bloodGroup,
    photoUrl,
    address,
    guardianName,
    guardianPhone,
    guardianEmail,
    guardianRelation,
    motherName,
    motherPhone,
  } = studentData;

  // 2. Use those variables in the SQL query
  const result = await query(
    `INSERT INTO students (
      full_name, rfid_card_id, class_id, section_id, roll_number,
      gender, dob, blood_group, photo_url, address,
      guardian_name, guardian_phone, guardian_email, guardian_relation,
      mother_name, mother_phone, school_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING *`,
    [
      fullName,
      rfidCardId,
      classId || null,
      sectionId || null,
      rollNumber,
      gender,
      dob,
      bloodGroup,
      photoUrl,
      address,
      guardianName,
      guardianPhone,
      guardianEmail,
      guardianRelation,
      motherName,
      motherPhone,
      schoolId,
    ]
  );

  return result.rows[0];
}

  /**
   * Find student by ID
   */
  static async findById(id) {
    const result = await query(
      `SELECT s.*,
        c.class_name,
        sec.section_name
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       LEFT JOIN sections sec ON s.section_id = sec.id
       WHERE s.id = $1`,
      [id]
    );

    return result.rows[0];
  }

  /**
   * Find student by RFID UID
   */
  static async findByRfid(rfidUid, schoolId) {
    const result = await query(
      `SELECT s.*,
        c.class_name,
        sec.section_name
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       LEFT JOIN sections sec ON s.section_id = sec.id
       WHERE s.rfid_card_id = $1 AND s.school_id = $2 AND s.is_active = TRUE`,
      [rfidUid, schoolId]
    );

    return result.rows[0];
  }

  /**
   * Get all students for a school (with multi-tenancy)
   */
  static async findAll(schoolId, page = 1, limit = 10, filters = {}) {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE s.school_id = $1';
    const params = [schoolId];
    let paramCount = 1;

    // Filter by active status (default to TRUE to show only active students)
    if (filters.isActive !== undefined) {
      paramCount++;
      whereClause += ` AND s.is_active = $${paramCount}`;
      params.push(filters.isActive);
    } else {
      // By default, only show active students
      paramCount++;
      whereClause += ` AND s.is_active = $${paramCount}`;
      params.push(true);
    }

    // ✅ Filter by academic year (if provided)
    if (filters.academicYear) {
      paramCount++;
      whereClause += ` AND s.academic_year = $${paramCount}`;
      params.push(filters.academicYear);
    }

    // Filter by class
    if (filters.classId) {
      paramCount++;
      whereClause += ` AND s.class_id = $${paramCount}`;
      params.push(filters.classId);
    }

    // Filter by section
    if (filters.sectionId) {
      paramCount++;
      whereClause += ` AND s.section_id = $${paramCount}`;
      params.push(filters.sectionId);
    }

    // Search by name or RFID
    if (filters.search) {
      paramCount++;
      whereClause += ` AND (s.full_name ILIKE $${paramCount} OR s.rfid_card_id ILIKE $${paramCount} OR s.roll_number ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM students s ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results with class and section names
    params.push(limit, offset);
    const result = await query(
      `SELECT s.*,
        c.class_name,
        sec.section_name,
        sec.room_number
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       LEFT JOIN sections sec ON s.section_id = sec.id
       ${whereClause}
       ORDER BY c.class_name ASC, sec.section_name ASC, 
                CASE WHEN s.roll_number ~ '^[0-9]+$' 
                     THEN CAST(s.roll_number AS INTEGER) 
                     ELSE 999999 
                END ASC, 
                s.roll_number ASC, 
                s.full_name ASC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      params
    );

    return {
      students: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update student
   */
  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    // Map camelCase to snake_case
    const fieldMap = {
      fullName: 'full_name',
      rfidCardId: 'rfid_card_id',
      classId: 'class_id',
      sectionId: 'section_id',
      rollNumber: 'roll_number',
      gender: 'gender',
      dob: 'dob',
      bloodGroup: 'blood_group',
      photoUrl: 'photo_url',
      address: 'address',
      guardianName: 'guardian_name',
      guardianPhone: 'guardian_phone',
      guardianEmail: 'guardian_email',
      guardianRelation: 'guardian_relation',
      motherName: 'mother_name',
      motherPhone: 'mother_phone',
      isActive: 'is_active',
    };

    Object.keys(updates).forEach((key) => {
      const dbField = fieldMap[key];
      if (updates[key] !== undefined && dbField) {
        paramCount++;
        fields.push(`${dbField} = $${paramCount}`);
        values.push(updates[key]);
      }
    });

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);
    const result = await query(
      `UPDATE students
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Delete (deactivate) student
   */
  static async delete(id) {
    const result = await query(
      'UPDATE students SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );

    return result.rows[0];
  }

  /**
   * Get student with attendance history
   */
  static async getWithAttendance(id, days = 30) {
    const studentResult = await query(
      `SELECT s.*,
        c.class_name,
        sec.section_name
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       LEFT JOIN sections sec ON s.section_id = sec.id
       WHERE s.id = $1`,
      [id]
    );

    if (studentResult.rows.length === 0) {
      return null;
    }

    const attendanceResult = await query(
      `SELECT * FROM attendance_logs
       WHERE student_id = $1
       AND date >= CURRENT_DATE - $2 * INTERVAL '1 day'
       ORDER BY date DESC, check_in_time DESC`,
      [id, days]
    );

    return {
      ...studentResult.rows[0],
      attendanceHistory: attendanceResult.rows,
    };
  }

  /**
   * Get students by section
   */
  static async findBySection(sectionId, academicYear = null) {
    let whereClause = 'WHERE s.section_id = $1 AND s.is_active = TRUE';
    const params = [sectionId];

    // ✅ Filter by academic year if provided
    if (academicYear) {
      whereClause += ' AND s.academic_year = $2';
      params.push(academicYear);
    }

    const result = await query(
      `SELECT s.*,
        c.class_name,
        sec.section_name
       FROM students s
       JOIN classes c ON s.class_id = c.id
       JOIN sections sec ON s.section_id = sec.id
       ${whereClause}
       ORDER BY CASE WHEN s.roll_number ~ '^[0-9]+$'
                     THEN CAST(s.roll_number AS INTEGER)
                     ELSE 999999
                END ASC,
                s.roll_number ASC,
                s.full_name ASC`,
      params
    );

    return result.rows;
  }

  /**
   * Bulk create students (CSV import)
   */
  static async bulkCreate(studentsData, schoolId) {
    const values = [];
    const placeholders = [];

    studentsData.forEach((student, index) => {
      const offset = index * 12;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12})`
      );
      values.push(
        student.full_name,
        student.rfid_card_id,
        student.class_id || null,
        student.section_id || null,
        student.roll_number,
        student.dob,
        student.address,
        student.guardian_name,
        student.guardian_phone,
        student.guardian_email,
        student.guardian_relation,
        schoolId
      );
    });

    const result = await query(
      `INSERT INTO students (
        full_name, rfid_card_id, class_id, section_id, roll_number,
        dob, address, guardian_name, guardian_phone,
        guardian_email, guardian_relation, school_id
      ) VALUES ${placeholders.join(', ')}
      RETURNING *`,
      values
    );

    return result.rows;
  }
}

module.exports = Student;
