const { query } = require('../config/database');

/**
 * Device Authentication Middleware
 * Verifies that the device is registered in our system using its Serial Number
 */
const deviceAuth = async (req, res, next) => {
  try {
    // Extract Serial Number from query parameter
    const { SN } = req.query;

    if (!SN) {
      console.error('Device authentication failed: No SN provided');
      res.set('Content-Type', 'text/plain');
      return res.status(401).send('ERROR: Serial Number required');
    }

    // Look up device in database
    const result = await query(
      `SELECT d.*, s.id as school_id, s.name as school_name
       FROM devices d
       JOIN schools s ON d.school_id = s.id
       WHERE d.serial_number = $1 AND d.is_active = TRUE`,
      [SN]
    );

    if (result.rows.length === 0) {
      console.error(`Device authentication failed: Device ${SN} not found or inactive`);
      res.set('Content-Type', 'text/plain');
      return res.status(401).send('ERROR: Device not registered');
    }

    // Attach device info to request for use in controllers
    req.device = result.rows[0];

    // Update last heartbeat
    await query(
      'UPDATE devices SET last_heartbeat = CURRENT_TIMESTAMP, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
      [req.device.id]
    );

    console.log(`✅ Device authenticated: ${SN} (${req.device.device_name}) - School: ${req.device.school_name}`);

    next();
  } catch (error) {
    console.error('Device authentication error:', error);
    res.set('Content-Type', 'text/plain');
    return res.status(500).send('ERROR: Server error');
  }
};

module.exports = deviceAuth;
