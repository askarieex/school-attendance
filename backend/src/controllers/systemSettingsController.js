const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * System Settings Controller
 * Manages platform-wide configuration settings
 */

/**
 * Get all settings or filter by category
 * GET /api/v1/super/settings
 * GET /api/v1/super/settings?category=whatsapp
 */
const getSettings = async (req, res) => {
  try {
    const { category } = req.query;

    let sql = 'SELECT * FROM platform_settings';
    const params = [];

    if (category) {
      sql += ' WHERE category = $1';
      params.push(category);
    }

    sql += ' ORDER BY category, setting_key';

    const result = await query(sql, params);

    // Hide secret values in response
    const settings = result.rows.map(setting => ({
      ...setting,
      setting_value: setting.is_secret ? '••••••••' : setting.setting_value
    }));

    sendSuccess(res, settings, 'Settings retrieved successfully');
  } catch (error) {
    console.error('Get settings error:', error);
    sendError(res, 'Failed to retrieve settings', 500);
  }
};

/**
 * Get settings grouped by category
 * GET /api/v1/super/settings/grouped
 */
const getSettingsGrouped = async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM platform_settings ORDER BY category, setting_key'
    );

    // Group by category
    const grouped = result.rows.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      
      acc[setting.category].push({
        ...setting,
        setting_value: setting.is_secret ? '••••••••' : setting.setting_value
      });
      
      return acc;
    }, {});

    sendSuccess(res, grouped, 'Settings retrieved successfully');
  } catch (error) {
    console.error('Get grouped settings error:', error);
    sendError(res, 'Failed to retrieve settings', 500);
  }
};

/**
 * Update a single setting
 * PUT /api/v1/super/settings/:key
 */
const updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const userId = req.user.id;

    if (value === undefined || value === null) {
      return sendError(res, 'Setting value is required', 400);
    }

    // Get current setting
    const currentResult = await query(
      'SELECT * FROM platform_settings WHERE setting_key = $1',
      [key]
    );

    if (currentResult.rows.length === 0) {
      return sendError(res, 'Setting not found', 404);
    }

    const currentSetting = currentResult.rows[0];

    // Validate value type
    const validatedValue = validateSettingValue(value, currentSetting.setting_type);

    // Update setting
    const result = await query(
      `UPDATE platform_settings 
       SET setting_value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
       WHERE setting_key = $3
       RETURNING *`,
      [validatedValue, userId, key]
    );

    // Log the change in audit_logs
    await logAuditAction({
      userId,
      userEmail: req.user.email,
      userRole: req.user.role,
      actionType: 'update',
      resourceType: 'setting',
      resourceId: result.rows[0].id,
      description: `Updated setting: ${key}`,
      oldValue: { [key]: currentSetting.setting_value },
      newValue: { [key]: validatedValue },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    sendSuccess(res, result.rows[0], 'Setting updated successfully');
  } catch (error) {
    console.error('Update setting error:', error);
    sendError(res, error.message || 'Failed to update setting', 500);
  }
};

/**
 * Update multiple settings at once
 * POST /api/v1/super/settings/batch
 */
const updateSettingsBatch = async (req, res) => {
  try {
    const { settings } = req.body; // Array of {key, value}
    const userId = req.user.id;

    if (!Array.isArray(settings) || settings.length === 0) {
      return sendError(res, 'Settings array is required', 400);
    }

    const updated = [];
    const errors = [];

    for (const setting of settings) {
      try {
        // Get current setting
        const currentResult = await query(
          'SELECT * FROM platform_settings WHERE setting_key = $1',
          [setting.key]
        );

        if (currentResult.rows.length === 0) {
          errors.push({ key: setting.key, error: 'Setting not found' });
          continue;
        }

        const currentSetting = currentResult.rows[0];
        const validatedValue = validateSettingValue(setting.value, currentSetting.setting_type);

        // Update setting
        const result = await query(
          `UPDATE platform_settings 
           SET setting_value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
           WHERE setting_key = $3
           RETURNING *`,
          [validatedValue, userId, setting.key]
        );

        updated.push(result.rows[0]);

        // Log audit
        await logAuditAction({
          userId,
          userEmail: req.user.email,
          userRole: req.user.role,
          actionType: 'update',
          resourceType: 'setting',
          resourceId: result.rows[0].id,
          description: `Batch updated setting: ${setting.key}`,
          oldValue: { [setting.key]: currentSetting.setting_value },
          newValue: { [setting.key]: validatedValue },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        });
      } catch (error) {
        errors.push({ key: setting.key, error: error.message });
      }
    }

    sendSuccess(res, { updated, errors }, `Updated ${updated.length} settings`);
  } catch (error) {
    console.error('Batch update settings error:', error);
    sendError(res, 'Failed to update settings', 500);
  }
};

/**
 * Test WhatsApp connection
 * POST /api/v1/super/settings/test-whatsapp
 */
const testWhatsAppConnection = async (req, res) => {
  try {
    // Get WhatsApp settings
    const settingsResult = await query(
      `SELECT setting_key, setting_value 
       FROM platform_settings 
       WHERE category = 'whatsapp'`
    );

    const settings = settingsResult.rows.reduce((acc, row) => {
      acc[row.setting_key] = row.setting_value;
      return acc;
    }, {});

    // Check if WhatsApp is enabled
    if (settings.whatsapp_enabled !== 'true') {
      return sendError(res, 'WhatsApp is disabled in settings', 400);
    }

    // Validate credentials
    if (!settings.twilio_account_sid || !settings.twilio_auth_token || !settings.twilio_phone_number) {
      return sendError(res, 'WhatsApp credentials not configured', 400);
    }

    // Try to send a test message (to super admin)
    const testNumber = req.body.testNumber || req.user.phone;
    
    if (!testNumber) {
      return sendError(res, 'Test phone number is required', 400);
    }

    // Use WhatsApp service to send test message
    const whatsappService = require('../services/whatsappService');
    
    try {
      await whatsappService.sendMessage(
        testNumber,
        '✅ WhatsApp Test Successful!\n\nYour WhatsApp integration is working correctly.'
      );

      sendSuccess(res, { testNumber }, 'WhatsApp test message sent successfully');
    } catch (twilioError) {
      console.error('Twilio error:', twilioError);
      sendError(res, `WhatsApp test failed: ${twilioError.message}`, 400);
    }
  } catch (error) {
    console.error('Test WhatsApp error:', error);
    sendError(res, 'Failed to test WhatsApp connection', 500);
  }
};

/**
 * Helper: Validate setting value based on type
 */
function validateSettingValue(value, type) {
  switch (type) {
    case 'string':
      return String(value);
    
    case 'number':
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error('Value must be a valid number');
      }
      return String(num);
    
    case 'boolean':
      if (value === 'true' || value === true || value === '1' || value === 1) {
        return 'true';
      } else if (value === 'false' || value === false || value === '0' || value === 0) {
        return 'false';
      }
      throw new Error('Value must be a boolean (true/false)');
    
    case 'json':
      try {
        // Validate JSON
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        JSON.parse(value);
        return value;
      } catch (e) {
        throw new Error('Value must be valid JSON');
      }
    
    default:
      return String(value);
  }
}

/**
 * Helper: Log audit action
 */
async function logAuditAction(data) {
  try {
    await query(
      `INSERT INTO audit_logs 
       (user_id, user_email, user_role, action_type, resource_type, resource_id, description, old_value, new_value, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        data.userId,
        data.userEmail,
        data.userRole,
        data.actionType,
        data.resourceType,
        data.resourceId,
        data.description,
        data.oldValue ? JSON.stringify(data.oldValue) : null,
        data.newValue ? JSON.stringify(data.newValue) : null,
        data.ipAddress,
        data.userAgent
      ]
    );
  } catch (error) {
    console.error('Failed to log audit action:', error);
    // Don't throw - audit logging should not break the main operation
  }
}

module.exports = {
  getSettings,
  getSettingsGrouped,
  updateSetting,
  updateSettingsBatch,
  testWhatsAppConnection
};
