const { query } = require('../src/config/database');
const { parseStudentExcel, validateStudents } = require('../src/utils/excelParser');
const fs = require('fs');
const path = require('path');

/**
 * Direct import of students from Excel files
 * Maps: 6th grade files → 7TH class, 7th grade files → 8TH class
 */

const FILES_TO_IMPORT = [
  {
    file: 'classes-excel/6th-Green (3).xls',
    targetClass: '7TH',
    targetSection: 'Green',
    academicYear: '2025-2026'
  },
  {
    file: 'classes-excel/6th-Red.xls',
    targetClass: '7TH',
    targetSection: 'Red',
    academicYear: '2025-2026'
  },
  {
    file: 'classes-excel/7th-Green.xls',
    targetClass: '8TH',
    targetSection: 'Green',
    academicYear: '2025-2026'
  },
  {
    file: 'classes-excel/7th-Red.xls',
    targetClass: '8TH',
    targetSection: 'Red',
    academicYear: '2025-2026'
  }
];

async function importFile(fileConfig) {
  const { file, targetClass, targetSection, academicYear } = fileConfig;
  const filePath = path.join(__dirname, '..', file);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📂 Importing: ${file}`);
  console.log(`🎯 Target Class: ${targetClass}, Section: ${targetSection}`);
  console.log(`📅 Academic Year: ${academicYear}`);
  console.log('='.repeat(60));

  try {
    // Read file
    const fileBuffer = fs.readFileSync(filePath);

    // Parse Excel
    console.log('📊 Parsing Excel file...');
    const students = parseStudentExcel(fileBuffer);
    console.log(`✅ Found ${students.length} students in file`);

    // Validate students
    console.log('✔️  Validating student data...');
    const { valid, invalid } = validateStudents(students);
    console.log(`✅ Valid students: ${valid.length}`);
    console.log(`❌ Invalid students: ${invalid.length}`);

    if (invalid.length > 0) {
      console.log('\n⚠️  Invalid students:');
      invalid.forEach((student, index) => {
        console.log(`  ${index + 1}. ${student.fullName || 'Unknown'} (Row ${student._rowNumber})`);
        student.errors.forEach(err => console.log(`     - ${err}`));
      });
    }

    // Get school_id (hardcoded to 1 for now, or get from database)
    const schoolId = 1;

    // Get class_id
    console.log(`\n🔍 Looking up class "${targetClass}"...`);
    const classResult = await query(
      'SELECT id FROM classes WHERE school_id = $1 AND class_name = $2 AND academic_year = $3',
      [schoolId, targetClass, academicYear]
    );

    if (classResult.rows.length === 0) {
      console.error(`❌ Class "${targetClass}" not found for academic year ${academicYear}`);
      return { success: false, imported: 0, failed: students.length };
    }

    const classId = classResult.rows[0].id;
    console.log(`✅ Found class ID: ${classId}`);

    // Get section_id
    let sectionId = null;
    if (targetSection) {
      console.log(`🔍 Looking up section "${targetSection}"...`);
      const sectionResult = await query(
        'SELECT id FROM sections WHERE class_id = $1 AND section_name = $2',
        [classId, targetSection]
      );

      if (sectionResult.rows.length === 0) {
        console.error(`❌ Section "${targetSection}" not found in class "${targetClass}"`);
        return { success: false, imported: 0, failed: students.length };
      }

      sectionId = sectionResult.rows[0].id;
      console.log(`✅ Found section ID: ${sectionId}`);
    }

    // Import valid students
    console.log(`\n📥 Importing ${valid.length} students...`);
    const imported = [];
    const failed = [];

    for (const studentData of valid) {
      try {
        const data = {
          full_name: studentData.fullName.trim(),
          roll_number: studentData.rollNumber || null,
          gender: studentData.gender,
          dob: studentData.dob || null,
          parent_name: studentData.fatherName || null,
          parent_phone: studentData.phoneNumber || null,
          mother_name: studentData.motherName || null,
          mother_phone: studentData.phoneNumber || null,
          guardian_name: studentData.guardianName || studentData.fatherName || null,
          guardian_phone: studentData.phoneNumber || null,
          address: studentData.address || null,
          blood_group: studentData.bloodGroup || null,
          rfid_card_id: null, // Will add later
          class_id: classId,
          section_id: sectionId,
          academic_year: academicYear,
          is_active: true
        };

        const result = await query(
          `INSERT INTO students (
            school_id, full_name, roll_number, gender, dob,
            parent_name, parent_phone, mother_name, mother_phone, guardian_name, guardian_phone,
            address, blood_group,
            rfid_card_id, class_id, section_id, academic_year, is_active,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10, $11,
            $12, $13,
            $14, $15, $16, $17, $18,
            NOW(), NOW()
          ) RETURNING id, full_name, roll_number`,
          [
            schoolId, data.full_name, data.roll_number, data.gender, data.dob,
            data.parent_name, data.parent_phone, data.mother_name, data.mother_phone, data.guardian_name, data.guardian_phone,
            data.address, data.blood_group,
            data.rfid_card_id, data.class_id, data.section_id, data.academic_year, data.is_active
          ]
        );

        imported.push(result.rows[0]);
        process.stdout.write('.');
      } catch (error) {
        console.error(`\n❌ Failed to import ${studentData.fullName}:`, error.message);
        failed.push({
          ...studentData,
          error: error.message
        });
      }
    }

    console.log(`\n✅ Successfully imported ${imported.length} students`);
    if (failed.length > 0) {
      console.log(`❌ Failed to import ${failed.length} students`);
    }

    return {
      success: true,
      file,
      total: students.length,
      imported: imported.length,
      failed: failed.length + invalid.length,
      invalidCount: invalid.length
    };

  } catch (error) {
    console.error(`❌ Error processing file ${file}:`, error);
    return { success: false, file, error: error.message };
  }
}

async function main() {
  console.log('\n🎓 STUDENT BULK IMPORT SCRIPT');
  console.log('📚 Importing students from Excel files to database\n');

  const results = [];

  for (const fileConfig of FILES_TO_IMPORT) {
    const result = await importFile(fileConfig);
    results.push(result);
  }

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));

  let totalImported = 0;
  let totalFailed = 0;

  results.forEach(result => {
    if (result.success) {
      totalImported += result.imported;
      totalFailed += result.failed;
      console.log(`\n✅ ${result.file}`);
      console.log(`   Total: ${result.total} | Imported: ${result.imported} | Failed: ${result.failed}`);
    } else {
      console.log(`\n❌ ${result.file}`);
      console.log(`   Error: ${result.error || 'Unknown error'}`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`🎉 TOTAL IMPORTED: ${totalImported} students`);
  console.log(`❌ TOTAL FAILED: ${totalFailed} students`);
  console.log('='.repeat(60) + '\n');

  process.exit(0);
}

// Run the import
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
