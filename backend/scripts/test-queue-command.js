#!/usr/bin/env node

/**
 * Test Script - Queue a Command and Verify Format
 * Creates a test command and shows exactly what's in the database
 */

const DeviceCommand = require('../src/models/DeviceCommand');
const { query, pool } = require('../src/config/database');

console.log('🧪 Testing Command Queue and Format\n');
console.log('='​.repeat(60));

async function test() {
  try {
    // Step 1: Get device ID
    console.log('\n📍 Step 1: Finding device...\n');
    const deviceResult = await query(`
      SELECT id, device_name, serial_number
      FROM devices
      WHERE is_active = TRUE
      ORDER BY id
      LIMIT 1
    `);
    
    if (deviceResult.rows.length === 0) {
      console.log('❌ No active devices found in database');
      console.log('   Please add a device first');
      pool.end();
      return;
    }
    
    const device = deviceResult.rows[0];
    console.log(`   ✅ Found device: ${device.device_name} (ID: ${device.id}, SN: ${device.serial_number})`);
    
    // Step 2: Queue a test command
    console.log('\n📋 Step 2: Queueing test command...\n');
    const result = await DeviceCommand.queueAddUser(
      device.id,
      999,            // PIN
      'Test User',    // Name
      '99998888'      // Card
    );
    
    console.log(`   ✅ Command queued with ID: ${result.id}`);
    
    // Step 3: Fetch and verify the command
    console.log('\n🔍 Step 3: Verifying command in database...\n');
    const cmdCheck = await query(`
      SELECT 
        id,
        device_id,
        command_type,
        command_string,
        status,
        priority,
        created_at
      FROM device_commands
      WHERE id = $1
    `, [result.id]);
    
    if (cmdCheck.rows.length === 0) {
      console.log('   ❌ Command not found in database!');
      pool.end();
      return;
    }
    
    const cmd = cmdCheck.rows[0];
    
    console.log('   Command Details:');
    console.log(`   ├─ ID: ${cmd.id}`);
    console.log(`   ├─ Device ID: ${cmd.device_id}`);
    console.log(`   ├─ Type: ${cmd.command_type}`);
    console.log(`   ├─ Status: ${cmd.status}`);
    console.log(`   ├─ Priority: ${cmd.priority}`);
    console.log(`   └─ Created: ${cmd.created_at}`);
    
    console.log('\n   📝 Command String:');
    console.log(`   ${cmd.command_string}`);
    
    // Step 4: Validate format
    console.log('\n✅ Step 4: Format Validation\n');
    
    const checks = [];
    
    // Check 1: Starts with C:<id>:
    if (cmd.command_string.startsWith(`C:${cmd.id}:`)) {
      console.log('   ✅ Has correct prefix: C:' + cmd.id + ':');
      checks.push(true);
    } else {
      console.log('   ❌ Missing or wrong prefix');
      checks.push(false);
    }
    
    // Check 2: Contains DATA USER
    if (cmd.command_string.includes('DATA USER')) {
      console.log('   ✅ Contains "DATA USER"');
      checks.push(true);
    } else {
      console.log('   ❌ Missing "DATA USER"');
      checks.push(false);
    }
    
    // Check 3: Has uppercase PIN=
    if (cmd.command_string.includes('PIN=999')) {
      console.log('   ✅ Has uppercase "PIN="');
      checks.push(true);
    } else {
      console.log('   ❌ Missing or lowercase "PIN="');
      checks.push(false);
    }
    
    // Check 4: Uses tabs
    if (cmd.command_string.includes('\t')) {
      const tabCount = (cmd.command_string.match(/\t/g) || []).length;
      console.log(`   ✅ Uses tab separators (${tabCount} tabs found)`);
      checks.push(true);
    } else {
      console.log('   ❌ No tab separators found');
      checks.push(false);
    }
    
    // Check 5: Has required fields
    const requiredFields = ['Grp=', 'TZ=', 'VerifyMode=', 'Pwd='];
    const missingFields = requiredFields.filter(f => !cmd.command_string.includes(f));
    
    if (missingFields.length === 0) {
      console.log('   ✅ All required fields present');
      checks.push(true);
    } else {
      console.log(`   ❌ Missing fields: ${missingFields.join(', ')}`);
      checks.push(false);
    }
    
    // Final verdict
    console.log('\n' + '='.repeat(60));
    
    if (checks.every(c => c === true)) {
      console.log('🎉 SUCCESS! Command format is PERFECT!');
      console.log('\n✅ Your command will work on the ZKTeco device.');
      console.log('\n🎯 Next steps:');
      console.log('   1. Wait for device to poll GET /iclock/getrequest');
      console.log('   2. Device will receive this command');
      console.log('   3. Device should respond with Return=0');
      console.log('   4. Check server logs for success confirmation');
    } else {
      console.log('❌ FAILED! Command format has issues.');
      console.log('\n🔧 Please review the code fixes and try again.');
    }
    
    console.log('\n📊 To delete this test command:');
    console.log(`   DELETE FROM device_commands WHERE id = ${cmd.id};`);
    
    pool.end();
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    pool.end();
    process.exit(1);
  }
}

test();
