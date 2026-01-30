/**
 * WhatsApp API - Test ALL Templates (FIXED PARAM ORDER)
 * Params sent in ORDER OF APPEARANCE in template, not numerical order
 * Run: node testOneByOne.js [1|2|3|4] (or no arg for all)
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

async function sendTemplate(name, description, bodyParams) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 Template: ${name}`);
    console.log(`📝 ${description}`);
    console.log(`📦 Params: [${bodyParams.join(', ')}]`);
    console.log(`${'='.repeat(60)}`);

    const components = [{
        type: 'body',
        parameters: bodyParams.map(param => ({ type: 'text', text: param }))
    }];

    const response = await axios.post(
        'https://api.ycloud.com/v2/whatsapp/messages',
        {
            from: WHATSAPP_PHONE_ID,
            to: TEST_PHONE,
            type: 'template',
            template: { name, language: { code: 'en' }, components }
        },
        { headers: { 'Content-Type': 'application/json', 'X-API-Key': YCLOUD_API_KEY } }
    );

    console.log(`✅ SENT! ID: ${response.data.id}`);
    console.log(`   Category: ${response.data.pricingCategory}, Cost: $${response.data.totalPrice}`);
    return response.data;
}

async function main() {
    const args = process.argv.slice(2);
    const templateNum = args[0] ? parseInt(args[0]) : 0;

    console.log('🚀 WhatsApp Template Tester (FIXED PARAM ORDER)');
    console.log(`📱 To: ${TEST_PHONE}`);
    console.log(`👤 Student: ${STUDENT_NAME}`);
    console.log(`🏫 School: ${SCHOOL_NAME}\n`);

    // ===== TEMPLATE 1: PRESENT (student_checkin_log_v1) =====
    // Variables in template appear as: {{4}}=school, {{1}}=name, {{2}}=time, {{3}}=date
    // So params order: [school, name, time, date]
    if (templateNum === 1 || templateNum === 0) {
        console.log('\n>>> TEST 1: PRESENT (student_checkin_log_v1)');
        await sendTemplate(
            'student_checkin_log_v1',
            'ORDER: {{4}}=school, {{1}}=name, {{2}}=time, {{3}}=date',
            [SCHOOL_NAME, STUDENT_NAME, CHECK_TIME, DATE]
        );
        if (templateNum === 1) return;
        console.log('\n⏳ Waiting 3 seconds...\n');
        await new Promise(r => setTimeout(r, 3000));
    }

    // ===== TEMPLATE 2: LATE (attendance_late) =====
    // Variables: {{4}}=school, {{1}}=name, {{2}}=date, {{3}}=time
    // So params order: [school, name, date, time]
    if (templateNum === 2 || templateNum === 0) {
        console.log('\n>>> TEST 2: LATE (attendance_late)');
        await sendTemplate(
            'attendance_late',
            'ORDER: {{4}}=school, {{1}}=name, {{2}}=date, {{3}}=time',
            [SCHOOL_NAME, STUDENT_NAME, DATE, LATE_TIME]
        );
        if (templateNum === 2) return;
        console.log('\n⏳ Waiting 3 seconds...\n');
        await new Promise(r => setTimeout(r, 3000));
    }

    // ===== TEMPLATE 3: ABSENT (attendance_absent_v1_) =====
    // Variables: {{4}}=school, {{1}}=name, {{3}}=date (NO {{2}}!)
    // So params order: [school, name, date]
    if (templateNum === 3 || templateNum === 0) {
        console.log('\n>>> TEST 3: ABSENT (attendance_absent_v1_)');
        await sendTemplate(
            'attendance_absent_v1_',
            'ORDER: {{4}}=school, {{1}}=name, {{3}}=date (NO {{2}})',
            [SCHOOL_NAME, STUDENT_NAME, DATE]
        );
        if (templateNum === 3) return;
        console.log('\n⏳ Waiting 3 seconds...\n');
        await new Promise(r => setTimeout(r, 3000));
    }

    // ===== TEMPLATE 4: LEAVE (attendance_leave_v1_) =====
    // Variables: {{4}}=school, {{1}}=name, {{3}}=date (NO {{2}}!)
    // So params order: [school, name, date]
    if (templateNum === 4 || templateNum === 0) {
        console.log('\n>>> TEST 4: LEAVE (attendance_leave_v1_)');
        await sendTemplate(
            'attendance_leave_v1_',
            'ORDER: {{4}}=school, {{1}}=name, {{3}}=date (NO {{2}})',
            [SCHOOL_NAME, STUDENT_NAME, DATE]
        );
    }

    console.log('\n\n✅ ALL TESTS COMPLETE! Check your phone 📱');
}

main().catch(err => console.error('❌ Error:', err.response?.data || err.message));
