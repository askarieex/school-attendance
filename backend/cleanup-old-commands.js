#!/usr/bin/env node

/**
 * Cleanup Script
 * Deletes old device commands with wrong format
 */

const { query, pool } = require('./src/config/database');

console.log('🧹 Cleanup Old Device Commands\n');
console.log('This script will delete commands with the OLD wrong format.');
console.log('Commands with correct format (starting with C:) will be kept.\n');

(async () => {
  try {
    // Show what will be deleted
    console.log('📋 Finding commands with wrong format...\n');
    
    const wrongCommands = await query(`
      SELECT id, device_id, command_type, 
             LEFT(command_string, 50) as preview,
             status, created_at
      FROM device_commands
      WHERE status IN ('pending', 'sent')
        AND command_string NOT LIKE 'C:%'
        AND command_string != 'PLACEHOLDER'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (wrongCommands.rows.length === 0) {
      console.log('✅ No wrong-format commands found. Database is clean!');
      pool.end();
      return;
    }

    console.log(`Found ${wrongCommands.rows.length} command(s) with wrong format:\n`);
    wrongCommands.rows.forEach(cmd => {
      console.log(`  ID: ${cmd.id} | Type: ${cmd.command_type} | Status: ${cmd.status}`);
      console.log(`  Preview: ${cmd.preview}...`);
      console.log(`  Created: ${cmd.created_at}\n`);
    });

    // Count total
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM device_commands
      WHERE status IN ('pending', 'sent')
        AND command_string NOT LIKE 'C:%'
        AND command_string != 'PLACEHOLDER'
    `);

    const total = parseInt(countResult.rows[0].total);
    console.log(`⚠️  Total commands to delete: ${total}\n`);

    // Delete them
    console.log('🗑️  Deleting wrong-format commands...\n');
    
    const deleteResult = await query(`
      DELETE FROM device_commands
      WHERE status IN ('pending', 'sent')
        AND command_string NOT LIKE 'C:%'
        AND command_string != 'PLACEHOLDER'
      RETURNING id
    `);

    console.log(`✅ Deleted ${deleteResult.rows.length} command(s)\n`);

    // Show remaining commands
    const remainingResult = await query(`
      SELECT COUNT(*) as total, status
      FROM device_commands
      GROUP BY status
    `);

    console.log('📊 Remaining commands in database:');
    remainingResult.rows.forEach(row => {
      console.log(`  ${row.status}: ${row.total}`);
    });

    console.log('\n✅ Cleanup complete!');
    console.log('\n🎯 Next steps:');
    console.log('   1. Create a new student (this will queue a new command with correct format)');
    console.log('   2. Watch device poll and execute the command');
    console.log('   3. Verify Return=0 in server logs\n');

    pool.end();

  } catch (error) {
    console.error('❌ Error:', error);
    pool.end();
    process.exit(1);
  }
})();
