const express = require('express');
const router = express.Router();
const { authenticate, requireSchoolAdmin, requireSuperAdmin } = require('../middleware/auth');
const autoAbsenceService = require('../services/autoAbsenceDetection');
const { pool } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

// Apply authentication to all routes
router.use(authenticate);

/**
 * AUTO-ABSENCE DETECTION API ENDPOINTS
 *
 * These endpoints allow school admins to:
 * 1. Get current auto-absence settings
 * 2. Update auto-absence settings
 * 3. Manually trigger absence check (for testing)
 * 4. Get service status
 */

/**
 * GET /api/v1/school/auto-absence/settings
 * Get auto-absence settings for current school
 */
router.get('/settings', async (req, res) => {
  try {
    const schoolId = req.user.schoolId; // From authenticate middleware

    if (!schoolId) {
      return sendError(res, 'School ID required', 400);
    }

    const result = await pool.query(`
      SELECT
        auto_absence_enabled,
        absence_grace_period_hours,
        absence_check_time,
        school_start_time
      FROM school_settings
      WHERE school_id = $1
    `, [schoolId]);

    if (result.rows.length === 0) {
      // Return defaults if no settings exist
      return sendSuccess(res, {
        auto_absence_enabled: true,
        absence_grace_period_hours: 2,
        absence_check_time: '11:00:00',
        school_start_time: '09:00:00'
      }, 'Default settings returned');
    }

    sendSuccess(res, result.rows[0], 'Settings retrieved successfully');
  } catch (error) {
    console.error('Get auto-absence settings error:', error);
    sendError(res, 'Failed to get settings', 500);
  }
});

/**
 * PUT /api/v1/school/auto-absence/settings
 * Update auto-absence settings for current school
 * Requires school_admin role
 */
router.put('/settings', requireSchoolAdmin, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const {
      auto_absence_enabled,
      absence_grace_period_hours,
      absence_check_time
    } = req.body;

    // Validate inputs
    if (absence_grace_period_hours !== undefined) {
      if (absence_grace_period_hours < 0 || absence_grace_period_hours > 12) {
        return sendError(res, 'Grace period must be between 0 and 12 hours', 400);
      }
    }

    if (absence_check_time !== undefined) {
      // Validate time format (HH:MM:SS or HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
      if (!timeRegex.test(absence_check_time)) {
        return sendError(res, 'Invalid time format. Use HH:MM:SS or HH:MM', 400);
      }
    }

    // Update settings
    await pool.query(`
      UPDATE school_settings
      SET
        auto_absence_enabled = COALESCE($1, auto_absence_enabled),
        absence_grace_period_hours = COALESCE($2, absence_grace_period_hours),
        absence_check_time = COALESCE($3, absence_check_time)
      WHERE school_id = $4
    `, [
      auto_absence_enabled,
      absence_grace_period_hours,
      absence_check_time,
      schoolId
    ]);

    // Get updated settings
    const result = await pool.query(`
      SELECT
        auto_absence_enabled,
        absence_grace_period_hours,
        absence_check_time,
        school_start_time
      FROM school_settings
      WHERE school_id = $1
    `, [schoolId]);

    sendSuccess(res, result.rows[0], 'Auto-absence settings updated successfully');
  } catch (error) {
    console.error('Update auto-absence settings error:', error);
    sendError(res, 'Failed to update settings', 500);
  }
});

/**
 * POST /api/v1/school/auto-absence/trigger
 * Manually trigger absence check (for testing)
 * Only available to school admins
 */
router.post('/trigger', requireSchoolAdmin, async (req, res) => {
  try {
    console.log(`\n🧪 Manual trigger requested by user ID: ${req.user.id} (Role: ${req.user.role})`);

    // Run the absence detection manually
    const result = await autoAbsenceService.runManually();

    sendSuccess(res, {
      triggered: true,
      note: 'Check server console for detailed logs'
    }, result.message || 'Absence check triggered successfully');
  } catch (error) {
    console.error('Manual trigger error:', error);
    sendError(res, 'Failed to trigger absence check', 500);
  }
});

/**
 * GET /api/v1/school/auto-absence/status
 * Get service status
 */
router.get('/status', async (req, res) => {
  try {
    const status = autoAbsenceService.getStatus();

    sendSuccess(res, {
      ...status,
      description: 'Automatic absence detection service',
      schedule_description: '11:00 AM daily (Monday-Saturday)',
      how_it_works: [
        '1. Service runs daily at 11:00 AM',
        '2. Checks all students with no attendance record',
        '3. Marks them as absent automatically',
        '4. Sends WhatsApp notification to parents'
      ]
    }, 'Service status retrieved');
  } catch (error) {
    console.error('Get status error:', error);
    sendError(res, 'Failed to get service status', 500);
  }
});

module.exports = router;
