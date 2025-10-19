const { verifyToken } = require('../utils/auth');
const { sendError } = require('../utils/response');

/**
 * Middleware to authenticate JWT token
 * Extracts user info from token and attaches to req.user
 */
const authenticate = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'No token provided', 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify and decode token
    const decoded = verifyToken(token);

    // Attach user info to request object
    req.user = {
      id: decoded.userId,
      role: decoded.role,
      schoolId: decoded.schoolId || null,
    };

    next();
  } catch (error) {
    return sendError(res, 'Invalid or expired token', 401);
  }
};

/**
 * Middleware to check if user is super admin
 */
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'superadmin') {
    return sendError(res, 'Access denied. Super admin privileges required.', 403);
  }
  next();
};

/**
 * Middleware to check if user is school admin
 */
const requireSchoolAdmin = (req, res, next) => {
  if (req.user.role !== 'school_admin') {
    return sendError(res, 'Access denied. School admin privileges required.', 403);
  }

  if (!req.user.schoolId) {
    return sendError(res, 'Invalid school admin account', 403);
  }

  next();
};

/**
 * Middleware for device authentication using Serial Number
 * ZKTeco devices send their physical Serial Number for authentication
 */
const authenticateDevice = async (req, res, next) => {
  try {
    // Accept serial number from multiple headers for compatibility
    const serialNumber = req.headers['x-device-serial'] ||
                        req.headers['x-serial-number'] ||
                        req.headers['x-api-key']; // Backward compatibility

    if (!serialNumber) {
      return sendError(res, 'Device serial number required. Please provide X-Device-Serial header.', 401);
    }

    // Import here to avoid circular dependency
    const Device = require('../models/Device');

    // Verify device exists and is active using serial number
    const device = await Device.findBySerialNumber(serialNumber);

    if (!device) {
      return sendError(res, 'Device not registered. Please register this device serial number in the admin panel.', 401);
    }

    if (!device.is_active) {
      return sendError(res, 'Device is deactivated. Contact administrator to reactivate.', 403);
    }

    // Attach device info to request
    req.device = {
      id: device.id,
      schoolId: device.school_id,
      name: device.device_name,
      serialNumber: device.serial_number,
    };

    // Update last_seen timestamp
    await Device.updateLastSeen(device.id);

    next();
  } catch (error) {
    console.error('Device authentication error:', error);
    return sendError(res, 'Device authentication failed', 500);
  }
};

module.exports = {
  authenticate,
  requireSuperAdmin,
  requireSchoolAdmin,
  authenticateDevice,
};
