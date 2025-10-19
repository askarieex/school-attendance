const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticateDevice } = require('../middleware/auth');

/**
 * Hardware Device Attendance Routes
 * Base path: /api/v1/attendance
 * All routes require device API key authentication (X-API-Key header)
 */

// Apply device authentication to all routes
router.use(authenticateDevice);

/**
 * ATTENDANCE LOGGING
 */
// POST /api/v1/attendance/log
router.post('/log', attendanceController.logAttendance);

// GET /api/v1/attendance/verify/:rfid
router.get('/verify/:rfid', attendanceController.verifyRfid);

// GET /api/v1/attendance/health
router.get('/health', attendanceController.healthCheck);

module.exports = router;
