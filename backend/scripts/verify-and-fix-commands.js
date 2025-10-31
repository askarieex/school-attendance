#!/usr/bin/env node

/**
 * Comprehensive Verification and Auto-Fix Script
 * Checks and fixes all ZKTeco command format issues
 */

const { query, pool } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

console.log('🔍 ZKTeco Command Format - Complete Verification\n');
console.log('='​.repeat(60));

const issues = [];
const fixes = [];

async function main() {
  try {
    // ========================================
    // CHECK 1: Code Files
    // ========================================
    console.log('\n📁 CHECK 1: Verifying Code Files\n');
    
    // Check commandGenerator.js
    const generatorPath = path.join(__dirname, '../src/services/commandGenerator.js');
    const generatorCode = fs.readFileSync(generatorPath, 'utf8');
    
    if (generatorCode.includes('C:${commandId}:DATA USER PIN=')) {
      console.log('   ✅ commandGenerator.js: Correct format');
    } else {
      console.log('   ❌ commandGenerator.js: WRONG format');
      issues.push('commandGenerator.js has wrong format');
    }
    
    if (generatorCode.includes('\\tName=') && generatorCode.includes('\\tCard=')) {
      console.log('   ✅ commandGenerator.js: Uses tab separators');
    } else {
      console.log('   ❌ commandGenerator.js: Missing tab separators');
      issues.push('commandGenerator.js missing tabs');
    }
    
    // Check DeviceCommand.js
    const modelPath = path.join(__dirname, '../src/models/DeviceCommand.js');
    const modelCode = fs.readFileSync(modelPath, 'utf8');
    
    if (modelCode.includes('PLACEHOLDER') && modelCode.includes('RETURNING id')) {
      console.log('   ✅ DeviceCommand.js: Uses insert-then-update pattern');
    } else {
      console.log('   ❌ DeviceCommand.js: Missing correct pattern');
      issues.push('DeviceCommand.js missing insert-then-update');
    }
    
    // ========================================
    // CHECK 2: Database Schema
    // ========================================
    console.log('\n🗄️  CHECK 2: Verifying Database Schema\n');
    
    const schemaCheck = await query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'device_commands'
      ORDER BY ordinal_position
    `);
    
    if (schemaCheck.rows.length === 0) {
      console.log('   ❌ device_commands table NOT FOUND');
      issues.push('Missing device_commands table');
    } else {
      console.log('   ✅ device_commands table exists');
      
      const cmdStringCol = schemaCheck.rows.find(r => r.column_name === 'command_string');
      if (cmdStringCol) {
        if (cmdStringCol.data_type === 'text' || parseInt(cmdStringCol.character_maximum_length) >= 500) {
          console.log(`   ✅ command_string column: ${cmdStringCol.data_type} (adequate)`);
        } else {
          console.log(`   ⚠️  command_string column: ${cmdStringCol.data_type}(${cmdStringCol.character_maximum_length}) - may be too small`);
          issues.push('command_string column may be too small for long commands');
        }
      } else {
        console.log('   ❌ command_string column NOT FOUND');
        issues.push('Missing command_string column');
      }
    }
    
    // ========================================
    // CHECK 3: Existing Commands
    // ========================================
    console.log('\n📋 CHECK 3: Analyzing Existing Commands\n');
    
    // Count commands by status
    const statusCounts = await query(`
      SELECT status, COUNT(*) as count
      FROM device_commands
      GROUP BY status
      ORDER BY status
    `);
    
    console.log('   Command Status Summary:');
    statusCounts.rows.forEach(row => {
      console.log(`     ${row.status}: ${row.count}`);
    });
    
    // Find commands with wrong format
    const wrongFormat = await query(`
      SELECT 
        id,
        command_type,
        LEFT(command_string, 50) as preview,
        status,
        created_at
      FROM device_commands
      WHERE status IN ('pending', 'sent')
        AND command_string NOT LIKE 'C:%'
        AND command_string != 'PLACEHOLDER'
        AND command_string IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (wrongFormat.rows.length > 0) {
      console.log(`\n   ⚠️  Found ${wrongFormat.rows.length} command(s) with WRONG format:\n`);
      wrongFormat.rows.forEach(cmd => {
        console.log(`      ID: ${cmd.id} | Status: ${cmd.status}`);
        console.log(`      Preview: ${cmd.preview}...`);
        console.log(`      Created: ${cmd.created_at}\n`);
      });
      issues.push(`${wrongFormat.rows.length} commands with wrong format`);
    } else {
      console.log('\n   ✅ No commands with wrong format found');
    }
    
    // Find stuck PLACEHOLDER commands
    const stuckPlaceholders = await query(`
      SELECT COUNT(*) as count
      FROM device_commands
      WHERE command_string = 'PLACEHOLDER'
        AND status IN ('pending', 'sent')
        AND created_at < NOW() - INTERVAL '5 minutes'
    `);
    
    const stuckCount = parseInt(stuckPlaceholders.rows[0].count);
    if (stuckCount > 0) {
      console.log(`\n   ⚠️  Found ${stuckCount} STUCK PLACEHOLDER command(s)`);
      issues.push(`${stuckCount} stuck PLACEHOLDER commands`);
    }
    
    // Find commands with correct format
    const correctFormat = await query(`
      SELECT COUNT(*) as count
      FROM device_commands
      WHERE command_string LIKE 'C:%DATA USER PIN=%'
        AND command_string LIKE '%\\t%'
    `);
    
    const correctCount = parseInt(correctFormat.rows[0].count);
    if (correctCount > 0) {
      console.log(`\n   ✅ Found ${correctCount} command(s) with CORRECT format`);
    }
    
    // ========================================
    // DECISION: Auto-Fix or Report
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 ANALYSIS SUMMARY');
    console.log('='.repeat(60));
    
    if (issues.length === 0) {
      console.log('\n✅ ALL CHECKS PASSED!');
      console.log('\n   Your ZKTeco integration is properly configured.');
      console.log('   No issues found in code or database.');
    } else {
      console.log(`\n⚠️  FOUND ${issues.length} ISSUE(S):\n`);
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
      
      console.log('\n🔧 AUTO-FIX AVAILABLE');
      console.log('\nWould you like to automatically fix these issues?');
      console.log('This will:');
      console.log('  • Delete commands with wrong format');
      console.log('  • Mark stuck PLACEHOLDERs as failed');
      console.log('  • NOT modify your code files (manual review recommended)');
      
      // Auto-fix if running with --fix flag
      if (process.argv.includes('--fix')) {
        console.log('\n🔧 APPLYING AUTO-FIX...\n');
        await autoFix(wrongFormat.rows.length, stuckCount);
      } else {
        console.log('\nTo auto-fix, run: node scripts/verify-and-fix-commands.js --fix');
      }
    }
    
    // ========================================
    // Test Command Generation
    // ========================================
    if (issues.length === 0 || process.argv.includes('--test')) {
      console.log('\n🧪 TEST: Generating Sample Command\n');
      
      const CommandGenerator = require('../src/services/commandGenerator');
      const testCmd = CommandGenerator.addUser(999, 'Test User', '12345678', 500);
      
      console.log('   Generated command:');
      console.log(`   ${testCmd}\n`);
      
      if (testCmd.startsWith('C:500:DATA USER PIN=999') && testCmd.includes('\t')) {
        console.log('   ✅ Command generation works correctly!');
      } else {
        console.log('   ❌ Command generation has issues!');
      }
    }
    
    pool.end();
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    pool.end();
    process.exit(1);
  }
}

async function autoFix(wrongCount, stuckCount) {
  try {
    let fixed = 0;
    
    // Fix 1: Delete wrong-format commands
    if (wrongCount > 0) {
      const deleteResult = await query(`
        DELETE FROM device_commands
        WHERE status IN ('pending', 'sent')
          AND command_string NOT LIKE 'C:%'
          AND command_string != 'PLACEHOLDER'
          AND command_string IS NOT NULL
        RETURNING id
      `);
      fixed += deleteResult.rows.length;
      console.log(`   ✅ Deleted ${deleteResult.rows.length} wrong-format command(s)`);
    }
    
    // Fix 2: Mark stuck PLACEHOLDERs as failed
    if (stuckCount > 0) {
      const updateResult = await query(`
        UPDATE device_commands
        SET status = 'failed',
            error_message = 'Command string was never updated from PLACEHOLDER - likely a code bug',
            completed_at = NOW()
        WHERE command_string = 'PLACEHOLDER'
          AND status IN ('pending', 'sent')
          AND created_at < NOW() - INTERVAL '5 minutes'
        RETURNING id
      `);
      fixed += updateResult.rows.length;
      console.log(`   ✅ Marked ${updateResult.rows.length} stuck PLACEHOLDER(s) as failed`);
    }
    
    console.log(`\n✅ AUTO-FIX COMPLETE: Fixed ${fixed} issue(s)`);
    console.log('\n🎯 Next Steps:');
    console.log('   1. Create a new student to test command generation');
    console.log('   2. Watch device poll and execute the command');
    console.log('   3. Verify Return=0 in server logs');
    
  } catch (error) {
    console.error('\n❌ AUTO-FIX FAILED:', error.message);
    throw error;
  }
}

main();
