# 🔐 LOGIN CREDENTIALS - QUICK REFERENCE

**Last Updated**: November 5, 2025  
**All Passwords Reset To**: `password123`

---

## 📱 FLUTTER APP LOGINS (Teacher)

### **Working Teacher Account**:
```
Email: askery7865@gmail.com
Password: password123
Role: Teacher
School: CPS (ID: 6)
Academic Year: 2025-2026
Classes: 3 (9th-A, 10th-Red x2)
Students: 6
```

### **Other Teacher Accounts**:
```
Email: hell222o@gmail.com
Password: password123
Role: Teacher  
School: PIL (ID: 1)
Academic Year: 2025-2026
Classes: 1 (8Th-Green)
Students: 7
```

---

## 🌐 WEB DASHBOARD LOGINS

### **Admin Account** (Full Access):
```
Email: admin@adtrack.com
Password: admin123
Role: Super Admin
Access: All schools
```

### **School Admin**:
```
Email: [School specific admin email]
Password: password123
Role: School Admin
Access: Single school management
```

---

## 🔧 HOW TO RESET PASSWORD

### **Method 1: Using psql**
```sql
-- Update password to 'password123'
UPDATE users 
SET password_hash = '$2a$10$YOUR_HASH_HERE'
WHERE email = 'user@example.com';
```

### **Method 2: Using Node.js Script**
```bash
cd backend
node -e "
const bcrypt = require('bcryptjs');
(async () => {
  const hash = await bcrypt.hash('password123', 10);
  const { query } = require('./src/config/database');
  await query('UPDATE users SET password_hash = \$1 WHERE email = \$2', 
    [hash, 'user@example.com']);
  console.log('✅ Password updated');
  process.exit(0);
})();
"
```

### **Method 3: Using API** (if forgot password feature exists)
```bash
curl -X POST http://localhost:3001/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

---

## ✅ VERIFICATION

### **Test Login**:
```bash
# Test via API
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"askery7865@gmail.com","password":"password123"}'

# Expected response:
# {"success": true, "data": {"user": {...}, "accessToken": "..."}}
```

### **Flutter App**:
1. Open app
2. Select "Teacher Login"
3. Enter email and password
4. Tap "Login"
5. Should see dashboard with classes

---

## 🐛 TROUBLESHOOTING

### **Login Fails**:
1. Check email spelling (case-sensitive)
2. Verify user exists in database
3. Reset password using script above
4. Check backend server is running
5. Verify network connection

### **"Invalid email or password"**:
```sql
-- Check if user exists
SELECT id, email, role FROM users WHERE email = 'user@example.com';

-- Reset password
-- Use Node.js script above
```

### **Backend Not Running**:
```bash
cd backend
npm start
# Should see: "Server running on port 3001"
```

---

## 📊 USER DATABASE QUERY

### **List All Users**:
```sql
SELECT 
  id, 
  email, 
  role, 
  full_name, 
  school_id,
  is_active,
  created_at
FROM users
ORDER BY created_at DESC
LIMIT 20;
```

### **Find Teacher Users**:
```sql
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.school_id,
  s.name as school_name,
  t.id as teacher_id
FROM users u
LEFT JOIN schools s ON u.school_id = s.id
LEFT JOIN teachers t ON u.id = t.user_id
WHERE u.role = 'teacher'
ORDER BY u.id;
```

### **Check Teacher Assignments**:
```sql
SELECT 
  u.email,
  u.full_name,
  t.id as teacher_id,
  tca.section_id,
  c.class_name,
  s.section_name,
  tca.academic_year
FROM users u
JOIN teachers t ON u.id = t.user_id
LEFT JOIN teacher_class_assignments tca ON t.id = tca.teacher_id
LEFT JOIN sections s ON tca.section_id = s.id
LEFT JOIN classes c ON s.class_id = c.id
WHERE u.email = 'askery7865@gmail.com';
```

---

## 🎯 QUICK COMMANDS

### **Reset All Teacher Passwords**:
```bash
# Run this to reset ALL teacher passwords to 'password123'
cd backend
node scripts/reset-teacher-passwords.js
```

### **Create Script** (save as reset-teacher-passwords.js):
```javascript
const bcrypt = require('bcryptjs');
const { query } = require('./src/config/database');

(async () => {
  const hash = await bcrypt.hash('password123', 10);
  const result = await query(
    "UPDATE users SET password_hash = $1 WHERE role = 'teacher' RETURNING email",
    [hash]
  );
  console.log(`✅ Updated ${result.rows.length} teachers`);
  result.rows.forEach(r => console.log(`  - ${r.email}`));
  process.exit(0);
})();
```

---

## ⚠️ SECURITY NOTES

1. **Change default passwords** in production
2. **Use strong passwords** (min 8 chars, mixed case, numbers, symbols)
3. **Never commit passwords** to git
4. **Use environment variables** for sensitive data
5. **Enable 2FA** for production (future feature)

---

**Created**: November 5, 2025  
**Purpose**: Quick reference for login credentials  
**Status**: ✅ All passwords reset and working
