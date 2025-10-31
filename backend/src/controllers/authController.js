const User = require('../models/User');
const { comparePassword, generateAccessToken, generateRefreshToken } = require('../utils/auth');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Login endpoint for both Super Admin and School Admin
 * POST /api/v1/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return sendError(res, 'Email and password are required', 400);
    }

    // Find user by email
    const user = await User.findByEmail(email);

    if (!user) {
      return sendError(res, 'Invalid email or password', 401);
    }

    // Check password
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      return sendError(res, 'Invalid email or password', 401);
    }

    // Update last login
    await User.updateLastLogin(user.id);

    // Generate tokens
    const payload = {
      userId: user.id,
      role: user.role,
      schoolId: user.school_id,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Send response
    sendSuccess(
      res,
      {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          schoolId: user.school_id,
          fullName: user.full_name,
        },
        accessToken,
        refreshToken,
      },
      'Login successful',
      200
    );
  } catch (error) {
    console.error('Login error:', error);
    sendError(res, 'Login failed', 500);
  }
};

/**
 * Refresh access token
 * POST /api/v1/auth/refresh
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return sendError(res, 'Refresh token required', 400);
    }

    const { verifyToken } = require('../utils/auth');
    const decoded = verifyToken(refreshToken);

    // Generate new access token
    const payload = {
      userId: decoded.userId,
      role: decoded.role,
      schoolId: decoded.schoolId,
    };

    const newAccessToken = generateAccessToken(payload);

    sendSuccess(
      res,
      { accessToken: newAccessToken },
      'Token refreshed successfully'
    );
  } catch (error) {
    console.error('Token refresh error:', error);
    sendError(res, 'Invalid refresh token', 401);
  }
};

/**
 * Get current user info
 * GET /api/v1/auth/me
 * Enhanced: Returns teacher assignments if user is a teacher
 */
const getMe = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 'User not authenticated', 401);
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // If user is a teacher, include their teacher profile and assignments
    if (user.role === 'teacher') {
      const Teacher = require('../models/Teacher');
      const { query } = require('../config/database');
      
      // Get teacher record by user_id
      const teacherResult = await query(
        'SELECT id FROM teachers WHERE user_id = $1 AND is_active = TRUE',
        [user.id]
      );
      
      if (teacherResult.rows.length > 0) {
        const teacherId = teacherResult.rows[0].id;
        
        // Get teacher assignments
        const assignments = await Teacher.getAssignments(teacherId, '2025-2026');
        
        // Add teacher data to response
        user.teacher_id = teacherId;
        user.assignments = assignments;
      }
    }

    sendSuccess(res, user, 'User retrieved successfully');
  } catch (error) {
    console.error('Get user error:', error);
    sendError(res, 'Failed to retrieve user', 500);
  }
};

/**
 * Change password
 * PUT /api/v1/auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    if (!req.user || !req.user.id || !req.user.email) {
      return sendError(res, 'User not authenticated', 401);
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return sendError(res, 'Current password and new password are required', 400);
    }

    // Get user
    const user = await User.findByEmail(req.user.email);

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Verify current password
    const isPasswordValid = await comparePassword(currentPassword, user.password_hash);

    if (!isPasswordValid) {
      return sendError(res, 'Current password is incorrect', 401);
    }

    // Update password
    await User.update(req.user.id, { password: newPassword });

    sendSuccess(res, null, 'Password changed successfully');
  } catch (error) {
    console.error('Change password error:', error);
    sendError(res, 'Failed to change password', 500);
  }
};

module.exports = {
  login,
  refreshToken,
  getMe,
  changePassword,
};
