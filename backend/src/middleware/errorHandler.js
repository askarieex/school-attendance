const { sendError } = require('../utils/response');

/**
 * 🔒 IMPROVED: Global error handling middleware with production-safe logging
 * Catches all errors and sends consistent error responses
 * Prevents stack trace leakage in production
 */
const errorHandler = (err, req, res, next) => {
  // 🔒 SECURITY: In production, only log error message (not full stack trace)
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Error:', {
      message: err.message,
      code: err.code,
      path: req.path,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
  } else {
    // Development: Log full error including stack trace
    console.error('❌ Error:', err);
  }

  // Database errors
  if (err.code === '23505') {
    // Unique constraint violation
    return sendError(res, 'Duplicate entry. Resource already exists.', 409);
  }

  if (err.code === '23503') {
    // Foreign key constraint violation
    return sendError(res, 'Referenced resource does not exist.', 400);
  }

  if (err.code === '23502') {
    // NOT NULL constraint violation
    return sendError(res, 'Missing required field.', 400);
  }

  if (err.code === '23514') {
    // CHECK constraint violation
    return sendError(res, 'Invalid data: constraint violation.', 400);
  }

  if (err.code === '42P01') {
    // Undefined table
    console.error('❌ CRITICAL: Database table missing:', err.message);
    return sendError(res, 'System error. Please contact administrator.', 500);
  }

  if (err.code === '42703') {
    // Undefined column
    console.error('❌ CRITICAL: Database column missing:', err.message);
    return sendError(res, 'System error. Please contact administrator.', 500);
  }

  // Connection errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    console.error('❌ CRITICAL: Database connection failed:', err.message);
    return sendError(res, 'Database connection error. Please try again later.', 503);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid authentication token.', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Authentication token expired. Please login again.', 401);
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return sendError(res, 'Validation failed.', 400, err.errors);
  }

  // Rate limit errors
  if (err.name === 'TooManyRequestsError') {
    return sendError(res, 'Too many requests. Please slow down.', 429);
  }

  // File upload errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 'File too large. Maximum size is 5MB.', 400);
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return sendError(res, 'Unexpected file field.', 400);
    }
    return sendError(res, 'File upload error.', 400);
  }

  // Default error
  const statusCode = err.statusCode || 500;

  // 🔒 SECURITY: Don't expose internal error messages in production
  let message;
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'An unexpected error occurred. Please try again or contact support.';
  } else {
    message = err.message || 'Internal server error';
  }

  sendError(res, message, statusCode);
};

/**
 * Handle 404 - Route not found
 */
const notFound = (req, res) => {
  sendError(res, `Route ${req.originalUrl} not found`, 404);
};

module.exports = {
  errorHandler,
  notFound,
};
