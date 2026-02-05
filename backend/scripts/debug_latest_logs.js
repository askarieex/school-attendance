
const { query } = require('../src/config/database');

async function debugLatest() {
    try {
        console.log('--- START DEBUG LATEST ---');

        console.log('1. Checking Schools:');
        const schools = await query('SELECT id, name FROM schools');
        console.log(schools.rows);

        console.log('\n2. Checking Latest 5 Logs (Any School):');
        const logs = await query('SELECT id, school_id, date, status, check_in_time FROM attendance_logs ORDER BY date DESC, check_in_time DESC LIMIT 5');
        console.log(logs.rows);

        console.log('\n3. Checking Logs for Today (Feb 5, 2026):');
        const todayLogs = await query("SELECT * FROM attendance_logs WHERE date = '2026-02-05'::date");
        console.log(`Found ${todayLogs.rows.length} logs for today.`);
        if (todayLogs.rows.length > 0) {
            console.log('Sample Today Log:', todayLogs.rows[0]);
        }

        console.log('--- END DEBUG LATEST ---');
        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err);
        process.exit(1);
    }
}

debugLatest();
