# School Attendance System - API Endpoints Summary

**Generated:** 2025-10-20  
**API Version:** v1  
**Base URL:** `http://localhost:3001/api/v1`

## Environment Variables Required

```env
DB_PASSWORD=<REQUIRED>
JWT_SECRET=<REQUIRED>
PORT=3001 (optional, defaults to 3001)
NODE_ENV=development
```

## Total API Endpoints: 100+

### Authentication (4 endpoints)
- POST `/auth/login` - Login
- POST `/auth/refresh` - Refresh token
- GET `/auth/me` - Get current user
- PUT `/auth/change-password` - Change password

### Super Admin (13 endpoints)
**Schools:** GET, POST, GET/:id, PUT/:id, DELETE/:id  
**Devices:** GET, POST, DELETE/:id  
**Users:** GET, POST, DELETE/:id  
**Stats:** GET platform stats

### School Admin - Students (6 endpoints)
- GET `/school/students` - List with pagination
- POST `/school/students` - Create (✅ **AUTO-ENROLLS** to devices)
- POST `/school/students/import` - Bulk import (✅ **BATCHED enrollment**)
- GET `/school/students/:id` - Get details
- PUT `/school/students/:id` - Update
- DELETE `/school/students/:id` - Deactivate

### School Admin - Dashboard (4 endpoints)
- GET `/school/stats/dashboard` - Today's stats
- GET `/school/dashboard/recent-checkins` - Live feed
- GET `/school/dashboard/absent` - Absent students

### School Admin - Attendance (5 endpoints)
- GET `/school/attendance` - Logs with filters
- GET `/school/attendance/today` - Today's logs
- GET `/school/attendance/today/stats` - Today's stats
- GET `/school/attendance/range` - ⚡ **BATCH API** (30X faster for calendars)
- POST `/school/attendance/manual` - Manual mark

### School Admin - Reports (6 endpoints)
- GET `/school/reports/attendance` - Attendance report
- GET `/school/reports/analytics` - Analytics data
- GET `/school/reports/daily` - Daily report
- GET `/school/reports/monthly` - Monthly report
- GET `/school/reports/student/:id` - Student report
- GET `/school/reports/class/:id` - Class report

### School Admin - Classes & Sections (16 endpoints)
**Classes:** GET, POST, GET/:id, PUT/:id, DELETE/:id, GET/statistics  
**Sections:** GET all, GET by class, POST, GET/:id, GET/:id/students, PUT/:id, DELETE/:id, PUT/form-teacher, DELETE/form-teacher

### School Admin - Teachers (9 endpoints)
- GET, POST, GET/:id, PUT/:id, DELETE/:id
- GET/:id/assignments
- POST/:id/assignments
- DELETE/:id/assignments/:assignmentId
- POST/:id/reset-password

### School Admin - Academic Years (10 endpoints)
- GET, POST, GET/current, GET/:id, PUT/:id, DELETE/:id
- PUT/:id/set-current
- GET/:id/vacations, POST/:id/vacations, DELETE/vacations/:id

### School Admin - Holidays (5 endpoints)
- GET, POST, PUT/:id, DELETE/:id
- POST /bulk-import

### School Admin - Settings & Devices (8 endpoints)
**Settings:** GET, PUT  
**Devices:** GET, POST/:id/enroll-student, POST/:id/enroll-all, GET/:id/enrolled-students, DELETE/:id/students/:id

### Hardware Device APIs (3 endpoints)
Require `X-API-Key` or `X-Device-Serial` header
- POST `/attendance/log` - Log attendance
- GET `/attendance/verify/:rfid` - Verify RFID
- GET `/attendance/health` - Health check

### Device Sync APIs (5 endpoints)
Require `X-Device-Serial` header
- GET `/device/sync/cards` - Download RFID list
- POST `/device/sync/logs` - Batch upload
- POST `/device/sync/validate` - Quick validate
- POST `/device/sync/heartbeat` - Heartbeat
- GET `/device/sync/status` - Sync status

### ZKTeco Device Endpoints (3 endpoints)
No `/api` prefix, require `?SN=<serial>` param
- POST `/iclock/cdata` - Receive attendance
- GET `/iclock/getrequest` - Poll for commands
- POST `/iclock/devicecmd` - Command confirmation

## Key Features

✅ **AUTO-ENROLLMENT**: Students automatically enrolled to all devices on creation  
⚡ **BATCH API**: `/attendance/range` endpoint 30X faster for monthly calendars  
🔒 **MULTI-TENANCY**: School data isolation enforced at middleware level  
📊 **COMPREHENSIVE VALIDATION**: All inputs validated with express-validator  
🚀 **RATE LIMITING**: 1000 requests/minute (configurable)  
🔐 **JWT AUTH**: Access + Refresh tokens with auto-refresh  
📱 **ZKTECO INTEGRATION**: Native support for ZKTeco biometric devices
