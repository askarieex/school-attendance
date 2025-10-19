const express = require('express');
const router = express.Router();
const schoolController = require('../controllers/schoolController');
const classController = require('../controllers/classController');
const teacherController = require('../controllers/teacherController');
const academicYearController = require('../controllers/academicYearController');
const reportsController = require('../controllers/reportsController');
const { authenticate, requireSchoolAdmin } = require('../middleware/auth');
const { enforceSchoolTenancy } = require('../middleware/multiTenant');

/**
 * School Admin Routes
 * Base path: /api/v1/school
 * All routes require school admin authentication and multi-tenancy enforcement
 */

// Apply authentication, school admin check, and multi-tenancy to all routes

router.use(authenticate);
router.use(requireSchoolAdmin);
router.use(enforceSchoolTenancy);

/**
 * STUDENT MANAGEMENT
 */
// GET /api/v1/school/students
router.get('/students', schoolController.getStudents);

// POST /api/v1/school/students
router.post('/students', schoolController.createStudent);

// POST /api/v1/school/students/import
router.post('/students/import', schoolController.importStudents);

// GET /api/v1/school/students/:id
router.get('/students/:id', schoolController.getStudent);

// PUT /api/v1/school/students/:id
router.put('/students/:id', schoolController.updateStudent);

// DELETE /api/v1/school/students/:id
router.delete('/students/:id', schoolController.deleteStudent);

/**
 * DASHBOARD & ATTENDANCE
 */
// GET /api/v1/school/stats/dashboard
router.get('/stats/dashboard', schoolController.getDashboardToday);

// GET /api/v1/school/dashboard/today
router.get('/dashboard/today', schoolController.getDashboardToday);

// GET /api/v1/school/dashboard/recent-checkins
router.get('/dashboard/recent-checkins', schoolController.getRecentCheckins);

// GET /api/v1/school/dashboard/absent
router.get('/dashboard/absent', schoolController.getAbsentStudents);

// GET /api/v1/school/attendance (for logs)
router.get('/attendance', schoolController.getAttendanceLogs);

// GET /api/v1/school/attendance/today
router.get('/attendance/today', schoolController.getTodayAttendance);

// GET /api/v1/school/attendance/today/stats
router.get('/attendance/today/stats', schoolController.getTodayAttendanceStats);

/**
 * REPORTS & ANALYTICS
 */
// GET /api/v1/school/reports/attendance
router.get('/reports/attendance', schoolController.getAttendanceReport);

// GET /api/v1/school/reports/analytics
router.get('/reports/analytics', schoolController.getAnalytics);

// GET /api/v1/school/reports/daily
router.get('/reports/daily', reportsController.getDailyReport);

// GET /api/v1/school/reports/monthly
router.get('/reports/monthly', reportsController.getMonthlyReport);

// GET /api/v1/school/reports/student/:studentId
router.get('/reports/student/:studentId', reportsController.getStudentReport);

// GET /api/v1/school/reports/class/:classId
router.get('/reports/class/:classId', reportsController.getClassReport);

// GET /api/v1/school/reports/export/:type
router.get('/reports/export/:type', reportsController.exportReport);

/**
 * SCHOOL SETTINGS
 */
// GET /api/v1/school/settings
router.get('/settings', schoolController.getSettings);

// PUT /api/v1/school/settings
router.put('/settings', schoolController.updateSettings);

/**
 * DEVICES
 */
// GET /api/v1/school/devices
router.get('/devices', schoolController.getSchoolDevices);

/**
 * DEVICE USER ENROLLMENT
 */
// POST /api/v1/school/devices/:deviceId/enroll-student
router.post('/devices/:deviceId/enroll-student', schoolController.enrollStudentToDevice);

// POST /api/v1/school/devices/:deviceId/enroll-all
router.post('/devices/:deviceId/enroll-all', schoolController.enrollAllStudentsToDevice);

// GET /api/v1/school/devices/:deviceId/enrolled-students
router.get('/devices/:deviceId/enrolled-students', schoolController.getDeviceEnrolledStudents);

// DELETE /api/v1/school/devices/:deviceId/students/:studentId
router.delete('/devices/:deviceId/students/:studentId', schoolController.unenrollStudentFromDevice);

/**
 * CLASS MANAGEMENT
 */
// GET /api/v1/school/classes
router.get('/classes', classController.getClasses);

// POST /api/v1/school/classes
router.post('/classes', classController.createClass);

// GET /api/v1/school/classes/statistics
router.get('/classes/statistics', classController.getClassStatistics);

// GET /api/v1/school/classes/:id
router.get('/classes/:id', classController.getClass);

// PUT /api/v1/school/classes/:id
router.put('/classes/:id', classController.updateClass);

// DELETE /api/v1/school/classes/:id
router.delete('/classes/:id', classController.deleteClass);

/**
 * SECTION MANAGEMENT
 */
// GET /api/v1/school/sections (all sections across all classes)
router.get('/sections', classController.getAllSections);

// GET /api/v1/school/classes/:classId/sections
router.get('/classes/:classId/sections', classController.getSections);

// POST /api/v1/school/classes/:classId/sections
router.post('/classes/:classId/sections', classController.createSection);

// GET /api/v1/school/sections/:sectionId
router.get('/sections/:sectionId', classController.getSection);

// GET /api/v1/school/sections/:sectionId/students
router.get('/sections/:sectionId/students', classController.getSectionWithStudents);

// PUT /api/v1/school/sections/:sectionId
router.put('/sections/:sectionId', classController.updateSection);

// DELETE /api/v1/school/sections/:sectionId
router.delete('/sections/:sectionId', classController.deleteSection);

// PUT /api/v1/school/sections/:sectionId/form-teacher
router.put('/sections/:sectionId/form-teacher', classController.assignFormTeacher);

// DELETE /api/v1/school/sections/:sectionId/form-teacher
router.delete('/sections/:sectionId/form-teacher', classController.removeFormTeacher);

/**
 * TEACHER MANAGEMENT
 */
// GET /api/v1/school/teachers
router.get('/teachers', teacherController.getTeachers);

// POST /api/v1/school/teachers
router.post('/teachers', teacherController.createTeacher);

// GET /api/v1/school/teachers/:id
router.get('/teachers/:id', teacherController.getTeacher);

// PUT /api/v1/school/teachers/:id
router.put('/teachers/:id', teacherController.updateTeacher);

// DELETE /api/v1/school/teachers/:id
router.delete('/teachers/:id', teacherController.deleteTeacher);

// GET /api/v1/school/teachers/:id/assignments
router.get('/teachers/:id/assignments', teacherController.getTeacherAssignments);

// POST /api/v1/school/teachers/:id/assignments
router.post('/teachers/:id/assignments', teacherController.assignTeacherToSection);

// DELETE /api/v1/school/teachers/:id/assignments/:assignmentId
router.delete('/teachers/:id/assignments/:assignmentId', teacherController.removeTeacherAssignment);

// POST /api/v1/school/teachers/:id/reset-password
router.post('/teachers/:id/reset-password', teacherController.resetTeacherPassword);

/**
 * ACADEMIC YEAR MANAGEMENT
 */
// GET /api/v1/school/academic-years
router.get('/academic-years', academicYearController.getAcademicYears);

// GET /api/v1/school/academic-years/current
router.get('/academic-years/current', academicYearController.getCurrentAcademicYear);

// POST /api/v1/school/academic-years
router.post('/academic-years', academicYearController.createAcademicYear);

// GET /api/v1/school/academic-years/:id
router.get('/academic-years/:id', academicYearController.getAcademicYear);

// PUT /api/v1/school/academic-years/:id
router.put('/academic-years/:id', academicYearController.updateAcademicYear);

// PUT /api/v1/school/academic-years/:id/set-current
router.put('/academic-years/:id/set-current', academicYearController.setCurrentAcademicYear);

// DELETE /api/v1/school/academic-years/:id
router.delete('/academic-years/:id', academicYearController.deleteAcademicYear);

// GET /api/v1/school/academic-years/:id/vacations
router.get('/academic-years/:id/vacations', academicYearController.getVacationPeriods);

// POST /api/v1/school/academic-years/:id/vacations
router.post('/academic-years/:id/vacations', academicYearController.addVacationPeriod);

// DELETE /api/v1/school/vacations/:vacationId
router.delete('/vacations/:vacationId', academicYearController.deleteVacationPeriod);

module.exports = router;
