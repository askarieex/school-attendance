const School = require('../models/School');
const User = require('../models/User');
const Device = require('../models/Device');
const SchoolSettings = require('../models/SchoolSettings');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

/**
 * SCHOOL MANAGEMENT
 */

// Get all schools
const getSchools = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status } = req.query;

    const isActive = status === 'active' ? true : status === 'inactive' ? false : null;

    const result = await School.findAll(
      parseInt(page),
      parseInt(limit),
      search,
      isActive
    );

    sendPaginated(res, result.schools, page, limit, result.total);
  } catch (error) {
    console.error('Get schools error:', error);
    sendError(res, 'Failed to retrieve schools', 500);
  }
};

// Create new school
const createSchool = async (req, res) => {
  try {
    const { name, email, phone, address, plan, adminName, adminEmail, adminPassword } = req.body;

    // Validate required fields
    if (!name || !email) {
      return sendError(res, 'School name and email are required', 400);
    }

    // Check if school email already exists
    const existingSchool = await School.findByEmail(email);
    if (existingSchool) {
      return sendError(res, 'School with this email already exists', 409);
    }

    // Create school
    const school = await School.create({
      name,
      email,
      phone,
      address,
      plan: plan || 'trial',
    });

    // Create default settings for school
    await SchoolSettings.create(school.id);

    // Create school admin user if provided
    if (adminEmail && adminPassword) {
      await User.create({
        email: adminEmail,
        password: adminPassword,
        role: 'school_admin',
        schoolId: school.id,
        fullName: adminName || 'School Admin',
      });
    }

    sendSuccess(res, school, 'School created successfully', 201);
  } catch (error) {
    console.error('Create school error:', error);
    sendError(res, 'Failed to create school', 500);
  }
};

// Get school by ID
const getSchool = async (req, res) => {
  try {
    const { id } = req.params;

    const school = await School.findById(id);

    if (!school) {
      return sendError(res, 'School not found', 404);
    }

    // Get school statistics
    const stats = await School.getStats(id);

    sendSuccess(res, { ...school, stats }, 'School retrieved successfully');
  } catch (error) {
    console.error('Get school error:', error);
    sendError(res, 'Failed to retrieve school', 500);
  }
};

// Update school
const updateSchool = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const school = await School.findById(id);

    if (!school) {
      return sendError(res, 'School not found', 404);
    }

    const updatedSchool = await School.update(id, updates);

    sendSuccess(res, updatedSchool, 'School updated successfully');
  } catch (error) {
    console.error('Update school error:', error);
    sendError(res, 'Failed to update school', 500);
  }
};

// Deactivate school
const deleteSchool = async (req, res) => {
  try {
    const { id } = req.params;

    const school = await School.findById(id);

    if (!school) {
      return sendError(res, 'School not found', 404);
    }

    await School.delete(id);

    sendSuccess(res, null, 'School deactivated successfully');
  } catch (error) {
    console.error('Delete school error:', error);
    sendError(res, 'Failed to deactivate school', 500);
  }
};

/**
 * DEVICE MANAGEMENT
 */

// Get all devices
const getDevices = async (req, res) => {
  try {
    const { page = 1, limit = 10, schoolId, status } = req.query;

    const filters = {};
    if (schoolId) filters.schoolId = parseInt(schoolId);
    if (status) filters.isActive = status === 'active';

    const result = await Device.findAll(parseInt(page), parseInt(limit), filters);

    sendPaginated(res, result.devices, page, limit, result.total);
  } catch (error) {
    console.error('Get devices error:', error);
    sendError(res, 'Failed to retrieve devices', 500);
  }
};

// Register device using physical Serial Number
const createDevice = async (req, res) => {
  try {
    const { schoolId, serialNumber, deviceName, location } = req.body;

    if (!schoolId || !serialNumber || !deviceName) {
      return sendError(res, 'School ID, serial number, and device name are required', 400);
    }

    // Validate serial number format (basic validation)
    if (serialNumber.trim().length < 5) {
      return sendError(res, 'Invalid serial number format. Please enter the serial number from the device label.', 400);
    }

    // Verify school exists
    const school = await School.findById(schoolId);
    if (!school) {
      return sendError(res, 'School not found', 404);
    }

    const device = await Device.create({
      serialNumber: serialNumber.trim(),
      deviceName,
      location
    }, schoolId);

    sendSuccess(res, device, 'Device registered successfully! The device can now authenticate using its serial number.', 201);
  } catch (error) {
    console.error('Create device error:', error);

    if (error.message.includes('already registered')) {
      return sendError(res, error.message, 409);
    }

    sendError(res, 'Failed to register device', 500);
  }
};

// Deactivate device (revoke access)
const deleteDevice = async (req, res) => {
  try {
    const { id } = req.params;

    const device = await Device.findById(id);

    if (!device) {
      return sendError(res, 'Device not found', 404);
    }

    await Device.deactivate(id);

    sendSuccess(res, null, 'Device deactivated successfully. It can no longer authenticate with the server.');
  } catch (error) {
    console.error('Delete device error:', error);
    sendError(res, 'Failed to deactivate device', 500);
  }
};

/**
 * USER MANAGEMENT
 */

// Get all users
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, schoolId, search } = req.query;

    const filters = {};
    if (role) filters.role = role;
    if (schoolId) filters.schoolId = parseInt(schoolId);
    if (search) filters.search = search;

    const result = await User.findAll(parseInt(page), parseInt(limit), filters);

    sendPaginated(res, result.users, page, limit, result.total);
  } catch (error) {
    console.error('Get users error:', error);
    sendError(res, 'Failed to retrieve users', 500);
  }
};

// Create user
const createUser = async (req, res) => {
  try {
    const { email, password, role, schoolId, fullName } = req.body;

    if (!email || !password || !role || !fullName) {
      return sendError(res, 'Email, password, role, and full name are required', 400);
    }

    // Validate role
    if (!['superadmin', 'school_admin'].includes(role)) {
      return sendError(res, 'Invalid role', 400);
    }

    // School admin must have schoolId
    if (role === 'school_admin' && !schoolId) {
      return sendError(res, 'School ID is required for school admin', 400);
    }

    // Check if email already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return sendError(res, 'User with this email already exists', 409);
    }

    const user = await User.create({ email, password, role, schoolId, fullName });

    sendSuccess(res, user, 'User created successfully', 201);
  } catch (error) {
    console.error('Create user error:', error);
    sendError(res, 'Failed to create user', 500);
  }
};

// Deactivate user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    await User.deactivate(id);

    sendSuccess(res, null, 'User deactivated successfully');
  } catch (error) {
    console.error('Delete user error:', error);
    sendError(res, 'Failed to deactivate user', 500);
  }
};

/**
 * PLATFORM STATISTICS
 */

// Get platform-wide statistics
const getPlatformStats = async (req, res) => {
  try {
    const stats = await School.getPlatformStats();

    sendSuccess(res, stats, 'Platform statistics retrieved successfully');
  } catch (error) {
    console.error('Get platform stats error:', error);
    sendError(res, 'Failed to retrieve platform statistics', 500);
  }
};

module.exports = {
  // Schools
  getSchools,
  createSchool,
  getSchool,
  updateSchool,
  deleteSchool,

  // Devices
  getDevices,
  createDevice,
  deleteDevice,

  // Users
  getUsers,
  createUser,
  deleteUser,

  // Stats
  getPlatformStats,
};
