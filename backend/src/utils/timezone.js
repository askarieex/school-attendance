/**
 * Timezone Utilities for Indian Standard Time (IST - UTC+5:30)
 *
 * This module ensures consistent timezone handling across the application.
 * All dates are stored in UTC in the database, but displayed in IST to users.
 */

const IST_OFFSET_MINUTES = 330; // IST is UTC+5:30 (5 hours 30 minutes = 330 minutes)

/**
 * Get current date in IST as YYYY-MM-DD format
 * @returns {string} Date in YYYY-MM-DD format (IST)
 */
const getCurrentDateIST = () => {
  const now = new Date();
  const istDate = new Date(now.getTime() + (IST_OFFSET_MINUTES * 60 * 1000));

  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/**
 * Get current time in IST as HH:MM:SS format
 * @returns {string} Time in HH:MM:SS format (IST)
 */
const getCurrentTimeIST = () => {
  const now = new Date();
  const istDate = new Date(now.getTime() + (IST_OFFSET_MINUTES * 60 * 1000));

  const hours = String(istDate.getUTCHours()).padStart(2, '0');
  const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(istDate.getUTCSeconds()).padStart(2, '0');

  return `${hours}:${minutes}:${seconds}`;
};

/**
 * Get current datetime in IST
 * @returns {Date} Date object representing current time in IST
 */
const getCurrentDateTimeIST = () => {
  const now = new Date();
  return new Date(now.getTime() + (IST_OFFSET_MINUTES * 60 * 1000));
};

/**
 * Convert UTC date to IST date string (YYYY-MM-DD)
 * @param {Date|string} utcDate - UTC date to convert
 * @returns {string} Date in YYYY-MM-DD format (IST)
 */
const utcToISTDate = (utcDate) => {
  const date = new Date(utcDate);
  const istDate = new Date(date.getTime() + (IST_OFFSET_MINUTES * 60 * 1000));

  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/**
 * Convert UTC datetime to IST time string (HH:MM:SS)
 * @param {Date|string} utcDateTime - UTC datetime to convert
 * @returns {string} Time in HH:MM:SS format (IST)
 */
const utcToISTTime = (utcDateTime) => {
  const date = new Date(utcDateTime);
  const istDate = new Date(date.getTime() + (IST_OFFSET_MINUTES * 60 * 1000));

  const hours = String(istDate.getUTCHours()).padStart(2, '0');
  const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(istDate.getUTCSeconds()).padStart(2, '0');

  return `${hours}:${minutes}:${seconds}`;
};

/**
 * Convert IST date string (YYYY-MM-DD) to UTC Date object
 * Assumes the date is at start of day (00:00:00) in IST
 * @param {string} istDateStr - IST date string (YYYY-MM-DD)
 * @returns {Date} UTC Date object
 */
const istDateToUTC = (istDateStr) => {
  const [year, month, day] = istDateStr.split('-').map(Number);

  // Create date at midnight IST
  const istDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

  // Subtract IST offset to get UTC
  return new Date(istDate.getTime() - (IST_OFFSET_MINUTES * 60 * 1000));
};

/**
 * Convert IST datetime string to UTC Date object
 * @param {string} istDateStr - IST date (YYYY-MM-DD)
 * @param {string} istTimeStr - IST time (HH:MM:SS)
 * @returns {Date} UTC Date object
 */
const istDateTimeToUTC = (istDateStr, istTimeStr = '00:00:00') => {
  const [year, month, day] = istDateStr.split('-').map(Number);
  const [hours, minutes, seconds] = istTimeStr.split(':').map(Number);

  // Create date in IST
  const istDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));

  // Subtract IST offset to get UTC
  return new Date(istDate.getTime() - (IST_OFFSET_MINUTES * 60 * 1000));
};

/**
 * Check if a time is late based on school start time (in IST)
 * @param {string} checkInTime - Check-in time (HH:MM:SS in IST)
 * @param {string} schoolStartTime - School start time (HH:MM:SS in IST), default 09:00:00
 * @returns {boolean} True if late, false otherwise
 */
const isLate = (checkInTime, schoolStartTime = '09:00:00') => {
  const checkIn = checkInTime.split(':').map(Number);
  const schoolStart = schoolStartTime.split(':').map(Number);

  // Compare hours
  if (checkIn[0] > schoolStart[0]) return true;
  if (checkIn[0] < schoolStart[0]) return false;

  // Hours are equal, compare minutes
  if (checkIn[1] > schoolStart[1]) return true;
  if (checkIn[1] < schoolStart[1]) return false;

  // Minutes are equal, compare seconds
  return checkIn[2] > schoolStart[2];
};

/**
 * Format date for display in IST
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string (DD/MM/YYYY)
 */
const formatDateIST = (date) => {
  const istDateStr = utcToISTDate(date);
  const [year, month, day] = istDateStr.split('-');
  return `${day}/${month}/${year}`;
};

/**
 * Format datetime for display in IST
 * @param {Date|string} datetime - Datetime to format
 * @returns {string} Formatted datetime string (DD/MM/YYYY HH:MM:SS)
 */
const formatDateTimeIST = (datetime) => {
  const dateStr = formatDateIST(datetime);
  const timeStr = utcToISTTime(datetime);
  return `${dateStr} ${timeStr}`;
};

/**
 * Get start of day in UTC for a given IST date
 * Useful for database queries
 * @param {string} istDateStr - IST date (YYYY-MM-DD)
 * @returns {Date} UTC Date at start of IST day
 */
const getStartOfDayUTC = (istDateStr) => {
  return istDateTimeToUTC(istDateStr, '00:00:00');
};

/**
 * Get end of day in UTC for a given IST date
 * Useful for database queries
 * @param {string} istDateStr - IST date (YYYY-MM-DD)
 * @returns {Date} UTC Date at end of IST day
 */
const getEndOfDayUTC = (istDateStr) => {
  return istDateTimeToUTC(istDateStr, '23:59:59');
};

module.exports = {
  IST_OFFSET_MINUTES,
  getCurrentDateIST,
  getCurrentTimeIST,
  getCurrentDateTimeIST,
  utcToISTDate,
  utcToISTTime,
  istDateToUTC,
  istDateTimeToUTC,
  isLate,
  formatDateIST,
  formatDateTimeIST,
  getStartOfDayUTC,
  getEndOfDayUTC
};
