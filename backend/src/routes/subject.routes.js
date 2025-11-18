const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subjectController');
const { authenticate, requireSchoolAdmin } = require('../middleware/auth');
const { requireTeacher } = require('../middleware/teacherAuth');

/**
 * Subject Routes
 *
 * Base path: /api/subjects
 *
 * Access control:
 * - School admins: Full CRUD access
 * - Teachers: Read-only access to their assigned subjects
 */

// ===== School Admin Routes (Full CRUD) =====

/**
 * GET /api/subjects
 * Get all subjects for the school
 * Query params:
 *   - includeInactive: Include inactive subjects (default: false)
 *   - includeStats: Include assignment statistics (default: false)
 */
router.get(
  '/',
  authenticate,
  requireSchoolAdmin,
  subjectController.getAllSubjects
);

/**
 * GET /api/subjects/statistics
 * Get subject statistics for the school
 */
router.get(
  '/statistics',
  authenticate,
  requireSchoolAdmin,
  subjectController.getSubjectStatistics
);

/**
 * POST /api/subjects/create-defaults
 * Create default subjects for the school
 */
router.post(
  '/create-defaults',
  authenticate,
  requireSchoolAdmin,
  subjectController.createDefaultSubjects
);

/**
 * GET /api/subjects/section/:sectionId
 * Get all subjects for a specific section
 */
router.get(
  '/section/:sectionId',
  authenticate,
  requireSchoolAdmin,
  subjectController.getSubjectsBySection
);

/**
 * GET /api/subjects/:id
 * Get a single subject by ID
 */
router.get(
  '/:id',
  authenticate,
  requireSchoolAdmin,
  subjectController.getSubjectById
);

/**
 * POST /api/subjects
 * Create a new subject
 * Body: { subjectName, subjectCode?, description?, isActive? }
 */
router.post(
  '/',
  authenticate,
  requireSchoolAdmin,
  subjectController.createSubject
);

/**
 * PUT /api/subjects/:id
 * Update a subject
 * Body: { subjectName?, subjectCode?, description?, isActive? }
 */
router.put(
  '/:id',
  authenticate,
  requireSchoolAdmin,
  subjectController.updateSubject
);

/**
 * DELETE /api/subjects/:id
 * Delete (deactivate) a subject
 * Query params:
 *   - hard: Hard delete if no assignments (default: false)
 */
router.delete(
  '/:id',
  authenticate,
  requireSchoolAdmin,
  subjectController.deleteSubject
);

// ===== Teacher Routes (Read-only) =====

/**
 * GET /api/subjects/my-subjects
 * Get subjects assigned to the current teacher
 */
router.get(
  '/my-subjects',
  authenticate,
  requireTeacher,
  subjectController.getMySubjects
);

module.exports = router;
