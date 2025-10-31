# School Admin Dashboard - Complete Implementation Plan

## Overview
A dedicated dashboard for school staff to manage their school's attendance system, students, and view reports.

---

## Project Structure
```
school-dashboard/
├── public/
├── src/
│   ├── components/
│   │   ├── Navbar.js           # Top navigation bar
│   │   ├── Sidebar.js          # Side navigation menu
│   │   └── ProtectedRoute.js   # Auth route wrapper
│   ├── pages/
│   │   ├── Login.js            # School admin login
│   │   ├── Dashboard.js        # Main dashboard (stats)
│   │   ├── Students.js         # Manage students (CRUD)
│   │   ├── Attendance.js       # View attendance logs
│   │   ├── Reports.js          # Generate reports
│   │   └── Settings.js         # School settings
│   ├── contexts/
│   │   └── AuthContext.js      # Authentication context
│   ├── utils/
│   │   └── api.js              # API calls to backend
│   ├── App.js                  # Main app with routes
│   ├── App.css                 # Global styles
│   └── index.js                # Entry point
├── .env                         # Environment variables
└── package.json
```

---

## Features by Page

### 1. Login Page (`/login`)
- Email & password authentication
- Login as school admin
- Shows school name after login
- Redirects to dashboard

### 2. Dashboard (`/dashboard`)
**Stats Cards:**
- Total Students
- Present Today
- Absent Today
- Late Today

**Recent Activity:**
- Last 10 attendance logs (real-time)

**Quick Actions:**
- Add New Student
- View Today's Report
- Download Attendance

### 3. Students Page (`/students`)
**Features:**
- View all students (table)
- Add new student (modal form)
- Edit student details
- Deactivate student
- Search & filter students
- Bulk upload students (CSV)

**Student Fields:**
- Full Name
- Grade/Class
- Roll Number
- RFID Card Number
- Parent Name
- Parent Phone
- Email
- Photo (optional)
- Status (Active/Inactive)

### 4. Attendance Page (`/attendance`)
**Features:**
- View all attendance logs (table)
- Filter by date, student, status
- Real-time updates (polling every 30 sec)
- Export to Excel/PDF
- Mark manual attendance

**Attendance Log Fields:**
- Student Name & Photo
- Date & Time
- Status (Present/Late/Absent)
- Entry/Exit
- Device Name

### 5. Reports Page (`/reports`)
**Report Types:**
- Daily Attendance Report
- Monthly Attendance Report
- Student-wise Attendance
- Late Arrivals Report
- Absent Students Report

**Filters:**
- Date Range
- Grade/Class
- Student
- Status

**Export Options:**
- PDF
- Excel
- Print

### 6. Settings Page (`/settings`)
**School Information:**
- School Name
- Contact Details
- Address
- Logo

**Attendance Settings:**
- School Start Time (for late marking)
- School End Time
- Grace Period (minutes)
- Notification Settings

**User Profile:**
- Change Password
- Update Email
- Profile Picture

---

## API Endpoints Needed

### Authentication
```
POST /api/v1/auth/login
GET  /api/v1/auth/me
PUT  /api/v1/auth/change-password
```

### Students (School Admin)
```
GET    /api/v1/school/students          # Get all students for this school
POST   /api/v1/school/students          # Add new student
GET    /api/v1/school/students/:id      # Get student details
PUT    /api/v1/school/students/:id      # Update student
DELETE /api/v1/school/students/:id      # Deactivate student
POST   /api/v1/school/students/bulk     # Bulk upload (CSV)
```

### Attendance Logs (School Admin)
```
GET    /api/v1/school/attendance         # Get attendance logs
GET    /api/v1/school/attendance/today   # Today's attendance
POST   /api/v1/school/attendance/manual  # Manual attendance entry
GET    /api/v1/school/stats               # Dashboard stats
```

### Reports
```
GET    /api/v1/school/reports/daily      # Daily report
GET    /api/v1/school/reports/monthly    # Monthly report
GET    /api/v1/school/reports/student/:id # Student report
```

### Settings
```
GET    /api/v1/school/settings           # Get school settings
PUT    /api/v1/school/settings           # Update settings
```

---

## Database Tables Needed

### students table
```sql
CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  full_name VARCHAR(255) NOT NULL,
  grade VARCHAR(50),
  roll_number VARCHAR(50),
  rfid_card VARCHAR(100) UNIQUE NOT NULL,
  parent_name VARCHAR(255),
  parent_phone VARCHAR(20),
  email VARCHAR(255),
  photo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_students_school ON students(school_id);
CREATE INDEX idx_students_rfid ON students(rfid_card);
```

### attendance_logs table
```sql
CREATE TABLE attendance_logs (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  student_id INTEGER NOT NULL REFERENCES students(id),
  rfid_card VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'present', 'late', 'absent'
  check_in_time TIMESTAMP NOT NULL,
  check_out_time TIMESTAMP,
  device_id INTEGER REFERENCES devices(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attendance_school ON attendance_logs(school_id);
CREATE INDEX idx_attendance_student ON attendance_logs(student_id);
CREATE INDEX idx_attendance_date ON attendance_logs(check_in_time);
```

---

## Technology Stack

### Frontend (School Dashboard)
- React 18
- React Router v6 (routing)
- Axios (API calls)
- CSS/Styled Components
- React Icons (icons)
- Chart.js / Recharts (graphs)

### Backend (Already exists)
- Node.js + Express
- PostgreSQL
- JWT Authentication

---

## Implementation Steps

### Phase 1: Setup (Day 1)
1. ✅ Create React app
2. Install dependencies
3. Set up folder structure
4. Configure API base URL
5. Create AuthContext

### Phase 2: Authentication (Day 1-2)
1. Create Login page
2. Implement JWT authentication
3. Create ProtectedRoute component
4. Test login/logout flow

### Phase 3: Layout (Day 2)
1. Create Navbar component
2. Create Sidebar component
3. Set up main layout wrapper
4. Add routing

### Phase 4: Dashboard (Day 2-3)
1. Create Dashboard page
2. Fetch and display stats
3. Show recent activity
4. Add quick actions

### Phase 5: Students Module (Day 3-4)
1. Create Students page (list view)
2. Add student form (modal)
3. Edit student functionality
4. Delete/deactivate student
5. Search & filter

### Phase 6: Attendance Module (Day 4-5)
1. Create Attendance page
2. Fetch and display logs
3. Filter by date/student
4. Real-time updates
5. Manual attendance entry

### Phase 7: Reports Module (Day 5-6)
1. Create Reports page
2. Implement report filters
3. Generate PDF reports
4. Export to Excel
5. Print functionality

### Phase 8: Settings (Day 6-7)
1. Create Settings page
2. School information form
3. Attendance settings
4. Profile update

### Phase 9: Testing & Polish (Day 7)
1. Test all features
2. Fix bugs
3. Improve UI/UX
4. Add loading states
5. Error handling

---

## Color Scheme (School Dashboard)

### Primary Colors (Light & Professional)
- Primary: `#4F46E5` (Indigo)
- Secondary: `#10B981` (Green)
- Background: `#F9FAFB` (Light Gray)
- Cards: `#FFFFFF` (White)
- Text: `#111827` (Dark Gray)
- Borders: `#E5E7EB` (Light Gray)

### Status Colors
- Present: `#10B981` (Green)
- Late: `#F59E0B` (Orange)
- Absent: `#EF4444` (Red)
- Active: `#3B82F6` (Blue)

---

## Security Features

1. **JWT Authentication**: Only school admins can login
2. **Role-Based Access**: School admin can only see their school's data
3. **School ID Filtering**: All queries filtered by `school_id`
4. **Session Management**: Auto-logout on token expiry
5. **Input Validation**: All forms validated
6. **XSS Protection**: Sanitize user inputs

---

## Real-Time Features

1. **Live Attendance**: Dashboard updates every 30 seconds
2. **Instant Notifications**: When student checks in/out
3. **Device Status**: Show online/offline devices
4. **Recent Activity**: Last 10 attendance logs

---

## Mobile Responsive

- All pages responsive
- Works on tablets
- Sidebar collapses on mobile
- Touch-friendly buttons

---

## Next Steps

1. Wait for `create-react-app` to finish
2. Install dependencies
3. Start building components
4. Connect to backend APIs
5. Test thoroughly

---

**Estimated Time:** 7 days for complete implementation
**Priority:** High - School staff need this dashboard to manage daily operations
