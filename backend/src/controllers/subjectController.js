const Subject = require('../models/Subject');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Subject Controller
 *
 * Handles all subject management operations for schools
 */

/**
 * Get all subjects for a school
 * GET /api/subjects
 */
const getAllSubjects = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { includeInactive, includeStats } = req.query;

    console.log('📚 getAllSubjects called');
    console.log('   schoolId:', schoolId);
    console.log('   includeInactive:', includeInactive);
    console.log('   includeStats:', includeStats);

    const options = {
      includeInactive: includeInactive === 'true',
      includeStats: includeStats === 'true'
    };

    console.log('   options:', options);

    const subjects = await Subject.findAll(schoolId, options);

    console.log('   subjects found:', subjects.length);
    console.log('   subjects:', subjects);

    return sendSuccess(res, {
      subjects,
      count: subjects.length
    }, 'Subjects retrieved successfully');
  } catch (error) {
    console.error('Get all subjects error:', error);
    return sendError(res, 'Failed to retrieve subjects', 500);
  }
};

/**
 * Get a single subject by ID
 * GET /api/subjects/:id
 */
const getSubjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const subject = await Subject.findById(id, schoolId);

    if (!subject) {
      return sendError(res, 'Subject not found', 404);
    }

    return sendSuccess(res, { subject }, 'Subject retrieved successfully');
  } catch (error) {
    console.error('Get subject by ID error:', error);
    return sendError(res, 'Failed to retrieve subject', 500);
  }
};

/**
 * Create a new subject
 * POST /api/subjects
 */
const createSubject = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { subjectName, subjectCode, description, isActive } = req.body;

    // Validation
    if (!subjectName || subjectName.trim() === '') {
      return sendError(res, 'Subject name is required', 400);
    }

    // Check if subject name already exists
    const exists = await Subject.findByName(subjectName, schoolId);
    if (exists) {
      return sendError(res, 'A subject with this name already exists', 400);
    }

    // Create subject
    const subject = await Subject.create(
      { subjectName, subjectCode, description, isActive },
      schoolId
    );

    return sendSuccess(res, { subject }, 'Subject created successfully', 201);
  } catch (error) {
    console.error('Create subject error:', error);

    // Handle unique constraint violation
    if (error.code === '23505') {
      return sendError(res, 'A subject with this name already exists', 400);
    }

    return sendError(res, 'Failed to create subject', 500);
  }
};

/**
 * Update a subject
 * PUT /api/subjects/:id
 */
const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;
    const { subjectName, subjectCode, description, isActive } = req.body;

    // Check if subject exists
    const existingSubject = await Subject.findById(id, schoolId);
    if (!existingSubject) {
      return sendError(res, 'Subject not found', 404);
    }

    // Check name uniqueness if name is being changed
    if (subjectName && subjectName !== existingSubject.subject_name) {
      const isUnique = await Subject.isNameUnique(subjectName, schoolId, id);
      if (!isUnique) {
        return sendError(res, 'A subject with this name already exists', 400);
      }
    }

    // Update subject
    const updatedSubject = await Subject.update(
      id,
      { subjectName, subjectCode, description, isActive },
      schoolId
    );

    if (!updatedSubject) {
      return sendError(res, 'Subject not found or update failed', 404);
    }

    return sendSuccess(res, { subject: updatedSubject }, 'Subject updated successfully');
  } catch (error) {
    console.error('Update subject error:', error);

    // Handle unique constraint violation
    if (error.code === '23505') {
      return sendError(res, 'A subject with this name already exists', 400);
    }

    return sendError(res, 'Failed to update subject', 500);
  }
};

/**
 * Delete (deactivate) a subject
 * DELETE /api/subjects/:id
 */
const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;
    const { hard } = req.query; // ?hard=true for hard delete

    // Check if subject exists
    const existingSubject = await Subject.findById(id, schoolId);
    if (!existingSubject) {
      return sendError(res, 'Subject not found', 404);
    }

    let deletedSubject;

    if (hard === 'true') {
      // Hard delete (only if no assignments)
      try {
        deletedSubject = await Subject.hardDelete(id, schoolId);
      } catch (error) {
        if (error.message.includes('existing assignments')) {
          return sendError(res, error.message, 400);
        }
        throw error;
      }
    } else {
      // Soft delete (deactivate)
      deletedSubject = await Subject.delete(id, schoolId);
    }

    if (!deletedSubject) {
      return sendError(res, 'Subject not found or delete failed', 404);
    }

    return sendSuccess(res, { subject: deletedSubject }, 'Subject deleted successfully');
  } catch (error) {
    console.error('Delete subject error:', error);
    return sendError(res, 'Failed to delete subject', 500);
  }
};

/**
 * Get subjects assigned to current teacher
 * GET /api/subjects/my-subjects
 */
const getMySubjects = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const schoolId = req.user.schoolId;

    const subjects = await Subject.findByTeacher(teacherId, schoolId);

    return sendSuccess(res, {
      subjects,
      count: subjects.length
    }, 'Teacher subjects retrieved successfully');
  } catch (error) {
    console.error('Get teacher subjects error:', error);
    return sendError(res, 'Failed to retrieve subjects', 500);
  }
};

/**
 * Get subjects for a specific section
 * GET /api/subjects/section/:sectionId
 */
const getSubjectsBySection = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const schoolId = req.user.schoolId;

    const subjects = await Subject.findBySection(sectionId, schoolId);

    return sendSuccess(res, {
      subjects,
      count: subjects.length
    }, 'Section subjects retrieved successfully');
  } catch (error) {
    console.error('Get section subjects error:', error);
    return sendError(res, 'Failed to retrieve subjects', 500);
  }
};

/**
 * Create default subjects for a school
 * POST /api/subjects/create-defaults
 */
const createDefaultSubjects = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const subjects = await Subject.createDefaults(schoolId);

    return sendSuccess(res, {
      subjects,
      count: subjects.length
    }, 'Default subjects created successfully');
  } catch (error) {
    console.error('Create default subjects error:', error);
    return sendError(res, 'Failed to create default subjects', 500);
  }
};

/**
 * Get subject statistics
 * GET /api/subjects/statistics
 */
const getSubjectStatistics = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const statistics = await Subject.getStatistics(schoolId);

    return sendSuccess(res, { statistics }, 'Statistics retrieved successfully');
  } catch (error) {
    console.error('Get subject statistics error:', error);
    return sendError(res, 'Failed to retrieve statistics', 500);
  }
};

module.exports = {
  getAllSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
  getMySubjects,
  getSubjectsBySection,
  createDefaultSubjects,
  getSubjectStatistics
};
