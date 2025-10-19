const { sendError } = require('../utils/response');

/**
 * Global error handling middleware
 * Catches all errors and sends consistent error responses
 */
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err);

  // Database errors
  if (err.code === '23505') {
    return sendError(res, 'Duplicate entry. Resource already exists.', 409);
  }

  if (err.code === '23503') {
    return sendError(res, 'Foreign key constraint violation', 400);
  }

  if (err.code === '23502') {
    return sendError(res, 'Missing required field', 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token expired', 401);
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return sendError(res, 'Validation failed', 400, err.errors);
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

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
