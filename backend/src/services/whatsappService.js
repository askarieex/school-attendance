const twilio = require('twilio');
const { maskPhone } = require('../utils/logger');

/**
 * WhatsApp Service using Twilio API
 * Sends attendance alerts to parents via WhatsApp
 * ✅ FIXED: Reads credentials from database (platform_settings) instead of .env
 * ✅ SECURITY FIX (Bug #7): Masks phone numbers in all log statements
 */
class WhatsAppService {
  constructor() {
    // Initialize with empty values - will be loaded from database on first use
    this.client = null;
    this.enabled = false;
    this.accountSid = null;
    this.authToken = null;
    this.whatsappNumber = null;
    this.initialized = false;

    // 🚀 SMS Queue for parallel batch sending
    this.smsQueue = [];
    this.processingQueue = false;
    this.batchSize = 20; // Send 20 SMS in parallel
    this.batchDelayMs = 100; // 100ms delay between batches to respect rate limits

    // Try to initialize from .env for backward compatibility
    // This will be overridden by database settings when loadSettings() is called
    const envAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const envAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const envWhatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    if (envAccountSid && envAuthToken && envAccountSid.startsWith('AC')) {
      this.accountSid = envAccountSid;
      this.authToken = envAuthToken;
      this.whatsappNumber = envWhatsappNumber;
      this.initializeTwilioClient();
    }

    console.log('⏳ WhatsApp Service created (will load settings from database on first use)');
    console.log(`🚀 SMS Queue initialized: ${this.batchSize} parallel, ${this.batchDelayMs}ms delay`);
  }

  /**
   * Load WhatsApp settings from database (platform_settings table)
   * ✅ NEW: Reads from database instead of .env
   */
  async loadSettings() {
    try {
      const { query } = require('../config/database');

      const result = await query(
        `SELECT setting_key, setting_value
         FROM platform_settings
         WHERE category = 'whatsapp'`
      );

      const settings = result.rows.reduce((acc, row) => {
        acc[row.setting_key] = row.setting_value;
        return acc;
      }, {});

      // Check if WhatsApp is enabled in database
      if (settings.whatsapp_enabled !== 'true') {
        this.enabled = false;
        console.log('⚠️ WhatsApp disabled in database settings');
        return false;
      }

      // Validate credentials from database
      const dbAccountSid = settings.twilio_account_sid;
      const dbAuthToken = settings.twilio_auth_token;
      const dbWhatsappNumber = settings.twilio_phone_number;

      const hasValidCredentials =
        dbAccountSid &&
        dbAuthToken &&
        dbAccountSid !== 'your_account_sid_here' &&
        dbAuthToken !== 'your_auth_token_here' &&
        dbAccountSid.startsWith('AC');

      if (!hasValidCredentials) {
        this.enabled = false;
        console.log('⚠️ WhatsApp credentials not configured in database');
        return false;
      }

      // Update credentials if they changed
      if (dbAccountSid !== this.accountSid || dbAuthToken !== this.authToken) {
        this.accountSid = dbAccountSid;
        this.authToken = dbAuthToken;
        this.whatsappNumber = dbWhatsappNumber;
        this.initializeTwilioClient();
      }

      this.initialized = true;
      return true;

    } catch (error) {
      console.error('❌ Failed to load WhatsApp settings from database:', error.message);
      // Fall back to .env credentials if database fails
      return this.enabled;
    }
  }

  /**
   * Initialize Twilio client with current credentials
   */
  initializeTwilioClient() {
    try {
      this.client = twilio(this.accountSid, this.authToken);
      this.enabled = true;
      console.log('✅ WhatsApp Service initialized (credentials from database)');
    } catch (error) {
      this.enabled = false;
      console.log('⚠️ WhatsApp Service disabled (invalid credentials):', error.message);
    }
  }

  /**
   * Ensure settings are loaded before sending messages
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.loadSettings();
    }
    return this.enabled;
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

    // ✅ BUG FIX: Reject if looks like email
    if (phone.includes('@') || phone.includes('.com') || phone.includes('.in') || phone.includes('.org')) {
      console.warn(`⚠️ Invalid phone number: looks like email`);
      return null;
    }

    // Remove all spaces, dashes, parentheses
    phone = phone.replace(/[\s\-()]/g, '');

    // If phone is ONLY country code (e.g., "+91" or "91"), return null
    if (phone === '+91' || phone === '91' || phone === '+92' || phone === '92') {
      console.warn(`⚠️ Invalid phone number: only country code provided`);
      return null;
    }

    // Handle different formats
    if (phone.startsWith('+')) {
      // Already has country code: +917889484343
      // Validate it has digits after country code
      const digitsAfterPlus = phone.substring(1);
      if (digitsAfterPlus.length < 10) {
        console.warn(`⚠️ Invalid phone number: too short`);
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
        console.warn(`⚠️ Invalid phone number: too short`);
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

    // Remove all non-digit characters
    phone = phone.replace(/\D/g, '');

    // Remove country codes intelligently
    // India +91 (10 digits after)
    if (phone.startsWith('91') && phone.length >= 12) {
      return phone.substring(2); // Remove 91
    }
    // Pakistan +92 (10 digits after)
    else if (phone.startsWith('92') && phone.length >= 12) {
      return phone.substring(2); // Remove 92
    }
    // USA/Canada +1 (10 digits after)
    else if (phone.startsWith('1') && phone.length === 11) {
      return phone.substring(1); // Remove 1
    }
    // Other country codes (1-3 digits, keep last 10 digits)
    else if (phone.length > 10) {
      return phone.slice(-10); // Keep last 10 digits
    }
    // Numbers starting with 0 (remove leading zero)
    else if (phone.startsWith('0') && phone.length > 10) {
      return phone.substring(1);
    }

    // Return as-is for 10-digit numbers
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
    // ✅ FIXED: Load settings from database before sending
    await this.ensureInitialized();

    // If WhatsApp is disabled, use SMS directly
    if (!this.enabled) {
      console.log('⚠️ WhatsApp service disabled - using SMS fallback');
      return await this.sendViaSMS(data);
    }

    // ✅ BUG FIX: Validate data object exists
    if (!data) {
      console.warn('⚠️ WhatsApp alert called with null/undefined data');
      return { success: false, error: 'No data provided' };
    }

    try {
      const { parentPhone, studentName, studentId, schoolId, status, checkInTime, schoolName, date } = data;

      // ✅ BUG FIX: Validate required fields
      if (!parentPhone || !studentName || !studentId) {
        console.warn('⚠️ Missing required fields for WhatsApp alert:', { 
          hasPhone: !!parentPhone, 
          hasName: !!studentName, 
          hasId: !!studentId 
        });
        return { success: false, error: 'Missing required fields (phone, name, or ID)' };
      }

      // Format phone number
      const to = this.formatPhoneNumber(parentPhone);
      if (!to) {
        console.warn(`⚠️ Invalid phone number for student ${studentName}`);
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
        console.log(`⏭️ WhatsApp already sent to ${maskPhone(parentPhone)} for ${studentName} (${status}) today. Skipping duplicate.`);
        return {
          success: true,
          messageId: duplicateCheck.rows[0].message_id,
          skipped: true,
          reason: 'Duplicate message prevented'
        };
      }

      // Create message based on status
      let message = this.createMessage(studentName, status, checkInTime, schoolName);

      // 📱 TRY WHATSAPP FIRST, FALLBACK TO SMS IF FAILED
      let response;
      let sentVia = 'whatsapp';

      try {
        // Try WhatsApp first
        response = await this.client.messages.create({
          from: `whatsapp:${this.whatsappNumber}`,
          to: to,
          body: message
        });
        console.log(`✅ WhatsApp sent to ${maskPhone(parentPhone)}: ${response.sid}`);
      } catch (whatsappError) {
        console.warn(`⚠️ WhatsApp failed (${whatsappError.code}): ${whatsappError.message}`);
        console.log(`🔄 Trying SMS fallback for ${maskPhone(parentPhone)}...`);

        // Fallback to SMS
        try {
          // Get SMS phone number from .env
          const smsNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_WHATSAPP_NUMBER;

          // Format phone for SMS (without whatsapp: prefix)
          const smsTo = parentPhone.startsWith('+') ? parentPhone : `+91${parentPhone.replace(/[\s\-()]/g, '')}`;

          // Create shorter SMS message (160 chars limit)
          const smsMessage = this.createSMSMessage(studentName, status, checkInTime, schoolName);

          response = await this.client.messages.create({
            from: smsNumber,
            to: smsTo,
            body: smsMessage
          });

          sentVia = 'sms';
          console.log(`✅ SMS sent to ${maskPhone(parentPhone)}: ${response.sid}`);
        } catch (smsError) {
          throw new Error(`Both WhatsApp and SMS failed. WhatsApp: ${whatsappError.message}, SMS: ${smsError.message}`);
        }
      }

      // Log to database
      await this.logMessage(normalizedPhone, studentName, studentId, schoolId, status, response.sid, sentVia);

      return {
        success: true,
        messageId: response.sid,
        status: response.status,
        sentVia: sentVia
      };

    } catch (error) {
      console.error(`❌ Message send failed:`, error.message);

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
   * Send message via SMS only (when WhatsApp is disabled)
   */
  async sendViaSMS(data) {
    try {
      const { parentPhone, studentName, studentId, schoolId, status, checkInTime, schoolName, date } = data;

      // Validate required fields
      if (!parentPhone || !studentName || !studentId) {
        console.warn('⚠️ Missing required fields for SMS alert');
        return { success: false, error: 'Missing required fields' };
      }

      // Get SMS phone number from .env
      const smsNumber = process.env.TWILIO_PHONE_NUMBER;
      if (!smsNumber) {
        return { success: false, error: 'SMS phone number not configured' };
      }

      // Format phone for SMS (without whatsapp: prefix)
      const smsTo = parentPhone.startsWith('+') ? parentPhone : `+91${parentPhone.replace(/[\s\-()]/g, '')}`;

      // Create shorter SMS message
      const smsMessage = this.createSMSMessage(studentName, status, checkInTime, schoolName);

      // Check deduplication
      const { query } = require('../config/database');
      const normalizedPhone = this.normalizePhoneForDedup(parentPhone);
      const today = date || new Date().toISOString().split('T')[0];

      const duplicateCheck = await query(
        `SELECT id, message_id FROM whatsapp_logs
         WHERE phone = $1 AND student_id = $2 AND status = $3 AND DATE(sent_at) = $4 LIMIT 1`,
        [normalizedPhone, studentId, status, today]
      );

      if (duplicateCheck.rows.length > 0) {
        console.log(`⏭️ SMS already sent to ${maskPhone(parentPhone)} for ${studentName} (${status}) today. Skipping duplicate.`);
        return {
          success: true,
          messageId: duplicateCheck.rows[0].message_id,
          skipped: true,
          sentVia: 'sms',
          reason: 'Duplicate message prevented'
        };
      }

      // Send SMS
      const response = await this.client.messages.create({
        from: smsNumber,
        to: smsTo,
        body: smsMessage
      });

      console.log(`✅ SMS sent to ${maskPhone(parentPhone)}: ${response.sid}`);

      // Log to database
      await this.logMessage(normalizedPhone, studentName, studentId, schoolId, status, response.sid, 'sms');

      return {
        success: true,
        messageId: response.sid,
        status: response.status,
        sentVia: 'sms'
      };

    } catch (error) {
      console.error(`❌ SMS send failed:`, error.message);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Create SMS message (beautiful, detailed format)
   */
  createSMSMessage(studentName, status, checkInTime, schoolName) {
    const time = checkInTime || new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const date = new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    switch (status) {
      case 'late':
        return `ATTENDANCE ALERT - ${schoolName}\n\n` +
               `Dear Parent,\n\n` +
               `Your child ${studentName} arrived LATE today.\n\n` +
               `Time: ${time}\n` +
               `Date: ${dayName}, ${date}\n\n` +
               `Please ensure timely arrival tomorrow.\n\n` +
               `Thank you,\n${schoolName}`;

      case 'absent':
        return `ABSENCE ALERT - ${schoolName}\n\n` +
               `Dear Parent,\n\n` +
               `Your child ${studentName} is marked ABSENT today.\n\n` +
               `Date: ${dayName}, ${date}\n\n` +
               `If this is an error or your child is unwell, please contact the school office immediately.\n\n` +
               `Thank you,\n${schoolName}`;

      case 'leave':
        return `LEAVE NOTIFICATION - ${schoolName}\n\n` +
               `Dear Parent,\n\n` +
               `Your child ${studentName} is on approved LEAVE today.\n\n` +
               `Date: ${dayName}, ${date}\n\n` +
               `We hope to see them back soon.\n\n` +
               `Thank you,\n${schoolName}`;

      case 'present':
        return `ATTENDANCE CONFIRMED - ${schoolName}\n\n` +
               `Dear Parent,\n\n` +
               `Your child ${studentName} has arrived safely at school.\n\n` +
               `Time: ${time}\n` +
               `Date: ${dayName}, ${date}\n\n` +
               `Have a great day!\n\n` +
               `Thank you,\n${schoolName}`;

      default:
        return `ATTENDANCE UPDATE - ${schoolName}\n\n` +
               `Dear Parent,\n\n` +
               `Attendance update for ${studentName}\n` +
               `Status: ${status.toUpperCase()}\n` +
               `Date: ${dayName}, ${date}\n\n` +
               `Thank you,\n${schoolName}`;
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
   * Log message to database (WhatsApp or SMS)
   */
  async logMessage(phone, studentName, studentId, schoolId, status, messageId, sentVia = 'whatsapp') {
    try {
      const { query } = require('../config/database');

      const messageType = sentVia === 'sms' ? 'sms_alert' : 'attendance_alert';

      await query(
        `INSERT INTO whatsapp_logs (phone, student_name, student_id, school_id, status, message_id, message_type, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [phone, studentName, studentId, schoolId, status, messageId, messageType]
      );
    } catch (error) {
      // Non-critical - just log the error
      console.error('Failed to log message:', error.message);
    }
  }

  /**
   * Test WhatsApp connection
   * ✅ FIXED: Load settings from database before testing
   */
  async testConnection(testPhone) {
    await this.ensureInitialized();

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

  /**
   * 🚀 BATCH SEND: Send SMS to multiple students in parallel
   * Optimized for 100-200 students
   */
  async sendBatchSMS(studentsData) {
    console.log(`🚀 Batch SMS: Processing ${studentsData.length} messages...`);
    const startTime = Date.now();

    const results = {
      total: studentsData.length,
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    // Process in batches to respect rate limits
    for (let i = 0; i < studentsData.length; i += this.batchSize) {
      const batch = studentsData.slice(i, i + this.batchSize);
      const batchNum = Math.floor(i / this.batchSize) + 1;
      const totalBatches = Math.ceil(studentsData.length / this.batchSize);

      console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} messages)`);

      // Send all messages in this batch in parallel
      const batchPromises = batch.map(data =>
        this.sendViaSMS(data)
          .then(result => {
            if (result.success) {
              if (result.skipped) {
                results.skipped++;
              } else {
                results.sent++;
              }
            } else {
              results.failed++;
              results.errors.push({
                student: data.studentName,
                error: result.error
              });
            }
            return result;
          })
          .catch(error => {
            results.failed++;
            results.errors.push({
              student: data.studentName,
              error: error.message
            });
            return { success: false, error: error.message };
          })
      );

      // Wait for all messages in this batch to complete
      await Promise.all(batchPromises);

      // Small delay between batches to avoid rate limiting
      if (i + this.batchSize < studentsData.length) {
        await new Promise(resolve => setTimeout(resolve, this.batchDelayMs));
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Batch SMS complete: ${results.sent} sent, ${results.skipped} skipped, ${results.failed} failed in ${duration}s`);

    return results;
  }
}

// Export singleton instance
module.exports = new WhatsAppService();
