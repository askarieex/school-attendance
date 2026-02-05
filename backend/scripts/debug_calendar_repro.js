
const { query } = require('../src/config/database');
const AttendanceLog = require('../src/models/AttendanceLog');

async function debugCalendar() {
    try {
        console.log('--- START DEBUG ---');
        const schoolId = 1; // Assuming school ID 1
        const startDate = '2026-02-01';
        const endDate = '2026-02-28';

        console.log(`Fetching logs for School ${schoolId} from ${startDate} to ${endDate}...`);

        const logs = await AttendanceLog.getLogsForDateRange(schoolId, startDate, endDate);

        console.log(`Found ${logs.length} logs.`);

        if (logs.length > 0) {
            console.log('Sample Log:', JSON.stringify(logs[0], null, 2));

            // Count statuses
            const counts = logs.reduce((acc, log) => {
                acc[log.status] = (acc[log.status] || 0) + 1;
                return acc;
            }, {});
            console.log('Status Counts:', counts);
        } else {
            console.log('⚠️ No logs found! Checking DB directly...');
            const directCheck = await query('SELECT * FROM attendance_logs WHERE school_id = $1 LIMIT 5', [schoolId]);
            console.log('Direct DB Check (First 5 logs):', directCheck.rows);
        }

        console.log('--- END DEBUG ---');
        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err);
        process.exit(1);
    }
}

debugCalendar();
