const express = require('express');
const router = express.Router();
const deviceAuth = require('../middleware/deviceAuth');
const { receiveAttendanceData, sendCommands, receiveCommandConfirmation } = require('../controllers/iclockController');

/**
 * ZKTeco Device Communication Routes
 * These are the hardcoded endpoints that ZKTeco devices use
 */

/**
 * GET/POST /iclock/cdata
 * - GET with ?options=all -> handshake (device requests configuration)
 * - POST with attendance data -> receives attendance logs
 * Query param: SN (serial number)
 * Body: Plain text, tab-separated attendance logs (POST only)
 */
router.get('/cdata', deviceAuth, receiveAttendanceData);
router.post('/cdata', deviceAuth, receiveAttendanceData);

/**
 * GET /iclock/getrequest
 * Sends commands to devices
 * Query param: SN (serial number)
 * Response: Command string or "OK"
 */
router.get('/getrequest', deviceAuth, sendCommands);

/**
 * POST /iclock/devicecmd
 * Receives command execution confirmations from devices
 * Query param: SN (serial number)
 * Body: Plain text like "ID=6&Return=0"
 */
router.post('/devicecmd', deviceAuth, receiveCommandConfirmation);

module.exports = router;
