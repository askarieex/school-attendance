const twilio = require('twilio');

/**
 * WhatsApp Service using Twilio API
 * Sends attendance alerts to parents via WhatsApp
 */
class WhatsAppService {
  constructor() {
    // Initialize Twilio client
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    // Check if credentials are properly configured (not placeholder values)
    const hasValidCredentials =
      this.accountSid &&
      this.authToken &&
      this.accountSid !== 'your_account_sid_here' &&
      this.authToken !== 'your_auth_token_here' &&
      this.accountSid.startsWith('AC'); // Twilio Account SIDs always start with AC

    if (hasValidCredentials) {
      try {
        this.client = twilio(this.accountSid, this.authToken);
        this.enabled = true;
        console.log('✅ WhatsApp Service initialized');
      } catch (error) {
        this.enabled = false;
        console.log('⚠️ WhatsApp Service disabled (invalid credentials):', error.message);
      }
    } else {
      this.enabled = false;
      console.log('⚠️ WhatsApp Service disabled (no Twilio credentials configured)');
      console.log('   To enable: Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to .env file');
    }
  }

  /**
   * Format phone number for WhatsApp
   * Supports multiple country codes and formats
   * Examples:
   *   - +917889484343 → whatsapp:+917889484343
   *   - 7889484343 → whatsapp:+917889484343 (adds India +91)
   *   - 03001234567 → whatsapp:+923001234567 (Pakistan)
   *   - +91 → null (invalid)
   */
  formatPhoneNumber(phone, defaultCountryCode = '+91') {
    if (!phone) return null;

    // Remove all spaces, dashes, parentheses
    phone = phone.replace(/[\s\-()]/g, '');

    // If phone is ONLY country code (e.g., "+91" or "91"), return null
    if (phone === '+91' || phone === '91' || phone === '+92' || phone === '92') {
      console.warn(`⚠️ Invalid phone number: only country code provided (${phone})`);
      return null;
    }

    // Handle different formats
    if (phone.startsWith('+')) {
      // Already has country code: +917889484343
      // Validate it has digits after country code
      const digitsAfterPlus = phone.substring(1);
      if (digitsAfterPlus.length < 10) {
        console.warn(`⚠️ Invalid phone number: too short (${phone})`);
        return null;
      }
      return `whatsapp:${phone}`;
    }
    else if (phone.startsWith('0')) {
      // Indian mobile numbers don't start with 0, but Pakistani do
      // Default to Pakistan +92 for numbers starting with 0
      phone = '+92' + phone.substring(1);
      return `whatsapp:${phone}`;
    }
    else if (phone.startsWith('91') || phone.startsWith('92')) {
      // Country code without + sign: 917889484343
      phone = '+' + phone;
      return `whatsapp:${phone}`;
    }
    else {
      // No country code, add default (India +91)
      // Example: 7889484343 → +917889484343
      if (phone.length >= 10) {
        phone = defaultCountryCode + phone;
        return `whatsapp:${phone}`;
      } else {
        console.warn(`⚠️ Invalid phone number: too short (${phone})`);
        return null;
      }
    }
  }

  /**
   * Normalize phone number for duplicate detection
   * Removes country code prefix for comparison
   * Example: +917889484343 → 7889484343
   */
  normalizePhoneForDedup(phone) {
    if (!phone) return null;

    phone = phone.replace(/[\s\-()]/g, '');

    // Remove country codes
    if (phone.startsWith('+91')) {
      return phone.substring(3);
    } else if (phone.startsWith('+92')) {
      return phone.substring(3);
    } else if (phone.startsWith('+')) {
      // Remove + and any country code (first 1-3 digits)
      return phone.substring(1).replace(/^(\d{1,3})/, '');
    } else if (phone.startsWith('91')) {
      return phone.substring(2);
    } else if (phone.startsWith('92')) {
      return phone.substring(2);
    } else if (phone.startsWith('0')) {
      return phone.substring(1);
    }

    return phone;
  }

  /**
   * Send attendance alert to parent
   * @param {Object} data - Alert data
   * @param {string} data.parentPhone - Parent's phone number
   * @param {string} data.studentName - Student's full name
   * @param {string} data.studentId - Student ID (for deduplication)
   * @param {string} data.schoolId - School ID (for logging)
   * @param {string} data.status - Attendance status (present/late/absent/leave)
   * @param {string} data.checkInTime - Check-in time
   * @param {string} data.schoolName - School name
   * @param {string} data.date - Date (YYYY-MM-DD)
   */
  async sendAttendanceAlert(data) {
    if (!this.enabled) {
      console.log('⚠️ WhatsApp service disabled - skipping message');
      return { success: false, error: 'WhatsApp service not configured' };
    }

    try {
      const { parentPhone, studentName, studentId, schoolId, status, checkInTime, schoolName, date } = data;

      // Format phone number
      const to = this.formatPhoneNumber(parentPhone);
      if (!to) {
        console.warn(`⚠️ Invalid phone number for student ${studentName}: ${parentPhone}`);
        return { success: false, error: 'Invalid phone number' };
      }

      // 🔒 DEDUPLICATION: Check if message already sent to this parent today for this student
      const { query } = require('../config/database');

      const normalizedPhone = this.normalizePhoneForDedup(parentPhone);
      const today = date || new Date().toISOString().split('T')[0];

      const duplicateCheck = await query(
        `SELECT id, message_id FROM whatsapp_logs
         WHERE phone = $1
         AND student_id = $2
         AND status = $3
         AND DATE(sent_at) = $4
         LIMIT 1`,
        [normalizedPhone, studentId, status, today]
      );

      if (duplicateCheck.rows.length > 0) {
        console.log(`⏭️ WhatsApp already sent to ${parentPhone} for ${studentName} (${status}) today. Skipping duplicate.`);
        return {
          success: true,
          messageId: duplicateCheck.rows[0].message_id,
          skipped: true,
          reason: 'Duplicate message prevented'
        };
      }

      // Create message based on status
      let message = this.createMessage(studentName, status, checkInTime, schoolName);

      // Send via Twilio WhatsApp API
      const response = await this.client.messages.create({
        from: `whatsapp:${this.whatsappNumber}`,
        to: to,
        body: message
      });

      console.log(`✅ WhatsApp sent to ${parentPhone}: ${response.sid}`);

      // Log to database
      await this.logMessage(normalizedPhone, studentName, studentId, schoolId, status, response.sid);

      return {
        success: true,
        messageId: response.sid,
        status: response.status
      };

    } catch (error) {
      console.error(`❌ WhatsApp send failed:`, error.message);

      // Log failed attempt
      try {
        const { query } = require('../config/database');
        const normalizedPhone = this.normalizePhoneForDedup(data.parentPhone);
        await query(
          `INSERT INTO whatsapp_logs (phone, student_name, student_id, school_id, status, error_message, sent_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [normalizedPhone, data.studentName, data.studentId, data.schoolId, data.status, error.message]
        );
      } catch (logError) {
        console.error('Failed to log WhatsApp error:', logError.message);
      }

      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Create WhatsApp message based on attendance status
   */
  createMessage(studentName, status, checkInTime, schoolName) {
    const date = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const time = checkInTime || new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    let message = '';

    switch (status) {
      case 'late':
        message = `🔔 *Attendance Alert*\n\n` +
                  `Dear Parent,\n\n` +
                  `Your child *${studentName}* arrived LATE at school.\n\n` +
                  `⏰ Check-in Time: ${time}\n` +
                  `📅 Date: ${date}\n` +
                  `🏫 School: ${schoolName}\n\n` +
                  `Please ensure timely arrival tomorrow.\n\n` +
                  `_This is an automated message from ${schoolName}_`;
        break;

      case 'absent':
        message = `⚠️ *Absence Alert*\n\n` +
                  `Dear Parent,\n\n` +
                  `Your child *${studentName}* is marked ABSENT from school today.\n\n` +
                  `📅 Date: ${date}\n` +
                  `🏫 School: ${schoolName}\n\n` +
                  `If this is an error or your child is sick, please contact the school immediately.\n\n` +
                  `_This is an automated message from ${schoolName}_`;
        break;

      case 'leave':
        message = `📋 *Leave Notification*\n\n` +
                  `Dear Parent,\n\n` +
                  `Your child *${studentName}* has been marked on LEAVE today.\n\n` +
                  `📅 Date: ${date}\n` +
                  `🏫 School: ${schoolName}\n\n` +
                  `_This is an automated message from ${schoolName}_`;
        break;

      case 'present':
        message = `✅ *Attendance Confirmation*\n\n` +
                  `Dear Parent,\n\n` +
                  `Your child *${studentName}* has arrived safely at school.\n\n` +
                  `⏰ Check-in Time: ${time}\n` +
                  `📅 Date: ${date}\n` +
                  `🏫 School: ${schoolName}\n\n` +
                  `_This is an automated message from ${schoolName}_`;
        break;

      default:
        message = `📢 *School Notification*\n\n` +
                  `Dear Parent,\n\n` +
                  `Attendance update for *${studentName}*\n\n` +
                  `Status: ${status}\n` +
                  `📅 Date: ${date}\n` +
                  `🏫 School: ${schoolName}`;
    }

    return message;
  }

  /**
   * Send daily attendance summary to parent
   */
  async sendDailySummary(data) {
    if (!this.enabled) return { success: false, error: 'Service disabled' };

    try {
      const { parentPhone, studentName, summary, schoolName } = data;

      const to = this.formatPhoneNumber(parentPhone);
      if (!to) return { success: false, error: 'Invalid phone number' };

      const message = `📊 *Daily Attendance Summary*\n\n` +
                      `Student: *${studentName}*\n` +
                      `Date: ${new Date().toLocaleDateString()}\n\n` +
                      `Status: ${summary.status}\n` +
                      `Check-in: ${summary.checkInTime || 'N/A'}\n` +
                      `Check-out: ${summary.checkOutTime || 'N/A'}\n\n` +
                      `🏫 ${schoolName}\n\n` +
                      `_This is an automated message_`;

      const response = await this.client.messages.create({
        from: `whatsapp:${this.whatsappNumber}`,
        to: to,
        body: message
      });

      return { success: true, messageId: response.sid };
    } catch (error) {
      console.error('WhatsApp summary send failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send custom message to parent
   */
  async sendCustomMessage(parentPhone, message, schoolName) {
    if (!this.enabled) return { success: false, error: 'Service disabled' };

    try {
      const to = this.formatPhoneNumber(parentPhone);
      if (!to) return { success: false, error: 'Invalid phone number' };

      const fullMessage = `${message}\n\n_From ${schoolName}_`;

      const response = await this.client.messages.create({
        from: `whatsapp:${this.whatsappNumber}`,
        to: to,
        body: fullMessage
      });

      return { success: true, messageId: response.sid };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Log WhatsApp message to database
   */
  async logMessage(phone, studentName, studentId, schoolId, status, messageId) {
    try {
      const { query } = require('../config/database');

      await query(
        `INSERT INTO whatsapp_logs (phone, student_name, student_id, school_id, status, message_id, message_type, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [phone, studentName, studentId, schoolId, status, messageId, 'attendance_alert']
      );
    } catch (error) {
      // Non-critical - just log the error
      console.error('Failed to log WhatsApp message:', error.message);
    }
  }

  /**
   * Test WhatsApp connection
   */
  async testConnection(testPhone) {
    if (!this.enabled) {
      return { success: false, error: 'WhatsApp service not configured' };
    }

    try {
      const to = this.formatPhoneNumber(testPhone);

      const message = `🧪 *Test Message*\n\n` +
                      `This is a test message from your School Attendance System.\n\n` +
                      `✅ WhatsApp integration is working correctly!\n\n` +
                      `Time: ${new Date().toLocaleString()}`;

      const response = await this.client.messages.create({
        from: `whatsapp:${this.whatsappNumber}`,
        to: to,
        body: message
      });

      return {
        success: true,
        messageId: response.sid,
        message: 'Test message sent successfully!'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        hint: 'Make sure the phone number is registered in Twilio Sandbox'
      };
    }
  }
}

// Export singleton instance
module.exports = new WhatsAppService();
