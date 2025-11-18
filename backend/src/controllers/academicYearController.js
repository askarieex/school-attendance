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
    const { query } = require('../config/database');

    // Normalize field names (accept both camelCase and snake_case)
    const yearName = yearData.year_name || yearData.yearName;
    const startDate = yearData.start_date || yearData.startDate;
    const endDate = yearData.end_date || yearData.endDate;

    // Validate required fields
    if (!yearName || !startDate || !endDate) {
      return sendError(res, 'Year name, start date, and end date are required', 400);
    }

    // ✅ FIX BUG #4: Validate year name format (YYYY-YYYY)
    const yearNamePattern = /^(\d{4})-(\d{4})$/;
    const match = yearName.match(yearNamePattern);

    if (!match) {
      return sendError(
        res,
        'Invalid year name format. Must be YYYY-YYYY (e.g., 2025-2026)',
        400
      );
    }

    const [, startYear, endYear] = match;
    if (parseInt(endYear) !== parseInt(startYear) + 1) {
      return sendError(
        res,
        'Invalid year name. Second year must be exactly one year after first year (e.g., 2025-2026)',
        400
      );
    }

    // ✅ Validate dates: end date must be after start date
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (endDateObj <= startDateObj) {
      return sendError(res, 'End date must be after start date', 400);
    }

    // ✅ FIX BUG #4: Check for date overlaps with existing academic years
    const overlapCheck = await query(
      `SELECT year_name, start_date, end_date FROM academic_years
       WHERE school_id = $1
       AND (
         (start_date <= $2 AND end_date >= $2)  -- New start overlaps with existing
         OR (start_date <= $3 AND end_date >= $3)  -- New end overlaps with existing
         OR (start_date >= $2 AND end_date <= $3)  -- Existing year completely within new range
       )`,
      [schoolId, startDate, endDate]
    );

    if (overlapCheck.rows.length > 0) {
      const conflictingYear = overlapCheck.rows[0];
      return sendError(
        res,
        `Academic year dates overlap with existing year "${conflictingYear.year_name}" ` +
        `(${new Date(conflictingYear.start_date).toLocaleDateString()} - ${new Date(conflictingYear.end_date).toLocaleDateString()}). ` +
        `Please choose different dates.`,
        400
      );
    }

    // ✅ Check for duplicate year name
    const duplicateCheck = await query(
      'SELECT id FROM academic_years WHERE school_id = $1 AND year_name = $2',
      [schoolId, yearName]
    );

    if (duplicateCheck.rows.length > 0) {
      return sendError(
        res,
        `Academic year "${yearName}" already exists for this school`,
        400
      );
    }

    // Normalize the data for the model (use snake_case)
    const normalizedData = {
      year_name: yearName,
      start_date: startDate,
      end_date: endDate,
      working_days: yearData.working_days || yearData.workingDays || 'Mon-Sat',
      weekly_holiday: yearData.weekly_holiday || yearData.weeklyHoliday || 'Sunday'
    };

    const academicYear = await AcademicYear.create(normalizedData, schoolId);

    console.log(`✅ Created academic year ${academicYear.year_name} (ID: ${academicYear.id}) for school ${schoolId}`);
    sendSuccess(res, academicYear, 'Academic year created successfully', 201);
  } catch (error) {
    console.error('Create academic year error:', error);

    // Handle unique constraint violation
    if (error.code === '23505') {
      return sendError(res, 'Academic year with this name already exists', 409);
    }

    sendError(res, error.message || 'Failed to create academic year', 500);
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
    const { query } = require('../config/database');

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

    // ✅ FIX BUG #5: Check if any students are using this academic year
    const studentsCheck = await query(
      'SELECT COUNT(*) as count FROM students WHERE academic_year = $1',
      [academicYear.year_name]
    );

    const studentCount = parseInt(studentsCheck.rows[0].count);
    if (studentCount > 0) {
      return sendError(
        res,
        `Cannot delete academic year ${academicYear.year_name}. ${studentCount} student(s) are enrolled in this year. Please reassign students first.`,
        400
      );
    }

    // ✅ Check if any teachers are assigned to this academic year
    const teachersCheck = await query(
      'SELECT COUNT(*) as count FROM teacher_class_assignments WHERE academic_year = $1',
      [academicYear.year_name]
    );

    const teacherCount = parseInt(teachersCheck.rows[0].count);
    if (teacherCount > 0) {
      return sendError(
        res,
        `Cannot delete academic year ${academicYear.year_name}. ${teacherCount} teacher assignment(s) exist for this year.`,
        400
      );
    }

    // ✅ Check if any attendance records exist within this year's date range
    const attendanceCheck = await query(
      'SELECT COUNT(*) as count FROM attendance_logs WHERE date BETWEEN $1 AND $2',
      [academicYear.start_date, academicYear.end_date]
    );

    const attendanceCount = parseInt(attendanceCheck.rows[0].count);
    if (attendanceCount > 0) {
      return sendError(
        res,
        `Cannot delete academic year ${academicYear.year_name}. ${attendanceCount} attendance record(s) exist for this period. Historical data must be preserved.`,
        400
      );
    }

    await AcademicYear.delete(id);

    console.log(`✅ Deleted academic year ${academicYear.year_name} (ID: ${id}) for school ${req.tenantSchoolId}`);
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

/**
 * STUDENT PROMOTION
 */

// Get promotion preview
const getPromotionPreview = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;
    const { fromYear } = req.query;

    if (!fromYear) {
      return sendError(res, 'Source academic year (fromYear) is required', 400);
    }

    const preview = await AcademicYear.getPromotionPreview(schoolId, fromYear);

    sendSuccess(res, preview, 'Promotion preview retrieved successfully');
  } catch (error) {
    console.error('Get promotion preview error:', error);
    sendError(res, error.message || 'Failed to get promotion preview', 500);
  }
};

// Promote students to new academic year
const promoteStudents = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;
    const { fromYear, toYear, confirm } = req.body;

    // Validation
    if (!fromYear || !toYear) {
      return sendError(res, 'Both fromYear and toYear are required', 400);
    }

    if (fromYear === toYear) {
      return sendError(res, 'Source and target academic years cannot be the same', 400);
    }

    // Safety check: require explicit confirmation
    if (confirm !== true) {
      return sendError(
        res,
        'Promotion requires explicit confirmation. Set "confirm": true in request body',
        400
      );
    }

    console.log(`🎓 Starting student promotion for school ${schoolId}: ${fromYear} → ${toYear}`);

    const result = await AcademicYear.promoteStudents(schoolId, fromYear, toYear);

    console.log(`✅ Promotion complete: ${result.studentsPromoted} students promoted`);

    sendSuccess(res, result, result.message, 200);
  } catch (error) {
    console.error('Promote students error:', error);
    sendError(res, error.message || 'Failed to promote students', 500);
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
  // ✅ NEW: Student promotion
  getPromotionPreview,
  promoteStudents,
};
