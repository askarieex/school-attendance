const { query } = require('./database');

/**
 * Database Migration Script
 * Creates all necessary tables for the school attendance system
 */

async function migrate() {
  console.log('🚀 Starting database migration...\n');

  try {
    // Create schools table
    console.log('Creating schools table...');
    await query(`
      CREATE TABLE IF NOT EXISTS schools (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        address TEXT,
        plan VARCHAR(50) DEFAULT 'trial',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create users table
    console.log('Creating users table...');
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('superadmin', 'school_admin', 'teacher')),
        school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
        full_name VARCHAR(255) NOT NULL,
        last_login TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create devices table
    console.log('Creating devices table...');
    await query(`
      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        api_key UUID UNIQUE NOT NULL,
        device_name VARCHAR(255) NOT NULL,
        device_type VARCHAR(50) DEFAULT 'rfid',
        device_model VARCHAR(100),
        serial_number VARCHAR(100) UNIQUE,
        ip_address VARCHAR(45),
        location VARCHAR(100),
        school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        is_active BOOLEAN DEFAULT TRUE,
        is_online BOOLEAN DEFAULT FALSE,
        last_seen TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create classes table
    console.log('Creating classes table...');
    await query(`
      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        class_name VARCHAR(100) NOT NULL,
        academic_year VARCHAR(20) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(school_id, class_name, academic_year)
      );
    `);

    // Create sections table
    console.log('Creating sections table...');
    await query(`
      CREATE TABLE IF NOT EXISTS sections (
        id SERIAL PRIMARY KEY,
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        section_name VARCHAR(50) NOT NULL,
        max_capacity INTEGER DEFAULT 50,
        current_strength INTEGER DEFAULT 0,
        form_teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        room_number VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(class_id, section_name)
      );
    `);

    // Create students table
    console.log('Creating students table...');
    await query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        gender VARCHAR(20),
        dob DATE,
        blood_group VARCHAR(10),
        grade VARCHAR(50),
        class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
        section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
        roll_number VARCHAR(50),
        rfid_card_id VARCHAR(100) UNIQUE,
        photo_url TEXT,
        address TEXT,
        parent_name VARCHAR(255),
        parent_phone VARCHAR(20),
        parent_email VARCHAR(255),
        guardian_name VARCHAR(255),
        guardian_phone VARCHAR(20),
        guardian_email VARCHAR(255),
        mother_name VARCHAR(255),
        mother_phone VARCHAR(20),
        school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create attendance_logs table
    console.log('Creating attendance_logs table...');
    await query(`
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
        check_in_time TIMESTAMP NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'late', 'absent')),
        date DATE NOT NULL,
        sms_sent BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create teachers table
    console.log('Creating teachers table...');
    await query(`
      CREATE TABLE IF NOT EXISTS teachers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        teacher_code VARCHAR(50) UNIQUE,
        subject_specialization VARCHAR(100),
        qualification VARCHAR(255),
        phone VARCHAR(20),
        emergency_contact VARCHAR(20),
        date_of_joining DATE,
        employee_type VARCHAR(50) DEFAULT 'full_time',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create teacher_class_assignments table
    console.log('Creating teacher_class_assignments table...');
    await query(`
      CREATE TABLE IF NOT EXISTS teacher_class_assignments (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        subject VARCHAR(100),
        academic_year VARCHAR(20) NOT NULL,
        is_form_teacher BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(teacher_id, section_id, subject, academic_year)
      );
    `);

    // Create academic_years table
    console.log('Creating academic_years table...');
    await query(`
      CREATE TABLE IF NOT EXISTS academic_years (
        id SERIAL PRIMARY KEY,
        school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        year_name VARCHAR(20) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_current BOOLEAN DEFAULT FALSE,
        total_working_days INTEGER DEFAULT 200,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(school_id, year_name)
      );
    `);

    // Create holidays table
    console.log('Creating holidays table...');
    await query(`
      CREATE TABLE IF NOT EXISTS holidays (
        id SERIAL PRIMARY KEY,
        school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        holiday_name VARCHAR(255) NOT NULL,
        holiday_type VARCHAR(50) NOT NULL CHECK (holiday_type IN ('national', 'school', 'weekend', 'other')),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        description TEXT,
        is_recurring BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create vacation_periods table
    console.log('Creating vacation_periods table...');
    await query(`
      CREATE TABLE IF NOT EXISTS vacation_periods (
        id SERIAL PRIMARY KEY,
        school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE CASCADE,
        vacation_name VARCHAR(100) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        vacation_type VARCHAR(50) DEFAULT 'term_break',
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create school_settings table
    console.log('Creating school_settings table...');
    await query(`
      CREATE TABLE IF NOT EXISTS school_settings (
        school_id INTEGER PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
        school_start_time TIME DEFAULT '08:00:00',
        school_close_time TIME DEFAULT '15:00:00',
        late_threshold_min INTEGER DEFAULT 15,
        sms_enabled BOOLEAN DEFAULT TRUE,
        sms_provider VARCHAR(50),
        sms_api_key TEXT,
        sms_sender_id VARCHAR(20),
        timezone VARCHAR(50) DEFAULT 'UTC',
        academic_year VARCHAR(20),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create audit_logs table (for security and compliance)
    console.log('Creating audit_logs table...');
    await query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        resource_id INTEGER,
        details JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create trigger function for teacher code generation
    console.log('Creating trigger functions...');
    await query(`
      CREATE OR REPLACE FUNCTION generate_teacher_code()
      RETURNS TRIGGER AS $$
      DECLARE
        school_prefix VARCHAR(3);
        next_number INTEGER;
        new_code VARCHAR(50);
      BEGIN
        -- Get school prefix (first 3 letters of school name)
        SELECT UPPER(LEFT(name, 3))
        INTO school_prefix
        FROM schools WHERE id = NEW.school_id;

        -- Get next number
        SELECT COALESCE(MAX(CAST(SUBSTRING(teacher_code FROM 5) AS INTEGER)), 0) + 1
        INTO next_number
        FROM teachers
        WHERE school_id = NEW.school_id;

        -- Generate code: SCH-0001
        new_code := school_prefix || '-' || LPAD(next_number::TEXT, 4, '0');
        NEW.teacher_code := new_code;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await query(`
      DROP TRIGGER IF EXISTS trigger_generate_teacher_code ON teachers;
      CREATE TRIGGER trigger_generate_teacher_code
      BEFORE INSERT ON teachers
      FOR EACH ROW
      WHEN (NEW.teacher_code IS NULL)
      EXECUTE FUNCTION generate_teacher_code();
    `);

    // Create indexes for better performance
    console.log('Creating indexes...');
    await query('CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_students_section_id ON students(section_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_students_rfid ON students(rfid_card_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_attendance_school_date ON attendance_logs(school_id, date);');
    await query('CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_logs(date);');
    await query('CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_logs(student_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_devices_school ON devices(school_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_devices_api_key ON devices(api_key);');
    await query('CREATE INDEX IF NOT EXISTS idx_devices_serial ON devices(serial_number);');
    await query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
    await query('CREATE INDEX IF NOT EXISTS idx_users_school ON users(school_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_sections_class ON sections(class_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_teachers_school ON teachers(school_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_teachers_user ON teachers(user_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_tca_teacher ON teacher_class_assignments(teacher_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_tca_section ON teacher_class_assignments(section_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_academic_years_school ON academic_years(school_id);');

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate();
