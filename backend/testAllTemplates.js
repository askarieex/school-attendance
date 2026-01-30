/**
 * WhatsApp API - Test ALL Templates (FIXED Params)
 * Run: node testAllTemplates.js
 */

const axios = require('axios');

// ============ CONFIGURATION ============
const YCLOUD_API_KEY = '3ce5e1037f920dde84603058e36d4fc5';
const WHATSAPP_PHONE_ID = '919103521261';
const TEST_PHONE = '917889704442';

// Test data
const STUDENT_NAME = 'Zara Khan';
const SCHOOL_NAME = 'The Heritage School';
const CHECK_TIME = '08:45 AM';
const LATE_TIME = '11:30 AM';
const DATE = '30 January 2026';

// All templates with CORRECT params based on YCloud screenshots
const TEMPLATES = [
    {
        name: 'student_checkin_log_v1',
        status: 'present',
        description: 'Present/Check-in ({{1}}=name, {{2}}=time, {{3}}=date, {{4}}=school header)',
        hasHeader: true,
        headerParam: SCHOOL_NAME,
        bodyParams: [STUDENT_NAME, CHECK_TIME, DATE]  // {{1}}, {{2}}, {{3}}
    },
    {
        name: 'attendance_late',
        status: 'late',
        description: 'Late arrival ({{1}}=name, {{2}}=date, {{3}}=time, {{4}}=school header)',
        hasHeader: true,
        headerParam: SCHOOL_NAME,
        bodyParams: [STUDENT_NAME, DATE, LATE_TIME]  // {{1}}, {{2}}, {{3}}
    },
    {
        name: 'attendance_absent_v1_',
        status: 'absent',
        description: 'Absent ({{1}}=name, {{3}}=date, {{4}}=school header - NO {{2}}!)',
        hasHeader: true,
        headerParam: SCHOOL_NAME,
        bodyParams: [STUDENT_NAME, DATE]  // {{1}}, {{3}} - skips {{2}}!
    },
    {
        name: 'attendance_leave_v1_',
        status: 'leave',
        description: 'Leave ({{1}}=name, {{3}}=date, {{4}}=school header - NO {{2}}!)',
        hasHeader: true,
        headerParam: SCHOOL_NAME,
        bodyParams: [STUDENT_NAME, DATE]  // {{1}}, {{3}} - skips {{2}}!
    }
];

async function testTemplate(template) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 Template: ${template.name}`);
    console.log(`📝 ${template.description}`);
    console.log(`${'='.repeat(60)}`);

    try {
        const components = [];

        // Add header if needed
        if (template.hasHeader && template.headerParam) {
            components.push({
                type: 'header',
                parameters: [{ type: 'text', text: template.headerParam }]
            });
        }

        // Add body params
        components.push({
            type: 'body',
            parameters: template.bodyParams.map(param => ({ type: 'text', text: param }))
        });

        const response = await axios.post(
            'https://api.ycloud.com/v2/whatsapp/messages',
            {
                from: WHATSAPP_PHONE_ID,
                to: TEST_PHONE,
                type: 'template',
                template: {
                    name: template.name,
                    language: { code: 'en' },
                    components: components
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': YCLOUD_API_KEY
                }
            }
        );

        console.log(`✅ SENT!`);
        console.log(`   Message ID: ${response.data.id}`);
        console.log(`   Status: ${response.data.status}`);
        console.log(`   Category: ${response.data.pricingCategory}`);
        console.log(`   Cost: $${response.data.totalPrice}`);

        return { success: true, template: template.name, status: template.status };

    } catch (error) {
        const errorMsg = error.response?.data?.message || error.message;
        console.log(`❌ FAILED: ${errorMsg}`);
        if (error.response?.data) {
            console.log(`   Details:`, JSON.stringify(error.response.data, null, 2));
        }
        return { success: false, template: template.name, error: errorMsg };
    }
}

async function runAllTests() {
    console.log('🚀 Testing ALL WhatsApp Templates (FIXED Params)...');
    console.log(`📱 To: ${TEST_PHONE}`);
    console.log(`📞 From: ${WHATSAPP_PHONE_ID}`);
    console.log(`👤 Student: ${STUDENT_NAME}`);
    console.log(`🏫 School: ${SCHOOL_NAME}`);

    const results = [];

    for (const template of TEMPLATES) {
        const result = await testTemplate(template);
        results.push(result);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 SUMMARY');
    console.log(`${'='.repeat(60)}`);

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`✅ Sent: ${sent}/${results.length}`);
    console.log(`❌ Failed: ${failed}/${results.length}`);

    if (failed > 0) {
        console.log('\n⚠️  Failed templates:');
        results.filter(r => !r.success).forEach(r => {
            console.log(`   - ${r.template}: ${r.error}`);
        });
    }

    console.log('\n📱 Check your WhatsApp for messages!');
}

runAllTests();
