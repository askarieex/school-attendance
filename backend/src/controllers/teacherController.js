const Teacher = require('../models/Teacher');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

/**
 * TEACHER MANAGEMENT
 */

// Get all teachers for the school
const getTeachers = async (req, res) => {
  try {
    const { page = 1, limit = 20, subject, search } = req.query;
    const schoolId = req.tenantSchoolId;

    const filters = {};
    if (subject) filters.subject = subject;
    if (search) filters.search = search;

    const result = await Teacher.findAll(
      schoolId,
      parseInt(page),
      parseInt(limit),
      filters
    );

    sendPaginated(res, result.teachers, page, limit, result.total);
  } catch (error) {
    console.error('Get teachers error:', error);
    sendError(res, 'Failed to retrieve teachers', 500);
  }
};

// Create a new teacher
const createTeacher = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;
    const teacherData = req.body;

    // Validate required fields
    if (!teacherData.fullName || !teacherData.email) {
      return sendError(res, 'Full name and email are required', 400);
    }

    const teacher = await Teacher.create(teacherData, schoolId);

    sendSuccess(res, teacher, 'Teacher created successfully', 201);
  } catch (error) {
    console.error('Create teacher error:', error);

    if (error.code === '23505') {
      return sendError(res, 'Email already exists', 409);
    }

    sendError(res, 'Failed to create teacher', 500);
  }
};

// Get a single teacher by ID
const getTeacher = async (req, res) => {
  try {
    const { id } = req.params;

    const teacher = await Teacher.findById(id);

    if (!teacher) {
      return sendError(res, 'Teacher not found', 404);
    }

    // Verify teacher belongs to this school
    if (teacher.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    sendSuccess(res, teacher, 'Teacher retrieved successfully');
  } catch (error) {
    console.error('Get teacher error:', error);
    sendError(res, 'Failed to retrieve teacher', 500);
  }
};

// Update a teacher
const updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Verify teacher exists and belongs to this school
    const existingTeacher = await Teacher.findById(id);
    if (!existingTeacher) {
      return sendError(res, 'Teacher not found', 404);
    }

    if (existingTeacher.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    const updatedTeacher = await Teacher.update(id, updates);

    sendSuccess(res, updatedTeacher, 'Teacher updated successfully');
  } catch (error) {
    console.error('Update teacher error:', error);

    if (error.code === '23505') {
      return sendError(res, 'Email already exists', 409);
    }

    sendError(res, 'Failed to update teacher', 500);
  }
};

// Delete (deactivate) a teacher
const deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify teacher exists and belongs to this school
    const existingTeacher = await Teacher.findById(id);
    if (!existingTeacher) {
      return sendError(res, 'Teacher not found', 404);
    }

    if (existingTeacher.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    await Teacher.delete(id);

    sendSuccess(res, null, 'Teacher deactivated successfully');
  } catch (error) {
    console.error('Delete teacher error:', error);
    sendError(res, 'Failed to deactivate teacher', 500);
  }
};

/**
 * TEACHER ASSIGNMENTS
 */

// Get teacher's assignments
const getTeacherAssignments = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify teacher exists and belongs to this school
    const teacher = await Teacher.findById(id);
    if (!teacher) {
      return sendError(res, 'Teacher not found', 404);
    }

    if (teacher.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    // ✅ FIXED: Get current academic year dynamically instead of hardcoded
    let academicYear = req.query.academicYear;

    if (!academicYear) {
      const { getCurrentAcademicYear } = require('../utils/academicYear');
      academicYear = await getCurrentAcademicYear(teacher.school_id);
    }

    if (!academicYear) {
      return sendError(res, 'No active academic year found. Please set current academic year in settings.', 400);
    }

    const assignments = await Teacher.getAssignments(id, academicYear);

    sendSuccess(res, assignments, 'Assignments retrieved successfully');
  } catch (error) {
    console.error('Get teacher assignments error:', error);
    sendError(res, 'Failed to retrieve assignments', 500);
  }
};

// Assign teacher to section
const assignTeacherToSection = async (req, res) => {
  try {
    const { id } = req.params;
    const assignmentData = req.body;

    // Validate required fields
    if (!assignmentData.sectionId) {
      return sendError(res, 'Section ID is required', 400);
    }

    // Verify teacher exists and belongs to this school
    const teacher = await Teacher.findById(id);
    if (!teacher) {
      return sendError(res, 'Teacher not found', 404);
    }

    if (teacher.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    // SECURITY FIX: Verify section belongs to the same school
    const Section = require('../models/Section');
    const Class = require('../models/Class');
    
    const section = await Section.findById(assignmentData.sectionId);
    if (!section) {
      return sendError(res, 'Section not found', 404);
    }

    const sectionClass = await Class.findById(section.class_id);
    if (sectionClass.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Cannot assign teacher to another school\'s section', 403);
    }

    const assignment = await Teacher.assignToSection(id, assignmentData);

    sendSuccess(res, assignment, 'Teacher assigned to section successfully', 201);
  } catch (error) {
    console.error('Assign teacher error:', error);

    if (error.code === '23505') {
      return sendError(res, 'Teacher already assigned to this section for this subject', 409);
    }

    if (error.message && error.message.includes('already has a form teacher')) {
      return sendError(res, error.message, 409);
    }

    sendError(res, 'Failed to assign teacher', 500);
  }
};

// Remove teacher assignment
const removeTeacherAssignment = async (req, res) => {
  try {
    const { id, assignmentId } = req.params;

    // Verify teacher exists and belongs to this school
    const teacher = await Teacher.findById(id);
    if (!teacher) {
      return sendError(res, 'Teacher not found', 404);
    }

    if (teacher.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    const removedAssignment = await Teacher.removeAssignment(assignmentId);

    if (!removedAssignment) {
      return sendError(res, 'Assignment not found', 404);
    }

    sendSuccess(res, removedAssignment, 'Assignment removed successfully');
  } catch (error) {
    console.error('Remove assignment error:', error);
    sendError(res, 'Failed to remove assignment', 500);
  }
};

/**
 * TEACHER PASSWORD MANAGEMENT
 */

// Reset teacher password
const resetTeacherPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return sendError(res, 'Password must be at least 6 characters', 400);
    }

    // Verify teacher exists and belongs to this school
    const teacher = await Teacher.findById(id);
    if (!teacher) {
      return sendError(res, 'Teacher not found', 404);
    }

    if (teacher.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    await Teacher.resetPassword(id, newPassword);

    sendSuccess(res, null, 'Password reset successfully');
  } catch (error) {
    console.error('Reset password error:', error);
    sendError(res, 'Failed to reset password', 500);
  }
};

module.exports = {
  getTeachers,
  createTeacher,
  getTeacher,
  updateTeacher,
  deleteTeacher,

  // Assignments
  getTeacherAssignments,
  assignTeacherToSection,
  removeTeacherAssignment,

  // Password
  resetTeacherPassword
};
