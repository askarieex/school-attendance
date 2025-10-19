const express = require('express');
const router = express.Router();
const holidayController = require('../controllers/holidayController');
const { authenticate, requireSchoolAdmin } = require('../middleware/auth');
const { enforceSchoolTenancy } = require('../middleware/multiTenant');

/**
 * Holiday Management Routes
 * Base path: /api/v1/school/holidays
 * All routes require school admin authentication and multi-tenancy enforcement
 */

// Apply authentication, school admin check, and multi-tenancy to all routes
router.use(authenticate);
router.use(requireSchoolAdmin);
router.use(enforceSchoolTenancy);

/**
 * HOLIDAY MANAGEMENT
 */
// GET /api/v1/school/holidays
router.get('/', holidayController.getHolidays);

// POST /api/v1/school/holidays
router.post('/', holidayController.createHoliday);

// POST /api/v1/school/holidays/bulk-import
router.post('/bulk-import', holidayController.bulkImportHolidays);

// PUT /api/v1/school/holidays/:id
router.put('/:id', holidayController.updateHoliday);

// DELETE /api/v1/school/holidays/:id
router.delete('/:id', holidayController.deleteHoliday);

module.exports = router;
