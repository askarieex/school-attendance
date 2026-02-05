/**
 * Debug script to compare student IDs between:
 * 1. Students table (filtered by academic year 2026-2027)
 * 2. Attendance logs for February 2026
 * 
 * Run on VPS: node scripts/debug_student_ids.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function debugStudentIds() {
    console.log('🔍 Debugging Student ID Mismatch...\n');

    const schoolId = 5; // From pm2 logs

    // 1. Get students filtered by academic year 2026-2027
    console.log('📚 Students in academic year 2026-2027:');
    const studentsResult = await pool.query(`
    SELECT id, full_name, academic_year, grade, section_id
    FROM students, unnest(academic_year_ids) AS aid
    JOIN academic_years ay ON ay.id = aid
    WHERE school_id = $1
    AND ay.year_name = '2026-2027'
    LIMIT 10
  `, [schoolId]).catch(async () => {
        // Fallback if academic_year_ids is a single value
        return pool.query(`
      SELECT s.id, s.full_name, s.grade, s.section_id, ay.year_name
      FROM students s
      LEFT JOIN academic_years ay ON ay.id = s.current_academic_year_id
      WHERE s.school_id = $1
      AND (ay.year_name = '2026-2027' OR ay.year_name IS NULL)
      LIMIT 10
    `, [schoolId]);
    });

    console.log('   IDs:', studentsResult.rows.map(r => r.id).join(', '));
    studentsResult.rows.forEach(s => {
        console.log(`   - ID: ${s.id}, Name: ${s.full_name}, Grade: ${s.grade}`);
    });

    // 2. Get attendance logs for Feb 2026
    console.log('\n📋 Attendance logs for Feb 2026:');
    const logsResult = await pool.query(`
    SELECT DISTINCT al.student_id, s.full_name, ay.year_name as student_academic_year
    FROM attendance_logs al
    JOIN students s ON al.student_id = s.id
    LEFT JOIN academic_years ay ON ay.id = s.current_academic_year_id
    WHERE al.school_id = $1
    AND al.date >= '2026-02-01' AND al.date <= '2026-02-28'
    ORDER BY al.student_id
  `, [schoolId]);

    console.log('   Unique student IDs in logs:', logsResult.rows.map(r => r.student_id).join(', '));
    logsResult.rows.forEach(l => {
        console.log(`   - ID: ${l.student_id}, Name: ${l.full_name}, Academic Year: ${l.student_academic_year || 'NULL'}`);
    });

    // 3. Find the mismatch
    const studentIds = new Set(studentsResult.rows.map(r => r.id));
    const logStudentIds = new Set(logsResult.rows.map(r => r.student_id));

    const inLogsButNotStudents = [...logStudentIds].filter(id => !studentIds.has(id));
    const inStudentsButNoLogs = [...studentIds].filter(id => !logStudentIds.has(id));

    console.log('\n❌ MISMATCH ANALYSIS:');
    console.log(`   Student IDs in LOGS but NOT in filtered students list: [${inLogsButNotStudents.join(', ')}]`);
    console.log(`   Student IDs in STUDENTS but have NO attendance logs: [${inStudentsButNoLogs.join(', ')}]`);

    console.log('\n✅ FIX NEEDED:');
    if (inLogsButNotStudents.length > 0) {
        console.log('   The attendance logs belong to students NOT in academic year 2026-2027');
        console.log('   Either:');
        console.log('   1. Update those students to be in academic year 2026-2027');
        console.log('   2. Or record new attendance for the correct students');
    }

    process.exit(0);
}

debugStudentIds().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
