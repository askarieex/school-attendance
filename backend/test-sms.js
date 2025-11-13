/**
 * SMS Fallback Test Script
 * Tests SMS sending when WhatsApp fails
 */

require('dotenv').config();
const whatsappService = require('./src/services/whatsappService');

async function testSMSFallback() {
  console.log('\n📱 ========== TESTING SMS FALLBACK ==========\n');

  // Test phone number - Use random number to trigger SMS fallback
  // Or use your real number: +917889704442
  const testPhone = '+919999999999'; // This will fail WhatsApp, trigger SMS fallback

  console.log('📱 Testing SMS fallback with phone:', testPhone);
  console.log('📞 Using SMS number:', process.env.TWILIO_PHONE_NUMBER);
  console.log('');

  try {
    // Test attendance alert with random parent number (will fail WhatsApp, fallback to SMS)
    const result = await whatsappService.sendAttendanceAlert({
      parentPhone: testPhone,
      studentName: 'Test Student',
      studentId: '12345',
      schoolId: 1,
      status: 'late',
      checkInTime: '08:45 AM',
      schoolName: 'ABC School',
      date: new Date().toISOString().split('T')[0]
    });

    if (result.success) {
      console.log('✅ SUCCESS! Message sent!');
      console.log('   Message ID:', result.messageId);
      console.log('   Sent via:', result.sentVia || 'unknown');
      console.log('');
      if (result.sentVia === 'sms') {
        console.log('📱 Check your phone for SMS!');
      } else {
        console.log('📱 Check your WhatsApp!');
      }
    } else {
      console.log('❌ FAILED!');
      console.log('   Error:', result.error);
    }

  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }

  console.log('\n📱 ========================================\n');
  process.exit(0);
}

// Run test
testSMSFallback();
