const bcrypt = require('bcryptjs');
const { query } = require('./src/config/database');

async function resetPassword() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const result = await query(
    'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING email, role',
    [hashedPassword, 'askarieex@gmail.com']
  );
  console.log('Password reset for:', result.rows[0]);
  process.exit(0);
}

resetPassword().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
