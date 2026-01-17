const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const { bulkUploadStudents, downloadTemplate } = require('../controllers/bulkUploadController');

// Configure multer for file upload (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept only Excel and CSV files
    const allowedMimes = [
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'text/csv' // .csv
    ];

    if (allowedMimes.includes(file.mimetype) ||
        file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'));
    }
  }
});

// All routes require authentication and school_admin role
router.use(authenticate);
router.use(authorize(['school_admin']));

/**
 * @route   POST /api/v1/school/students/bulk-upload
 * @desc    Bulk upload students from Excel/CSV file
 * @access  Private (school_admin only)
 */
router.post('/', upload.single('file'), bulkUploadStudents);

/**
 * @route   GET /api/v1/school/students/bulk-upload/template
 * @desc    Download sample Excel template
 * @access  Private (school_admin only)
 */
router.get('/template', downloadTemplate);

module.exports = router;
