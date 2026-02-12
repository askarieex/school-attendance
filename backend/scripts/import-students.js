#!/usr/bin/env node

/**
 * Bulk Import Students from Excel File
 * 
 * Usage:
 *   node import-students.js <excel-file> <class-name> <academic-year> <school-id>
 * 
 * Example:
 *   node import-students.js "/tmp/Student List.xlsx" "Groups" "2026-2027" 1
 */

const XLSX = require('xlsx');
const { query } = require('../src/config/database');
const path = require('path');

// Parse command line arguments
const [, , excelFilePath, className, academicYear, schoolId] = process.argv;

if (!excelFilePath || !className || !academicYear || !schoolId) {
    console.error('❌ Missing required arguments!');
    console.log('Usage: node import-students.js <excel-file> <class-name> <academic-year> <school-id>');
    console.log('Example: node import-students.js "/tmp/Student List.xlsx" "Groups" "2026-2027" 1');
    process.exit(1);
}

async function importStudents() {
    try {
        console.log('📚 Starting bulk import...');
        console.log(`   File: ${excelFilePath}`);
        console.log(`   Class: ${className}`);
        console.log(`   Academic Year: ${academicYear}`);
        console.log(`   School ID: ${schoolId}`);
        console.log('');

        // 1. Read Excel file
        console.log('📖 Reading Excel file...');
        const workbook = XLSX.readFile(excelFilePath);
        console.log(`   Sheets found: ${workbook.SheetNames.join(', ')}`);
        console.log('');

        // 2. Get class ID
        console.log('🔍 Finding class...');
        const classResult = await query(
            'SELECT id FROM classes WHERE school_id = $1 AND class_name = $2 AND academic_year = $3',
            [schoolId, className, academicYear]
        );

        if (classResult.rows.length === 0) {
            throw new Error(`Class "${className}" not found for academic year ${academicYear}`);
        }

        const classId = classResult.rows[0].id;
        console.log(`   ✅ Class ID: ${classId}`);
        console.log('');

        // 3. Get sections
        console.log('🔍 Finding sections...');
        const sectionsResult = await query(
            'SELECT id, section_name FROM sections WHERE class_id = $1',
            [classId]
        );

        if (sectionsResult.rows.length === 0) {
            throw new Error(`No sections found for class "${className}"`);
        }

        const sections = {};
        sectionsResult.rows.forEach(row => {
            sections[row.section_name] = row.id;
            console.log(`   ✅ Section "${row.section_name}" ID: ${row.id}`);
        });
        console.log('');

        // 4. Process each sheet
        let totalImported = 0;
        let totalFailed = 0;

        for (const sheetName of workbook.SheetNames) {
            console.log(`📊 Processing sheet: ${sheetName}`);

            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });

            console.log(`   Rows: ${data.length}`);

            // Determine section based on sheet name or Group column
            let sectionId = null;

            // Try to match sheet name to section (e.g., "Group A" -> "Group A")
            if (sections[sheetName]) {
                sectionId = sections[sheetName];
            } else {
                // Try to extract section from the first row's Group column
                const firstRow = data[0];
                const groupValue = firstRow['Group'] || firstRow['Group '] || firstRow['Section'];

                // Map group letter to section name
                if (groupValue) {
                    const sectionName = `Group ${groupValue}`;
                    if (sections[sectionName]) {
                        sectionId = sections[sectionName];
                    }
                }
            }

            if (!sectionId) {
                console.error(`   ❌ Could not determine section for sheet "${sheetName}"`);
                console.error(`      Available sections: ${Object.keys(sections).join(', ')}`);
                continue;
            }

            console.log(`   → Importing to section ID: ${sectionId}`);

            // Import students
            let imported = 0;
            let failed = 0;

            for (const row of data) {
                try {
                    // Extract student data
                    const fullName = (
                        row['Name of Student'] ||
                        row['Name of Student '] ||
                        row['Student Name'] ||
                        row['Name'] ||
                        row['Full Name']
                    )?.trim();

                    const rollNumber = row['S.No.'] || row['Roll Number'] || row['Roll No'];

                    if (!fullName) {
                        console.warn(`   ⚠️  Skipping row: No name found`);
                        failed++;
                        continue;
                    }

                    // Insert student
                    await query(
                        `INSERT INTO students (
              school_id, full_name, roll_number, gender, 
              class_id, section_id, academic_year, is_active,
              created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4,
              $5, $6, $7, $8,
              NOW(), NOW()
            )`,
                        [
                            schoolId,
                            fullName,
                            rollNumber || null,
                            'Male', // Default gender
                            classId,
                            sectionId,
                            academicYear,
                            true
                        ]
                    );

                    imported++;
                } catch (error) {
                    console.error(`   ❌ Failed to import student: ${error.message}`);
                    failed++;
                }
            }

            console.log(`   ✅ Imported: ${imported}, ❌ Failed: ${failed}`);
            console.log('');

            totalImported += imported;
            totalFailed += failed;
        }

        // 5. Summary
        console.log('═══════════════════════════════════════');
        console.log('📊 IMPORT SUMMARY');
        console.log('═══════════════════════════════════════');
        console.log(`✅ Total Imported: ${totalImported}`);
        console.log(`❌ Total Failed: ${totalFailed}`);
        console.log('═══════════════════════════════════════');

        process.exit(0);
    } catch (error) {
        console.error('');
        console.error('❌ IMPORT FAILED:');
        console.error(error.message);
        console.error('');
        process.exit(1);
    }
}

// Run import
importStudents();
