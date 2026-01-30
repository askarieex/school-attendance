const axios = require('axios');
const { maskPhone } = require('../utils/logger');

/**
 * WhatsApp Service using YCloud API (Meta WhatsApp Business API)
 * Sends attendance alerts to parents via WhatsApp using pre-approved templates
 * 
 * ✅ Features:
 * - Uses YCloud API for WhatsApp Business
 * - Supports Meta-approved message templates
 * - Per-school API key support (some schools can use their own YCloud account)
 * - Credit management integration
 * - Deduplication to prevent duplicate messages
 */
class WhatsAppService {
  constructor() {
    this.initialized = false;
    this.enabled = false;

    // Master settings (loaded from database)
    this.masterApiKey = null;
    this.phoneNumberId = null;
    this.wabaId = null;

    // Template names for different statuses
    this.templates = {
      late: 'attendance_late',
      absent: 'attendance_absent',
      present: 'attendance_present',
      leave: 'attendance_leave'
    };

    // YCloud API base URL
    this.apiBaseUrl = 'https://api.ycloud.com/v2';

    console.log('⏳ WhatsApp Service (YCloud) created - will load settings on first use');
  }

  /**
   * Load WhatsApp settings from database (platform_settings table)
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

      // Check if WhatsApp is enabled globally
      if (settings.whatsapp_enabled !== 'true') {
        this.enabled = false;
        console.log('⚠️ WhatsApp disabled in platform settings');
        return false;
      }

      // Load YCloud settings
      this.masterApiKey = settings.ycloud_api_key;
      this.phoneNumberId = settings.whatsapp_phone_id;
      this.wabaId = settings.whatsapp_business_account_id;

      // Load template names if configured
      if (settings.whatsapp_template_late) this.templates.late = settings.whatsapp_template_late;
      if (settings.whatsapp_template_absent) this.templates.absent = settings.whatsapp_template_absent;
      if (settings.whatsapp_template_present) this.templates.present = settings.whatsapp_template_present;
      if (settings.whatsapp_template_leave) this.templates.leave = settings.whatsapp_template_leave;
      if (settings.whatsapp_template_name) {
        // Use single template name for all statuses if only one is configured
        this.templates.late = settings.whatsapp_template_name;
        this.templates.absent = settings.whatsapp_template_name;
        this.templates.present = settings.whatsapp_template_name;
        this.templates.leave = settings.whatsapp_template_name;
      }

      // Validate API key
      if (!this.masterApiKey || this.masterApiKey === 'your_api_key_here') {
        this.enabled = false;
        console.log('⚠️ YCloud API key not configured');
        return false;
      }

      this.enabled = true;
      this.initialized = true;
      console.log('✅ WhatsApp Service (YCloud) initialized');
      console.log(`📋 Templates: late=${this.templates.late}, absent=${this.templates.absent}`);
      return true;

    } catch (error) {
      console.error('❌ Failed to load WhatsApp settings:', error.message);
      return false;
    }
  }

  /**
   * Ensure settings are loaded before sending
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.loadSettings();
    }
    return this.enabled;
  }

  /**
   * Get API key for a school (use school's own key if configured, otherwise master key)
   */
  async getApiKeyForSchool(schoolId) {
    try {
      const { query } = require('../config/database');

      const result = await query(
        `SELECT whatsapp_api_key, whatsapp_use_own_key
         FROM schools WHERE id = $1`,
        [schoolId]
      );

      if (result.rows.length > 0) {
        const school = result.rows[0];
        if (school.whatsapp_use_own_key && school.whatsapp_api_key) {
          console.log(`🔑 Using school's own YCloud API key for school ${schoolId}`);
          return school.whatsapp_api_key;
        }
      }

      // Use master key
      return this.masterApiKey;
    } catch (error) {
      console.error('Error getting API key for school:', error.message);
      return this.masterApiKey;
    }
  }

  /**
   * Format phone number for WhatsApp API
   * Returns phone number in international format without + prefix
   */
  formatPhoneNumber(phone, defaultCountryCode = '91') {
    if (!phone) return null;

    // Reject if looks like email
    if (phone.includes('@') || phone.includes('.com')) {
      console.warn('⚠️ Invalid phone: looks like email');
      return null;
    }

    // Remove all non-digit characters except +
    phone = phone.replace(/[^\d+]/g, '');

    // If only country code, return null
    if (phone === '+91' || phone === '91' || phone.length < 10) {
      console.warn('⚠️ Invalid phone: too short');
      return null;
    }

    // Handle different formats
    if (phone.startsWith('+')) {
      return phone.substring(1); // Remove + for API
    } else if (phone.startsWith('0')) {
      // Pakistani format: 03001234567 → 923001234567
      return '92' + phone.substring(1);
    } else if (phone.startsWith('91') || phone.startsWith('92')) {
      return phone; // Already has country code
    } else if (phone.length >= 10) {
      return defaultCountryCode + phone; // Add default country code
    }

    return null;
  }

  /**
   * Normalize phone for deduplication
   */
  normalizePhoneForDedup(phone) {
    if (!phone) return null;
    phone = phone.replace(/\D/g, '');

    // Remove country codes, keep last 10 digits
    if (phone.startsWith('91') && phone.length >= 12) return phone.substring(2);
    if (phone.startsWith('92') && phone.length >= 12) return phone.substring(2);
    if (phone.length > 10) return phone.slice(-10);
    if (phone.startsWith('0') && phone.length > 10) return phone.substring(1);

    return phone;
  }

  /**
   * Send WhatsApp message using YCloud API with template
   * @param {string} phoneNumber - Phone number to send to
   * @param {string} templateName - Template name from Meta/YCloud
   * @param {Array} bodyParams - Parameters for BODY component {{1}}, {{2}}, {{3}}
   * @param {string} apiKey - YCloud API key
   * @param {string} headerParam - Optional parameter for HEADER component {{4}}
   */
  async sendTemplateMessage(phoneNumber, templateName, bodyParams, apiKey, headerParam = null) {
    try {
      // Build components array
      const components = [];

      // Add HEADER component if school name is provided
      if (headerParam) {
        components.push({
          type: 'header',
          parameters: [{
            type: 'text',
            text: headerParam
          }]
        });
      }

      // Add BODY component with student details
      if (bodyParams && bodyParams.length > 0) {
        components.push({
          type: 'body',
          parameters: bodyParams.map(param => ({
            type: 'text',
            text: param
          }))
        });
      }

      const response = await axios.post(
        `${this.apiBaseUrl}/whatsapp/messages`,
        {
          to: phoneNumber,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: 'en'  // Or 'en_US' depending on your template
            },
            components: components
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey
          }
        }
      );

      return {
        success: true,
        messageId: response.data.id || response.data.messageId,
        status: response.data.status
      };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      console.error('❌ YCloud API error:', errorMessage);
      return {
        success: false,
        error: errorMessage,
        code: error.response?.status
      };
    }
  }

  /**
   * Send attendance alert to parent
   * @param {Object} data - Alert data
   */
  async sendAttendanceAlert(data) {
    await this.ensureInitialized();

    if (!this.enabled) {
      console.log('⚠️ WhatsApp service disabled');
      return { success: false, error: 'WhatsApp service disabled' };
    }

    if (!data) {
      return { success: false, error: 'No data provided' };
    }

    try {
      const { parentPhone, studentName, studentId, schoolId, status, checkInTime, schoolName, date } = data;

      // Validate required fields
      if (!parentPhone || !studentName || !studentId) {
        console.warn('⚠️ Missing required fields for WhatsApp alert');
        return { success: false, error: 'Missing required fields' };
      }

      // Format phone number
      const phone = this.formatPhoneNumber(parentPhone);
      if (!phone) {
        console.warn(`⚠️ Invalid phone for ${studentName}`);
        return { success: false, error: 'Invalid phone number' };
      }

      // 🔒 Deduplication check
      const { query } = require('../config/database');
      const normalizedPhone = this.normalizePhoneForDedup(parentPhone);
      const today = date || new Date().toISOString().split('T')[0];

      const duplicateCheck = await query(
        `SELECT id, message_id FROM whatsapp_logs
         WHERE phone = $1 AND student_id = $2 AND status = $3 AND DATE(sent_at) = $4 LIMIT 1`,
        [normalizedPhone, studentId, status, today]
      );

      if (duplicateCheck.rows.length > 0) {
        console.log(`⏭️ Already sent to ${maskPhone(parentPhone)} for ${studentName} (${status})`);
        return {
          success: true,
          messageId: duplicateCheck.rows[0].message_id,
          skipped: true,
          reason: 'Duplicate prevented'
        };
      }

      // Get API key (school-specific or master)
      const apiKey = await this.getApiKeyForSchool(schoolId);
      if (!apiKey) {
        return { success: false, error: 'No API key available' };
      }

      // Get template name for this status
      const templateName = this.templates[status] || this.templates.late;

      // Build template parameters
      // BODY: {{1}} = student name, {{2}} = time, {{3}} = date
      // HEADER: {{4}} = school name (optional, for templates with header)
      const time = checkInTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const dateFormatted = new Date().toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });

      // Body params: {{1}}, {{2}}, {{3}}
      const bodyParams = [studentName, time, dateFormatted];

      // Header param: {{4}} - School name (for templates with header component)
      const headerParam = schoolName || 'School';

      console.log(`📱 Sending WhatsApp to ${maskPhone(parentPhone)} via YCloud...`);
      console.log(`   Template: ${templateName}, Body: [${studentName}, ${time}, ${dateFormatted}], Header: ${headerParam}`);

      // Send via YCloud with header and body params
      const result = await this.sendTemplateMessage(phone, templateName, bodyParams, apiKey, headerParam);

      if (result.success) {
        console.log(`✅ WhatsApp sent: ${result.messageId}`);

        // Log to database
        await this.logMessage(normalizedPhone, studentName, studentId, schoolId, status, result.messageId, 'whatsapp');

        return {
          success: true,
          messageId: result.messageId,
          sentVia: 'whatsapp'
        };
      } else {
        console.error(`❌ WhatsApp failed: ${result.error}`);

        // Log failure
        await this.logError(normalizedPhone, studentName, studentId, schoolId, status, result.error);

        return result;
      }

    } catch (error) {
      console.error('❌ sendAttendanceAlert error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Log successful message to database
   */
  async logMessage(phone, studentName, studentId, schoolId, status, messageId, sentVia = 'whatsapp') {
    try {
      const { query } = require('../config/database');
      await query(
        `INSERT INTO whatsapp_logs (phone, student_name, student_id, school_id, status, message_id, message_type, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [phone, studentName, studentId, schoolId, status, messageId, sentVia + '_alert']
      );
    } catch (error) {
      console.error('Failed to log message:', error.message);
    }
  }

  /**
   * Log failed message attempt
   */
  async logError(phone, studentName, studentId, schoolId, status, errorMessage) {
    try {
      const { query } = require('../config/database');
      await query(
        `INSERT INTO whatsapp_logs (phone, student_name, student_id, school_id, status, error_message, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [phone, studentName, studentId, schoolId, status, errorMessage]
      );
    } catch (error) {
      console.error('Failed to log error:', error.message);
    }
  }

  /**
   * Test WhatsApp connection
   */
  async testConnection(testPhone) {
    await this.ensureInitialized();

    if (!this.enabled) {
      return { success: false, error: 'WhatsApp service not configured' };
    }

    try {
      const phone = this.formatPhoneNumber(testPhone);
      if (!phone) {
        return { success: false, error: 'Invalid phone number' };
      }

      // Send test template (you need a test template approved in Meta)
      const result = await this.sendTemplateMessage(
        phone,
        'hello_world', // Common test template, or use your own
        [],
        this.masterApiKey
      );

      if (result.success) {
        return {
          success: true,
          messageId: result.messageId,
          message: 'Test message sent successfully via YCloud!'
        };
      } else {
        return {
          success: false,
          error: result.error,
          hint: 'Make sure your template is approved in Meta Business Manager'
        };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get template configuration (for Settings page)
   */
  getTemplateConfig() {
    return this.templates;
  }
}

// Export singleton instance
module.exports = new WhatsAppService();
