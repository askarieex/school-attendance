-- Create superadmin user
-- Email: admin@school.com
-- Password: Admin@123

INSERT INTO users (email, password_hash, role, full_name, is_active, created_at, updated_at)
VALUES (
  'admin@school.com',
  '$2b$10$rT8EqJ5Z2kW8qF3N1gH7/.xMVYJ.YZQqX0YzK0pZ.6VqL9tJ5.vZe',
  'superadmin',
  'Super Administrator',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;
