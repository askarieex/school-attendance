const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');
const systemSettingsController = require('../controllers/systemSettingsController');
const passwordManagementController = require('../controllers/passwordManagementController');
const auditLogsController = require('../controllers/auditLogsController');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

/**
 * Super Admin Routes
 * Base path: /api/v1/super
 * All routes require super admin authentication
 */

// Apply authentication and super admin check to all routes
router.use(authenticate);
router.use(requireSuperAdmin);

/**
 * SCHOOL MANAGEMENT
 */
// GET /api/v1/super/schools
router.get('/schools', superAdminController.getSchools);

// POST /api/v1/super/schools
router.post('/schools', superAdminController.createSchool);

// GET /api/v1/super/schools/:id
router.get('/schools/:id', superAdminController.getSchool);

// PUT /api/v1/super/schools/:id
router.put('/schools/:id', superAdminController.updateSchool);

// DELETE /api/v1/super/schools/:id (soft delete - deactivate)
router.delete('/schools/:id', superAdminController.deleteSchool);

// DELETE /api/v1/super/schools/:id/permanent (hard delete - remove all data)
router.delete('/schools/:id/permanent', superAdminController.permanentDeleteSchool);

/**
 * DEVICE MANAGEMENT
 */
// GET /api/v1/super/devices
router.get('/devices', superAdminController.getDevices);

// POST /api/v1/super/devices
router.post('/devices', superAdminController.createDevice);

// DELETE /api/v1/super/devices/:id
router.delete('/devices/:id', superAdminController.deleteDevice);

/**
 * USER MANAGEMENT
 */
// GET /api/v1/super/users
router.get('/users', superAdminController.getUsers);

// POST /api/v1/super/users
router.post('/users', superAdminController.createUser);

// DELETE /api/v1/super/users/:id/permanent (Move to top to avoid matching issues)
router.delete('/users/:id/permanent', superAdminController.permanentDeleteUser);

// GET /api/v1/super/users/debug-route
router.get('/users/debug-route', (req, res) => res.json({ message: 'Debug route works!' }));

// DELETE /api/v1/super/users/:id
router.delete('/users/:id', superAdminController.deleteUser);



/**
 * PASSWORD MANAGEMENT ✨ NEW
 */
// GET /api/v1/super/users/search?q=email
router.get('/users/search', passwordManagementController.searchUsers);

// POST /api/v1/super/users/:id/reset-password
router.post('/users/:id/reset-password', passwordManagementController.resetPassword);

// POST /api/v1/super/users/:id/generate-temp-password
router.post('/users/:id/generate-temp-password', passwordManagementController.generateTempPassword);

/**
 * SYSTEM SETTINGS ✨ NEW
 */
// GET /api/v1/super/settings - Get all settings
router.get('/settings', systemSettingsController.getSettings);

// GET /api/v1/super/settings/grouped - Get settings grouped by category
router.get('/settings/grouped', systemSettingsController.getSettingsGrouped);

// PUT /api/v1/super/settings/:key - Update single setting
router.put('/settings/:key', systemSettingsController.updateSetting);

// POST /api/v1/super/settings/batch - Update multiple settings
router.post('/settings/batch', systemSettingsController.updateSettingsBatch);

// POST /api/v1/super/settings/test-whatsapp - Test WhatsApp connection
router.post('/settings/test-whatsapp', systemSettingsController.testWhatsAppConnection);

/**
 * AUDIT LOGS ✨ NEW
 */
// GET /api/v1/super/audit-logs - Get audit logs with filters
router.get('/audit-logs', auditLogsController.getAuditLogs);

// GET /api/v1/super/audit-logs/stats - Get audit statistics
router.get('/audit-logs/stats', auditLogsController.getAuditStats);

// GET /api/v1/super/audit-logs/export - Export to CSV
router.get('/audit-logs/export', auditLogsController.exportAuditLogs);

// GET /api/v1/super/audit-logs/:id - Get single audit log details
router.get('/audit-logs/:id', auditLogsController.getAuditLogDetails);

/**
 * PLATFORM STATISTICS
 */
// GET /api/v1/super/stats
router.get('/stats', superAdminController.getPlatformStats);

module.exports = router;
