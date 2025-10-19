const { sendError } = require('../utils/response');

/**
 * Multi-tenancy middleware
 * Ensures school admins can only access their own school's data
 *
 * This is THE MOST CRITICAL security middleware!
 * It automatically filters all database queries by school_id
 */
const enforceSchoolTenancy = (req, res, next) => {
  // If user is super admin, skip tenancy filtering
  if (req.user.role === 'superadmin') {
    req.tenantSchoolId = null; // Super admin sees all data
    return next();
  }

  // For school admin, enforce school_id filtering
  if (req.user.role === 'school_admin') {
    if (!req.user.schoolId) {
      return sendError(res, 'Invalid school admin account - no school assigned', 403);
    }

    // Attach school_id to request for use in controllers/models
    req.tenantSchoolId = req.user.schoolId;
    return next();
  }

  // Unknown role
  return sendError(res, 'Invalid user role', 403);
};

/**
 * Validate school_id in request params matches user's school
 * Use this for routes like PUT /students/:id
 */
const validateSchoolOwnership = async (Model, resourceIdField = 'id') => {
  return async (req, res, next) => {
    try {
      // Super admin can access any resource
      if (req.user.role === 'superadmin') {
        return next();
      }

      const resourceId = req.params[resourceIdField];

      // Get resource from database
      const resource = await Model.findById(resourceId);

      if (!resource) {
        return sendError(res, 'Resource not found', 404);
      }

      // Check if resource belongs to user's school
      if (resource.school_id !== req.user.schoolId) {
        return sendError(res, 'Access denied. This resource belongs to another school.', 403);
      }

      // Attach resource to request for use in controller
      req.resource = resource;
      next();
    } catch (error) {
      console.error('School ownership validation error:', error);
      return sendError(res, 'Failed to validate resource ownership', 500);
    }
  };
};

module.exports = {
  enforceSchoolTenancy,
  validateSchoolOwnership,
};
