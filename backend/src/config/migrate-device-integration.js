const { query } = require('./database');

/**
 * Database Migration for ZKTeco Device Integration
 * Creates tables for device-student mappings and command queue
 */

async function migrateDeviceIntegration() {
  console.log('🚀 Starting device integration migration...\n');

  try {
    // Update devices table with new columns
    console.log('Updating devices table...');
    await query(`
      ALTER TABLE devices
        ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP,
        ADD COLUMN IF NOT EXISTS firmware_version VARCHAR(50),
        ADD COLUMN IF NOT EXISTS user_count INTEGER DEFAULT 0;
    `);

    // Create device_user_mappings table
    console.log('Creating device_user_mappings table...');
    await query(`
      CREATE TABLE IF NOT EXISTS device_user_mappings (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        device_pin INTEGER NOT NULL,
        synced BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(device_id, device_pin),
        UNIQUE(device_id, student_id)
      );
    `);

    // Create device_commands table
    console.log('Creating device_commands table...');
    await query(`
      CREATE TABLE IF NOT EXISTS device_commands (
        id SERIAL PRIMARY KEY,
        device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        command_type VARCHAR(50) NOT NULL,
        command_string TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'failed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP,
        completed_at TIMESTAMP,
        error_message TEXT
      );
    `);

    // Create indexes for better performance
    console.log('Creating indexes...');
    await query('CREATE INDEX IF NOT EXISTS idx_device_user_mappings_student ON device_user_mappings(student_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_device_user_mappings_device ON device_user_mappings(device_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_device_commands_device_status ON device_commands(device_id, status);');
    await query('CREATE INDEX IF NOT EXISTS idx_device_commands_status ON device_commands(status);');

    console.log('\n✅ Device integration migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateDeviceIntegration();
