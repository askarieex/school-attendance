const { pool } = require('../src/config/database');

async function checkSchema() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'devices'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Devices Table Schema:');
    console.log('========================');
    result.rows.forEach(row => {
      const required = row.is_nullable === 'NO' ? '- REQUIRED' : '';
      console.log(`- ${row.column_name} (${row.data_type}) ${required}`);
    });

    console.log('\n✅ Schema check complete!\n');
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkSchema();
