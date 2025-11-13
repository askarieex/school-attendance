const AcademicYear = require('../models/AcademicYear');

/**
 * Academic Year Utility Functions
 *
 * Helper functions for working with academic years across the application
 */

/**
 * Get the current academic year for a school
 *
 * @param {number} schoolId - The school ID
 * @returns {Promise<string|null>} The current academic year name (e.g., "2025-2026") or null if not set
 */
async function getCurrentAcademicYear(schoolId) {
  try {
    const currentYear = await AcademicYear.getCurrent(schoolId);
    return currentYear ? currentYear.year_name : null;
  } catch (error) {
    console.error(`Error getting current academic year for school ${schoolId}:`, error);
    return null;
  }
}

/**
 * Get the current academic year object (full details) for a school
 *
 * @param {number} schoolId - The school ID
 * @returns {Promise<Object|null>} The current academic year object or null
 */
async function getCurrentAcademicYearObject(schoolId) {
  try {
    return await AcademicYear.getCurrent(schoolId);
  } catch (error) {
    console.error(`Error getting current academic year object for school ${schoolId}:`, error);
    return null;
  }
}

/**
 * Calculate academic year from a given date
 * Assumes academic year runs from April to March (common in many countries)
 *
 * @param {Date} date - The date to calculate from (defaults to today)
 * @returns {string} The academic year in format "YYYY-YYYY"
 */
function calculateAcademicYearFromDate(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // JavaScript months are 0-indexed

  // If month is April (4) or later, academic year is current year - next year
  // If month is before April, academic year is last year - current year
  if (month >= 4) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

/**
 * Validate academic year format
 *
 * @param {string} yearName - The year name to validate (e.g., "2025-2026")
 * @returns {boolean} True if valid format
 */
function isValidAcademicYearFormat(yearName) {
  if (!yearName) return false;

  // Format should be YYYY-YYYY where second year = first year + 1
  const pattern = /^(\d{4})-(\d{4})$/;
  const match = yearName.match(pattern);

  if (!match) return false;

  const firstYear = parseInt(match[1], 10);
  const secondYear = parseInt(match[2], 10);

  return secondYear === firstYear + 1;
}

/**
 * Get academic year for a specific date
 * This checks the database to see which academic year the date falls in
 *
 * @param {number} schoolId - The school ID
 * @param {Date} date - The date to check
 * @returns {Promise<string|null>} The academic year name or null
 */
async function getAcademicYearForDate(schoolId, date) {
  try {
    const allYears = await AcademicYear.findAll(schoolId);

    for (const year of allYears) {
      const startDate = new Date(year.start_date);
      const endDate = new Date(year.end_date);

      if (date >= startDate && date <= endDate) {
        return year.year_name;
      }
    }

    return null;
  } catch (error) {
    console.error(`Error getting academic year for date:`, error);
    return null;
  }
}

/**
 * Middleware to attach current academic year to request object
 * Usage: Add this middleware after authentication
 *
 * Example:
 * router.get('/some-route', authenticate, attachCurrentAcademicYear, controllerFunction);
 */
async function attachCurrentAcademicYear(req, res, next) {
  try {
    if (req.user && req.user.schoolId) {
      const currentYear = await getCurrentAcademicYear(req.user.schoolId);
      req.currentAcademicYear = currentYear;

      // Also attach the full object
      const currentYearObject = await getCurrentAcademicYearObject(req.user.schoolId);
      req.currentAcademicYearObject = currentYearObject;
    }
    next();
  } catch (error) {
    console.error('Error in attachCurrentAcademicYear middleware:', error);
    // Don't fail the request, just continue without academic year
    next();
  }
}

module.exports = {
  getCurrentAcademicYear,
  getCurrentAcademicYearObject,
  calculateAcademicYearFromDate,
  isValidAcademicYearFormat,
  getAcademicYearForDate,
  attachCurrentAcademicYear,
};
