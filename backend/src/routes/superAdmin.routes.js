const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');
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

// DELETE /api/v1/super/schools/:id
router.delete('/schools/:id', superAdminController.deleteSchool);

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

// DELETE /api/v1/super/users/:id
router.delete('/users/:id', superAdminController.deleteUser);

/**
 * PLATFORM STATISTICS
 */
// GET /api/v1/super/stats
router.get('/stats', superAdminController.getPlatformStats);

module.exports = router;
