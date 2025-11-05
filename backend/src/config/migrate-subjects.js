const { query } = require('./database');

/**
 * Subjects Module Migration
 *
 * Creates:
 * 1. subjects table - School-specific subject library
 * 2. Updates teacher_class_assignments to use subject_id FK
 * 3. Migrates existing text subjects to the new table
 */

async function migrateSubjects() {
  console.log('🚀 Starting Subjects Module Migration...\n');

  try {
    // ===== STEP 1: Create subjects table =====
    console.log('📚 Creating subjects table...');
    await query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id SERIAL PRIMARY KEY,
        school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        subject_name VARCHAR(100) NOT NULL,
        subject_code VARCHAR(20),
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(school_id, subject_name)
      );
    `);

    // Create indexes
    await query('CREATE INDEX IF NOT EXISTS idx_subjects_school ON subjects(school_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_subjects_active ON subjects(school_id, is_active);');

    console.log('✅ Subjects table created');

    // ===== STEP 2: Migrate existing subjects from teacher_class_assignments =====
    console.log('\n🔄 Migrating existing subjects...');

    // Get all unique subjects per school from teacher_class_assignments
    const existingSubjects = await query(`
      SELECT DISTINCT
        t.school_id,
        TRIM(tca.subject) as subject_name
      FROM teacher_class_assignments tca
      JOIN teachers t ON tca.teacher_id = t.id
      WHERE tca.subject IS NOT NULL
        AND TRIM(tca.subject) != ''
      ORDER BY t.school_id, subject_name
    `);

    console.log(`📋 Found ${existingSubjects.rows.length} unique subject(s) to migrate`);

    // Insert unique subjects into subjects table
    for (const row of existingSubjects.rows) {
      try {
        await query(
          `INSERT INTO subjects (school_id, subject_name, subject_code)
           VALUES ($1, $2, $3)
           ON CONFLICT (school_id, subject_name) DO NOTHING`,
          [row.school_id, row.subject_name, row.subject_name.substring(0, 10).toUpperCase()]
        );
      } catch (err) {
        console.warn(`⚠️ Skipping duplicate subject: ${row.subject_name} for school ${row.school_id}`);
      }
    }

    console.log('✅ Existing subjects migrated');

    // ===== STEP 3: Add subject_id column to teacher_class_assignments =====
    console.log('\n🔧 Adding subject_id column to teacher_class_assignments...');

    // Check if column already exists
    const columnCheck = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'teacher_class_assignments'
        AND column_name = 'subject_id'
    `);

    if (columnCheck.rows.length === 0) {
      await query(`
        ALTER TABLE teacher_class_assignments
        ADD COLUMN subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL
      `);

      await query('CREATE INDEX IF NOT EXISTS idx_tca_subject ON teacher_class_assignments(subject_id);');

      console.log('✅ subject_id column added');
    } else {
      console.log('ℹ️ subject_id column already exists');
    }

    // ===== STEP 4: Populate subject_id based on subject text =====
    console.log('\n🔗 Linking existing assignments to subject IDs...');

    await query(`
      UPDATE teacher_class_assignments tca
      SET subject_id = sub.id
      FROM teachers t, subjects sub
      WHERE tca.teacher_id = t.id
        AND t.school_id = sub.school_id
        AND TRIM(tca.subject) = sub.subject_name
        AND tca.subject IS NOT NULL
        AND TRIM(tca.subject) != ''
        AND tca.subject_id IS NULL
    `);

    const updatedCount = await query(`
      SELECT COUNT(*) as count
      FROM teacher_class_assignments
      WHERE subject_id IS NOT NULL
    `);

    console.log(`✅ Linked ${updatedCount.rows[0].count} assignment(s) to subjects`);

    // ===== STEP 5: Add default subjects for schools without any =====
    console.log('\n🎓 Adding default subjects for schools...');

    const defaultSubjects = [
      'Mathematics',
      'English',
      'Science',
      'Social Studies',
      'Computer Science',
      'Physical Education',
      'Art',
      'Music'
    ];

    const schools = await query('SELECT id FROM schools WHERE is_active = TRUE');

    for (const school of schools.rows) {
      const hasSubjects = await query(
        'SELECT COUNT(*) as count FROM subjects WHERE school_id = $1',
        [school.id]
      );

      if (parseInt(hasSubjects.rows[0].count) === 0) {
        console.log(`📚 Adding default subjects for school ID: ${school.id}`);

        for (const subjectName of defaultSubjects) {
          await query(
            `INSERT INTO subjects (school_id, subject_name, subject_code)
             VALUES ($1, $2, $3)
             ON CONFLICT (school_id, subject_name) DO NOTHING`,
            [school.id, subjectName, subjectName.substring(0, 10).toUpperCase()]
          );
        }
      }
    }

    console.log('✅ Default subjects added');

    // ===== STEP 6: Add trigger for updated_at =====
    console.log('\n⚙️ Creating triggers...');

    await query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await query(`
      DROP TRIGGER IF EXISTS update_subjects_updated_at ON subjects;
      CREATE TRIGGER update_subjects_updated_at
      BEFORE UPDATE ON subjects
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('✅ Triggers created');

    // ===== SUMMARY =====
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));

    const subjectsCount = await query('SELECT COUNT(*) as count FROM subjects');
    const assignmentsWithSubject = await query(
      'SELECT COUNT(*) as count FROM teacher_class_assignments WHERE subject_id IS NOT NULL'
    );
    const assignmentsWithoutSubject = await query(
      'SELECT COUNT(*) as count FROM teacher_class_assignments WHERE subject_id IS NULL'
    );

    console.log(`✅ Total subjects created: ${subjectsCount.rows[0].count}`);
    console.log(`✅ Assignments linked to subjects: ${assignmentsWithSubject.rows[0].count}`);
    console.log(`⚠️ Assignments without subjects: ${assignmentsWithoutSubject.rows[0].count}`);
    console.log('\n🎉 Subjects Module Migration completed successfully!');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run migration
migrateSubjects();
