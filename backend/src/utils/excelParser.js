const XLSX = require('xlsx');

/**
 * Parse Excel file and extract student data
 * @param {Buffer} fileBuffer - Excel file buffer
 * @param {Object} options - Parsing options
 * @returns {Array} - Array of student objects
 */
const parseStudentExcel = (fileBuffer, options = {}) => {
  try {
    // Read the workbook from buffer
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert sheet to JSON
    const data = XLSX.utils.sheet_to_json(worksheet, {
      raw: false, // Get formatted values
      defval: '' // Default value for empty cells
    });

    console.log(`📊 Parsed ${data.length} rows from Excel sheet: ${sheetName}`);

    // Map Excel columns to our student schema
    const students = data.map((row, index) => {
      // Handle various possible column names (flexible mapping)
      const student = {
        fullName: row['Name (FIRST SECOND LAST)'] || row['Student Name'] || row['Full Name'] || row['Name'] || row['fullName'] || row['full_name'] || '',
        rollNumber: row['Roll Number'] || row['Roll No'] || row['RollNumber'] || row['roll_number'] || '',
        gender: row['Gender'] || row['gender'] || '',
        dob: row['DOB(dd-mm-YYYY)'] || row['DOB'] || row['Date of Birth'] || row['dob'] || '',
        fatherName: row["Father's Name(FIRST SECOND LAST)"] || row["Father's Name"] || row['Father Name'] || row['fatherName'] || row['father_name'] || '',
        motherName: row["Mother's Name(FIRST SECOND LAST)"] || row["Mother's Name"] || row['Mother Name'] || row['motherName'] || row['mother_name'] || '',
        guardianName: row["Guardian's Name"] || row['Guardian Name'] || row['guardianName'] || row['guardian_name'] || '',
        phoneNumber: row["Father's Mobile"] || row['Phone Number'] || row['Phone'] || row['Mobile'] || row['phoneNumber'] || row['phone_number'] || '',
        whatsappNumber: row['WhatsApp Number'] || row['WhatsApp'] || row['whatsappNumber'] || row['whatsapp_number'] || '',
        address: row['Address Line One'] || row['Address'] || row['address'] || '',
        bloodGroup: row['Blood Group'] || row['BloodGroup'] || row['bloodGroup'] || row['blood_group'] || '',
        className: row['Class'] || row['Grade'] || row['className'] || row['class_name'] || '',
        sectionName: row['Section'] || row['sectionName'] || row['section_name'] || '',
        rfidCardId: row['RFID'] || row['RFID Card'] || row['rfidCardId'] || row['rfid_card_id'] || '',

        // Row number for error reporting
        _rowNumber: index + 2 // +2 because Excel is 1-indexed and has header row
      };

      return student;
    });

    return students;
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    throw new Error(`Failed to parse Excel file: ${error.message}`);
  }
};

/**
 * Validate student data
 * @param {Array} students - Array of student objects
 * @returns {Object} - Validation result with valid and invalid students
 */
const validateStudents = (students) => {
  const valid = [];
  const invalid = [];

  students.forEach(student => {
    const errors = [];

    // Required field validation
    if (!student.fullName || student.fullName.trim() === '') {
      errors.push('Full Name is required');
    }

    if (!student.gender || !['Male', 'Female', 'M', 'F', 'male', 'female', 'm', 'f'].includes(student.gender)) {
      errors.push('Gender must be Male or Female');
    }

    // Normalize gender
    if (student.gender) {
      const g = student.gender.toLowerCase();
      student.gender = (g === 'male' || g === 'm') ? 'Male' : 'Female';
    }

    // Phone number validation (optional but if provided should be valid)
    if (student.phoneNumber && student.phoneNumber.length > 0) {
      // Remove any non-digit characters
      student.phoneNumber = student.phoneNumber.replace(/\D/g, '');

      // Check if it's a valid length (10-15 digits)
      if (student.phoneNumber.length < 10 || student.phoneNumber.length > 15) {
        errors.push('Phone number must be 10-15 digits');
      }
    }

    // WhatsApp number (copy from phone if not provided)
    if (!student.whatsappNumber && student.phoneNumber) {
      student.whatsappNumber = student.phoneNumber;
    }

    // Date of Birth validation
    if (student.dob) {
      // Try to parse the date
      // Handle dd-mm-yyyy format
      let dobDate;
      if (typeof student.dob === 'string' && student.dob.includes('-')) {
        const parts = student.dob.split('-');
        if (parts.length === 3) {
          // Convert dd-mm-yyyy to yyyy-mm-dd
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          dobDate = new Date(`${year}-${month}-${day}`);
        } else {
          dobDate = new Date(student.dob);
        }
      } else {
        dobDate = new Date(student.dob);
      }

      if (isNaN(dobDate.getTime())) {
        errors.push('Invalid Date of Birth format');
      } else {
        // Convert to YYYY-MM-DD format
        student.dob = dobDate.toISOString().split('T')[0];
      }
    }

    if (errors.length > 0) {
      invalid.push({
        ...student,
        errors
      });
    } else {
      valid.push(student);
    }
  });

  return { valid, invalid };
};

module.exports = {
  parseStudentExcel,
  validateStudents
};
