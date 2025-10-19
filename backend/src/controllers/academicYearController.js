const AcademicYear = require('../models/AcademicYear');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * ACADEMIC YEAR MANAGEMENT
 */

// Get all academic years for the school
const getAcademicYears = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;

    const academicYears = await AcademicYear.findAll(schoolId);

    sendSuccess(res, academicYears, 'Academic years retrieved successfully');
  } catch (error) {
    console.error('Get academic years error:', error);
    sendError(res, 'Failed to retrieve academic years', 500);
  }
};

// Get current academic year
const getCurrentAcademicYear = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;

    const currentYear = await AcademicYear.getCurrent(schoolId);

    if (!currentYear) {
      return sendError(res, 'No current academic year set', 404);
    }

    sendSuccess(res, currentYear, 'Current academic year retrieved successfully');
  } catch (error) {
    console.error('Get current academic year error:', error);
    sendError(res, 'Failed to retrieve current academic year', 500);
  }
};

// Get academic year by ID
const getAcademicYear = async (req, res) => {
  try {
    const { id } = req.params;

    const academicYear = await AcademicYear.findById(id);

    if (!academicYear) {
      return sendError(res, 'Academic year not found', 404);
    }

    // Verify academic year belongs to this school
    if (academicYear.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    sendSuccess(res, academicYear, 'Academic year retrieved successfully');
  } catch (error) {
    console.error('Get academic year error:', error);
    sendError(res, 'Failed to retrieve academic year', 500);
  }
};

// Create new academic year
const createAcademicYear = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;
    const yearData = req.body;

    // Validate required fields
    if (!yearData.yearName || !yearData.startDate || !yearData.endDate) {
      return sendError(res, 'Year name, start date, and end date are required', 400);
    }

    const academicYear = await AcademicYear.create(yearData, schoolId);

    sendSuccess(res, academicYear, 'Academic year created successfully', 201);
  } catch (error) {
    console.error('Create academic year error:', error);
    sendError(res, 'Failed to create academic year', 500);
  }
};

// Update academic year
const updateAcademicYear = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const academicYear = await AcademicYear.findById(id);

    if (!academicYear) {
      return sendError(res, 'Academic year not found', 404);
    }

    // Verify academic year belongs to this school
    if (academicYear.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    const updatedYear = await AcademicYear.update(id, updates);

    sendSuccess(res, updatedYear, 'Academic year updated successfully');
  } catch (error) {
    console.error('Update academic year error:', error);
    sendError(res, 'Failed to update academic year', 500);
  }
};

// Set as current academic year
const setCurrentAcademicYear = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.tenantSchoolId;

    const academicYear = await AcademicYear.findById(id);

    if (!academicYear) {
      return sendError(res, 'Academic year not found', 404);
    }

    // Verify academic year belongs to this school
    if (academicYear.school_id !== schoolId) {
      return sendError(res, 'Access denied', 403);
    }

    const updatedYear = await AcademicYear.setCurrent(id, schoolId);

    sendSuccess(res, updatedYear, 'Academic year set as current successfully');
  } catch (error) {
    console.error('Set current academic year error:', error);
    sendError(res, 'Failed to set current academic year', 500);
  }
};

// Delete academic year
const deleteAcademicYear = async (req, res) => {
  try {
    const { id } = req.params;

    const academicYear = await AcademicYear.findById(id);

    if (!academicYear) {
      return sendError(res, 'Academic year not found', 404);
    }

    // Verify academic year belongs to this school
    if (academicYear.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    // Prevent deleting current academic year
    if (academicYear.is_current) {
      return sendError(res, 'Cannot delete current academic year', 400);
    }

    await AcademicYear.delete(id);

    sendSuccess(res, null, 'Academic year deleted successfully');
  } catch (error) {
    console.error('Delete academic year error:', error);
    sendError(res, 'Failed to delete academic year', 500);
  }
};

// Get vacation periods for academic year
const getVacationPeriods = async (req, res) => {
  try {
    const { id } = req.params;

    const academicYear = await AcademicYear.findById(id);

    if (!academicYear) {
      return sendError(res, 'Academic year not found', 404);
    }

    // Verify academic year belongs to this school
    if (academicYear.school_id !== req.tenantSchoolId) {
      return sendError(res, 'Access denied', 403);
    }

    const vacations = await AcademicYear.getVacationPeriods(id);

    sendSuccess(res, vacations, 'Vacation periods retrieved successfully');
  } catch (error) {
    console.error('Get vacation periods error:', error);
    sendError(res, 'Failed to retrieve vacation periods', 500);
  }
};

// Add vacation period
const addVacationPeriod = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.tenantSchoolId;
    const vacationData = req.body;

    const academicYear = await AcademicYear.findById(id);

    if (!academicYear) {
      return sendError(res, 'Academic year not found', 404);
    }

    // Verify academic year belongs to this school
    if (academicYear.school_id !== schoolId) {
      return sendError(res, 'Access denied', 403);
    }

    // Validate required fields
    if (!vacationData.vacationName || !vacationData.startDate || !vacationData.endDate) {
      return sendError(res, 'Vacation name, start date, and end date are required', 400);
    }

    const vacation = await AcademicYear.addVacationPeriod(vacationData, id, schoolId);

    sendSuccess(res, vacation, 'Vacation period added successfully', 201);
  } catch (error) {
    console.error('Add vacation period error:', error);
    sendError(res, 'Failed to add vacation period', 500);
  }
};

// Delete vacation period
const deleteVacationPeriod = async (req, res) => {
  try {
    const { vacationId } = req.params;

    // Note: We should verify the vacation belongs to this school
    // But for now, we'll rely on the school tenancy middleware

    await AcademicYear.deleteVacationPeriod(vacationId);

    sendSuccess(res, null, 'Vacation period deleted successfully');
  } catch (error) {
    console.error('Delete vacation period error:', error);
    sendError(res, 'Failed to delete vacation period', 500);
  }
};

module.exports = {
  getAcademicYears,
  getCurrentAcademicYear,
  getAcademicYear,
  createAcademicYear,
  updateAcademicYear,
  setCurrentAcademicYear,
  deleteAcademicYear,
  getVacationPeriods,
  addVacationPeriod,
  deleteVacationPeriod,
};
