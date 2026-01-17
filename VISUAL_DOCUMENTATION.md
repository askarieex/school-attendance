# 🏫 School Attendance Management System
## Complete Visual Documentation for Development Team

---

# 📊 System Architecture

![System Architecture](/Users/askerymalik/Documents/Development/school-attendance-sysytem/diagrams/system_architecture_1767593936191.png)

### Components Overview

| Layer | Component | Technology | Description |
|-------|-----------|------------|-------------|
| **Hardware** | RFID Devices | ZKTeco K40 Pro | Physical card readers at school gates |
| **Backend** | API Server | Node.js + Express | REST API handling all business logic |
| **Backend** | Database | PostgreSQL | All data storage with connection pooling |
| **Backend** | Services | Node.js + Cron | Auto-absence, sync, notifications |
| **Notifications** | SMS | Twilio | Parent notifications |
| **Notifications** | WhatsApp | WhatsApp API | Rich message templates |
| **Frontend** | School Dashboard | React.js | Admin interface for schools |
| **Frontend** | Super Admin | React.js | Platform management |
| **Frontend** | Mobile App | Flutter | Teacher & parent app |

---

# 🔄 RFID Attendance Flow

![RFID Attendance Flow](/Users/askerymalik/Documents/Development/school-attendance-sysytem/diagrams/rfid_attendance_flow_1767593959492.png)

### Step-by-Step Process

```
1. STUDENT ARRIVAL
   └── Student swipes RFID card at school gate device

2. DEVICE COMMUNICATION  
   └── ZKTeco device sends POST request to /iclock/cdata
   └── Data includes: rfid_uid, timestamp, device_serial

3. BACKEND PROCESSING
   └── API receives attendance punch
   └── Queries database: Find student by rfid_uid
   └── Check: Has student already checked in today?

4. DECISION BRANCHING
   ├── FIRST CHECK-IN (Morning)
   │   └── Create attendance_log record
   │   └── Compare time vs school_start_time
   │   └── If (check_in > school_start_time + late_threshold)
   │       └── Mark as LATE
   │       └── Queue SMS to parent
   │
   └── ALREADY CHECKED-IN (Afternoon)
       └── Update check_out_time in existing record

5. RESPONSE
   └── Return 200 OK to device
```

### RFID Data Format (iclock Protocol)

```
POST /iclock/cdata?SN=ABC123&table=ATTLOG&Stamp=1234

Body:
1234567890    2025-01-05 08:30:15    0    0
[rfid_uid]    [timestamp]          [type] [status]
```

---

# ⏰ Auto-Absence Detection System

![Auto Absence Detection](/Users/askerymalik/Documents/Development/school-attendance-sysytem/diagrams/auto_absence_flow_1767593981920.png)

### Scheduled Job Details

| Setting | Value |
|---------|-------|
| Schedule | Daily at 11:00 AM |
| Trigger | node-cron scheduled task |
| File | `src/services/autoAbsenceDetection.js` |

### Process Flow

```
┌─────────────────────────────────────────────────────────────┐
│ CRON JOB: 11:00 AM Daily                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Get all ACTIVE students from database                   │
│     SELECT * FROM students WHERE is_active = true           │
│                                                             │
│  2. Get today's attendance logs                             │
│     SELECT * FROM attendance_logs WHERE date = TODAY        │
│                                                             │
│  3. Compare lists                                           │
│     absent_students = active_students - checked_in_students │
│                                                             │
│  4. For each absent student:                                │
│     ├── Create attendance record (status = 'absent')        │
│     ├── Queue SMS notification                              │
│     └── Queue WhatsApp message (if enabled)                 │
│                                                             │
│  5. Send all notifications via Twilio/WhatsApp              │
│     Message: "Dear Parent, your child [name] was absent     │
│              from school today [date]."                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 🗄 Database Schema

![Database Schema](/Users/askerymalik/Documents/Development/school-attendance-sysytem/diagrams/database_schema_1767594006690.png)

### Core Tables

#### `schools`
```sql
CREATE TABLE schools (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    school_start_time TIME DEFAULT '08:30:00',
    school_end_time TIME DEFAULT '14:30:00',
    late_threshold_minutes INTEGER DEFAULT 15,
    sms_enabled BOOLEAN DEFAULT true,
    whatsapp_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `students`
```sql
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES schools(id),
    section_id INTEGER REFERENCES sections(id),
    name VARCHAR(255) NOT NULL,
    roll_number VARCHAR(50),
    rfid_uid VARCHAR(100) UNIQUE,
    parent_name VARCHAR(255),
    parent_phone VARCHAR(20),
    parent_email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    academic_year VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `attendance_logs`
```sql
CREATE TABLE attendance_logs (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id),
    device_id INTEGER REFERENCES devices(id),
    school_id INTEGER REFERENCES schools(id),
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'present',  -- present, absent, late, leave
    is_late BOOLEAN DEFAULT false,
    sms_sent BOOLEAN DEFAULT false,
    notes TEXT,
    academic_year VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `devices`
```sql
CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES schools(id),
    device_name VARCHAR(255),
    serial_number VARCHAR(100) UNIQUE NOT NULL,
    location VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMP,
    firmware_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Relationships

```
schools (1) ──────< (N) students
schools (1) ──────< (N) teachers
schools (1) ──────< (N) classes
schools (1) ──────< (N) devices
classes (1) ──────< (N) sections
sections (1) ─────< (N) students
students (1) ─────< (N) attendance_logs
devices (1) ──────< (N) attendance_logs
```

---

# 👤 User Roles & Access Levels

![User Roles](/Users/askerymalik/Documents/Development/school-attendance-sysytem/diagrams/user_roles_access_1767594030852.png)

### Role Permissions Matrix

| Feature | Super Admin | School Admin | Teacher | Parent |
|---------|:-----------:|:------------:|:-------:|:------:|
| Manage Schools | ✅ | ❌ | ❌ | ❌ |
| System Settings | ✅ | ❌ | ❌ | ❌ |
| View All Devices | ✅ | ❌ | ❌ | ❌ |
| Audit Logs | ✅ | ❌ | ❌ | ❌ |
| Manage Students | ❌ | ✅ | ❌ | ❌ |
| Manage Teachers | ❌ | ✅ | ❌ | ❌ |
| View All Attendance | ❌ | ✅ | ❌ | ❌ |
| School Settings | ❌ | ✅ | ❌ | ❌ |
| School Devices | ❌ | ✅ | ❌ | ❌ |
| Generate Reports | ❌ | ✅ | ✅ | ❌ |
| Mark Attendance | ❌ | ✅ | ✅ | ❌ |
| View Class Students | ❌ | ✅ | ✅ | ❌ |
| Approve Leaves | ❌ | ✅ | ✅ | ❌ |
| View Child Attendance | ❌ | ❌ | ❌ | ✅ |
| Apply Leave | ❌ | ❌ | ❌ | ✅ |

### Authentication Flow

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│    LOGIN     │      │   BACKEND    │      │   DATABASE   │
│    FORM      │      │     API      │      │              │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                     │                     │
       │ POST /auth/login    │                     │
       │ {email, password}   │                     │
       │────────────────────>│                     │
       │                     │ SELECT * FROM users │
       │                     │ WHERE email = ?     │
       │                     │────────────────────>│
       │                     │                     │
       │                     │<────────────────────│
       │                     │    user record      │
       │                     │                     │
       │                     │ bcrypt.compare()    │
       │                     │ jwt.sign()          │
       │                     │                     │
       │<────────────────────│                     │
       │ {token, user, role} │                     │
       │                     │                     │
       │ Store in localStorage                     │
       │ Redirect to dashboard                     │
       │                     │                     │
```

---

# 📅 Daily Operations Workflow

![Daily Workflow](/Users/askerymalik/Documents/Development/school-attendance-sysytem/diagrams/daily_workflow_1767594062185.png)

### Complete Daily Timeline

```
═══════════════════════════════════════════════════════════════════════
  TIME          EVENT                    SYSTEM ACTION
═══════════════════════════════════════════════════════════════════════

  07:00 AM      School Gates Open        Devices come online
                                         ↓
  07:00-09:00   Students Arrive          RFID scan → Check-in recorded
                                         Late detection active
                                         SMS sent for late arrivals
                                         ↓
  09:00 AM      School Starts            Late threshold begins
                                         (configurable: 15-30 min)
                                         ↓
  11:00 AM      ⚡ AUTO-ABSENCE CRON     Find students with no check-in
                                         Create absent records
                                         Send SMS to all absent parents
                                         ↓
  12:00-01:00   Lunch Break              No specific system action
                                         ↓
  02:30-03:30   School Ends              Students scan RFID
                                         Check-out time recorded
                                         ↓
  04:00 PM      Admin Reviews            View dashboard statistics
                                         Generate daily reports
                                         ↓
  05:00 PM      End of Day               Daily summary available
                                         Export reports (PDF/Excel)
                                         ↓
  11:00 PM     Background Sync           Verify device user lists
                                         Queue pending sync commands

═══════════════════════════════════════════════════════════════════════
```

---

# 📱 Device Sync Flow (Student ↔ Device)

### Adding New Student to Device

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   ADMIN     │     │  DASHBOARD  │     │   BACKEND   │     │ RFID DEVICE │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ Add Student Form  │                   │                   │
       │ + RFID UID        │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │ POST /students    │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │                   │ INSERT student    │
       │                   │                   │ INSERT device_cmd │
       │                   │                   │ (DATA UPDATE)     │
       │                   │                   │                   │
       │                   │<──────────────────│                   │
       │                   │    201 Created    │                   │
       │                   │                   │                   │
       │                   │                   │    [30 sec later] │
       │                   │                   │                   │
       │                   │                   │<──────────────────│
       │                   │                   │ GET /getrequest   │
       │                   │                   │                   │
       │                   │                   │──────────────────>│
       │                   │                   │ "DATA UPDATE      │
       │                   │                   │  USERINFO PIN=123 │
       │                   │                   │  Name=John..."    │
       │                   │                   │                   │
       │                   │                   │                   │
       │                   │                   │<──────────────────│
       │                   │                   │ POST /devicecmd   │
       │                   │                   │ (CMD executed)    │
       │                   │                   │                   │
       │                   │                   │ UPDATE device_cmd │
       │                   │                   │ status='executed' │
       │                   │                   │                   │
```

### Device Command Format

```
Command to ADD user:
DATA UPDATE USERINFO PIN=1234\tName=John Smith\tCard=9876543210\tPri=0

Command to DELETE user:
DATA DELETE USERINFO PIN=1234

Command Response from Device:
ID=1&CMD=DATA&RET=0    (0 = success)
```

---

# 🔌 API Endpoints Reference

### Authentication APIs

| Method | Endpoint | Request Body | Response |
|--------|----------|--------------|----------|
| POST | `/api/v1/auth/login` | `{email, password}` | `{token, user}` |
| POST | `/api/v1/auth/refresh` | `{refreshToken}` | `{token}` |
| POST | `/api/v1/auth/logout` | - | `{success}` |

### Student APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/school/students` | List students (paginated) |
| GET | `/api/v1/school/students/:id` | Get single student |
| POST | `/api/v1/school/students` | Create student |
| PUT | `/api/v1/school/students/:id` | Update student |
| DELETE | `/api/v1/school/students/:id` | Deactivate student |
| POST | `/api/v1/school/bulk-upload/students` | Bulk import CSV |

### Attendance APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/school/attendance` | Get attendance logs |
| GET | `/api/v1/school/attendance/today` | Today's statistics |
| GET | `/api/v1/school/attendance/calendar` | Monthly calendar view |
| POST | `/api/v1/teacher/attendance/mark` | Manual attendance mark |

### Device APIs (iclock Protocol)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/iclock/cdata` | Device handshake (init) |
| POST | `/iclock/cdata` | Receive attendance punch |
| GET | `/iclock/getrequest` | Send commands to device |
| POST | `/iclock/devicecmd` | Receive command result |

---

# 🛠 Project Structure

```
school-attendance-system/
│
├── 📁 backend/                      # Node.js API Server
│   ├── 📁 src/
│   │   ├── 📁 config/               # Database, environment config
│   │   │   ├── database.js          # PostgreSQL connection pool
│   │   │   └── migrate.js           # Migration runner
│   │   │
│   │   ├── 📁 controllers/          # Request handlers (22 files)
│   │   │   ├── authController.js
│   │   │   ├── attendanceController.js
│   │   │   ├── studentController.js → (in schoolController.js)
│   │   │   ├── deviceSyncController.js
│   │   │   ├── iclockController.js  # RFID device communication
│   │   │   └── ...
│   │   │
│   │   ├── 📁 models/               # Database models (14 files)
│   │   │   ├── User.js
│   │   │   ├── Student.js
│   │   │   ├── Teacher.js
│   │   │   ├── AttendanceLog.js
│   │   │   ├── Device.js
│   │   │   └── ...
│   │   │
│   │   ├── 📁 routes/               # API routes (15 files)
│   │   │   ├── auth.routes.js
│   │   │   ├── school.routes.js
│   │   │   ├── teacher.routes.js
│   │   │   ├── iclock.js            # Device routes
│   │   │   └── ...
│   │   │
│   │   ├── 📁 services/             # Background services (7 files)
│   │   │   ├── autoAbsenceDetection.js
│   │   │   ├── attendanceProcessor.js
│   │   │   ├── studentSyncVerification.js
│   │   │   ├── whatsappService.js
│   │   │   └── ...
│   │   │
│   │   ├── 📁 middleware/           # Auth, validation (8 files)
│   │   └── server.js                # Entry point
│   │
│   └── 📁 migrations/               # SQL migrations (25 files)
│
├── 📁 school-dashboard/             # React School Admin UI
│   └── 📁 src/
│       ├── 📁 pages/                # 20 page components
│       │   ├── Dashboard.js
│       │   ├── Students.js
│       │   ├── Teachers.js
│       │   ├── Attendance.js
│       │   ├── Reports.js
│       │   └── ...
│       └── 📁 components/
│
├── 📁 super-admin-panel/            # React Platform Admin UI
│   └── 📁 src/
│       └── 📁 pages/                # 9 page components
│           ├── Dashboard.js
│           ├── Schools.js
│           ├── Devices.js
│           ├── SystemSettings.js
│           └── ...
│
└── 📁 School-attendance-app/        # Flutter Mobile App
    └── 📁 lib/
        ├── 📁 screens/              # 15 screen widgets
        │   ├── teacher_dashboard_screen.dart
        │   ├── parent_dashboard_screen.dart
        │   ├── attendance_calendar_screen.dart
        │   └── ...
        ├── 📁 models/               # Data models
        ├── 📁 providers/            # State management
        └── 📁 services/             # API services
```

---

# 🚀 Quick Start Guide

### 1. Backend Setup

```bash
# Clone and navigate
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Edit .env:
# DB_HOST=localhost
# DB_NAME=school_attendance
# DB_USER=postgres
# DB_PASSWORD=your_password
# JWT_SECRET=your_secure_secret

# Run migrations
npm run db:migrate

# Start development server
npm run dev
# Server runs at http://localhost:5000
```

### 2. School Dashboard Setup

```bash
cd school-dashboard
npm install

# Configure API URL in .env
# REACT_APP_API_URL=http://localhost:5000/api/v1

npm start
# Dashboard at http://localhost:3000
```

### 3. Super Admin Panel Setup

```bash
cd super-admin-panel
npm install
npm start
# Panel at http://localhost:3001
```

### 4. Mobile App Setup

```bash
cd School-attendance-app
flutter pub get

# Configure API URL in lib/config/api_config.dart
flutter run
```

### 5. RFID Device Configuration

```
On ZKTeco K40 Pro device:
├── Menu → Communication → Cloud Server Setting
├── Server Address: YOUR_SERVER_IP
├── Server Port: 5000
├── Enable Push → YES
└── Save and restart device
```

---

# 📋 Technology Stack Summary

| Component | Technology | Purpose |
|-----------|------------|---------|
| Backend Runtime | Node.js 16+ | JavaScript server |
| API Framework | Express.js 4.18 | REST API routing |
| Database | PostgreSQL 14+ | Data storage |
| Authentication | JWT | Token-based auth |
| Password Security | bcryptjs | Password hashing |
| File Upload | Multer | CSV/Excel import |
| SMS Service | Twilio | Parent notifications |
| Real-time | Socket.IO | Live updates |
| Task Scheduling | node-cron | Auto-absence cron |
| School Dashboard | React 18 | Admin web UI |
| Super Admin Panel | React 18 | Platform management |
| Mobile App | Flutter 3.x | iOS/Android app |
| RFID Protocol | iclock | ZKTeco device communication |

---

# 📞 Support & Documentation

Refer to additional documentation files in the project root:

- `DEPLOYMENT_GUIDE.md` - Production deployment steps
- `ZKTECO_README.md` - RFID device setup guide  
- `WHATSAPP_SETUP_GUIDE.md` - WhatsApp API configuration
- `LOGIN_CREDENTIALS.md` - Default login credentials
- `API_ENDPOINTS_SUMMARY.md` - Full API reference

---

*Documentation generated for development team - School Attendance Management System v1.0*
