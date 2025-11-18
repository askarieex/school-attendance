const multer = require('multer');
const { parseStudentExcel, validateStudents } = require('../utils/excelParser');
const Student = require('../models/Student');
const { sendSuccess, sendError } = require('../utils/response');
const { query } = require('../config/database');

// Configure multer for file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept Excel files only
    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.oasis.opendocument.spreadsheet'
    ];

    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|ods)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  }
});

/**
 * Bulk import students from Excel file
 */
const bulkImportStudents = async (req, res) => {
  try {
    const schoolId = req.tenantSchoolId;
    const {
      className,
      sectionName,
      academicYear,
      promoteFromGrade // If provided, will promote students from this grade
    } = req.body;

    // Validate required fields
    if (!className) {
      return sendError(res, 'Class name is required', 400);
    }

    if (!academicYear) {
      return sendError(res, 'Academic year is required', 400);
    }

    if (!req.file) {
      return sendError(res, 'Excel file is required', 400);
    }

    console.log(`📤 Starting bulk import for school ${schoolId}, class: ${className}, section: ${sectionName || 'N/A'}`);

    // Parse Excel file
    const students = parseStudentExcel(req.file.buffer);

    if (students.length === 0) {
      return sendError(res, 'No student data found in Excel file', 400);
    }

    // Validate students
    const { valid, invalid } = validateStudents(students);

    console.log(`✅ Valid students: ${valid.length}`);
    console.log(`❌ Invalid students: ${invalid.length}`);

    // Get class and section IDs
    const classResult = await query(
      'SELECT id FROM classes WHERE school_id = $1 AND class_name = $2 AND academic_year = $3',
      [schoolId, className, academicYear]
    );

    if (classResult.rows.length === 0) {
      return sendError(res, `Class "${className}" not found for academic year ${academicYear}`, 404);
    }

    const classId = classResult.rows[0].id;

    let sectionId = null;
    if (sectionName) {
      const sectionResult = await query(
        'SELECT id FROM sections WHERE class_id = $1 AND section_name = $2',
        [classId, sectionName]
      );

      if (sectionResult.rows.length === 0) {
        return sendError(res, `Section "${sectionName}" not found in class "${className}"`, 404);
      }

      sectionId = sectionResult.rows[0].id;
    }

    // Import valid students
    const imported = [];
    const failed = [];

    for (const studentData of valid) {
      try {
        // Prepare student data for insertion
        const data = {
          full_name: studentData.fullName.trim(),
          roll_number: studentData.rollNumber || null,
          gender: studentData.gender,
          dob: studentData.dob || null,
          father_name: studentData.fatherName || null,
          mother_name: studentData.motherName || null,
          guardian_name: studentData.guardianName || studentData.fatherName || null,
          phone_number: studentData.phoneNumber || null,
          whatsapp_number: studentData.whatsappNumber || studentData.phoneNumber || null,
          address: studentData.address || null,
          blood_group: studentData.bloodGroup || null,
          rfid_card_id: studentData.rfidCardId || null, // Will be null for now, can add later
          class_id: classId,
          section_id: sectionId,
          academic_year: academicYear,
          is_active: true
        };

        // Insert student
        const result = await query(
          `INSERT INTO students (
            school_id, full_name, roll_number, gender, dob,
            father_name, mother_name, guardian_name,
            phone_number, whatsapp_number, address, blood_group,
            rfid_card_id, class_id, section_id, academic_year, is_active,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8,
            $9, $10, $11, $12,
            $13, $14, $15, $16, $17,
            NOW(), NOW()
          ) RETURNING id, full_name, roll_number`,
          [
            schoolId, data.full_name, data.roll_number, data.gender, data.dob,
            data.father_name, data.mother_name, data.guardian_name,
            data.phone_number, data.whatsapp_number, data.address, data.blood_group,
            data.rfid_card_id, data.class_id, data.section_id, data.academic_year, data.is_active
          ]
        );

        imported.push(result.rows[0]);
      } catch (error) {
        console.error(`Failed to import student ${studentData.fullName}:`, error);
        failed.push({
          ...studentData,
          error: error.message
        });
      }
    }

    console.log(`✅ Successfully imported ${imported.length} students`);

    // Prepare response
    const response = {
      summary: {
        total: students.length,
        imported: imported.length,
        failed: failed.length + invalid.length,
        validationErrors: invalid.length
      },
      imported,
      failed: [...invalid, ...failed]
    };

    sendSuccess(res, response, `Successfully imported ${imported.length} out of ${students.length} students`, 201);
  } catch (error) {
    console.error('Bulk import error:', error);
    sendError(res, error.message || 'Failed to import students', 500);
  }
};

module.exports = {
  upload,
  bulkImportStudents
};
