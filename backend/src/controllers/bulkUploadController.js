const { query } = require('../config/database');
const xlsx = require('xlsx');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * BULK UPLOAD CONTROLLER
 *
 * Handles bulk import of students from Excel/CSV files
 */

/**
 * Bulk upload students from Excel file
 * POST /api/v1/school/students/bulk-upload
 *
 * Expected Excel columns:
 * - Full Name (required)
 * - Class (required - e.g., "10" or "Class 10")
 * - Section (required - e.g., "A")
 * - Roll Number (required)
 * - Parent Name (required)
 * - Parent Phone (required)
 * - RFID Card ID (optional)
 * - Date of Birth (optional - format: YYYY-MM-DD or DD/MM/YYYY)
 * - Address (optional)
 */
const bulkUploadStudents = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return sendError(res, 'No file uploaded. Please upload an Excel (.xlsx, .xls) or CSV file.', 400);
    }

    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return sendError(res, 'School ID not found', 400);
    }

    console.log(`📤 Bulk upload started for school ${schoolId} by user ${req.user.email}`);
    console.log(`   File: ${req.file.originalname} (${req.file.size} bytes)`);

    // Parse the Excel/CSV file
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      return sendError(res, 'Excel file is empty. Please add student data.', 400);
    }

    console.log(`   Found ${jsonData.length} rows in Excel file`);

    // Track results
    const results = {
      total: jsonData.length,
      success: 0,
      failed: 0,
      errors: []
    };

    // Process each row
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNumber = i + 2; // Excel row number (header is row 1)

      try {
        // Validate required fields
        const fullName = row['Full Name'] || row['full_name'] || row['Name'];
        const className = row['Class'] || row['class'];
        const sectionName = row['Section'] || row['section'];
        const rollNumber = row['Roll Number'] || row['roll_number'] || row['Roll No'];
        const parentName = row['Parent Name'] || row['parent_name'];
        const parentPhone = row['Parent Phone'] || row['parent_phone'] || row['Phone'];

        if (!fullName || !className || !sectionName || !rollNumber || !parentName || !parentPhone) {
          throw new Error(`Missing required fields. Row ${rowNumber}: ${JSON.stringify(row)}`);
        }

        // Optional fields
        const rfidCardId = row['RFID Card ID'] || row['rfid_card_id'] || row['RFID'] || null;
        const dateOfBirth = row['Date of Birth'] || row['date_of_birth'] || row['DOB'] || null;
        const address = row['Address'] || row['address'] || null;

        // Find or create class
        const classResult = await query(
          'SELECT id FROM classes WHERE LOWER(class_name) = LOWER($1) AND school_id = $2',
          [String(className).trim(), schoolId]
        );

        let classId;
        if (classResult.rows.length === 0) {
          // Create class if doesn't exist
          const newClass = await query(
            'INSERT INTO classes (school_id, class_name) VALUES ($1, $2) RETURNING id',
            [schoolId, String(className).trim()]
          );
          classId = newClass.rows[0].id;
          console.log(`   ✅ Created new class: ${className}`);
        } else {
          classId = classResult.rows[0].id;
        }

        // Find or create section
        const sectionResult = await query(
          'SELECT id FROM sections WHERE LOWER(section_name) = LOWER($1) AND class_id = $2',
          [String(sectionName).trim(), classId]
        );

        let sectionId;
        if (sectionResult.rows.length === 0) {
          // Create section if doesn't exist
          const newSection = await query(
            'INSERT INTO sections (class_id, section_name) VALUES ($1, $2) RETURNING id',
            [classId, String(sectionName).trim()]
          );
          sectionId = newSection.rows[0].id;
          console.log(`   ✅ Created new section: ${className}-${sectionName}`);
        } else {
          sectionId = sectionResult.rows[0].id;
        }

        // Check if student with same roll number already exists
        const existingStudent = await query(
          'SELECT id FROM students WHERE roll_number = $1 AND class_id = $2 AND section_id = $3 AND school_id = $4',
          [String(rollNumber).trim(), classId, sectionId, schoolId]
        );

        if (existingStudent.rows.length > 0) {
          throw new Error(`Student with roll number ${rollNumber} already exists in ${className}-${sectionName}`);
        }

        // Format date of birth if provided
        let formattedDob = null;
        if (dateOfBirth) {
          try {
            // Handle various date formats
            const dobStr = String(dateOfBirth);
            if (dobStr.includes('/')) {
              // DD/MM/YYYY or MM/DD/YYYY
              const parts = dobStr.split('/');
              formattedDob = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else if (dobStr.includes('-')) {
              // YYYY-MM-DD (already correct)
              formattedDob = dobStr;
            }
          } catch (e) {
            console.warn(`   ⚠️  Invalid date format for row ${rowNumber}: ${dateOfBirth}`);
          }
        }

        // Insert student
        await query(
          `INSERT INTO students (
            school_id, class_id, section_id, full_name, roll_number,
            parent_name, parent_phone, rfid_card_id, date_of_birth, address
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            schoolId,
            classId,
            sectionId,
            fullName.trim(),
            String(rollNumber).trim(),
            parentName.trim(),
            String(parentPhone).trim(),
            rfidCardId ? String(rfidCardId).trim() : null,
            formattedDob,
            address ? address.trim() : null
          ]
        );

        results.success++;
        console.log(`   ✅ Row ${rowNumber}: ${fullName} added successfully`);

      } catch (error) {
        results.failed++;
        const errorMsg = `Row ${rowNumber}: ${error.message}`;
        results.errors.push(errorMsg);
        console.error(`   ❌ ${errorMsg}`);
      }
    }

    console.log(`📊 Bulk upload completed: ${results.success} success, ${results.failed} failed`);

    if (results.failed > 0) {
      return res.status(207).json({
        success: true,
        message: `Bulk upload completed with some errors. ${results.success} students added, ${results.failed} failed.`,
        data: results
      });
    }

    sendSuccess(
      res,
      results,
      `Successfully imported ${results.success} students!`
    );

  } catch (error) {
    console.error('Bulk upload error:', error);
    sendError(res, `Bulk upload failed: ${error.message}`, 500);
  }
};

/**
 * Download sample Excel template
 * GET /api/v1/school/students/bulk-upload/template
 */
const downloadTemplate = (req, res) => {
  try {
    // Create sample data
    const sampleData = [
      {
        'Full Name': 'John Doe',
        'Class': '10',
        'Section': 'A',
        'Roll Number': '101',
        'Parent Name': 'Jane Doe',
        'Parent Phone': '1234567890',
        'RFID Card ID': 'ABC123',
        'Date of Birth': '2010-05-15',
        'Address': '123 Main Street'
      },
      {
        'Full Name': 'Mary Smith',
        'Class': '10',
        'Section': 'A',
        'Roll Number': '102',
        'Parent Name': 'Bob Smith',
        'Parent Phone': '9876543210',
        'RFID Card ID': 'XYZ456',
        'Date of Birth': '2010-06-20',
        'Address': '456 Oak Avenue'
      }
    ];

    // Create workbook
    const worksheet = xlsx.utils.json_to_sheet(sampleData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Students');

    // Generate buffer
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Send file
    res.setHeader('Content-Disposition', 'attachment; filename=student_upload_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

    console.log(`📥 Sample template downloaded by user ${req.user.email}`);

  } catch (error) {
    console.error('Template download error:', error);
    sendError(res, 'Failed to generate template', 500);
  }
};

module.exports = {
  bulkUploadStudents,
  downloadTemplate
};
