# Super Admin Login Credentials

## Default Super Admin Account

**Email:** `admin@school.com`
**Password:** `Admin@123`

---

## Other Super Admin Accounts

You also have these existing superadmin accounts in your database:

1. **Mohammad Askarie**
   - Email: `mohammadaskarie78632@gmail.com`
   - (Use the password you set when creating this account)

2. **Hadi**
   - Email: `hadi@gmail.com`
   - (Use the password you set when creating this account)

---

## How to Login

### Super Admin Panel
1. Open browser: `http://localhost:3002` (or your configured port)
2. Enter email and password
3. Click Login

### API Endpoints
- **Login:** `POST http://localhost:3001/api/v1/auth/login`
- **Body:**
  ```json
  {
    "email": "admin@school.com",
    "password": "Admin@123"
  }
  ```

---

## Change Password

After first login, it's recommended to change your password:
1. Go to Settings > Profile
2. Change Password section
3. Enter current password: `Admin@123`
4. Enter new password (must be at least 8 characters)

---

## Reset Password (If Forgotten)

Run this SQL command to reset any user's password:

```sql
-- Reset to default password: Admin@123
UPDATE users
SET password_hash = '$2a$10$aOMtltxiY.6Bi9JtrvaHvu.EjuFHwjesGIbezChAuTlWqLltEgZla',
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'admin@school.com';
```

Or use this command:
```bash
psql school_attendance -c "UPDATE users SET password_hash = '\$2a\$10\$aOMtltxiY.6Bi9JtrvaHvu.EjuFHwjesGIbezChAuTlWqLltEgZla' WHERE email = 'admin@school.com';"
```

---

## Fixed Issues (2025-11-18)

✅ **Fixed Missing Table Error**: Created `device_user_sync_status` table (migration 012)
✅ **Created Default Superadmin**: Email `admin@school.com` with password `Admin@123`
✅ **Fixed Auth Middleware**: Added `authorize` function and `authenticateToken` alias
✅ **Backend Started Successfully**: Server running on port 3001

---

## Testing Login

```bash
# Test login via curl
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@school.com",
    "password": "Admin@123"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJI...",
    "refreshToken": "eyJhbGciOiJI...",
    "user": {
      "id": 32,
      "email": "admin@school.com",
      "role": "superadmin",
      "fullName": "Super Administrator"
    }
  },
  "message": "Login successful"
}
```
