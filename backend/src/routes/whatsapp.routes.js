const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');
const { authenticate } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * @route   POST /api/v1/whatsapp/test
 * @desc    Test WhatsApp connection
 * @access  Private (School Admin only)
 */
router.post('/test', authenticate, async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return sendError(res, 'Phone number is required', 400);
    }

    // Test the WhatsApp connection
    const result = await whatsappService.testConnection(phoneNumber);

    if (result.success) {
      return sendSuccess(res, result, 'Test message sent successfully');
    } else {
      return sendError(res, result.error, 400, result);
    }
  } catch (error) {
    console.error('WhatsApp test error:', error);
    return sendError(res, 'Failed to send test message', 500);
  }
});

/**
 * @route   POST /api/v1/whatsapp/send-alert
 * @desc    Send attendance alert to parent
 * @access  Private (Teacher or School Admin)
 */
router.post('/send-alert', authenticate, async (req, res) => {
  try {
    const { parentPhone, studentName, status, checkInTime, schoolName } = req.body;

    // Validate required fields
    if (!parentPhone || !studentName || !status) {
      return sendError(res, 'Missing required fields: parentPhone, studentName, status', 400);
    }

    // Validate status
    const validStatuses = ['present', 'late', 'absent', 'leave'];
    if (!validStatuses.includes(status)) {
      return sendError(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    // Send alert
    const result = await whatsappService.sendAttendanceAlert({
      parentPhone,
      studentName,
      status,
      checkInTime: checkInTime || new Date().toLocaleTimeString(),
      schoolName: schoolName || 'School'
    });

    if (result.success) {
      return sendSuccess(res, result, 'Attendance alert sent successfully');
    } else {
      return sendError(res, result.error, 400, result);
    }
  } catch (error) {
    console.error('WhatsApp alert error:', error);
    return sendError(res, 'Failed to send attendance alert', 500);
  }
});

/**
 * @route   POST /api/v1/whatsapp/send-summary
 * @desc    Send daily attendance summary to parent
 * @access  Private (Teacher or School Admin)
 */
router.post('/send-summary', authenticate, async (req, res) => {
  try {
    const { parentPhone, studentName, summary, schoolName } = req.body;

    if (!parentPhone || !studentName || !summary) {
      return sendError(res, 'Missing required fields', 400);
    }

    const result = await whatsappService.sendDailySummary({
      parentPhone,
      studentName,
      summary,
      schoolName: schoolName || 'School'
    });

    if (result.success) {
      return sendSuccess(res, result, 'Daily summary sent successfully');
    } else {
      return sendError(res, result.error, 400);
    }
  } catch (error) {
    console.error('WhatsApp summary error:', error);
    return sendError(res, 'Failed to send summary', 500);
  }
});

/**
 * @route   POST /api/v1/whatsapp/send-custom
 * @desc    Send custom message to parent
 * @access  Private (School Admin only)
 */
router.post('/send-custom', authenticate, async (req, res) => {
  try {
    const { parentPhone, message, schoolName } = req.body;

    if (!parentPhone || !message) {
      return sendError(res, 'Missing required fields: parentPhone, message', 400);
    }

    const result = await whatsappService.sendCustomMessage(
      parentPhone,
      message,
      schoolName || 'School'
    );

    if (result.success) {
      return sendSuccess(res, result, 'Custom message sent successfully');
    } else {
      return sendError(res, result.error, 400);
    }
  } catch (error) {
    console.error('WhatsApp custom message error:', error);
    return sendError(res, 'Failed to send custom message', 500);
  }
});

/**
 * @route   GET /api/v1/whatsapp/status
 * @desc    Check WhatsApp service status
 * @access  Private
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const isEnabled = whatsappService.enabled;

    return sendSuccess(res, {
      enabled: isEnabled,
      configured: !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN,
      whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || 'Not configured'
    }, 'WhatsApp service status retrieved');
  } catch (error) {
    console.error('WhatsApp status error:', error);
    return sendError(res, 'Failed to check WhatsApp status', 500);
  }
});

module.exports = router;
