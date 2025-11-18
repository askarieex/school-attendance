const { query } = require('../config/database');
const { sendError } = require('../utils/response');

/**
 * Teacher Authorization Middleware
 *
 * Critical Security: Ensures teachers can ONLY access data for sections they are assigned to.
 * This prevents cross-section data leakage and unauthorized access.
 */

/**
 * Middleware to check if user is a teacher
 */
const requireTeacher = (req, res, next) => {
  if (req.user.role !== 'teacher') {
    return sendError(res, 'Access denied. Teacher privileges required.', 403);
  }

  if (!req.user.schoolId) {
    return sendError(res, 'Invalid teacher account - no school associated', 403);
  }

  next();
};

/**
 * Validate that teacher has access to a specific section
 *
 * Usage: validateTeacherSectionAccess('params', 'sectionId')
 * - First arg: where to find section ID ('params', 'query', 'body')
 * - Second arg: the field name containing section ID
 *
 * Example:
 *   router.get('/section/:sectionId/students',
 *     authenticate,
 *     requireTeacher,
 *     validateTeacherSectionAccess('params', 'sectionId'),
 *     getStudents
 *   )
 */
const validateTeacherSectionAccess = (location = 'params', fieldName = 'sectionId') => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const sectionId = req[location][fieldName];

      if (!sectionId) {
        return sendError(res, `Section ID is required in ${location}.${fieldName}`, 400);
      }

      // Get teacher_id from user_id (CRITICAL FIX)
      const teacherResult = await query(
        'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2 AND is_active = TRUE',
        [userId, req.user.schoolId]
      );

      if (teacherResult.rows.length === 0) {
        return sendError(res, 'Teacher profile not found', 404);
      }

      const teacherId = teacherResult.rows[0].id;

      // Check if teacher is assigned to this section
      const result = await query(
        `SELECT tca.id, tca.section_id, tca.subject_id, tca.is_form_teacher,
                s.section_name, c.school_id
         FROM teacher_class_assignments tca
         JOIN sections s ON tca.section_id = s.id
         JOIN classes c ON s.class_id = c.id
         WHERE tca.teacher_id = $1
           AND tca.section_id = $2
           AND c.school_id = $3
         LIMIT 1`,
        [teacherId, sectionId, req.user.schoolId]
      );

      if (result.rows.length === 0) {
        return sendError(
          res,
          'Access denied. You are not assigned to this section.',
          403
        );
      }

      // Attach assignment info to request for use in controllers
      req.teacherAssignment = {
        assignmentId: result.rows[0].id,
        sectionId: result.rows[0].section_id,
        subjectId: result.rows[0].subject_id,
        isFormTeacher: result.rows[0].is_form_teacher,
        sectionName: result.rows[0].section_name,
        schoolId: result.rows[0].school_id
      };

      next();
    } catch (error) {
      console.error('Teacher section authorization error:', error);
      return sendError(res, 'Authorization check failed', 500);
    }
  };
};

/**
 * Validate teacher has access to a specific student
 *
 * Checks if student belongs to any section the teacher is assigned to
 *
 * Usage: validateTeacherStudentAccess('params', 'studentId')
 */
const validateTeacherStudentAccess = (location = 'params', fieldName = 'studentId') => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const studentId = req[location][fieldName];

      if (!studentId) {
        return sendError(res, `Student ID is required in ${location}.${fieldName}`, 400);
      }

      // Get teacher_id from user_id
      const teacherResult = await query(
        'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2 AND is_active = TRUE',
        [userId, req.user.schoolId]
      );

      if (teacherResult.rows.length === 0) {
        return sendError(res, 'Teacher profile not found', 404);
      }

      const teacherId = teacherResult.rows[0].id;

      // Check if student belongs to any section this teacher is assigned to
      const result = await query(
        `SELECT s.id as student_id, s.full_name, sec.id as section_id, sec.section_name
         FROM students s
         JOIN sections sec ON s.section_id = sec.id
         JOIN teacher_class_assignments tca ON tca.section_id = sec.id
         WHERE tca.teacher_id = $1
           AND s.id = $2
           AND s.school_id = $3
           AND sec.school_id = $3
         LIMIT 1`,
        [teacherId, studentId, req.user.schoolId]
      );

      if (result.rows.length === 0) {
        return sendError(
          res,
          'Access denied. This student is not in any of your assigned sections.',
          403
        );
      }

      // Attach student info to request
      req.authorizedStudent = {
        studentId: result.rows[0].student_id,
        fullName: result.rows[0].full_name,
        sectionId: result.rows[0].section_id,
        sectionName: result.rows[0].section_name
      };

      next();
    } catch (error) {
      console.error('Teacher student authorization error:', error);
      return sendError(res, 'Authorization check failed', 500);
    }
  };
};

/**
 * Get all section IDs that a teacher is assigned to
 * Helper function for controllers that need to filter by sections
 */
const getTeacherSectionIds = async (teacherId, schoolId) => {
  try {
    const result = await query(
      `SELECT DISTINCT section_id
       FROM teacher_class_assignments tca
       JOIN sections s ON tca.section_id = s.id
       WHERE tca.teacher_id = $1
         AND s.school_id = $2`,
      [teacherId, schoolId]
    );

    return result.rows.map(row => row.section_id);
  } catch (error) {
    console.error('Error fetching teacher sections:', error);
    throw error;
  }
};

/**
 * Validate teacher has access to a class (grade level)
 * Less restrictive than section check - useful for class-level reports
 *
 * Usage: validateTeacherClassAccess('params', 'classId')
 */
const validateTeacherClassAccess = (location = 'params', fieldName = 'classId') => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const classId = req[location][fieldName];

      if (!classId) {
        return sendError(res, `Class ID is required in ${location}.${fieldName}`, 400);
      }

      // Get teacher_id from user_id
      const teacherResult = await query(
        'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2 AND is_active = TRUE',
        [userId, req.user.schoolId]
      );

      if (teacherResult.rows.length === 0) {
        return sendError(res, 'Teacher profile not found', 404);
      }

      const teacherId = teacherResult.rows[0].id;

      // Check if teacher has any sections in this class
      const result = await query(
        `SELECT DISTINCT c.id as class_id, c.class_name
         FROM classes c
         JOIN sections s ON s.class_id = c.id
         JOIN teacher_class_assignments tca ON tca.section_id = s.id
         WHERE tca.teacher_id = $1
           AND c.id = $2
           AND c.school_id = $3
         LIMIT 1`,
        [teacherId, classId, req.user.schoolId]
      );

      if (result.rows.length === 0) {
        return sendError(
          res,
          'Access denied. You have no sections in this class.',
          403
        );
      }

      // Attach class info to request
      req.authorizedClass = {
        classId: result.rows[0].class_id,
        className: result.rows[0].class_name
      };

      next();
    } catch (error) {
      console.error('Teacher class authorization error:', error);
      return sendError(res, 'Authorization check failed', 500);
    }
  };
};

/**
 * Middleware to check if teacher is a form teacher for a specific section
 * Form teachers have additional privileges (e.g., edit student details)
 */
const requireFormTeacher = (location = 'params', fieldName = 'sectionId') => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const sectionId = req[location][fieldName];

      if (!sectionId) {
        return sendError(res, `Section ID is required in ${location}.${fieldName}`, 400);
      }

      // Get teacher_id from user_id
      const teacherResult = await query(
        'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2 AND is_active = TRUE',
        [userId, req.user.schoolId]
      );

      if (teacherResult.rows.length === 0) {
        return sendError(res, 'Teacher profile not found', 404);
      }

      const teacherId = teacherResult.rows[0].id;

      // Check if teacher is form teacher for this section
      const result = await query(
        `SELECT id, section_id, is_form_teacher
         FROM teacher_class_assignments
         WHERE teacher_id = $1
           AND section_id = $2
           AND is_form_teacher = TRUE
         LIMIT 1`,
        [teacherId, sectionId]
      );

      if (result.rows.length === 0) {
        return sendError(
          res,
          'Access denied. Form teacher privileges required for this section.',
          403
        );
      }

      req.isFormTeacher = true;
      next();
    } catch (error) {
      console.error('Form teacher authorization error:', error);
      return sendError(res, 'Authorization check failed', 500);
    }
  };
};

module.exports = {
  requireTeacher,
  validateTeacherSectionAccess,
  validateTeacherStudentAccess,
  validateTeacherClassAccess,
  requireFormTeacher,
  getTeacherSectionIds, // Export helper function
};
