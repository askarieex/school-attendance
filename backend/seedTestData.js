/**
 * Seed Test Data Script
 * Creates a test teacher with assigned sections for testing the app flow
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'school_attendance',
    user: 'postgres',
    password: 'postgres'
});

async function seedTestData() {
    const client = await pool.connect();

    try {
        console.log('🌱 Starting test data seed...\n');

        // Start transaction
        await client.query('BEGIN');

        // 1. Check if school exists
        let schoolResult = await client.query('SELECT id, name FROM schools LIMIT 1');
        let schoolId = schoolResult.rows[0]?.id;

        if (!schoolId) {
            console.log('Creating test school...');
            const insertSchool = await client.query(`
        INSERT INTO schools (name, code, address, phone, email)
        VALUES ('Test School', 'TEST001', 'Test Address', '1234567890', 'test@school.com')
        RETURNING id
      `);
            schoolId = insertSchool.rows[0].id;
            console.log(`✅ Created school with ID: ${schoolId}`);
        } else {
            console.log(`✅ Using existing school: ${schoolResult.rows[0].name} (ID: ${schoolId})`);
        }

        // 2. Create test teacher user
        const teacherEmail = 'teacher@test.com';
        const teacherPassword = 'Teacher@123';
        const passwordHash = await bcrypt.hash(teacherPassword, 10);

        // Check if teacher email exists
        let userResult = await client.query('SELECT id FROM users WHERE email = $1', [teacherEmail]);
        let userId;

        if (userResult.rows.length === 0) {
            console.log('Creating test teacher user...');
            const insertUser = await client.query(`
        INSERT INTO users (email, password_hash, role, full_name, school_id, is_active)
        VALUES ($1, $2, 'teacher', 'Test Teacher', $3, true)
        RETURNING id
      `, [teacherEmail, passwordHash, schoolId]);
            userId = insertUser.rows[0].id;
            console.log(`✅ Created user with ID: ${userId}`);
        } else {
            userId = userResult.rows[0].id;
            // Update password to known value
            await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
            console.log(`✅ Using existing user ID: ${userId} (password updated)`);
        }

        // 3. Create teacher record
        let teacherResult = await client.query('SELECT id FROM teachers WHERE user_id = $1', [userId]);
        let teacherId;

        if (teacherResult.rows.length === 0) {
            console.log('Creating teacher record...');
            const insertTeacher = await client.query(`
        INSERT INTO teachers (user_id, school_id, teacher_code, is_active)
        VALUES ($1, $2, 'TCH001', true)
        RETURNING id
      `, [userId, schoolId]);
            teacherId = insertTeacher.rows[0].id;
            console.log(`✅ Created teacher with ID: ${teacherId}`);
        } else {
            teacherId = teacherResult.rows[0].id;
            console.log(`✅ Using existing teacher ID: ${teacherId}`);
        }

        // 4. Check/Create classes and sections
        let classResult = await client.query('SELECT id FROM classes WHERE school_id = $1 LIMIT 1', [schoolId]);
        let classId;

        if (classResult.rows.length === 0) {
            console.log('Creating test class...');
            const insertClass = await client.query(`
        INSERT INTO classes (school_id, name, grade_level, academic_year)
        VALUES ($1, 'Class 10', 10, '2025-26')
        RETURNING id
      `, [schoolId]);
            classId = insertClass.rows[0].id;
            console.log(`✅ Created class with ID: ${classId}`);
        } else {
            classId = classResult.rows[0].id;
            console.log(`✅ Using existing class ID: ${classId}`);
        }

        // 5. Check/Create section
        let sectionResult = await client.query('SELECT id FROM sections WHERE class_id = $1 LIMIT 1', [classId]);
        let sectionId;

        if (sectionResult.rows.length === 0) {
            console.log('Creating test section...');
            const insertSection = await client.query(`
        INSERT INTO sections (class_id, name)
        VALUES ($1, 'A')
        RETURNING id
      `, [classId]);
            sectionId = insertSection.rows[0].id;
            console.log(`✅ Created section with ID: ${sectionId}`);
        } else {
            sectionId = sectionResult.rows[0].id;
            console.log(`✅ Using existing section ID: ${sectionId}`);
        }

        // 6. Assign teacher to section
        let assignmentResult = await client.query(
            'SELECT id FROM teacher_class_assignments WHERE section_id = $1 AND teacher_id = $2',
            [sectionId, teacherId]
        );

        if (assignmentResult.rows.length === 0) {
            console.log('Assigning teacher to section...');
            await client.query(`
        INSERT INTO teacher_class_assignments (section_id, teacher_id, is_form_teacher, academic_year)
        VALUES ($1, $2, true, '2025-26')
      `, [sectionId, teacherId]);
            console.log(`✅ Assigned teacher ${teacherId} to section ${sectionId}`);
        } else {
            console.log(`✅ Teacher already assigned to section`);
        }

        // 7. Create test students if needed
        let studentResult = await client.query('SELECT COUNT(*) FROM students WHERE section_id = $1', [sectionId]);
        const studentCount = parseInt(studentResult.rows[0].count);

        if (studentCount < 5) {
            console.log('Creating test students...');
            const studentsToCreate = 5 - studentCount;
            for (let i = 1; i <= studentsToCreate; i++) {
                await client.query(`
          INSERT INTO students (school_id, class_id, section_id, full_name, roll_number, gender, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, true)
        `, [schoolId, classId, sectionId, `Test Student ${studentCount + i}`, `${studentCount + i}`, i % 2 === 0 ? 'female' : 'male']);
            }
            console.log(`✅ Created ${studentsToCreate} test students`);
        } else {
            console.log(`✅ Section already has ${studentCount} students`);
        }

        // Commit transaction
        await client.query('COMMIT');

        console.log('\n' + '═'.repeat(60));
        console.log('🎉 TEST DATA SEEDED SUCCESSFULLY!');
        console.log('═'.repeat(60));
        console.log('\n📋 Test Credentials:');
        console.log(`   Email:    ${teacherEmail}`);
        console.log(`   Password: ${teacherPassword}`);
        console.log('\n📋 Test Data IDs:');
        console.log(`   School ID:  ${schoolId}`);
        console.log(`   Teacher ID: ${teacherId}`);
        console.log(`   Class ID:   ${classId}`);
        console.log(`   Section ID: ${sectionId}`);
        console.log('\n');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error seeding data:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

seedTestData();
