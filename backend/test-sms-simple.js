/**
 * Simple SMS Test
 * Just tests if SMS sending works
 */

require('dotenv').config();
const twilio = require('twilio');

async function testSMS() {
  console.log('\n📱 ========== SIMPLE SMS TEST ==========\n');

  // Your credentials
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const smsNumber = process.env.TWILIO_PHONE_NUMBER;

  // Your phone number to test
  const testPhone = '+917889704442'; // Change this to your number

  console.log('📞 From:', smsNumber);
  console.log('📱 To:', testPhone);
  console.log('');

  try {
    // Create Twilio client
    const client = twilio(accountSid, authToken);

    // Send SMS
    const message = await client.messages.create({
      from: smsNumber,
      to: testPhone,
      body: 'Test SMS from School Attendance System. If you received this, SMS is working! ✅'
    });

    console.log('✅ SMS SENT SUCCESSFULLY!');
    console.log('   Message ID:', message.sid);
    console.log('   Status:', message.status);
    console.log('');
    console.log('📱 Check your phone now!');
    console.log('   You should receive an SMS from:', smsNumber);

  } catch (error) {
    console.log('❌ SMS FAILED!');
    console.log('   Error:', error.message);
    console.log('   Code:', error.code);
  }

  console.log('\n📱 =====================================\n');
  process.exit(0);
}

// Run test
testSMS();
