/**
 * Batch SMS Performance Test
 * Tests parallel SMS sending for 200 students
 */

require('dotenv').config();
const whatsappService = require('./src/services/whatsappService');

async function testBatchSMS() {
  console.log('\n🚀 ========== BATCH SMS PERFORMANCE TEST ==========\n');

  // Simulate 200 students
  const studentCount = 200;
  const testPhone = '+917889704442'; // Your phone number

  console.log(`📊 Simulating ${studentCount} students`);
  console.log(`📱 All messages will go to: ${testPhone}`);
  console.log(`⚙️ Batch size: 20 messages in parallel`);
  console.log(`⏱️ Delay between batches: 100ms`);
  console.log('');

  // Create test data for 200 students
  const studentsData = [];
  for (let i = 1; i <= studentCount; i++) {
    studentsData.push({
      parentPhone: testPhone,
      studentName: `Test Student ${i}`,
      studentId: 1000 + i, // Unique IDs
      schoolId: 1,
      status: i % 2 === 0 ? 'late' : 'present', // Alternate between late and present
      checkInTime: '08:30 AM',
      schoolName: 'Test School',
      date: new Date().toISOString().split('T')[0]
    });
  }

  console.log('🔥 Starting batch send...\n');
  const startTime = Date.now();

  try {
    const results = await whatsappService.sendBatchSMS(studentsData);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n📊 ========== RESULTS ==========\n');
    console.log(`✅ Total messages: ${results.total}`);
    console.log(`✅ Successfully sent: ${results.sent}`);
    console.log(`⏭️ Skipped (duplicates): ${results.skipped}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`⏱️ Total time: ${duration} seconds`);
    console.log(`⚡ Speed: ${(results.total / duration).toFixed(1)} messages/second`);
    console.log('');

    if (results.errors.length > 0) {
      console.log('❌ Errors:');
      results.errors.slice(0, 5).forEach(err => {
        console.log(`   - ${err.student}: ${err.error}`);
      });
      if (results.errors.length > 5) {
        console.log(`   ... and ${results.errors.length - 5} more errors`);
      }
    }

    // Calculate expected time for sequential sending
    const sequentialTime = studentCount * 1.5; // 1.5 seconds per message
    const speedup = (sequentialTime / duration).toFixed(1);

    console.log('\n📈 ========== PERFORMANCE COMPARISON ==========\n');
    console.log(`Sequential (old way): ~${sequentialTime.toFixed(0)} seconds`);
    console.log(`Parallel (optimized): ${duration} seconds`);
    console.log(`⚡ Speed improvement: ${speedup}x faster!`);

  } catch (error) {
    console.log('❌ Batch send failed:', error.message);
  }

  console.log('\n🚀 ========================================\n');
  process.exit(0);
}

// Run test
testBatchSMS();
