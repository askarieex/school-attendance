const { query } = require('../config/database');
const { hashPassword } = require('../utils/auth');
const { sendSuccess, sendError } = require('../utils/response');
const crypto = require('crypto');

/**
 * Password Management Controller
 * Super admin can reset any user's password
 */

/**
 * Search users for password reset
 * GET /api/v1/super/users/search?q=email@example.com
 */
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query; // Search query

    if (!q || q.length < 2) {
      return sendError(res, 'Search query must be at least 2 characters', 400);
    }

    const result = await query(
      `SELECT u.id, u.email, u.role, u.full_name, u.is_active, u.created_at, u.last_login,
              s.name as school_name, s.id as school_id
       FROM users u
       LEFT JOIN schools s ON u.school_id = s.id
       WHERE u.email ILIKE $1 OR u.full_name ILIKE $1
       ORDER BY u.created_at DESC
       LIMIT 50`,
      [`%${q}%`]
    );

    sendSuccess(res, result.rows, `Found ${result.rows.length} users`);
  } catch (error) {
    console.error('Search users error:', error);
    sendError(res, 'Failed to search users', 500);
  }
};

/**
 * Reset user password (super admin can set new password)
 * POST /api/v1/super/users/:id/reset-password
 * Body: { newPassword, forceChange }
 */
const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword, forceChange = true } = req.body;
    const adminId = req.user.id;
    const adminEmail = req.user.email;

    if (!newPassword) {
      return sendError(res, 'New password is required', 400);
    }

    // Validate password strength (reuse User model validation)
    const User = require('../models/User');
    try {
      User.validatePasswordStrength(newPassword);
    } catch (validationError) {
      return sendError(res, validationError.message, 400);
    }

    // Get user details
    const userResult = await query(
      `SELECT u.id, u.email, u.role, u.full_name, s.name as school_name
       FROM users u
       LEFT JOIN schools s ON u.school_id = s.id
       WHERE u.id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    const user = userResult.rows[0];

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await query(
      `UPDATE users 
       SET password_hash = $1,
           force_password_change = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [newPasswordHash, forceChange, id]
    );

    // Log audit action
    await logPasswordReset({
      adminId,
      adminEmail,
      userId: id,
      userEmail: user.email,
      userRole: user.role,
      forceChange,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    sendSuccess(res, {
      userId: id,
      userEmail: user.email,
      forceChange
    }, `Password reset successfully for ${user.email}`);

  } catch (error) {
    console.error('Reset password error:', error);
    sendError(res, 'Failed to reset password', 500);
  }
};

/**
 * Generate temporary password for user
 * POST /api/v1/super/users/:id/generate-temp-password
 */
const generateTempPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const adminEmail = req.user.email;

    // Get user details
    const userResult = await query(
      `SELECT u.id, u.email, u.role, u.full_name, s.name as school_name
       FROM users u
       LEFT JOIN schools s ON u.school_id = s.id
       WHERE u.id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    const user = userResult.rows[0];

    // Generate random secure password
    const tempPassword = generateSecurePassword();

    // Hash password
    const tempPasswordHash = await hashPassword(tempPassword);

    // Update password with force change
    await query(
      `UPDATE users 
       SET password_hash = $1,
           force_password_change = TRUE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [tempPasswordHash, id]
    );

    // Log audit action
    await logPasswordReset({
      adminId,
      adminEmail,
      userId: id,
      userEmail: user.email,
      userRole: user.role,
      forceChange: true,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      isTemporary: true
    });

    sendSuccess(res, {
      userId: id,
      userEmail: user.email,
      tempPassword, // Send back to super admin (they can copy and send to user)
      forceChange: true
    }, `Temporary password generated for ${user.email}`);

  } catch (error) {
    console.error('Generate temp password error:', error);
    sendError(res, 'Failed to generate temporary password', 500);
  }
};

/**
 * Helper: Generate secure random password
 */
function generateSecurePassword() {
  // Generate password that meets requirements:
  // - 12 characters
  // - Uppercase, lowercase, number, special char
  
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluded I, O
  const lowercase = 'abcdefghijkmnopqrstuvwxyz'; // Excluded l
  const numbers = '23456789'; // Excluded 0, 1
  const special = '@#$%&*!';
  
  const all = uppercase + lowercase + numbers + special;
  
  let password = '';
  
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill remaining characters
  for (let i = 4; i < 12; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  
  // Shuffle password
  password = password.split('').sort(() => Math.random() - 0.5).join('');
  
  return password;
}

/**
 * Helper: Log password reset action
 */
async function logPasswordReset(data) {
  try {
    await query(
      `INSERT INTO audit_logs 
       (user_id, user_email, user_role, action_type, resource_type, resource_id, description, new_value, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        data.adminId,
        data.adminEmail,
        'superadmin',
        'password_reset',
        'user',
        data.userId,
        `Password reset for user: ${data.userEmail} (${data.userRole})`,
        JSON.stringify({
          targetUser: data.userEmail,
          forceChange: data.forceChange,
          isTemporary: data.isTemporary || false
        }),
        data.ipAddress,
        data.userAgent
      ]
    );
  } catch (error) {
    console.error('Failed to log password reset:', error);
  }
}

module.exports = {
  searchUsers,
  resetPassword,
  generateTempPassword
};
