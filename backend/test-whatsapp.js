/**
 * Quick WhatsApp Test Script
 * Tests if Twilio WhatsApp integration is working
 */

require('dotenv').config();
const whatsappService = require('./src/services/whatsappService');

async function testWhatsApp() {
  console.log('\n🧪 ========== TESTING WHATSAPP SERVICE ==========\n');

  // Test phone number (change to your phone)
  const testPhone = '+917889704442'; // Random unverified number for testing

  console.log('📱 Testing WhatsApp with phone:', testPhone);
  console.log('🔧 Using credentials from:', process.env.TWILIO_WHATSAPP_NUMBER);
  console.log('');

  try {
    // Test connection
    const result = await whatsappService.testConnection(testPhone);

    if (result.success) {
      console.log('✅ SUCCESS! WhatsApp test message sent!');
      console.log('   Message ID:', result.messageId);
      console.log('   Message:', result.message);
      console.log('');
      console.log('📱 Check your WhatsApp now!');
      console.log('   You should receive a test message from:', process.env.TWILIO_WHATSAPP_NUMBER);
    } else {
      console.log('❌ FAILED! WhatsApp test failed');
      console.log('   Error:', result.error);
      if (result.hint) {
        console.log('   Hint:', result.hint);
      }
    }

  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }

  console.log('\n🧪 ========================================\n');
  process.exit(0);
}

// Run test
testWhatsApp();
