/**
 * TEST SCRIPT: Debug RFID SMS Issue
 *
 * This script helps you test why SMS is not sending for RFID scans.
 *
 * Run this after a student scans their RFID card to see what happened.
 */

const { query } = require('./src/config/database');

async function testRFIDSMS() {
  console.log('\n🔍 RFID SMS Debug Test\n');
  console.log('='.repeat(60));

  try {
    // 1. Get the most recent attendance log
    const recentLog = await query(`
      SELECT al.*, s.full_name, s.guardian_phone, s.parent_phone, s.mother_phone,
             d.device_name, d.serial_number, sch.name as school_name
      FROM attendance_logs al
      JOIN students s ON al.student_id = s.id
      LEFT JOIN devices d ON al.device_id = d.id
      LEFT JOIN schools sch ON al.school_id = sch.id
      WHERE al.date = CURRENT_DATE
      ORDER BY al.created_at DESC
      LIMIT 5
    `);

    if (recentLog.rows.length === 0) {
      console.log('❌ No attendance logs found for today');
      return;
    }

    console.log(`\n📋 Last 5 Attendance Logs for Today:\n`);

    for (const log of recentLog.rows) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`Student: ${log.full_name}`);
      console.log(`Status: ${log.status}`);
      console.log(`Check-in Time: ${log.check_in_time}`);
      console.log(`Date: ${log.date}`);
      console.log(`Device: ${log.device_name || 'Manual Entry'} (${log.serial_number || 'N/A'})`);
      console.log(`School: ${log.school_name}`);
      console.log(`\nPhone Numbers:`);
      console.log(`  Guardian: ${log.guardian_phone || '❌ Not set'}`);
      console.log(`  Parent: ${log.parent_phone || '❌ Not set'}`);
      console.log(`  Mother: ${log.mother_phone || '❌ Not set'}`);

      // Check if ANY phone number exists
      const hasPhone = log.guardian_phone || log.parent_phone || log.mother_phone;

      console.log(`\n💡 SMS Analysis:`);
      if (!log.device_id) {
        console.log(`  ✅ Manual attendance (should send SMS)`);
      } else {
        console.log(`  ✅ RFID scan (should send SMS if late/absent/leave)`);
      }

      if (log.status === 'present') {
        console.log(`  ⏭️  Status is 'present' - SMS NOT sent (by design)`);
      } else if (log.status === 'late' || log.status === 'absent' || log.status === 'leave') {
        console.log(`  ✅ Status is '${log.status}' - SMS SHOULD be sent`);

        if (!hasPhone) {
          console.log(`  ❌ PROBLEM: No phone number in database!`);
          console.log(`  💡 Solution: Add guardian_phone/parent_phone/mother_phone to student record`);
        } else {
          console.log(`  ✅ Phone number exists: ${log.guardian_phone || log.parent_phone || log.mother_phone}`);
          console.log(`  💡 Check WhatsApp logs to see if SMS was sent...`);
        }
      }
    }

    // 2. Check WhatsApp logs for recent sends
    console.log(`\n\n${'='.repeat(60)}`);
    console.log('📱 Recent WhatsApp/SMS Logs (Last 10):\n');

    const whatsappLogs = await query(`
      SELECT wl.*, s.full_name
      FROM whatsapp_logs wl
      LEFT JOIN students s ON wl.student_id = s.id
      ORDER BY wl.sent_at DESC
      LIMIT 10
    `);

    if (whatsappLogs.rows.length === 0) {
      console.log('❌ No WhatsApp/SMS logs found');
      console.log('💡 This means SMS service is not being called at all!');
    } else {
      for (const log of whatsappLogs.rows) {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`Student: ${log.student_name || log.full_name || 'Unknown'}`);
        console.log(`Phone: ${log.phone}`);
        console.log(`Status: ${log.status}`);
        console.log(`Message Type: ${log.message_type || 'N/A'}`);
        console.log(`Sent At: ${log.sent_at}`);
        console.log(`Message ID: ${log.message_id || '❌ Failed'}`);
        if (log.error_message) {
          console.log(`Error: ${log.error_message}`);
        }
      }
    }

    // 3. Check school settings
    console.log(`\n\n${'='.repeat(60)}`);
    console.log('⚙️  School Settings:\n');

    const settings = await query(`
      SELECT ss.*, s.name as school_name
      FROM school_settings ss
      JOIN schools s ON ss.school_id = s.id
      LIMIT 5
    `);

    for (const setting of settings.rows) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`School: ${setting.school_name}`);
      console.log(`School Open Time: ${setting.school_open_time}`);
      console.log(`Late Threshold: ${setting.late_threshold_minutes} minutes`);
      console.log(`School Close Time: ${setting.school_close_time}`);
    }

    console.log(`\n${'='.repeat(60)}\n`);

  } catch (error) {
    console.error('\n❌ Error running test:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

// Run the test
testRFIDSMS();
