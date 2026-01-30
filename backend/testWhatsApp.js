/**
 * WhatsApp API Test Script
 * Run: node testWhatsApp.js
 */

const axios = require('axios');

// ============ CONFIGURATION - CHANGE THESE ============
const YCLOUD_API_KEY = '3ce5e1037f920dde84603058e36d4fc5';
const WHATSAPP_PHONE_ID = '919103521261'; // Your WhatsApp Business Phone ID
const TEST_PHONE = '+917889704442';        // Test phone number (with country code, no +)

// ⬇️ WORKING TEMPLATE - attendance_alert_v1
const TEMPLATE_NAME = 'attendance_alert_v1';

// Template BODY parameters: {{1}}=name, {{2}}=time
const TEMPLATE_BODY_PARAMS = [
    'Mohammad Askarie',           // {{1}} - Student Name
    '09:15 AM',            // {{2}} - Check-in Time
];

// No header for this template
const TEMPLATE_HEADER_PARAM = null;
// ======================================================

async function testWhatsApp() {
    console.log('🚀 Testing WhatsApp API...');
    console.log('📱 To:', TEST_PHONE);
    console.log('📞 From:', WHATSAPP_PHONE_ID);
    console.log('📋 Template:', TEMPLATE_NAME);
    console.log('📝 Body Params:', TEMPLATE_BODY_PARAMS);
    console.log('📝 Header Param:', TEMPLATE_HEADER_PARAM);
    console.log('');

    try {
        const response = await axios.post(
            'https://api.ycloud.com/v2/whatsapp/messages',
            {
                from: WHATSAPP_PHONE_ID,
                to: TEST_PHONE,
                type: 'template',
                template: {
                    name: TEMPLATE_NAME,
                    language: {
                        code: 'en'
                    },
                    components: [
                        // HEADER component (school name)
                        ...(TEMPLATE_HEADER_PARAM ? [{
                            type: 'header',
                            parameters: [{
                                type: 'text',
                                text: TEMPLATE_HEADER_PARAM
                            }]
                        }] : []),
                        // BODY component ({{1}}, {{2}}, {{3}})
                        {
                            type: 'body',
                            parameters: TEMPLATE_BODY_PARAMS.map(param => ({
                                type: 'text',
                                text: param
                            }))
                        }
                    ]
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': YCLOUD_API_KEY
                }
            }
        );

        console.log('✅ SUCCESS!');
        console.log('📨 Message ID:', response.data.id || response.data.messageId);
        console.log('📊 Status:', response.data.status);
        console.log('');
        console.log('Full Response:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.log('❌ FAILED!');
        console.log('');

        if (error.response) {
            console.log('Status Code:', error.response.status);
            console.log('Error:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('Error:', error.message);
        }
    }
}

// Run the test
testWhatsApp();
