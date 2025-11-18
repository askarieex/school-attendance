const express = require('express');
const router = express.Router();
const deviceManagementController = require('../controllers/deviceManagementController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * Device Management Routes
 * Base path: /api/v1/device-management
 *
 * These routes allow admins to manage device-student synchronization
 */

// Apply authentication to all routes
router.use(authenticate);

/**
 * SYNC STATUS ENDPOINTS
 */

// GET /api/v1/device-management/:deviceId/sync-status
// Get sync status for a specific device
router.get(
  '/:deviceId/sync-status',
  authorize(['superadmin', 'school_admin']),
  deviceManagementController.getSyncStatus
);

// POST /api/v1/device-management/:deviceId/sync-students
// Trigger manual full sync for a specific device
router.post(
  '/:deviceId/sync-students',
  authorize(['superadmin', 'school_admin']),
  deviceManagementController.fullSyncStudents
);

// POST /api/v1/device-management/:deviceId/verify-sync
// Trigger sync verification (check for missing/extra students)
router.post(
  '/:deviceId/verify-sync',
  authorize(['superadmin', 'school_admin']),
  deviceManagementController.verifySyncStatus
);

// POST /api/v1/device-management/verify-all
// Trigger sync verification for all devices
router.post(
  '/verify-all',
  authorize(['superadmin']),
  deviceManagementController.verifyAllDevices
);

module.exports = router;
