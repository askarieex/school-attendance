/**
 * Database Migration Runner
 *
 * Usage:
 *   node scripts/runMigration.js 001_update_devices_to_serial_number.sql
 *
 * Or run all pending migrations:
 *   node scripts/runMigration.js
 */

const { pool } = require('../src/config/database');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Try to load .env from current dir or parent dir
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  console.log(`Loading .env from ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  dotenv.config(); // Default load
}

if (!process.env.DB_PASSWORD) {
  console.error('❌ Error: DB_PASSWORD is not set. Environment variables are missing.');
  console.error('Do you have a .env file in the project root?');
  process.exit(1);
}

async function runMigration(filename) {
  const migrationPath = path.join(__dirname, '../migrations', filename);

  console.log(`\n📦 Running migration: ${filename}`);
  console.log(`   Path: ${migrationPath}\n`);

  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  try {
    await pool.query(sql);
    console.log(`✅ Migration ${filename} completed successfully\n`);
    return true;
  } catch (error) {
    console.error(`❌ Migration ${filename} failed:`, error.message);
    console.error(`   Details:`, error);
    throw error;
  }
}

async function runAllMigrations() {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  console.log(`\n🔄 Found ${files.length} migration(s) to run:\n`);
  files.forEach((file, i) => console.log(`   ${i + 1}. ${file}`));

  for (const file of files) {
    await runMigration(file);
  }

  console.log(`✨ All migrations completed successfully!\n`);
}

async function main() {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');

    const migrationFile = process.argv[2];

    if (migrationFile) {
      // Run specific migration
      await runMigration(migrationFile);
    } else {
      // Run all migrations
      await runAllMigrations();
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

main();
