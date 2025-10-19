const Class = require('../models/Class');
const Section = require('../models/Section');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

/**
 * CLASS MANAGEMENT
 */

// Get all classes for the school
const getClasses = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;
    const { academicYear } = req.query;

    const classes = await Class.findAll(schoolId, academicYear);

    sendSuccess(res, classes, 'Classes retrieved successfully');
  } catch (error) {
    console.error('Get classes error:', error);
    sendError(res, 'Failed to retrieve classes', 500);
  }
};

// Create a new class
const createClass = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;
    const classData = req.body;

    // Validate required fields
    if (!classData.className || !classData.academicYear) {
      return sendError(res, 'Class name and academic year are required', 400);
    }

    const newClass = await Class.create(classData, schoolId);

    sendSuccess(res, newClass, 'Class created successfully', 201);
  } catch (error) {
    console.error('Create class error:', error);

    if (error.code === '23505') {
      return sendError(res, 'Class already exists for this academic year', 409);
    }

    sendError(res, 'Failed to create class', 500);
  }
};

// Get a single class by ID
const getClass = async (req, res) => {
  try {
    const { id } = req.params;

    const classData = await Class.findById(id);

    if (!classData) {
      return sendError(res, 'Class not found', 404);
    }

    // Verify class belongs to this school (multi-tenancy)
    if (classData.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    sendSuccess(res, classData, 'Class retrieved successfully');
  } catch (error) {
    console.error('Get class error:', error);
    sendError(res, 'Failed to retrieve class', 500);
  }
};

// Update a class
const updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Verify class exists and belongs to this school
    const existingClass = await Class.findById(id);
    if (!existingClass) {
      return sendError(res, 'Class not found', 404);
    }

    if (existingClass.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    const updatedClass = await Class.update(id, updates);

    sendSuccess(res, updatedClass, 'Class updated successfully');
  } catch (error) {
    console.error('Update class error:', error);

    if (error.code === '23505') {
      return sendError(res, 'Class name already exists for this academic year', 409);
    }

    sendError(res, 'Failed to update class', 500);
  }
};

// Delete (deactivate) a class
const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify class exists and belongs to this school
    const existingClass = await Class.findById(id);
    if (!existingClass) {
      return sendError(res, 'Class not found', 404);
    }

    if (existingClass.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    await Class.delete(id);

    sendSuccess(res, null, 'Class deactivated successfully');
  } catch (error) {
    console.error('Delete class error:', error);
    sendError(res, 'Failed to deactivate class', 500);
  }
};

// Get class statistics
const getClassStatistics = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;
    const { academicYear = '2025-2026' } = req.query;

    const stats = await Class.getStatistics(schoolId, academicYear);

    sendSuccess(res, stats, 'Statistics retrieved successfully');
  } catch (error) {
    console.error('Get statistics error:', error);
    sendError(res, 'Failed to retrieve statistics', 500);
  }
};

/**
 * SECTION MANAGEMENT
 */

// Get sections for a class
const getSections = async (req, res) => {
  try {
    const { classId } = req.params;

    // Verify class belongs to this school
    const classData = await Class.findById(classId);
    if (!classData) {
      return sendError(res, 'Class not found', 404);
    }

    if (classData.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    const sections = await Section.findByClass(classId);

    sendSuccess(res, sections, 'Sections retrieved successfully');
  } catch (error) {
    console.error('Get sections error:', error);
    sendError(res, 'Failed to retrieve sections', 500);
  }
};

// Create a new section
const createSection = async (req, res) => {
  try {
    const { classId } = req.params;
    const sectionData = req.body;

    // Verify class belongs to this school
    const classData = await Class.findById(classId);
    if (!classData) {
      return sendError(res, 'Class not found', 404);
    }

    if (classData.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    // Validate required fields
    if (!sectionData.sectionName) {
      return sendError(res, 'Section name is required', 400);
    }

    const newSection = await Section.create({
      ...sectionData,
      classId: parseInt(classId)
    });

    sendSuccess(res, newSection, 'Section created successfully', 201);
  } catch (error) {
    console.error('Create section error:', error);

    if (error.code === '23505') {
      return sendError(res, 'Section already exists in this class', 409);
    }

    sendError(res, 'Failed to create section', 500);
  }
};

// Get a single section by ID
const getSection = async (req, res) => {
  try {
    const { sectionId } = req.params;

    const section = await Section.findById(sectionId);

    if (!section) {
      return sendError(res, 'Section not found', 404);
    }

    // Verify section's class belongs to this school
    const classData = await Class.findById(section.class_id);
    if (classData.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    sendSuccess(res, section, 'Section retrieved successfully');
  } catch (error) {
    console.error('Get section error:', error);
    sendError(res, 'Failed to retrieve section', 500);
  }
};

// Get section with students
const getSectionWithStudents = async (req, res) => {
  try {
    const { sectionId } = req.params;

    const section = await Section.findByIdWithStudents(sectionId);

    if (!section) {
      return sendError(res, 'Section not found', 404);
    }

    // Verify section's class belongs to this school
    const classData = await Class.findById(section.class_id);
    if (classData.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    sendSuccess(res, section, 'Section with students retrieved successfully');
  } catch (error) {
    console.error('Get section with students error:', error);
    sendError(res, 'Failed to retrieve section', 500);
  }
};

// Update a section
const updateSection = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const updates = req.body;

    // Verify section exists
    const existingSection = await Section.findById(sectionId);
    if (!existingSection) {
      return sendError(res, 'Section not found', 404);
    }

    // Verify belongs to this school
    const classData = await Class.findById(existingSection.class_id);
    if (classData.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    const updatedSection = await Section.update(sectionId, updates);

    sendSuccess(res, updatedSection, 'Section updated successfully');
  } catch (error) {
    console.error('Update section error:', error);

    if (error.code === '23505') {
      return sendError(res, 'Section name already exists in this class', 409);
    }

    sendError(res, 'Failed to update section', 500);
  }
};

// Delete (deactivate) a section
const deleteSection = async (req, res) => {
  try {
    const { sectionId } = req.params;

    // Verify section exists
    const existingSection = await Section.findById(sectionId);
    if (!existingSection) {
      return sendError(res, 'Section not found', 404);
    }

    // Verify belongs to this school
    const classData = await Class.findById(existingSection.class_id);
    if (classData.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    await Section.delete(sectionId);

    sendSuccess(res, null, 'Section deactivated successfully');
  } catch (error) {
    console.error('Delete section error:', error);
    sendError(res, 'Failed to deactivate section', 500);
  }
};

// Assign form teacher to section
const assignFormTeacher = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { teacherId } = req.body;

    if (!teacherId) {
      return sendError(res, 'Teacher ID is required', 400);
    }

    // Verify section exists and belongs to this school
    const section = await Section.findById(sectionId);
    if (!section) {
      return sendError(res, 'Section not found', 404);
    }

    const classData = await Class.findById(section.class_id);
    if (classData.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    const updatedSection = await Section.assignFormTeacher(sectionId, teacherId);

    sendSuccess(res, updatedSection, 'Form teacher assigned successfully');
  } catch (error) {
    console.error('Assign form teacher error:', error);
    sendError(res, 'Failed to assign form teacher', 500);
  }
};

// Remove form teacher from section
const removeFormTeacher = async (req, res) => {
  try {
    const { sectionId } = req.params;

    // Verify section exists and belongs to this school
    const section = await Section.findById(sectionId);
    if (!section) {
      return sendError(res, 'Section not found', 404);
    }

    const classData = await Class.findById(section.class_id);
    if (classData.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    const updatedSection = await Section.removeFormTeacher(sectionId);

    sendSuccess(res, updatedSection, 'Form teacher removed successfully');
  } catch (error) {
    console.error('Remove form teacher error:', error);
    sendError(res, 'Failed to remove form teacher', 500);
  }
};

// Get all sections for the school (across all classes)
const getAllSections = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;

    const sections = await Section.findBySchool(schoolId);

    sendSuccess(res, sections, 'All sections retrieved successfully');
  } catch (error) {
    console.error('Get all sections error:', error);
    sendError(res, 'Failed to retrieve sections', 500);
  }
};

module.exports = {
  // Classes
  getClasses,
  createClass,
  getClass,
  updateClass,
  deleteClass,
  getClassStatistics,

  // Sections
  getSections,
  createSection,
  getSection,
  getSectionWithStudents,
  updateSection,
  deleteSection,
  assignFormTeacher,
  removeFormTeacher,
  getAllSections
};
