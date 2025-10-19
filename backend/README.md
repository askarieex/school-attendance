# School Attendance System - Backend API

A complete multi-tenant SaaS backend for school attendance management with RFID integration.

## 🚀 Features

- **Multi-tenant Architecture**: Complete data isolation using school_id
- **Role-based Access Control**: Super Admin and School Admin roles
- **JWT Authentication**: Secure, stateless authentication
- **RFID Device Integration**: Hardware device API for attendance logging
- **Real-time Dashboard**: Live attendance statistics
- **Comprehensive Reporting**: Date-range reports and analytics
- **RESTful API**: Clean, versioned API endpoints
- **PostgreSQL Database**: Robust, scalable data storage
- **Security**: Helmet, CORS, rate limiting, password hashing

## 📋 Prerequisites

- Node.js >= 16.0.0
- PostgreSQL >= 12
- npm >= 8.0.0

## ⚙️ Installation

1. **Clone the repository**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure your database and JWT settings:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=school_attendance
   DB_USER=postgres
   DB_PASSWORD=your_password
   JWT_SECRET=your_secret_key
   ```

4. **Create PostgreSQL database**
   ```bash
   # Connect to PostgreSQL
   psql -U postgres

   # Create database
   CREATE DATABASE school_attendance;
   \q
   ```

5. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

6. **Start the server**
   ```bash
   # Development mode (with nodemon)
   npm run dev

   # Production mode
   npm start
   ```

The server will start on `http://localhost:5000`

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js          # PostgreSQL connection pool
│   │   └── migrate.js            # Database migration script
│   ├── middleware/
│   │   ├── auth.js               # JWT authentication
│   │   ├── multiTenant.js        # Multi-tenancy enforcement
│   │   ├── errorHandler.js       # Global error handling
│   │   └── validator.js          # Request validation
│   ├── models/
│   │   ├── School.js             # School model
│   │   ├── User.js               # User model
│   │   ├── Student.js            # Student model
│   │   ├── Device.js             # Device model
│   │   ├── AttendanceLog.js      # Attendance log model
│   │   └── SchoolSettings.js     # School settings model
│   ├── controllers/
│   │   ├── authController.js     # Authentication logic
│   │   ├── superAdminController.js
│   │   ├── schoolController.js
│   │   └── attendanceController.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── superAdmin.routes.js
│   │   ├── school.routes.js
│   │   └── attendance.routes.js
│   ├── utils/
│   │   ├── auth.js               # Password hashing, JWT utils
│   │   └── response.js           # Standard API responses
│   └── server.js                 # Main application entry
├── package.json
├── .env.example
└── README.md
```

## 🔌 API Endpoints

### Authentication (`/api/v1/auth`)
- `POST /login` - Login (both Super Admin & School Admin)
- `POST /refresh` - Refresh access token
- `GET /me` - Get current user info (protected)
- `PUT /change-password` - Change password (protected)

### Super Admin (`/api/v1/super`)
**All require Super Admin authentication**

#### Schools
- `GET /schools` - List all schools
- `POST /schools` - Create new school
- `GET /schools/:id` - Get school details
- `PUT /schools/:id` - Update school
- `DELETE /schools/:id` - Deactivate school

#### Devices
- `GET /devices` - List all devices
- `POST /devices` - Create device (generate API key)
- `DELETE /devices/:id` - Deactivate device

#### Users
- `GET /users` - List all users
- `POST /users` - Create user
- `DELETE /users/:id` - Deactivate user

#### Statistics
- `GET /stats` - Platform-wide statistics

### School Admin (`/api/v1/school`)
**All require School Admin authentication + multi-tenancy enforcement**

#### Students
- `GET /students` - List students (auto-filtered by school)
- `POST /students` - Add student
- `POST /students/import` - Bulk import students (CSV)
- `GET /students/:id` - Get student details
- `PUT /students/:id` - Update student
- `DELETE /students/:id` - Deactivate student

#### Dashboard
- `GET /dashboard/today` - Today's attendance stats
- `GET /dashboard/recent-checkins` - Recent check-ins
- `GET /dashboard/absent` - Absent students today

#### Reports
- `GET /reports/attendance?startDate=X&endDate=Y` - Attendance report
- `GET /reports/analytics?startDate=X&endDate=Y` - Analytics data

#### Settings
- `GET /settings` - Get school settings
- `PUT /settings` - Update school settings
- `GET /devices` - List school's devices

### Hardware Device (`/api/v1/attendance`)
**All require device API key (X-API-Key header)**

- `POST /log` - Log attendance scan
- `GET /verify/:rfid` - Verify RFID card
- `GET /health` - Device health check

## 🔐 Authentication

### For Web Dashboards (Super Admin & School Admin)

1. **Login**
   ```bash
   POST /api/v1/auth/login
   {
     "email": "admin@example.com",
     "password": "password123"
   }
   ```

   Response:
   ```json
   {
     "success": true,
     "data": {
       "user": { ... },
       "accessToken": "eyJhbGci...",
       "refreshToken": "eyJhbGci..."
     }
   }
   ```

2. **Use Access Token**
   ```bash
   Authorization: Bearer eyJhbGci...
   ```

### For Hardware Devices

Use the API key in the header:
```bash
X-API-Key: device-uuid-here
```

## 🧪 Testing

### Manual Testing with cURL

#### Login
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

#### Get Students (School Admin)
```bash
curl -X GET http://localhost:5000/api/v1/school/students \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Log Attendance (Device)
```bash
curl -X POST http://localhost:5000/api/v1/attendance/log \
  -H "X-API-Key: DEVICE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"rfidCardId":"ABC123456"}'
```

## 📊 Database Schema

- **schools**: School accounts
- **users**: Super admins and school admins
- **students**: Student records (multi-tenant)
- **devices**: RFID hardware devices
- **attendance_logs**: Attendance records
- **school_settings**: School-specific configurations
- **audit_logs**: System audit trail

## 🔒 Security Features

- **Password Hashing**: bcrypt with salt rounds 12
- **JWT Tokens**: Short-lived access tokens (15min) + refresh tokens (7 days)
- **Multi-tenancy**: Automatic school_id filtering
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Helmet**: Security headers
- **CORS**: Configurable allowed origins
- **Input Validation**: Request validation middleware
- **SQL Injection Protection**: Parameterized queries

## 🐛 Error Handling

All errors return consistent format:
```json
{
  "success": false,
  "message": "Error description",
  "errors": null,
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

## 📝 Development

### Create First Super Admin

After migration, manually create the first super admin:

```sql
-- Connect to database
psql -U postgres -d school_attendance

-- Insert super admin (password: admin123)
INSERT INTO users (email, password_hash, role, full_name)
VALUES (
  'superadmin@example.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqBk0yBJ3G',
  'superadmin',
  'Super Administrator'
);
```

### Common Commands

```bash
# Start development server
npm run dev

# Run database migration
npm run db:migrate

# Check logs
tail -f logs/app.log
```

## 🚢 Deployment

### Environment Variables for Production

```env
NODE_ENV=production
PORT=5000
DB_HOST=your-db-host
DB_PASSWORD=strong-password
JWT_SECRET=very-strong-secret-key
ALLOWED_ORIGINS=https://your-super-admin.com,https://your-school-portal.com
```

### Deploy to AWS/Heroku/DigitalOcean

1. Set environment variables
2. Run migrations: `npm run db:migrate`
3. Start server: `npm start`

## 📚 Documentation

For detailed API documentation, import the Postman collection or use the interactive docs (coming soon).

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request

## 📄 License

MIT

## 👨‍💻 Author

Your Name

---

**Need Help?** Open an issue or contact support@example.com
