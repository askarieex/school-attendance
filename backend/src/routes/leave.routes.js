const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const { authenticate, requireSchoolAdmin } = require('../middleware/auth');
const { enforceSchoolTenancy } = require('../middleware/multiTenant');

/**
 * Leave Management Routes
 * Base path: /api/v1/school/leaves
 * All routes require school admin authentication and multi-tenancy enforcement
 */

// Apply authentication, school admin check, and multi-tenancy to all routes
router.use(authenticate);
router.use(requireSchoolAdmin);
router.use(enforceSchoolTenancy);

// GET /api/v1/school/leaves
router.get('/', leaveController.getLeaves);

// GET /api/v1/school/leaves/monthly
router.get('/monthly', leaveController.getMonthlyLeaves);

// POST /api/v1/school/leaves
router.post('/', leaveController.createLeave);

// GET /api/v1/school/leaves/:id
router.get('/:id', leaveController.getLeave);

// PUT /api/v1/school/leaves/:id
router.put('/:id', leaveController.updateLeave);

// DELETE /api/v1/school/leaves/:id
router.delete('/:id', leaveController.deleteLeave);

// PUT /api/v1/school/leaves/:id/status
router.put('/:id/status', leaveController.updateLeaveStatus);

module.exports = router;
