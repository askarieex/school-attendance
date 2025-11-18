# 📚 Complete Project Documentation - School Attendance System

**Project Name**: School Attendance Management System
**Type**: Multi-tenant SaaS Platform
**Tech Stack**: MERN (MongoDB/PostgreSQL, Express, React, Node.js)
**Date**: October 12, 2025
**Version**: 1.0 (Current) → Planning v2.0

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Current Features](#current-features)
4. [Database Schema](#database-schema)
5. [API Documentation](#api-documentation)
6. [Frontend Applications](#frontend-applications)
7. [Hardware Integration](#hardware-integration)
8. [Authentication & Security](#authentication--security)
9. [Multi-Tenancy](#multi-tenancy)
10. [Future Roadmap](#future-roadmap)

---

## 1. Project Overview

### What is this system?

A **cloud-based school attendance management system** that uses **RFID card readers** to automatically track student attendance. Schools can register, add students, assign RFID cards, and monitor attendance in real-time through web dashboards.

### Key Value Propositions

- **Automated Attendance**: No manual roll calls, instant check-ins via RFID scan
- **Real-time Monitoring**: Live attendance data accessible from anywhere
- **Multi-school Support**: One platform serving multiple schools (SaaS model)
- **Parent Notifications**: SMS alerts when students arrive/leave (planned)
- **Comprehensive Reports**: Analytics, trends, and exportable reports
- **Teacher Integration**: Teachers can view and manage attendance (planned)

### Business Model

**SaaS Subscription**: Schools pay monthly/yearly fees based on:
- Number of students
- Number of devices
- Features enabled (basic, professional, enterprise tiers)

---

## 2. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLOUD BACKEND (Node.js)                  │
│                    Port: 3001                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Express REST API + JWT Auth + Multi-tenancy        │  │
│  │  - Authentication & Authorization                    │  │
│  │  - Student Management                                │  │
│  │  - Attendance Processing                             │  │
│  │  - Reports & Analytics                               │  │
│  │  - Device Management                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database                                 │  │
│  │  - schools, users, students, attendance_logs         │  │
│  │  - devices, settings, notifications                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↕ HTTPS API
    ┌──────────────────────┴──────────────────────┐
    ↓                                              ↓
┌─────────────────────┐              ┌──────────────────────┐
│  SUPER ADMIN PANEL  │              │  SCHOOL DASHBOARD    │
│  Port: 3000         │              │  Ports: 3003, 3004   │
│  React 19           │              │  React 19            │
│                     │              │                      │
│  - Add Schools      │              │  - View Students     │
│  - Manage Schools   │              │  - Add Students      │
│  - View All Data    │              │  - View Attendance   │
│  - System Settings  │              │  - Reports           │
│  - Billing          │              │  - Settings          │
└─────────────────────┘              └──────────────────────┘
                           ↕ HTTPS API
                ┌──────────────────────┐
                │  RFID DEVICE         │
                │  ZKTeco K40 Pro      │
                │                      │
                │  - Scans RFID cards  │
                │  - Sends to backend  │
                │  - Shows feedback    │
                │  - Offline capable   │
                └──────────────────────┘
                           ↕
                    [Student Scan]
```

### Technology Stack

#### Backend
- **Node.js** v18+ - Runtime environment
- **Express.js** v4.18 - Web framework
- **PostgreSQL** v14+ - Primary database
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **node-postgres (pg)** - Database driver
- **dotenv** - Environment configuration
- **cors** - Cross-origin resource sharing

#### Frontend
- **React** v19 - UI framework
- **React Router** v7 - Client-side routing
- **Axios** - HTTP client
- **React Icons** - Icon library
- **CSS3** - Styling

#### Hardware
- **ZKTeco K40 Pro** - RFID card reader
- **TCP/IP Connection** - Device to cloud communication
- **RFID Cards** - 13.56MHz / 125kHz

#### DevOps (Planned)
- **Docker** - Containerization
- **AWS/DigitalOcean** - Cloud hosting
- **Nginx** - Reverse proxy
- **PM2** - Process manager
- **GitHub Actions** - CI/CD

---

## 3. Current Features

### ✅ Implemented Features

#### Super Admin Features
1. **School Management**
   - Create new schools
   - View all schools
   - Edit school details
   - Deactivate schools
   - View school statistics

2. **System Monitoring**
   - Total schools count
   - Total students across all schools
   - System-wide attendance metrics
   - Device status monitoring

#### School Admin Features
1. **Student Management**
   - Add new students (manual entry)
   - Bulk import students (CSV planned)
   - Edit student information
   - Assign RFID cards to students
   - Deactivate students
   - View student attendance history

2. **Dashboard & Attendance**
   - Today's attendance summary
   - Present/Late/Absent counts
   - Attendance rate percentage
   - Recent check-ins list
   - Attendance logs with pagination
   - Filter by date, status, student name

3. **Device Management**
   - Register RFID devices
   - View device status
   - Device assignment to school

4. **Settings**
   - School profile settings
   - Attendance rules configuration
   - Notification preferences

#### RFID Device Features
1. **Attendance Recording**
   - Scan RFID card
   - Instant feedback (beep/LED)
   - Send data to cloud
   - Offline storage capability (device memory)

---

## 4. Database Schema

### Current Tables

#### `schools`
```sql
CREATE TABLE schools (
  id SERIAL PRIMARY KEY,
  school_name VARCHAR(255) NOT NULL,
  school_code VARCHAR(50) UNIQUE NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  principal_name VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  subscription_status VARCHAR(50) DEFAULT 'trial',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `users`
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) NOT NULL, -- 'superadmin', 'school_admin', 'teacher'
  school_id INTEGER REFERENCES schools(id),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `students`
```sql
CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  rfid_card_id VARCHAR(100) UNIQUE,
  grade VARCHAR(20),
  date_of_birth DATE,
  parent_name VARCHAR(255),
  parent_phone VARCHAR(20),
  parent_email VARCHAR(255),
  address TEXT,
  photo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `attendance_logs`
```sql
CREATE TABLE attendance_logs (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id) NOT NULL,
  school_id INTEGER REFERENCES schools(id) NOT NULL,
  device_id INTEGER REFERENCES devices(id),
  check_in_time TIMESTAMP NOT NULL,
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'present', 'late', 'absent'
  sms_sent BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `devices`
```sql
CREATE TABLE devices (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) NOT NULL,
  device_name VARCHAR(255) NOT NULL,
  serial_number VARCHAR(100) UNIQUE NOT NULL,
  device_type VARCHAR(50), -- 'RFID_READER', 'BIOMETRIC'
  ip_address VARCHAR(45),
  location VARCHAR(255), -- 'Main Gate', 'Secondary Entrance'
  is_active BOOLEAN DEFAULT TRUE,
  last_sync TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `school_settings`
```sql
CREATE TABLE school_settings (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) UNIQUE NOT NULL,
  attendance_start_time TIME DEFAULT '08:00:00',
  attendance_end_time TIME DEFAULT '09:00:00',
  late_threshold_minutes INTEGER DEFAULT 15,
  send_parent_sms BOOLEAN DEFAULT FALSE,
  sms_on_arrival BOOLEAN DEFAULT TRUE,
  sms_on_absent BOOLEAN DEFAULT TRUE,
  working_days JSONB DEFAULT '["monday","tuesday","wednesday","thursday","friday"]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. API Documentation

### Base URL
```
http://localhost:3001/api/v1
```

### Authentication Endpoints

#### POST `/auth/login`
Login user and get JWT token.

**Request**:
```json
{
  "email": "askarieex@gmail.com",
  "password": "password123"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 2,
      "email": "askarieex@gmail.com",
      "role": "school_admin",
      "schoolId": 1,
      "fullName": "Askarieex"
    },
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
}
```

#### GET `/auth/me`
Get current logged-in user details.

**Headers**: `Authorization: Bearer [token]`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 2,
    "email": "askarieex@gmail.com",
    "role": "school_admin",
    "fullName": "Askarieex",
    "schoolId": 1
  }
}
```

### School Admin Endpoints

#### GET `/school/students`
Get all students for the school with pagination and filters.

**Headers**: `Authorization: Bearer [token]`

**Query Params**:
- `page` (default: 1)
- `limit` (default: 10)
- `grade` (optional)
- `status` (optional: 'active', 'inactive')
- `search` (optional: search by name or RFID)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "full_name": "John Smith",
      "rfid_card_id": "RFID001",
      "grade": "10",
      "parent_name": "Mr. Smith",
      "parent_phone": "123-456-7890",
      "is_active": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

#### POST `/school/students`
Create a new student.

**Headers**: `Authorization: Bearer [token]`

**Request**:
```json
{
  "fullName": "Jane Doe",
  "rfidCardId": "RFID006",
  "grade": "11",
  "dateOfBirth": "2008-05-15",
  "parentName": "Mrs. Doe",
  "parentPhone": "123-456-7890",
  "parentEmail": "doe@example.com",
  "address": "123 Main St"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Student created successfully",
  "data": {
    "id": 6,
    "full_name": "Jane Doe",
    "rfid_card_id": "RFID006",
    "school_id": 1,
    "created_at": "2025-10-12T15:30:00.000Z"
  }
}
```

#### GET `/school/attendance`
Get attendance logs with pagination and filters.

**Headers**: `Authorization: Bearer [token]`

**Query Params**:
- `page` (default: 1)
- `limit` (default: 20)
- `date` (optional: YYYY-MM-DD)
- `status` (optional: 'present', 'late', 'absent')
- `search` (optional: student name or RFID)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "date": "2025-10-12",
      "check_in_time": "2025-10-12T07:15:00.000Z",
      "check_out_time": null,
      "status": "present",
      "student_name": "John Smith",
      "rfid_uid": "RFID001",
      "grade": "10",
      "device_name": "Main Gate Reader"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

#### GET `/school/stats/dashboard`
Get today's attendance statistics.

**Headers**: `Authorization: Bearer [token]`

**Response**:
```json
{
  "success": true,
  "data": {
    "presentToday": 4,
    "lateToday": 1,
    "totalStudents": 5,
    "absentToday": 0,
    "attendanceRate": "100.00"
  }
}
```

#### GET `/school/reports/attendance`
Generate attendance report for date range.

**Headers**: `Authorization: Bearer [token]`

**Query Params**:
- `startDate` (required: YYYY-MM-DD)
- `endDate` (required: YYYY-MM-DD)
- `grade` (optional)
- `status` (optional)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "student_id": 1,
      "full_name": "John Smith",
      "grade": "10",
      "date": "2025-10-12",
      "check_in_time": "2025-10-12T07:15:00.000Z",
      "status": "present"
    }
  ]
}
```

### Device API Endpoints

#### POST `/device/checkin`
Record student check-in from RFID device.

**Headers**: `X-Device-Serial: [device_serial_number]`

**Request**:
```json
{
  "rfidCardId": "RFID001",
  "timestamp": "2025-10-12T07:15:00.000Z"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Check-in recorded successfully",
  "data": {
    "studentName": "John Smith",
    "status": "present",
    "checkInTime": "2025-10-12T07:15:00.000Z"
  }
}
```

---

## 6. Frontend Applications

### Application Structure

```
project-root/
├── super-admin-panel/          # Port 3000
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.js
│   │   │   ├── SchoolCard.js
│   │   │   └── StatCard.js
│   │   ├── pages/
│   │   │   ├── Dashboard.js
│   │   │   ├── Schools.js
│   │   │   ├── Login.js
│   │   │   └── Settings.js
│   │   ├── contexts/
│   │   │   └── AuthContext.js
│   │   ├── utils/
│   │   │   └── api.js
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
│
└── school-dashboard/           # Ports 3003, 3004
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.js
    │   │   ├── StudentTable.js
    │   │   └── AttendanceTable.js
    │   ├── pages/
    │   │   ├── Dashboard.js
    │   │   ├── Students.js
    │   │   ├── Attendance.js
    │   │   ├── Reports.js
    │   │   ├── Settings.js
    │   │   └── Login.js
    │   ├── contexts/
    │   │   └── AuthContext.js
    │   ├── utils/
    │   │   └── api.js
    │   ├── App.js
    │   └── index.js
    └── package.json
```

### School Dashboard Pages

#### Dashboard (`/`)
- Today's statistics cards:
  - Total Students
  - Present Today (with percentage)
  - Absent Today (with percentage)
  - Late Today (with percentage)
- Quick action buttons
- Recent check-ins list

#### Students (`/students`)
- List all students in a table
- Search and filter functionality
- Add new student button
- Edit student details
- Deactivate student
- View student attendance history

#### Attendance (`/attendance`)
- Attendance logs table with pagination
- Filter by date, status, student name
- Export to CSV button
- Manual attendance marking (planned)

#### Reports (`/reports`)
- Date range selector
- Attendance report generation
- Analytics charts (planned)
- Export options

#### Settings (`/settings`)
- School profile
- Attendance timing rules
- Notification preferences
- Device management

---

## 7. Hardware Integration

### ZKTeco K40 Pro Setup

#### Device Specifications
- **Model**: ZKTeco K40 Pro
- **Type**: RFID Card Reader
- **Card Types**: 13.56MHz / 125kHz RFID
- **Connection**: TCP/IP (Ethernet)
- **Storage**: 30,000 cards (offline capacity)
- **Display**: LCD screen
- **Feedback**: LED lights, beep sounds

#### Connection Flow

1. **Device Registration**
   - Admin registers device in dashboard
   - Device gets unique serial number in database
   - Device IP address configured to point to backend API

2. **Card Scan Process**
   ```
   Student Scans Card
         ↓
   Device reads RFID UID
         ↓
   Device checks local memory (offline mode)
         ↓
   Device shows immediate feedback (beep + LED)
         ↓
   Device sends data to backend API (background)
         ↓
   Backend validates device serial number
         ↓
   Backend finds student by RFID card ID
         ↓
   Backend checks attendance rules
         ↓
   Backend records attendance log
         ↓
   Backend sends confirmation to device
         ↓
   Device stores confirmation
   ```

3. **Offline Capability**
   - Device stores last 30,000 scans locally
   - When internet connection restored, syncs all pending scans
   - Backend handles duplicate prevention

#### Backend Device Handler

Located in: `backend/src/controllers/deviceController.js`

```javascript
const handleCheckIn = async (req, res) => {
  const deviceSerial = req.headers['x-device-serial'];
  const { rfidCardId, timestamp } = req.body;

  // 1. Verify device exists and is active
  const device = await Device.findBySerial(deviceSerial);
  if (!device || !device.is_active) {
    return sendError(res, 'Unauthorized device', 401);
  }

  // 2. Find student by RFID card
  const student = await Student.findByRfid(rfidCardId);
  if (!student) {
    return sendError(res, 'Student not found', 404);
  }

  // 3. Check if already checked in today
  const existing = await AttendanceLog.existsToday(student.id, today);
  if (existing) {
    return sendError(res, 'Already checked in today', 409);
  }

  // 4. Get school settings
  const settings = await SchoolSettings.get(device.school_id);

  // 5. Determine status (present/late)
  const status = calculateStatus(timestamp, settings);

  // 6. Record attendance
  const log = await AttendanceLog.create({
    studentId: student.id,
    schoolId: device.school_id,
    deviceId: device.id,
    checkInTime: timestamp,
    status: status,
    date: today
  });

  // 7. Send parent SMS (if enabled)
  if (settings.send_parent_sms) {
    await sendSMS(student.parent_phone, `${student.full_name} arrived at ${timestamp}`);
  }

  return sendSuccess(res, { studentName: student.full_name, status }, 'Check-in recorded');
};
```

---

## 8. Authentication & Security

### JWT Token System

#### Token Generation
```javascript
const jwt = require('jsonwebtoken');

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    {
      userId: user.id,
      role: user.role,
      schoolId: user.school_id
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};
```

#### Token Verification Middleware
```javascript
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return sendError(res, 'No token provided', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return sendError(res, 'Invalid or expired token', 401);
  }
};
```

### Role-Based Access Control (RBAC)

#### User Roles
1. **superadmin**
   - Access to all schools
   - System-wide settings
   - School creation/management
   - Billing management

2. **school_admin**
   - Access only to their school data
   - Student management
   - Attendance viewing
   - School settings

3. **teacher** (planned)
   - Access only to assigned classes
   - View attendance
   - Manual attendance marking
   - Student information (read-only)

#### Authorization Middleware
```javascript
const requireSchoolAdmin = (req, res, next) => {
  if (req.user.role !== 'school_admin' && req.user.role !== 'superadmin') {
    return sendError(res, 'Access denied. School admin role required.', 403);
  }
  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'superadmin') {
    return sendError(res, 'Access denied. Super admin role required.', 403);
  }
  next();
};
```

### Password Security
- **bcryptjs** with salt rounds = 10
- Passwords never stored in plain text
- Password reset via email (planned)

---

## 9. Multi-Tenancy

### Implementation Strategy

**Row-Level Security**: Each database row includes `school_id` foreign key. All queries are automatically filtered by school ID.

#### Multi-Tenancy Middleware

Located in: `backend/src/middleware/multiTenant.js`

```javascript
const enforceSchoolTenancy = (req, res, next) => {
  // Super admins can access any school
  if (req.user.role === 'superadmin') {
    return next();
  }

  // School admins and teachers can only access their school
  if (!req.user.schoolId) {
    return sendError(res, 'No school assigned to user', 403);
  }

  // Inject school ID into request for automatic filtering
  req.tenantSchoolId = req.user.schoolId;
  next();
};
```

#### Usage in Controllers

```javascript
const getStudents = async (req, res) => {
  const schoolId = req.tenantSchoolId; // Automatically set by middleware

  const students = await Student.findAll(schoolId);
  // Students from other schools are never accessible

  sendSuccess(res, students);
};
```

### Data Isolation

```
School A (schoolId: 1)        School B (schoolId: 2)
├── Students (1-100)          ├── Students (101-200)
├── Attendance Logs           ├── Attendance Logs
├── Devices                   ├── Devices
└── Settings                  └── Settings

❌ School A cannot access School B data
❌ School B cannot access School A data
✅ Super Admin can access both
```

---

## 10. Future Roadmap

See the detailed **FEATURE_ROADMAP.md** for complete future plans including:
- Classes & Sections management
- Teacher management system
- Teacher mobile app
- Manual attendance marking
- SMS notifications
- Advanced reporting
- And much more...

---

## 📞 Support & Maintenance

### Current System Health
- ✅ All APIs working
- ✅ Frontend applications operational
- ✅ Database connected and optimized
- ✅ Authentication secure
- ✅ Multi-tenancy enforced

### Known Limitations
- Check-out time not implemented (only check-in)
- No mobile app yet
- No SMS integration yet
- No bulk student import (CSV)
- No export to PDF

### How to Debug Issues

1. **Backend Logs**
   ```bash
   cd backend && npm run dev
   # Watch terminal for error messages
   ```

2. **Database Queries**
   ```bash
   psql -U postgres -d school_attendance
   \dt  # List all tables
   SELECT * FROM students WHERE school_id = 1;
   ```

3. **API Testing**
   ```bash
   # Test login
   curl -X POST http://localhost:3001/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"askarieex@gmail.com","password":"password123"}'

   # Test with token
   curl -X GET http://localhost:3001/api/v1/school/students \
     -H "Authorization: Bearer [YOUR_TOKEN]"
   ```

---

## 🎓 Learning Resources

### For Developers Working on This Project

**Backend**:
- Node.js + Express: https://expressjs.com/
- PostgreSQL: https://www.postgresql.org/docs/
- JWT: https://jwt.io/introduction

**Frontend**:
- React 19: https://react.dev/
- React Router: https://reactrouter.com/
- Axios: https://axios-http.com/

**DevOps**:
- Docker: https://docs.docker.com/
- PM2: https://pm2.keymetrics.io/

---

**Document Version**: 1.0
**Last Updated**: October 12, 2025
**Status**: ✅ Complete and accurate as of current implementation
