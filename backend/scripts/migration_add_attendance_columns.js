const { pool, query } = require('../src/config/database');

async function runMigration() {
    try {
        console.log('🔄 Starting Schema Migration...');

        // 1. Add weekly_holiday if missing
        console.log('Checking weekly_holiday...');
        try {
            await query(`ALTER TABLE school_settings ADD COLUMN weekly_holiday VARCHAR(20) DEFAULT 'Sunday'`);
            console.log('✅ Added column: weekly_holiday');
        } catch (e) {
            if (e.code === '42701') { // duplicate_column
                console.log('ℹ️  Column weekly_holiday already exists');
            } else {
                throw e;
            }
        }

        // 2. Add working_days if missing
        console.log('Checking working_days...');
        try {
            await query(`ALTER TABLE school_settings ADD COLUMN working_days VARCHAR(20) DEFAULT 'Mon-Sat'`);
            console.log('✅ Added column: working_days');
        } catch (e) {
            if (e.code === '42701') {
                console.log('ℹ️  Column working_days already exists');
            } else {
                throw e;
            }
        }

        // 3. Add is_recurring to holidays if missing
        console.log('Checking holidays.is_recurring...');
        try {
            await query(`ALTER TABLE holidays ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE`);
            console.log('✅ Added column: holidays.is_recurring');
        } catch (e) {
            if (e.code === '42701') {
                console.log('ℹ️  Column holidays.is_recurring already exists');
            } else {
                throw e;
            }
        }

        console.log('✨ Migration Complete!');
    } catch (error) {
        console.error('❌ Migration Failed:', error);
    } finally {
        await pool.end();
    }
}

runMigration();
