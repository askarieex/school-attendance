const { query } = require('../config/database');

/**
 * Password Validation Utility
 * Validates password strength based on platform settings
 */

/**
 * Get password policy from database settings
 */
async function getPasswordPolicy() {
  try {
    const result = await query(
      `SELECT setting_key, setting_value 
       FROM platform_settings 
       WHERE category = 'security' 
       AND setting_key LIKE 'password_%'`
    );

    const policy = {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecial: true
    };

    result.rows.forEach(row => {
      switch (row.setting_key) {
        case 'password_min_length':
          policy.minLength = parseInt(row.setting_value) || 8;
          break;
        case 'password_require_uppercase':
          policy.requireUppercase = row.setting_value === 'true';
          break;
        case 'password_require_lowercase':
          policy.requireLowercase = row.setting_value === 'true';
          break;
        case 'password_require_number':
          policy.requireNumber = row.setting_value === 'true';
          break;
        case 'password_require_special':
          policy.requireSpecial = row.setting_value === 'true';
          break;
      }
    });

    return policy;
  } catch (error) {
    console.warn('⚠️  Failed to load password policy from database, using defaults:', error.message);
    // Return default policy if database query fails
    return {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecial: true
    };
  }
}

/**
 * Validate password against policy
 * @param {string} password - Password to validate
 * @returns {Promise<{valid: boolean, errors: string[]}>}
 */
async function validatePassword(password) {
  const errors = [];
  
  if (!password || typeof password !== 'string') {
    return {
      valid: false,
      errors: ['Password is required']
    };
  }

  const policy = await getPasswordPolicy();

  // Check minimum length
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long`);
  }

  // Check maximum length (prevent DOS attacks)
  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }

  // Check for uppercase letter
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z)');
  }

  // Check for lowercase letter
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z)');
  }

  // Check for number
  if (policy.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number (0-9)');
  }

  // Check for special character
  if (policy.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
  }

  // Check for common weak passwords
  const commonWeakPasswords = [
    'password', 'password123', '12345678', 'qwerty', 'abc123', 
    'letmein', 'welcome', 'monkey', '1234567890', 'password1',
    'admin', 'admin123', 'root', 'root123', 'test', 'test123',
    '123456789', 'iloveyou', 'princess', 'welcome123'
  ];

  if (commonWeakPasswords.includes(password.toLowerCase())) {
    errors.push('This password is too common. Please choose a more unique password.');
  }

  // Check for sequential characters (123, abc, etc.)
  if (/(?:012|123|234|345|456|567|678|789|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password)) {
    errors.push('Password should not contain sequential characters (e.g., 123, abc)');
  }

  // Check for repeated characters (aaa, 111, etc.)
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password should not contain repeated characters (e.g., aaa, 111)');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Middleware to validate password in request body
 */
function validatePasswordMiddleware(req, res, next) {
  const password = req.body.password || req.body.adminPassword;

  if (!password) {
    // If password is not in request, skip validation (might be optional for updates)
    return next();
  }

  validatePassword(password).then(result => {
    if (!result.valid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet security requirements',
        details: result.errors
      });
    }
    next();
  }).catch(err => {
    console.error('Password validation error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to validate password'
    });
  });
}

module.exports = {
  validatePassword,
  validatePasswordMiddleware,
  getPasswordPolicy
};
