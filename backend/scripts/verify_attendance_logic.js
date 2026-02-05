const { pool, query } = require('../src/config/database');
const AttendanceCalculator = require('../src/services/attendanceCalculator');
const SchoolSettings = require('../src/models/SchoolSettings');
const Holiday = require('../src/models/Holiday');

async function runTest() {
    try {
        console.log('🧪 Starting Attendance Logic Verification...');

        // 1. Get a School
        const schoolRes = await query('SELECT id, name FROM schools LIMIT 1');
        if (schoolRes.rows.length === 0) {
            console.log('❌ No schools found. Cannot test.');
            process.exit(1);
        }
        const schoolId = schoolRes.rows[0].id;
        console.log(`🏫 Testing with School: ${schoolRes.rows[0].name} (ID: ${schoolId})`);

        // 2. Setup Settings (Simulate Mon-Sat working, Sunday off)
        // We update settings to ensure consistent test environment
        await SchoolSettings.update(schoolId, {
            weekly_holiday: 'Sunday',
            working_days: 'Mon-Sat',
            school_open_time: '09:00:00',
            late_threshold_minutes: 15
        });
        console.log('⚙️  Settings configured: Mon-Sat working, Sun off, 9:00 AM start, 15m grace');

        // 3. Test Weekend Detection
        // find next Sunday
        const d = new Date();
        d.setDate(d.getDate() + (7 - d.getDay()) % 7); // Next Sunday (or today if Sunday)
        if (d.getDay() !== 0) d.setDate(d.getDate() + (7 - d.getDay() + 0) % 7); // Ensure Sunday

        const sundayStr = d.toISOString().split('T')[0];
        const sundayStatus = await AttendanceCalculator.getDayStatus(schoolId, sundayStr);

        if (sundayStatus.type === 'WEEKEND') {
            console.log(`✅ [Pass] Weekend Detection (${sundayStr}): DETECTED (${sundayStatus.name})`);
        } else {
            console.error(`❌ [Fail] Weekend Detection (${sundayStr}): GOT ${sundayStatus.type}`);
        }

        // 4. Test Working Day Detection
        // find next Monday
        const m = new Date();
        m.setDate(m.getDate() + (1 + 7 - m.getDay()) % 7);
        const mondayStr = m.toISOString().split('T')[0];

        // Ensure no holiday exists on this Monday
        await query('DELETE FROM holidays WHERE school_id = $1 AND holiday_date = $2', [schoolId, mondayStr]);

        const mondayStatus = await AttendanceCalculator.getDayStatus(schoolId, mondayStr);
        if (mondayStatus.type === 'WORKING') {
            console.log(`✅ [Pass] Working Day Detection (${mondayStr}): DETECTED`);
        } else {
            console.error(`❌ [Fail] Working Day Detection (${mondayStr}): GOT ${mondayStatus.type}`);
        }

        // 5. Test Holiday Detection
        // Create a holiday on that Monday
        await Holiday.create({
            holidayName: 'Test Holiday',
            holidayDate: mondayStr,
            holidayType: 'national'
        }, schoolId);

        const holidayStatus = await AttendanceCalculator.getDayStatus(schoolId, mondayStr);
        if (holidayStatus.type === 'HOLIDAY') {
            console.log(`✅ [Pass] Holiday Detection (${mondayStr}): DETECTED (${holidayStatus.name})`);
        } else {
            console.error(`❌ [Fail] Holiday Detection (${mondayStr}): GOT ${holidayStatus.type}`);
        }

        // Cleanup Holiday
        await query('DELETE FROM holidays WHERE school_id = $1 AND holiday_date = $2', [schoolId, mondayStr]);

        // 6. Test Check-in Status (Late vs Present)
        const settings = await SchoolSettings.findBySchool(schoolId);

        // 8:55 AM (Early/On Time) -> Present
        const timeEarly = new Date(`${mondayStr}T08:55:00`);
        const statusEarly = AttendanceCalculator.calculateCheckInStatus(settings, timeEarly);
        console.log(`TEST 8:55 AM -> ${statusEarly} (Expected: present) [${statusEarly === 'present' ? '✅' : '❌'}]`);

        // 9:10 AM (Within 15m grace) -> Present
        const timeGrace = new Date(`${mondayStr}T09:10:00`);
        const statusGrace = AttendanceCalculator.calculateCheckInStatus(settings, timeGrace);
        console.log(`TEST 9:10 AM -> ${statusGrace} (Expected: present) [${statusGrace === 'present' ? '✅' : '❌'}]`);

        // 9:16 AM (Late) -> Late
        const timeLate = new Date(`${mondayStr}T09:16:00`);
        const statusLate = AttendanceCalculator.calculateCheckInStatus(settings, timeLate);
        console.log(`TEST 9:16 AM -> ${statusLate} (Expected: late) [${statusLate === 'late' ? '✅' : '❌'}]`);

        console.log('\n✨ Verification Complete!');

    } catch (error) {
        console.error('❌ Test Failed:', error);
    } finally {
        await pool.end();
    }
}

runTest();
