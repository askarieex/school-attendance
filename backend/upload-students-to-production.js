/**
 * BULK UPLOAD STUDENTS TO PRODUCTION VPS
 *
 * This script reads Excel files and uploads students directly to production database
 *
 * Usage: node upload-students-to-production.js
 */

const xlsx = require('xlsx');
const { Client } = require('pg');
const path = require('path');

// Production database configuration (running on VPS itself)
const dbConfig = {
  host: 'localhost', // Using localhost since we run this ON the VPS
  port: 5432,
  database: 'school_attendance',
  user: 'school_admin',
  password: 'SchoolAdmin123', // Update with your actual password
};

// School ID for The Heritage School
const SCHOOL_ID = 3;

// Excel files to process
const excelFiles = [
  '../Excel Data/6th-Green.xls',
  '../Excel Data/6th-Red.xls',
  '../Excel Data/7th-Green.xls',
  '../Excel Data/7th-Red.xls'
];

// Parse class name to extract class and section
// IMPORTANT: Students have moved up one class (6th -> 7th, 7th -> 8th)
function parseClassName(fileName) {
  // "6th-Green.xls" => These students are NOW in 7th class
  // "7th-Green.xls" => These students are NOW in 8th class
  const match = fileName.match(/(\d+)th-(\w+)/);
  if (match) {
    const oldClass = parseInt(match[1]); // Class in Excel file (old class)
    const currentClass = oldClass + 1; // Current class (moved up by 1)

    return {
      className: String(currentClass), // "7" or "8" (current class)
      sectionName: match[2], // "Green" or "Red"
      oldClassName: String(oldClass) // Original class in file
    };
  }
  return null;
}

// Main upload function
async function uploadStudents() {
  const client = new Client(dbConfig);

  try {
    console.log('🔗 Connecting to production database...');
    await client.connect();
    console.log('✅ Connected to production database');

    let totalSuccess = 0;
    let totalFailed = 0;

    for (const file of excelFiles) {
      const filePath = path.join(__dirname, file);
      const fileName = path.basename(file);

      console.log(`\n📄 Processing file: ${fileName}`);

      // Parse class and section from filename
      const classInfo = parseClassName(fileName);
      if (!classInfo) {
        console.error(`❌ Could not parse class info from filename: ${fileName}`);
        continue;
      }

      const { className, sectionName, oldClassName } = classInfo;
      console.log(`   Excel file class: ${oldClassName} → Current class: ${className}, Section: ${sectionName}`);

      // Read Excel file
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(sheet);

      console.log(`   Found ${jsonData.length} students in Excel`);

      // Get or create class
      let classResult = await client.query(
        'SELECT id FROM classes WHERE class_name = $1 AND school_id = $2',
        [className, SCHOOL_ID]
      );

      let classId;
      if (classResult.rows.length === 0) {
        const newClass = await client.query(
          'INSERT INTO classes (school_id, class_name) VALUES ($1, $2) RETURNING id',
          [SCHOOL_ID, className]
        );
        classId = newClass.rows[0].id;
        console.log(`   ✅ Created class: ${className}`);
      } else {
        classId = classResult.rows[0].id;
        console.log(`   ✅ Found existing class: ${className} (ID: ${classId})`);
      }

      // Get or create section
      let sectionResult = await client.query(
        'SELECT id FROM sections WHERE section_name = $1 AND class_id = $2',
        [sectionName, classId]
      );

      let sectionId;
      if (sectionResult.rows.length === 0) {
        const newSection = await client.query(
          'INSERT INTO sections (class_id, section_name) VALUES ($1, $2) RETURNING id',
          [classId, sectionName]
        );
        sectionId = newSection.rows[0].id;
        console.log(`   ✅ Created section: ${className}-${sectionName}`);
      } else {
        sectionId = sectionResult.rows[0].id;
        console.log(`   ✅ Found existing section: ${className}-${sectionName} (ID: ${sectionId})`);
      }

      // Get next available roll number
      const rollNumberResult = await client.query(
        'SELECT COALESCE(MAX(CAST(roll_number AS INTEGER)), 0) + 1 as next_roll FROM students WHERE class_id = $1 AND section_id = $2',
        [classId, sectionId]
      );
      let nextRollNumber = rollNumberResult.rows[0].next_roll;

      // Process each student
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];

        try {
          const fullName = row['Name (FIRST SECOND LAST)'] || row['Name'];
          const dob = row['DOB(dd-mm-YYYY)'] || row['DOB'];
          const gender = row['Gender'];
          const address = row['Address Line One'] || row['Address'];
          const fatherName = row["Father's Name(FIRST SECOND LAST)"] || row["Father's Name"];
          const fatherMobile = String(row["Father's Mobile"] || '').replace(/\D/g, ''); // Remove non-digits

          if (!fullName || !fatherName || !fatherMobile) {
            console.warn(`   ⚠️  Row ${i + 2}: Missing required data, skipping`);
            totalFailed++;
            continue;
          }

          // Format date of birth (dd-mm-YYYY to YYYY-MM-DD)
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
              console.warn(`   ⚠️  Invalid DOB format: ${dob}`);
            }
          }

          // Check if student already exists
          const existingStudent = await client.query(
            'SELECT id FROM students WHERE full_name = $1 AND class_id = $2 AND section_id = $3 AND school_id = $4',
            [fullName.trim(), classId, sectionId, SCHOOL_ID]
          );

          if (existingStudent.rows.length > 0) {
            console.log(`   ⏭️  ${fullName} already exists, skipping`);
            continue;
          }

          // Insert student
          await client.query(
            `INSERT INTO students (
              school_id, class_id, section_id, full_name, roll_number,
              parent_name, parent_phone, date_of_birth, address, gender
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              SCHOOL_ID,
              classId,
              sectionId,
              fullName.trim(),
              String(nextRollNumber),
              fatherName.trim(),
              fatherMobile,
              formattedDob,
              address ? address.trim() : null,
              gender ? gender.toLowerCase() : null
            ]
          );

          console.log(`   ✅ Added: ${fullName} (Roll: ${nextRollNumber})`);
          totalSuccess++;
          nextRollNumber++;

        } catch (error) {
          console.error(`   ❌ Row ${i + 2}: ${error.message}`);
          totalFailed++;
        }
      }
    }

    console.log(`\n📊 ====== UPLOAD SUMMARY ======`);
    console.log(`   Total Success: ${totalSuccess}`);
    console.log(`   Total Failed: ${totalFailed}`);
    console.log(`   Success Rate: ${((totalSuccess / (totalSuccess + totalFailed)) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the upload
uploadStudents();
