const express = require('express');
const router = express.Router();
const deviceSyncController = require('../controllers/deviceSyncController');
const { authenticateDevice } = require('../middleware/auth');

/**
 * Device Sync Routes
 * Base path: /api/v1/device/sync
 * All routes require device API key authentication (X-API-Key header)
 *
 * These endpoints support the Intelligent Hybrid Model
 */

// Apply device authentication to all routes
router.use(authenticateDevice);

/**
 * SYNC ENDPOINTS
 */

// GET /api/v1/device/sync/cards
// Download list of valid RFID cards for local caching
router.get('/cards', deviceSyncController.syncCardList);

// POST /api/v1/device/sync/logs
// Upload batch of attendance logs (for offline queue)
router.post('/logs', deviceSyncController.batchUploadLogs);

// POST /api/v1/device/sync/validate
// Quick RFID validation without logging
router.post('/validate', deviceSyncController.quickValidate);

// POST /api/v1/device/sync/heartbeat
// Device status/health check
router.post('/heartbeat', deviceSyncController.deviceHeartbeat);

// GET /api/v1/device/sync/status
// Get sync status and server time
router.get('/status', deviceSyncController.getSyncStatus);

module.exports = router;
