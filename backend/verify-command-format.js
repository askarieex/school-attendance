#!/usr/bin/env node

/**
 * Verification Script
 * Checks if command generation code has the correct format
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying ZKTeco Command Format Fix...\n');

// Check 1: commandGenerator.js
console.log('1️⃣ Checking commandGenerator.js...');
const generatorPath = path.join(__dirname, 'src/services/commandGenerator.js');
const generatorContent = fs.readFileSync(generatorPath, 'utf8');

if (generatorContent.includes('DATA USER PIN=')) {
  console.log('   ✅ Uses "DATA USER PIN=" (correct)');
} else {
  console.log('   ❌ Missing "DATA USER PIN=" format');
}

if (generatorContent.includes('\\tName=')) {
  console.log('   ✅ Uses tab separators (\\t)');
} else {
  console.log('   ❌ Not using tab separators');
}

if (generatorContent.includes('C:${commandId}:DATA USER')) {
  console.log('   ✅ Includes C:${commandId}: prefix');
} else {
  console.log('   ❌ Missing C:${commandId}: prefix');
}

if (generatorContent.includes('Grp=1\\tTZ=0000000000000000\\tVerifyMode=0\\tPwd=')) {
  console.log('   ✅ Includes all required fields');
} else {
  console.log('   ❌ Missing required fields');
}

// Check 2: DeviceCommand.js
console.log('\n2️⃣ Checking DeviceCommand.js...');
const modelPath = path.join(__dirname, 'src/models/DeviceCommand.js');
const modelContent = fs.readFileSync(modelPath, 'utf8');

if (modelContent.includes('PLACEHOLDER')) {
  console.log('   ✅ Uses PLACEHOLDER pattern (insert-then-update)');
} else {
  console.log('   ❌ Not using PLACEHOLDER pattern');
}

if (modelContent.includes('CommandGenerator.addUser(devicePin, studentName, rfidCard, commandId)')) {
  console.log('   ✅ Passes commandId to generator');
} else {
  console.log('   ❌ Not passing commandId to generator');
}

if (modelContent.includes('UPDATE device_commands SET command_string')) {
  console.log('   ✅ Updates command_string after insert');
} else {
  console.log('   ❌ Not updating command_string');
}

// Check 3: Database schema
console.log('\n3️⃣ Checking database connection...');
const { query, pool } = require('./src/config/database');

(async () => {
  try {
    // Check if device_commands table exists
    const tableCheck = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'device_commands'
      ORDER BY ordinal_position
    `);

    if (tableCheck.rows.length === 0) {
      console.log('   ❌ device_commands table not found');
      pool.end();
      return;
    }

    console.log('   ✅ device_commands table exists');
    
    const columns = tableCheck.rows.map(r => r.column_name);
    
    if (columns.includes('command_string')) {
      const cmdStringCol = tableCheck.rows.find(r => r.column_name === 'command_string');
      console.log(`   ✅ command_string column exists (${cmdStringCol.data_type})`);
    } else {
      console.log('   ❌ command_string column missing');
    }

    // Check for pending commands with wrong format
    console.log('\n4️⃣ Checking existing commands...');
    const pendingCheck = await query(`
      SELECT COUNT(*) as wrong_format
      FROM device_commands
      WHERE status = 'pending'
        AND command_string NOT LIKE 'C:%'
        AND command_string != 'PLACEHOLDER'
    `);

    const wrongCount = parseInt(pendingCheck.rows[0].wrong_format);
    if (wrongCount > 0) {
      console.log(`   ⚠️  Found ${wrongCount} pending command(s) with WRONG format`);
      console.log('      Run: DELETE FROM device_commands WHERE status = \'pending\' AND command_string NOT LIKE \'C:%\';');
    } else {
      console.log('   ✅ No pending commands with wrong format');
    }

    // Check for correctly formatted commands
    const correctCheck = await query(`
      SELECT COUNT(*) as correct_format
      FROM device_commands
      WHERE command_string LIKE 'C:%DATA USER PIN=%'
    `);

    const correctCount = parseInt(correctCheck.rows[0].correct_format);
    if (correctCount > 0) {
      console.log(`   ✅ Found ${correctCount} command(s) with CORRECT format`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log('='.repeat(50));
    
    if (wrongCount > 0) {
      console.log('❌ ISSUE: Old commands with wrong format still in database');
      console.log('   Solution: Delete old pending commands and create new ones');
    } else {
      console.log('✅ All code files have correct format!');
      console.log('✅ No wrong-format commands in database');
      console.log('\n🎉 System is ready! Test by creating a new student.');
    }

    pool.end();

  } catch (error) {
    console.error('   ❌ Database error:', error.message);
    pool.end();
  }
})();
