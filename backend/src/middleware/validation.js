const { body, param, query, validationResult } = require('express-validator');

/**
 * Validation Middleware
 * Protects against malformed data, XSS, and other input-based attacks
 */

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

/**
 * Student validation rules
 */
const validateStudent = {
  create: [
    body('fullName')
      .trim()
      .notEmpty().withMessage('Full name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Full name must be 2-100 characters')
      .matches(/^[a-zA-Z\s.'-]+$/).withMessage('Full name contains invalid characters'),

    body('rfidCardId')
      .trim()
      .notEmpty().withMessage('RFID card ID is required')
      .isLength({ min: 1, max: 50 }).withMessage('RFID card ID must be 1-50 characters'),

    body('grade')
      .optional()
      .trim()
      .isLength({ min: 1, max: 20 }).withMessage('Grade must be 1-20 characters'),

    body('section')
      .optional()
      .trim()
      .isLength({ max: 10 }).withMessage('Section must be max 10 characters'),

    body('parentContact')
      .optional()
      .trim()
      .matches(/^[+]?[\d\s()-]{10,20}$/).withMessage('Invalid phone number format'),

    body('parentEmail')
      .optional()
      .trim()
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),

    body('address')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Address must be max 500 characters'),

    body('dob')
      .optional()
      .isISO8601().withMessage('Invalid date format')
      .toDate(),

    body('gender')
      .optional()
      .isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),

    body('rollNumber')
      .optional()
      .trim()
      .isLength({ max: 50 }).withMessage('Roll number must be max 50 characters'),

    handleValidationErrors
  ],

  update: [
    param('id')
      .isInt({ min: 1 }).withMessage('Invalid student ID'),

    body('fullName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Full name must be 2-100 characters')
      .matches(/^[a-zA-Z\s.'-]+$/).withMessage('Full name contains invalid characters'),

    body('rfidCardId')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 }).withMessage('RFID card ID must be 1-50 characters'),

    body('grade')
      .optional()
      .trim()
      .isLength({ min: 1, max: 20 }).withMessage('Grade must be 1-20 characters'),

    body('section')
      .optional()
      .trim()
      .isLength({ max: 10 }).withMessage('Section must be max 10 characters'),

    body('parentContact')
      .optional()
      .trim()
      .matches(/^[+]?[\d\s()-]{10,20}$/).withMessage('Invalid phone number format'),

    body('parentEmail')
      .optional()
      .trim()
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),

    body('address')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Address must be max 500 characters'),

    body('isActive')
      .optional()
      .isBoolean().withMessage('isActive must be a boolean'),

    handleValidationErrors
  ]
};

/**
 * Attendance validation rules
 */
const validateAttendance = {
  manual: [
    body('studentId')
      .notEmpty().withMessage('Student ID is required')
      .isInt({ min: 1 }).withMessage('Invalid student ID'),

    body('date')
      .notEmpty().withMessage('Date is required')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be in YYYY-MM-DD format')
      .custom((value) => {
        const date = new Date(value);
        const now = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        if (date > now) {
          throw new Error('Date cannot be in the future');
        }
        if (date < oneYearAgo) {
          throw new Error('Date cannot be more than 1 year in the past');
        }
        return true;
      }),

    body('status')
      .notEmpty().withMessage('Status is required')
      .isIn(['present', 'late', 'absent']).withMessage('Status must be present, late, or absent'),

    body('notes')
      .optional()
      .trim()
      .isLength({ max: 1000 }).withMessage('Notes must be max 1000 characters'),

    handleValidationErrors
  ],

  getRange: [
    query('startDate')
      .notEmpty().withMessage('Start date is required')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Start date must be in YYYY-MM-DD format'),

    query('endDate')
      .notEmpty().withMessage('End date is required')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('End date must be in YYYY-MM-DD format')
      .custom((endDate, { req }) => {
        const start = new Date(req.query.startDate);
        const end = new Date(endDate);

        if (end < start) {
          throw new Error('End date must be after start date');
        }

        const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
        if (daysDiff > 366) {
          throw new Error('Date range cannot exceed 366 days');
        }

        return true;
      }),

    handleValidationErrors
  ]
};

/**
 * Class validation rules
 */
const validateClass = {
  create: [
    body('className')
      .trim()
      .notEmpty().withMessage('Class name is required')
      .isLength({ min: 1, max: 50 }).withMessage('Class name must be 1-50 characters')
      .matches(/^[a-zA-Z0-9\s-]+$/).withMessage('Class name can only contain letters, numbers, spaces, and hyphens'),

    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Description must be max 500 characters'),

    handleValidationErrors
  ],

  update: [
    param('id')
      .isInt({ min: 1 }).withMessage('Invalid class ID'),

    body('className')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 }).withMessage('Class name must be 1-50 characters')
      .matches(/^[a-zA-Z0-9\s-]+$/).withMessage('Class name can only contain letters, numbers, spaces, and hyphens'),

    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Description must be max 500 characters'),

    handleValidationErrors
  ]
};

/**
 * Teacher validation rules
 */
const validateTeacher = {
  create: [
    body('fullName')
      .trim()
      .notEmpty().withMessage('Full name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Full name must be 2-100 characters')
      .matches(/^[a-zA-Z\s.'-]+$/).withMessage('Full name contains invalid characters'),

    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),

    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),

    body('phone')
      .optional()
      .trim()
      .matches(/^[+]?[\d\s()-]{10,20}$/).withMessage('Invalid phone number format'),

    body('subject')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Subject must be max 100 characters'),

    handleValidationErrors
  ],

  update: [
    param('id')
      .isInt({ min: 1 }).withMessage('Invalid teacher ID'),

    body('fullName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Full name must be 2-100 characters')
      .matches(/^[a-zA-Z\s.'-]+$/).withMessage('Full name contains invalid characters'),

    body('email')
      .optional()
      .trim()
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),

    body('phone')
      .optional()
      .trim()
      .matches(/^[+]?[\d\s()-]{10,20}$/).withMessage('Invalid phone number format'),

    body('isActive')
      .optional()
      .isBoolean().withMessage('isActive must be a boolean'),

    handleValidationErrors
  ],

  resetPassword: [
    param('id')
      .isInt({ min: 1 }).withMessage('Invalid teacher ID'),

    body('newPassword')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),

    handleValidationErrors
  ]
};

/**
 * Authentication validation rules
 */
const validateAuth = {
  login: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),

    body('password')
      .notEmpty().withMessage('Password is required'),

    handleValidationErrors
  ],

  changePassword: [
    body('currentPassword')
      .notEmpty().withMessage('Current password is required'),

    body('newPassword')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),

    handleValidationErrors
  ]
};

/**
 * Generic ID validation
 */
const validateId = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid ID'),
  handleValidationErrors
];

/**
 * 🔒 NEW: Device validation rules (Bug #11 fix validation)
 */
const validateDevice = {
  enrollStudent: [
    param('deviceId')
      .isInt({ min: 1 }).withMessage('Invalid device ID'),

    body('studentId')
      .notEmpty().withMessage('Student ID is required')
      .isInt({ min: 1 }).withMessage('Student ID must be a positive integer'),

    body('devicePin')
      .notEmpty().withMessage('Device PIN is required')
      .isInt({ min: 1, max: 999999 }).withMessage('Device PIN must be between 1 and 999999'),

    handleValidationErrors
  ],

  syncTime: [
    param('deviceId')
      .isInt({ min: 1 }).withMessage('Invalid device ID'),
    handleValidationErrors
  ]
};

/**
 * 🔒 NEW: School settings validation (Bug #5 fix validation)
 */
const validateSettings = {
  update: [
    body('school_open_time')
      .optional()
      .matches(/^([0-1]\d):([0-5]\d):([0-5]\d)$/).withMessage('Invalid time format (use HH:MM:SS)')
      .custom((value) => {
        const [hours] = value.split(':').map(Number);
        if (hours >= 12) {
          throw new Error('School start time must be in the morning (before 12:00 PM). Did you mean 09:00 instead of 21:00?');
        }
        if (hours < 6) {
          throw new Error('School start time should be after 6:00 AM');
        }
        return true;
      }),

    body('school_close_time')
      .optional()
      .matches(/^([0-2]\d):([0-5]\d):([0-5]\d)$/).withMessage('Invalid time format (use HH:MM:SS)')
      .custom((value) => {
        const [hours] = value.split(':').map(Number);
        if (hours < 12) {
          throw new Error('School close time should be in afternoon/evening (after 12:00 PM)');
        }
        return true;
      }),

    body('late_threshold_minutes')
      .optional()
      .isInt({ min: 0, max: 60 }).withMessage('Late threshold must be between 0 and 60 minutes'),

    body('early_leave_minutes')
      .optional()
      .isInt({ min: 0, max: 120 }).withMessage('Early leave threshold must be between 0 and 120 minutes'),

    handleValidationErrors
  ]
};

/**
 * 🔒 IMPROVED: Enhanced attendance validation (Bug #1 fix validation)
 */
validateAttendance.markManual = [
  body('studentId')
    .notEmpty().withMessage('Student ID is required')
    .isInt({ min: 1 }).withMessage('Student ID must be a positive integer'),

  body('date')
    .notEmpty().withMessage('Date is required')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be in YYYY-MM-DD format')
    .custom((value) => {
      const date = new Date(value);
      const now = new Date();
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      if (date > now) {
        throw new Error('Cannot mark attendance for future dates');
      }
      if (date < ninetyDaysAgo) {
        throw new Error('Cannot mark attendance older than 90 days');
      }
      return true;
    }),

  body('checkInTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/).withMessage('Invalid time format (use HH:MM:SS)'),

  body('status')
    .optional()
    .isIn(['present', 'absent', 'late', 'leave']).withMessage('Status must be one of: present, absent, late, leave'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),

  body('forceUpdate')
    .optional()
    .isBoolean().withMessage('forceUpdate must be a boolean'),

  handleValidationErrors
];

module.exports = {
  validateStudent,
  validateAttendance,
  validateClass,
  validateTeacher,
  validateAuth,
  validateId,
  validateDevice,
  validateSettings,
  handleValidationErrors
};
