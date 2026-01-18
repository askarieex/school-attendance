const express = require('express');
const router = express.Router();
const databaseController = require('../controllers/databaseController');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

/**
 * Database Explorer Routes
 * Base path: /api/v1/super/database
 * 🔒 STRICT SECURITY: Super Admin ONLY
 */

// Apply authentication and super admin check to all routes
router.use(authenticate);
router.use(requireSuperAdmin);

// Get list of all tables
router.get('/tables', databaseController.getTables);

// Get data from a specific table
router.get('/tables/:tableName', databaseController.getTableData);

module.exports = router;
