const { query } = require('./database');

/**
 * Create WhatsApp Logs Table
 * Tracks all WhatsApp messages sent to parents
 */

async function migrateWhatsApp() {
  console.log('🚀 Creating whatsapp_logs table...\n');

  try {
    // Create whatsapp_logs table
    await query(`
      CREATE TABLE IF NOT EXISTS whatsapp_logs (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(20) NOT NULL,
        student_name VARCHAR(255),
        student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
        school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
        status VARCHAR(20),
        message_id VARCHAR(100),
        message_type VARCHAR(50) DEFAULT 'attendance_alert',
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ whatsapp_logs table created');

    // Create indexes for performance
    await query('CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_phone ON whatsapp_logs(phone);');
    await query('CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_student ON whatsapp_logs(student_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_school ON whatsapp_logs(school_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_sent_at ON whatsapp_logs(sent_at);');

    console.log('✅ Indexes created');

    // Add unique constraint to prevent duplicate messages within 5 minutes
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_logs_dedup
      ON whatsapp_logs(phone, student_id, date_trunc('minute', sent_at), status)
      WHERE sent_at > NOW() - INTERVAL '5 minutes';
    `);

    console.log('✅ Deduplication index created');

    console.log('\n✅ WhatsApp migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateWhatsApp();
