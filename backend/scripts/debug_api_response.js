
const { query } = require('../src/config/database');
const AttendanceLog = require('../src/models/AttendanceLog');
const AttendanceCalculator = require('../src/services/attendanceCalculator');

async function debugApiResponse() {
    try {
        console.log('--- START API RESPONSE DEBUG ---');
        const schoolId = 1; // Assuming school ID 1 based on previous logs
        const startDate = '2026-02-01';
        const endDate = '2026-02-28';

        console.log(`Simulating getAttendanceRange for School ${schoolId} (${startDate} to ${endDate})...`);

        // 1. Get raw logs (Mimic controller logic)
        const logs = await AttendanceLog.getLogsForDateRange(schoolId, startDate, endDate);
        console.log(`\n[AttendanceLog.getLogsForDateRange] Returned ${logs.length} logs.`);
        if (logs.length > 0) {
            console.log('Sample Log Item:', JSON.stringify(logs[0], null, 2));
        }

        // 2. Get Calendar Meta (Mimic controller logic)
        const calendarStats = await AttendanceCalculator.generateMonthlyCalendar(schoolId, startDate, endDate, []);

        // Transform to simple map
        const calendarMeta = {};
        calendarStats.forEach(day => {
            if (day.isHoliday) {
                calendarMeta[day.date] = { type: 'HOLIDAY', name: day.name || 'Holiday' };
            } else if (day.isWeekend) {
                calendarMeta[day.date] = { type: 'WEEKEND', name: day.name || 'Weekend' };
            }
        });

        console.log(`\n[Calendar Meta] Generated ${Object.keys(calendarMeta).length} entries.`);
        const dates = Object.keys(calendarMeta).sort().slice(0, 3);
        dates.forEach(d => console.log(`Date ${d}:`, calendarMeta[d]));

        // 3. Construct Final Response Payload
        const responsePayload = {
            logs: logs,
            calendar: calendarMeta
        };

        console.log('\n--- FINAL PAYLOAD STRUCTURE CHECK ---');
        console.log('Required keys present:', {
            hasLogs: Array.isArray(responsePayload.logs),
            hasCalendar: typeof responsePayload.calendar === 'object'
        });

        if (logs.length > 0) {
            const l = logs[0];
            console.log('Log Property Check:', {
                student_id: l.student_id,
                status: l.status,
                date: l.date,
                check_in_time: l.check_in_time,
                created_at: l.created_at
            });
        }

        console.log('--- END API RESPONSE DEBUG ---');
        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err);
        process.exit(1);
    }
}

debugApiResponse();
