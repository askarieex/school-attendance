/**
 * ✅ SECURITY FIX (Bug #7): Secure logging utilities
 * Prevents sensitive data (tokens, passwords, phone numbers) from being logged
 */

/**
 * Mask sensitive phone number for logging
 * Example: +919876543210 -> +91****3210
 * @param {string} phone - Phone number to mask
 * @returns {string} Masked phone number
 */
function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return '[INVALID_PHONE]';
  }

  const cleaned = phone.trim();

  // If phone is too short, fully redact
  if (cleaned.length < 6) {
    return '[REDACTED]';
  }

  // Show first 3 and last 4 digits, mask the rest
  const firstPart = cleaned.substring(0, 3);
  const lastPart = cleaned.substring(cleaned.length - 4);
  const maskedMiddle = '*'.repeat(Math.max(0, cleaned.length - 7));

  return `${firstPart}${maskedMiddle}${lastPart}`;
}

/**
 * Mask JWT token for logging
 * Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... -> eyJ...XVCJ9 (truncated)
 * @param {string} token - JWT token to mask
 * @returns {string} Masked token
 */
function maskToken(token) {
  if (!token || typeof token !== 'string') {
    return '[INVALID_TOKEN]';
  }

  if (token.length < 20) {
    return '[REDACTED]';
  }

  return `${token.substring(0, 3)}...${token.substring(token.length - 6)} (truncated)`;
}

/**
 * Mask password for logging (never log actual password)
 * @param {string} password - Password to mask
 * @returns {string} Fully redacted password
 */
function maskPassword(password) {
  if (!password) {
    return '[EMPTY]';
  }

  return '[REDACTED]';
}

/**
 * Mask email for logging
 * Example: john.doe@example.com -> j***@example.com
 * @param {string} email - Email to mask
 * @returns {string} Masked email
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return '[INVALID_EMAIL]';
  }

  const [localPart, domain] = email.split('@');

  if (localPart.length <= 1) {
    return `${localPart[0]}***@${domain}`;
  }

  return `${localPart[0]}***@${domain}`;
}

/**
 * Safe logger for sensitive operations
 * Auto-masks phone numbers, tokens, passwords, and emails
 */
const secureLog = {
  /**
   * Log with automatic masking of sensitive data
   */
  info: (message, data = {}) => {
    const sanitized = sanitizeLogData(data);
    console.log(message, sanitized);
  },

  /**
   * Log warning with automatic masking
   */
  warn: (message, data = {}) => {
    const sanitized = sanitizeLogData(data);
    console.warn(message, sanitized);
  },

  /**
   * Log error with automatic masking
   */
  error: (message, data = {}) => {
    const sanitized = sanitizeLogData(data);
    console.error(message, sanitized);
  },

  /**
   * Log attendance notification (masks phone)
   */
  attendance: (studentName, phone, status) => {
    console.log(`📱 Sending notification to ${maskPhone(phone)} for ${studentName} (${status})`);
  },

  /**
   * Log no phone found
   */
  noPhone: (studentName) => {
    console.log(`⚠️  No phone number found for ${studentName}, skipping notification`);
  }
};

/**
 * Sanitize object for logging (recursive)
 * @param {any} data - Data to sanitize
 * @returns {any} Sanitized data
 */
function sanitizeLogData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeLogData(item));
  }

  const sanitized = {};
  const sensitiveKeys = [
    'password', 'token', 'jwt', 'secret', 'authorization',
    'phone', 'parent_phone', 'guardian_phone', 'mother_phone',
    'email', 'refresh_token', 'access_token'
  ];

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    if (lowerKey.includes('password')) {
      sanitized[key] = maskPassword(value);
    } else if (lowerKey.includes('token') || lowerKey.includes('jwt') || lowerKey.includes('secret')) {
      sanitized[key] = maskToken(value);
    } else if (lowerKey.includes('phone')) {
      sanitized[key] = maskPhone(value);
    } else if (lowerKey.includes('email')) {
      sanitized[key] = maskEmail(value);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

module.exports = {
  maskPhone,
  maskToken,
  maskPassword,
  maskEmail,
  secureLog,
  sanitizeLogData
};
