const User = require('../models/User');
const { comparePassword, generateAccessToken, generateRefreshToken } = require('../utils/auth');
const { sendSuccess, sendError } = require('../utils/response');
const { getCurrentAcademicYear } = require('../utils/academicYear');

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

    // ✅ FIX: Get school name and current academic year for the login response
    const { query } = require('../config/database');
    let schoolName = null;
    let currentAcademicYear = null;

    if (user.school_id) {
      const schoolResult = await query(
        'SELECT name FROM schools WHERE id = $1',
        [user.school_id]
      );
      if (schoolResult.rows.length > 0) {
        schoolName = schoolResult.rows[0].name;
      }

      // Get current academic year
      currentAcademicYear = await getCurrentAcademicYear(user.school_id);
    }

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
          school_name: schoolName,  // ✅ FIX: Add school_name to login response
          currentAcademicYear: currentAcademicYear,  // ✅ FIX: Add current academic year
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

    const { query } = require('../config/database');

    // ✅ FIX: Create a mutable response object instead of modifying the user object
    const responseData = { ...user };

    // Get school name and current academic year if user has a school_id
    if (user.school_id) {
      const schoolResult = await query(
        'SELECT name FROM schools WHERE id = $1',
        [user.school_id]
      );

      if (schoolResult.rows.length > 0) {
        responseData.school_name = schoolResult.rows[0].name;
      }

      // Get current academic year
      const currentYear = await getCurrentAcademicYear(user.school_id);
      responseData.currentAcademicYear = currentYear;
    }

    // If user is a teacher, include their teacher profile and assignments
    if (user.role === 'teacher') {
      try {
        const Teacher = require('../models/Teacher');

        // Get teacher record by user_id
        const teacherResult = await query(
          'SELECT id FROM teachers WHERE user_id = $1 AND is_active = TRUE',
          [user.id]
        );

        if (teacherResult.rows.length > 0) {
          const teacherId = teacherResult.rows[0].id;

          // Get current academic year for assignments
          const currentYear = responseData.currentAcademicYear || await getCurrentAcademicYear(user.school_id);

          // ✅ FIX: Get teacher assignments with dynamic academic year
          const assignments = await Teacher.getAssignments(teacherId, currentYear);

          // Add teacher data to response
          responseData.teacher_id = teacherId;
          responseData.assignments = assignments || [];  // ✅ FIX: Default to empty array
        } else {
          // ✅ FIX: No teacher record found, return empty assignments
          console.log(`⚠️ No teacher record found for user_id: ${user.id}`);
          responseData.assignments = [];
        }
      } catch (teacherError) {
        // ✅ FIX: Don't crash if teacher assignments fail - just log and continue
        console.error('Error fetching teacher assignments:', teacherError);
        console.error('Stack:', teacherError.stack);
        responseData.assignments = [];
      }
    }

    sendSuccess(res, responseData, 'User retrieved successfully');
  } catch (error) {
    console.error('Get user error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
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
