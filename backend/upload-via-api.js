/**
 * UPLOAD STUDENTS VIA PRODUCTION API
 *
 * Reads Excel files from local Mac and uploads students one by one
 * to production API using loops
 */

const xlsx = require('xlsx');
const axios = require('axios');
const path = require('path');

// Production API configuration
const API_BASE_URL = 'https://adtenz.site/api/v1';
const LOGIN_EMAIL = 'afnanmir@gmail.com'; // Your school admin email
const LOGIN_PASSWORD = 'afnanmir@gmail.com'; // Your password

// Excel files to process
const excelFiles = [
  '../Excel Data/6th-Green.xls',
  '../Excel Data/6th-Red.xls',
  '../Excel Data/7th-Green.xls',
  '../Excel Data/7th-Red.xls'
];

let authToken = null;

// Parse class name (students moved up by 1 class)
function parseClassName(fileName) {
  const match = fileName.match(/(\d+)th-(\w+)/);
  if (match) {
    const oldClass = parseInt(match[1]);
    const currentClass = oldClass + 1; // 6th -> 7th, 7th -> 8th

    return {
      className: String(currentClass),
      sectionName: match[2],
      oldClassName: String(oldClass)
    };
  }
  return null;
}

// Login to get auth token
async function login() {
  try {
    console.log('🔐 Logging in to production API...');
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD
    });

    authToken = response.data.data.accessToken;
    console.log('✅ Login successful!');
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data?.message || error.message);
    return false;
  }
}

// Get or create class
async function getOrCreateClass(className) {
  try {
    // Get all classes
    const response = await axios.get(`${API_BASE_URL}/school/classes`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    const existingClass = response.data.data.find(c => c.class_name === className);

    if (existingClass) {
      console.log(`   ✅ Found existing class: ${className} (ID: ${existingClass.id})`);
      return existingClass.id;
    }

    // Get academic year
    const academicYearsResponse = await axios.get(`${API_BASE_URL}/school/academic-years`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    const currentAcademicYear = academicYearsResponse.data.data.find(y => y.is_current);
    if (!currentAcademicYear) {
      throw new Error('No current academic year found');
    }

    // Create new class with academic year NAME (not ID)
    const newClass = await axios.post(
      `${API_BASE_URL}/school/classes`,
      {
        className: className,
        academicYear: currentAcademicYear.year_name // Use year_name like "2025-2026"
      },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    console.log(`   ✅ Created new class: ${className} (ID: ${newClass.data.data.id})`);
    return newClass.data.data.id;

  } catch (error) {
    console.error(`   ❌ Error with class ${className}:`, error.response?.data?.message || error.message);
    throw error;
  }
}

// Get or create section
async function getOrCreateSection(classId, sectionName) {
  try {
    // Get all sections for this class
    const response = await axios.get(`${API_BASE_URL}/school/classes/${classId}/sections`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    const existingSection = response.data.data.find(s => s.section_name === sectionName);

    if (existingSection) {
      console.log(`   ✅ Found existing section: ${sectionName} (ID: ${existingSection.id})`);
      return existingSection.id;
    }

    // Create new section
    const newSection = await axios.post(
      `${API_BASE_URL}/school/classes/${classId}/sections`,
      { sectionName: sectionName },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    console.log(`   ✅ Created new section: ${sectionName} (ID: ${newSection.data.data.id})`);
    return newSection.data.data.id;

  } catch (error) {
    console.error(`   ❌ Error with section ${sectionName}:`, error.response?.data?.message || error.message);
    throw error;
  }
}

// Import students via API (batch import endpoint - no rfidCardId required)
async function importStudents(studentsArray) {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/school/students/import`,
      { students: studentsArray },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    return response.data.data;
  } catch (error) {
    throw error;
  }
}

// Main upload function
async function uploadStudents() {
  try {
    // Step 1: Login
    const loginSuccess = await login();
    if (!loginSuccess) {
      console.error('❌ Cannot proceed without login');
      return;
    }

    console.log('\n📚 Starting student upload...\n');

    let totalSuccess = 0;
    let totalFailed = 0;
    const errors = [];

    // Step 2: Process each Excel file
    for (const file of excelFiles) {
      const filePath = path.join(__dirname, file);
      const fileName = path.basename(file);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📄 Processing file: ${fileName}`);
      console.log(`${'='.repeat(60)}`);

      // Parse class info
      const classInfo = parseClassName(fileName);
      if (!classInfo) {
        console.error(`❌ Could not parse class info from: ${fileName}`);
        continue;
      }

      const { className, sectionName, oldClassName } = classInfo;
      console.log(`   Excel class: ${oldClassName} → Current class: ${className}, Section: ${sectionName}`);

      // Read Excel file
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(sheet);

      console.log(`   Found ${jsonData.length} students in Excel\n`);

      // Get or create class
      const classId = await getOrCreateClass(className);

      // Get or create section
      const sectionId = await getOrCreateSection(classId, sectionName);

      console.log(`\n   📝 Preparing students for batch import...\n`);

      // Step 3: Collect all valid students for batch import
      const studentsToImport = [];
      let rollNumber = 1;

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNumber = i + 2; // Excel row (header is row 1)

        // Extract data
        const fullName = row['Name (FIRST SECOND LAST)'] || row['Name'];
        const dob = row['DOB(dd-mm-YYYY)'] || row['DOB'];
        const gender = row['Gender'];
        const address = row['Address Line One'] || row['Address'];
        const fatherName = row["Father's Name(FIRST SECOND LAST)"] || row["Father's Name"];
        const fatherMobile = String(row["Father's Mobile"] || '').replace(/\D/g, '');

        try {
          if (!fullName || !fatherName || !fatherMobile) {
            console.warn(`   ⚠️  Row ${rowNumber}: Missing required fields, skipping`);
            totalFailed++;
            continue;
          }

          // Format date (dd-mm-YYYY to YYYY-MM-DD)
          let formattedDob = null;
          if (dob) {
            try {
              const dobStr = String(dob);
              if (dobStr.includes('-')) {
                const parts = dobStr.split('-');
                if (parts.length === 3) {
                  formattedDob = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
              }
            } catch (e) {
              console.warn(`   ⚠️  Row ${rowNumber}: Invalid DOB: ${dob}`);
            }
          }

          // Create student object (using snake_case for database)
          const studentData = {
            full_name: fullName.trim(),
            class_id: classId,
            section_id: sectionId,
            roll_number: String(rollNumber),
            guardian_name: fatherName.trim(),
            guardian_phone: fatherMobile,
            dob: formattedDob,
            address: address ? address.trim() : null,
            gender: gender ? gender.toLowerCase() : null,
            rfid_card_id: null, // Will be assigned later when RFID cards arrive
            guardian_email: null,
            guardian_relation: 'Father'
          };

          studentsToImport.push(studentData);
          rollNumber++;

        } catch (error) {
          const errorMsg = `Row ${rowNumber} (${fullName || 'Unknown'}): ${error.message}`;
          console.error(`   ❌ ${errorMsg}`);
          errors.push(`${fileName} - ${errorMsg}`);
          totalFailed++;
        }
      }

      // Step 4: Batch import all students at once
      if (studentsToImport.length > 0) {
        try {
          console.log(`\n   🚀 Importing ${studentsToImport.length} students in batch...`);
          const result = await importStudents(studentsToImport);
          console.log(`   ✅ Successfully imported ${studentsToImport.length} students!`);
          totalSuccess += studentsToImport.length;
        } catch (error) {
          // Detailed error logging
          console.error('\n   📋 Full error details:');
          if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', JSON.stringify(error.response.data, null, 2));
          }
          console.error('   Message:', error.message);

          const detailedError = error.response?.data?.message || error.response?.data?.error || error.message;
          console.error(`\n   ❌ Batch import failed: ${detailedError}`);

          // If batch fails, count all students as failed
          totalFailed += studentsToImport.length;
          errors.push(`${fileName} - Batch import failed: ${detailedError}`);
        }
      } else {
        console.log(`   ⚠️  No valid students to import from this file`);
      }
    }

    // Final summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 UPLOAD SUMMARY`);
    console.log(`${'='.repeat(60)}`);
    console.log(`   ✅ Total Success: ${totalSuccess}`);
    console.log(`   ❌ Total Failed: ${totalFailed}`);
    console.log(`   📈 Success Rate: ${totalSuccess > 0 ? ((totalSuccess / (totalSuccess + totalFailed)) * 100).toFixed(1) : 0}%`);

    if (errors.length > 0) {
      console.log(`\n   ⚠️  Errors:`);
      errors.forEach(err => console.log(`      - ${err}`));
    }

    console.log(`\n✅ Upload complete!`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
  }
}

// Run the upload
uploadStudents();
