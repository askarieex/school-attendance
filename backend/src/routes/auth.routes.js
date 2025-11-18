const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validateAuth } = require('../middleware/validation');

/**
 * Authentication Routes
 * Base path: /api/v1/auth
 */

// POST /api/v1/auth/login (with validation)
router.post('/login', validateAuth.login, authController.login);

// POST /api/v1/auth/refresh
router.post('/refresh', authController.refreshToken);

// GET /api/v1/auth/me (protected)
router.get('/me', authenticate, authController.getMe);

// PUT /api/v1/auth/change-password (protected, with validation)
router.put('/change-password', authenticate, validateAuth.changePassword, authController.changePassword);

module.exports = router;

