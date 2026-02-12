const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validateAuth } = require('../middleware/validation');

/**
 * Authentication Routes
 * Base path: /api/v1/auth
 */

// ✅ SECURITY FIX: Rate limiter for login endpoint to prevent brute-force attacks
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login requests per windowMs
    message: {
        success: false,
        error: 'Too many login attempts from this IP. Please try again in 15 minutes.',
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    skipSuccessfulRequests: false, // Count all requests
    skipFailedRequests: false, // Count failed requests too
});

// POST /api/v1/auth/login (with rate limiting and validation)
router.post('/login', loginLimiter, validateAuth.login, authController.login);


// POST /api/v1/auth/refresh
router.post('/refresh', authController.refreshToken);

// GET /api/v1/auth/me (protected)
router.get('/me', authenticate, authController.getMe);

// PUT /api/v1/auth/change-password (protected, with validation)
router.put('/change-password', authenticate, validateAuth.changePassword, authController.changePassword);

module.exports = router;

