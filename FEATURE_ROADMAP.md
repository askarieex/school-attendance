# 🚀 Complete Feature Roadmap - School Attendance System v2.0

**Planning Document**
**Date**: October 12, 2025
**Target Release**: Q1 2026

---

## 📋 Table of Contents

1. [Vision Overview](#vision-overview)
2. [Phase 1: Classes & Teacher Management](#phase-1-classes--teacher-management)
3. [Phase 2: Manual Attendance System](#phase-2-manual-attendance-system)
4. [Phase 3: Attendance Rules Engine](#phase-3-attendance-rules-engine)
5. [Phase 4: Teacher Mobile App](#phase-4-teacher-mobile-app)
6. [Phase 5: Lost Card Management](#phase-5-lost-card-management)
6. [Phase 6: Advanced Features](#phase-6-advanced-features)
7. [Complete Database Schema](#complete-database-schema)
8. [API Specifications](#api-specifications)
9. [UI/UX Mockups](#uiux-mockups)
10. [Implementation Timeline](#implementation-timeline)

---

## 1. Vision Overview

### The Complete System

Transform the current basic attendance system into a **comprehensive school management platform** with:

✅ **Current**: RFID-based automatic attendance
🎯 **New Features**:
- Custom classes and sections per school
- Complete teacher management
- Teacher mobile app for iOS/Android
- Manual attendance marking capability
- Flexible attendance rules (too early/too late handling)
- Lost/damaged card management workflow
- Multi-level user access (Super Admin → School Admin → Teachers)

### User Roles Hierarchy

```
┌─────────────────────────────────────────────────────┐
│              SUPER ADMIN                            │
│  - Manage all schools                               │
│  - System-wide configuration                        │
│  - Billing & subscriptions                          │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│           SCHOOL ADMIN (Principal)                  │
│  - Manage their school only                         │
│  - Add/edit students, teachers, classes             │
│  - View all attendance data                         │
│  - Configure school settings                        │
│  - Assign teachers to classes                       │
│  - Handle lost card requests                        │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│         TEACHER (Class/Form Teacher)                │
│  - View assigned class(es) students                 │
│  - Mark manual attendance for their class           │
│  - View attendance history of their students        │
│  - Report lost/damaged cards                        │
│  - Mobile app access                                │
└─────────────────────────────────────────────────────┘
                       ↓
                  STUDENTS
              (Scan RFID cards)
```

---

## 2. Phase 1: Classes & Teacher Management

### 2.1 Classes and Sections Management

#### Feature Description
Schools need to organize students into **classes** (grades) and **sections** (divisions within a grade). Each school should be able to customize this structure according to their needs.

#### Examples of School Structures

**Example 1: Traditional School**
```
Grade 9
  ├── Section A (35 students)
  ├── Section B (35 students)
  └── Section C (30 students)

Grade 10
  ├── Section A (40 students)
  ├── Section B (38 students)
  └── Section C (32 students)
```

**Example 2: Primary School**
```
Pre-KG
  └── Section A (20 students)

Kindergarten
  ├── Section A (25 students)
  └── Section B (25 students)

Grade 1
  ├── Section Red (28 students)
  ├── Section Blue (28 students)
  └── Section Green (24 students)
```

#### Database Schema

**New Table: `classes`**
```sql
CREATE TABLE classes (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) NOT NULL,
  class_name VARCHAR(100) NOT NULL, -- 'Grade 9', 'Grade 10', 'Pre-KG'
  academic_year VARCHAR(20) NOT NULL, -- '2025-2026'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, class_name, academic_year)
);
```

**New Table: `sections`**
```sql
CREATE TABLE sections (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id) NOT NULL,
  section_name VARCHAR(50) NOT NULL, -- 'A', 'B', 'Red', 'Blue'
  max_capacity INTEGER DEFAULT 40,
  current_strength INTEGER DEFAULT 0,
  form_teacher_id INTEGER REFERENCES users(id), -- Assigned teacher
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(class_id, section_name)
);
```

**Update: `students` table**
```sql
ALTER TABLE students
ADD COLUMN class_id INTEGER REFERENCES classes(id),
ADD COLUMN section_id INTEGER REFERENCES sections(id);

-- Now students are linked to specific class and section
```

#### UI Implementation

##### School Admin Dashboard: Classes Page

**URL**: `/classes`

**Features**:
1. View all classes and sections
2. Add new class
3. Add section to a class
4. Edit class/section details
5. Assign form teacher to section
6. View students in each section
7. Delete/deactivate class or section

**UI Layout**:
```
┌────────────────────────────────────────────────────┐
│ Classes & Sections Management                      │
│                                        [+ Add Class]│
├────────────────────────────────────────────────────┤
│                                                     │
│ Grade 9                              [Edit] [Delete]│
│   ├─ Section A (35/40 students)                    │
│   │  Form Teacher: Mrs. Smith       [Assign Teacher]│
│   │                                  [View Students]│
│   │                                                 │
│   ├─ Section B (35/40 students)                    │
│   │  Form Teacher: Mr. Johnson      [Assign Teacher]│
│   │                                  [View Students]│
│   │                                                 │
│   └─ Section C (30/40 students)                    │
│      Form Teacher: Not Assigned     [Assign Teacher]│
│                                      [View Students]│
│                                                     │
│ Grade 10                             [Edit] [Delete]│
│   ├─ Section A (40/40 students)                    │
│   │  Form Teacher: Mrs. Davis       [Assign Teacher]│
│   │                                  [View Students]│
│   │                                                 │
│   └─ ...                                           │
│                                                     │
└────────────────────────────────────────────────────┘
```

**Add Class Modal**:
```
┌─────────────────────────────────────┐
│  Add New Class                   [X]│
├─────────────────────────────────────┤
│                                     │
│  Class Name: [Grade 11      ]      │
│                                     │
│  Academic Year: [2025-2026  ▼]     │
│                                     │
│  Number of Sections: [3]           │
│                                     │
│  Section Names:                    │
│    Section 1: [A          ]        │
│    Section 2: [B          ]        │
│    Section 3: [C          ]        │
│                                     │
│  Max Students per Section: [40]    │
│                                     │
│         [Cancel]  [Create Class]   │
│                                     │
└─────────────────────────────────────┘
```

#### API Endpoints

```javascript
// Classes
GET    /api/v1/school/classes                 // Get all classes
POST   /api/v1/school/classes                 // Create new class
GET    /api/v1/school/classes/:id             // Get class details
PUT    /api/v1/school/classes/:id             // Update class
DELETE /api/v1/school/classes/:id             // Delete class

// Sections
GET    /api/v1/school/classes/:id/sections    // Get sections of a class
POST   /api/v1/school/classes/:id/sections    // Add section to class
PUT    /api/v1/school/sections/:id            // Update section
DELETE /api/v1/school/sections/:id            // Delete section

// Assign form teacher
PUT    /api/v1/school/sections/:id/teacher    // Assign/change form teacher
DELETE /api/v1/school/sections/:id/teacher    // Remove form teacher

// Students in section
GET    /api/v1/school/sections/:id/students   // Get all students in section
```

---

### 2.2 Teacher Management System

#### Feature Description
Schools need to add teachers, manage their profiles, and assign them to classes. Teachers will have their own login credentials to access the system.

#### Database Schema

**Update: `users` table** (already supports teachers with `role = 'teacher'`)
```sql
-- Already exists, just needs proper teacher data
```

**New Table: `teachers`** (Extended teacher profile)
```sql
CREATE TABLE teachers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) UNIQUE NOT NULL,
  school_id INTEGER REFERENCES schools(id) NOT NULL,
  teacher_code VARCHAR(50) UNIQUE, -- 'TCH001'
  phone VARCHAR(20),
  date_of_birth DATE,
  date_of_joining DATE,
  subject_specialization VARCHAR(255), -- 'Mathematics', 'Science'
  qualification VARCHAR(255), -- 'M.Ed, B.Sc'
  photo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**New Table: `teacher_class_assignments`** (Many-to-many relationship)
```sql
CREATE TABLE teacher_class_assignments (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER REFERENCES teachers(id) NOT NULL,
  section_id INTEGER REFERENCES sections(id) NOT NULL,
  subject VARCHAR(100), -- 'Mathematics', 'English', 'All Subjects' (for form teacher)
  is_form_teacher BOOLEAN DEFAULT FALSE,
  academic_year VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(teacher_id, section_id, subject, academic_year)
);
```

#### UI Implementation

##### School Admin Dashboard: Teachers Page

**URL**: `/teachers`

**Features**:
1. View all teachers
2. Add new teacher
3. Edit teacher details
4. Assign teacher to classes/sections
5. View teacher's assigned classes
6. Deactivate teacher
7. Reset teacher password

**UI Layout**:
```
┌────────────────────────────────────────────────────────────┐
│ Teacher Management                       [+ Add New Teacher]│
├────────────────────────────────────────────────────────────┤
│                                                             │
│ Search: [____________]  Filter: [All ▼]  Subject: [All ▼] │
│                                                             │
├───────┬──────────────┬──────────┬─────────────┬──────────┤
│ Photo │ Name         │ Code     │ Assigned To │ Actions  │
├───────┼──────────────┼──────────┼─────────────┼──────────┤
│ [IMG] │ Mrs. Smith   │ TCH001   │ Grade 9-A   │ [Edit]   │
│       │ Mathematics  │          │ (Form Tchr) │ [Assign] │
│       │ Active       │          │             │ [Delete] │
│       │              │          │             │          │
│ [IMG] │ Mr. Johnson  │ TCH002   │ Grade 9-B   │ [Edit]   │
│       │ Science      │          │ (Form Tchr) │ [Assign] │
│       │ Active       │          │ Grade 10-A  │ [Delete] │
│       │              │          │ (Science)   │          │
│       │              │          │             │          │
│ [IMG] │ Mrs. Davis   │ TCH003   │ Grade 10-A  │ [Edit]   │
│       │ English      │          │ (Form Tchr) │ [Assign] │
│       │ Active       │          │ Grade 10-B  │ [Delete] │
│       │              │          │ (English)   │          │
└───────┴──────────────┴──────────┴─────────────┴──────────┘
```

**Add Teacher Modal**:
```
┌─────────────────────────────────────┐
│  Add New Teacher                 [X]│
├─────────────────────────────────────┤
│                                     │
│  Full Name: [____________]          │
│  Email: [____________]              │
│  Phone: [____________]              │
│  Teacher Code: [TCH004]  (Auto)    │
│                                     │
│  Date of Birth: [DD/MM/YYYY]       │
│  Date of Joining: [DD/MM/YYYY]     │
│                                     │
│  Subject Specialization:           │
│    [Mathematics      ▼]            │
│                                     │
│  Qualification: [____________]      │
│                                     │
│  Photo: [Choose File]              │
│                                     │
│  Temporary Password: [Generate]    │
│  (Teacher will change on first login)│
│                                     │
│      [Cancel]  [Add Teacher]       │
│                                     │
└─────────────────────────────────────┘
```

**Assign Classes Modal**:
```
┌─────────────────────────────────────┐
│  Assign Classes - Mrs. Smith     [X]│
├─────────────────────────────────────┤
│                                     │
│  Current Assignments:               │
│    ☑ Grade 9-A (Form Teacher)      │
│    ☑ Grade 9-B (Mathematics)       │
│                                     │
│  Available Classes:                 │
│    ☐ Grade 9-C (Form Teacher)      │
│    ☐ Grade 10-A (Form Teacher)     │
│    ☐ Grade 10-A (Mathematics)      │
│    ☐ Grade 10-B (Mathematics)      │
│                                     │
│  Select Subject:                    │
│    [Mathematics      ▼]            │
│                                     │
│  ☑ Make Form Teacher                │
│                                     │
│      [Cancel]  [Save Assignments]  │
│                                     │
└─────────────────────────────────────┘
```

#### API Endpoints

```javascript
// Teachers
GET    /api/v1/school/teachers                    // Get all teachers
POST   /api/v1/school/teachers                    // Add new teacher
GET    /api/v1/school/teachers/:id                // Get teacher details
PUT    /api/v1/school/teachers/:id                // Update teacher
DELETE /api/v1/school/teachers/:id                // Deactivate teacher

// Teacher assignments
GET    /api/v1/school/teachers/:id/assignments    // Get teacher's class assignments
POST   /api/v1/school/teachers/:id/assignments    // Assign teacher to class
DELETE /api/v1/school/teachers/:id/assignments/:assignmentId // Remove assignment

// Password management
POST   /api/v1/school/teachers/:id/reset-password // Reset teacher password
```

---

## 3. Phase 2: Manual Attendance System

### 3.1 Why Manual Attendance?

**Use Cases**:
1. **Lost/Damaged RFID Card**: Student forgot or lost their card
2. **Card Malfunction**: RFID reader not working
3. **Late Arrival**: Student arrived after scanning period ended
4. **Makeup Attendance**: Marking attendance for past dates (with justification)
5. **Emergency Situations**: Power outage, system down
6. **Field Trips**: Students on educational trips outside school

### 3.2 Manual Attendance Features

#### Who Can Mark Manual Attendance?

1. **School Admin**: Can mark for any student, any date
2. **Form Teacher**: Can mark only for their assigned section(s)
3. **Subject Teacher**: Can mark for students in their assigned classes

#### Manual Attendance Rules

- Must provide a reason/note
- Should be approved by School Admin (optional setting)
- Log who marked it and when
- Different from automatic RFID attendance (visible in reports)

### 3.3 Database Schema

**Update: `attendance_logs` table**
```sql
ALTER TABLE attendance_logs
ADD COLUMN marked_by INTEGER REFERENCES users(id), -- Who marked (teacher/admin)
ADD COLUMN marking_type VARCHAR(20) DEFAULT 'automatic', -- 'automatic' or 'manual'
ADD COLUMN approval_status VARCHAR(20) DEFAULT 'approved', -- 'pending', 'approved', 'rejected'
ADD COLUMN approved_by INTEGER REFERENCES users(id),
ADD COLUMN approved_at TIMESTAMP;

-- marking_type:
-- 'automatic' = RFID scan
-- 'manual' = Marked by teacher/admin
```

### 3.4 UI Implementation

#### School Admin Dashboard: Manual Attendance Page

**URL**: `/attendance/manual`

**UI Layout**:
```
┌────────────────────────────────────────────────────────────┐
│ Mark Manual Attendance                                     │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ Select Date: [12 Oct 2025 ▼]                              │
│                                                             │
│ Select Class: [Grade 9 ▼]  Section: [A ▼]                 │
│                                                             │
│ [Refresh Student List]                                     │
│                                                             │
├────┬─────────────┬─────────┬──────────┬────────┬─────────┤
│ ☑  │ Student     │ RFID    │ Status   │ Time   │ Notes   │
├────┼─────────────┼─────────┼──────────┼────────┼─────────┤
│ ☐  │ John Smith  │ RFID001 │ ✅ Present│ 07:15 │ Auto    │
│ ☐  │ Sarah J.    │ RFID002 │ ✅ Present│ 07:20 │ Auto    │
│ ☑  │ Michael B.  │ RFID003 │ ❌ Absent │   -    │   -     │
│ ☑  │ Emily Davis │ RFID004 │ ⚠️ Late   │ 08:30 │ Auto    │
│ ☑  │ David W.    │ RFID005 │ ❌ Absent │   -    │   -     │
└────┴─────────────┴─────────┴──────────┴────────┴─────────┘

Selected Students: 3
Mark as: [⚪ Present] [⚪ Late] [⚪ Absent]

Reason/Notes:
┌─────────────────────────────────────────────────┐
│ Card lost, manual attendance marked by admin   │
│                                                 │
└─────────────────────────────────────────────────┘

               [Cancel]  [Mark Attendance]
```

#### Teacher Mobile App: Manual Attendance

**Screen Flow**:
```
┌─────────────────────────┐
│ Manual Attendance       │
├─────────────────────────┤
│                         │
│ My Classes:             │
│  • Grade 9-A (Form)     │
│  • Grade 10-B (Math)    │
│                         │
│ [Tap to select class]   │
│                         │
└─────────────────────────┘
         ↓
┌─────────────────────────┐
│ Grade 9-A Students      │
├─────────────────────────┤
│ Date: [Today ▼]        │
│                         │
│ ☑ John Smith     ✅    │
│ ☑ Sarah J.       ✅    │
│ ☐ Michael B.     ❌    │
│ ☑ Emily Davis    ⚠️    │
│ ☑ David W.       ❌    │
│                         │
│ [Select All Present]    │
│                         │
│ Reason: [___________]  │
│                         │
│ [Submit Attendance]     │
│                         │
└─────────────────────────┘
```

### 3.5 API Endpoints

```javascript
// Manual attendance
POST   /api/v1/school/attendance/manual           // Mark manual attendance
GET    /api/v1/school/attendance/manual/pending   // Get pending approvals (for admin)
PUT    /api/v1/school/attendance/manual/:id/approve // Approve manual attendance
PUT    /api/v1/school/attendance/manual/:id/reject  // Reject manual attendance

// Request body for marking manual attendance
{
  "date": "2025-10-12",
  "sectionId": 5,
  "students": [
    {
      "studentId": 1,
      "status": "present",
      "checkInTime": "08:15:00"
    },
    {
      "studentId": 2,
      "status": "late",
      "checkInTime": "09:30:00"
    }
  ],
  "reason": "Card lost, manual attendance marked",
  "markingType": "manual"
}
```

---

## 4. Phase 3: Attendance Rules Engine

### 4.1 "Too Early Arrival" Feature

#### The Problem
Currently, students can scan their RFID card at any time and it will be recorded. But schools want to enforce rules:
- **Attendance window**: 8:00 AM - 9:00 AM
- **Too early**: Before 8:00 AM should show error
- **On time**: 8:00 AM - 8:45 AM = "Present"
- **Late**: 8:45 AM - 9:00 AM = "Late"
- **Too late**: After 9:00 AM should show error or mark absent

#### How It Works

**Step-by-step Flow**:

1. **Student scans card at 7:55 AM** (too early)
   ```
   Student: Scans RFID card
       ↓
   Device: Reads card, sends to backend
       ↓
   Backend: Checks school settings
       - attendance_start_time = 08:00:00
       - Current time = 07:55:00
       - 07:55 < 08:00 → TOO EARLY
       ↓
   Backend: Returns error to device
       ↓
   Device: Shows RED light + Error beep
       LCD Display: "Too Early! Come back at 8:00 AM"
       ↓
   Student: Sees error, waits until 8:00 AM
   ```

2. **Student scans card at 8:15 AM** (on time)
   ```
   Student: Scans RFID card
       ↓
   Device: Reads card, sends to backend
       ↓
   Backend: Checks school settings
       - attendance_start_time = 08:00:00
       - late_threshold = 08:45:00
       - Current time = 08:15:00
       - 08:00 ≤ 08:15 ≤ 08:45 → PRESENT
       ↓
   Backend: Records attendance as "present"
       ↓
   Device: Shows GREEN light + Success beep
       LCD Display: "Welcome, John Smith!"
       ↓
   Parent: Receives SMS "John arrived at 8:15 AM"
   ```

3. **Student scans card at 8:50 AM** (late)
   ```
   Student: Scans RFID card
       ↓
   Backend: Checks school settings
       - late_threshold = 08:45:00
       - attendance_end_time = 09:00:00
       - Current time = 08:50:00
       - 08:45 < 08:50 ≤ 09:00 → LATE
       ↓
   Backend: Records attendance as "late"
       ↓
   Device: Shows YELLOW light + Warning beep
       LCD Display: "Late Arrival, John Smith"
       ↓
   Parent: Receives SMS "John arrived LATE at 8:50 AM"
   ```

4. **Student scans card at 9:30 AM** (too late)
   ```
   Student: Scans RFID card
       ↓
   Backend: Checks school settings
       - attendance_end_time = 09:00:00
       - Current time = 09:30:00
       - 09:30 > 09:00 → TOO LATE
       ↓
   Backend: Returns error OR marks as absent
       ↓
   Device: Shows RED light + Error beep
       LCD Display: "Attendance Closed! Contact Admin"
       ↓
   Teacher: Must mark manual attendance
   ```

#### Performance and Speed

**Is it fast? YES!** ⚡

The entire process happens in **less than 1 second**:

1. Card scan: 0.1 seconds
2. Send to backend: 0.2 seconds (over internet)
3. Backend processing: 0.1 seconds
4. Return response: 0.2 seconds
5. Device feedback: 0.1 seconds

**Total: ~0.7 seconds** from scan to beep

The device has a local cache of all student RFID cards, so it can show immediate visual feedback (green light) even before backend confirmation.

#### Is it safe? YES! 🔒

- Device authenticated via serial number
- HTTPS encrypted communication
- Multi-tenant isolation (schools can't see each other)
- Audit trail of all attendance records
- Cannot be bypassed without physical device access

#### Is it good to implement? YES! 👍

**Benefits**:
- Enforces school discipline rules
- Prevents early/late arrivals from being counted as "present"
- Clear feedback to students (they know immediately)
- Flexible - each school sets their own rules
- Professional system expected by schools

### 4.2 Attendance Rules Configuration

#### Update: `school_settings` table

```sql
ALTER TABLE school_settings
ADD COLUMN allow_early_checkin BOOLEAN DEFAULT FALSE,
ADD COLUMN allow_late_checkin BOOLEAN DEFAULT TRUE,
ADD COLUMN early_checkin_message TEXT DEFAULT 'Too early! Attendance starts at {time}',
ADD COLUMN late_checkin_message TEXT DEFAULT 'You are late. Please meet your class teacher.',
ADD COLUMN too_late_checkin_message TEXT DEFAULT 'Attendance closed. Contact school office.';
```

#### School Admin Settings UI

```
┌─────────────────────────────────────────────────┐
│ Attendance Rules Configuration                  │
├─────────────────────────────────────────────────┤
│                                                  │
│ Attendance Window                                │
│   Start Time: [08:00] AM                        │
│   End Time:   [09:00] AM                        │
│                                                  │
│ Late Threshold                                   │
│   Mark as late after: [08:45] AM                │
│                                                  │
│ Early Check-in Policy                            │
│   ☐ Allow check-in before start time            │
│   Message to show:                               │
│   [Too early! Attendance starts at 8:00 AM]    │
│                                                  │
│ Late Check-in Policy                             │
│   ☑ Allow check-in after late threshold         │
│   Message to show:                               │
│   [You are late. Please meet your teacher.]    │
│                                                  │
│ Too Late Policy                                  │
│   ☑ Reject check-in after end time              │
│   Message to show:                               │
│   [Attendance closed. Contact office.]         │
│                                                  │
│           [Cancel]  [Save Settings]             │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 4.3 Backend Implementation

**File**: `backend/src/controllers/deviceController.js`

```javascript
const handleCheckIn = async (req, res) => {
  const deviceSerial = req.headers['x-device-serial'];
  const { rfidCardId, timestamp } = req.body;

  // 1. Verify device
  const device = await Device.findBySerial(deviceSerial);
  if (!device || !device.is_active) {
    return sendError(res, 'Unauthorized device', 401);
  }

  // 2. Find student
  const student = await Student.findByRfid(rfidCardId);
  if (!student) {
    return sendDeviceError(res, 'Card not registered', 'ERROR_BEEP');
  }

  // 3. Check if already checked in today
  const today = new Date(timestamp).toISOString().split('T')[0];
  const existing = await AttendanceLog.existsToday(student.id, today);
  if (existing) {
    return sendDeviceError(res, 'Already checked in today', 'ERROR_BEEP');
  }

  // 4. Get school settings
  const settings = await SchoolSettings.get(device.school_id);

  // 5. Validate time window
  const scanTime = new Date(timestamp);
  const scanTimeOnly = scanTime.toTimeString().split(' ')[0]; // "07:55:00"

  const startTime = settings.attendance_start_time; // "08:00:00"
  const endTime = settings.attendance_end_time;     // "09:00:00"
  const lateTime = settings.late_threshold_time;    // "08:45:00"

  // Check if too early
  if (scanTimeOnly < startTime) {
    if (!settings.allow_early_checkin) {
      const message = settings.early_checkin_message
        .replace('{time}', startTime);
      return sendDeviceError(res, message, 'ERROR_BEEP');
    }
  }

  // Check if too late
  if (scanTimeOnly > endTime) {
    if (!settings.allow_late_checkin) {
      const message = settings.too_late_checkin_message;
      return sendDeviceError(res, message, 'ERROR_BEEP');
    }
  }

  // 6. Determine status
  let status = 'present';
  let deviceFeedback = 'SUCCESS_BEEP';
  let displayMessage = `Welcome, ${student.full_name}!`;

  if (scanTimeOnly >= startTime && scanTimeOnly <= lateTime) {
    status = 'present';
    deviceFeedback = 'SUCCESS_BEEP';
  } else if (scanTimeOnly > lateTime && scanTimeOnly <= endTime) {
    status = 'late';
    deviceFeedback = 'WARNING_BEEP';
    displayMessage = `Late Arrival, ${student.full_name}`;
  }

  // 7. Record attendance
  const log = await AttendanceLog.create({
    studentId: student.id,
    schoolId: device.school_id,
    deviceId: device.id,
    checkInTime: timestamp,
    status: status,
    date: today,
    markingType: 'automatic'
  });

  // 8. Send parent SMS (if enabled)
  if (settings.send_parent_sms && settings.sms_on_arrival) {
    const smsMessage = status === 'late'
      ? `${student.full_name} arrived LATE at school at ${scanTime.toLocaleTimeString()}`
      : `${student.full_name} arrived at school at ${scanTime.toLocaleTimeString()}`;

    await sendSMS(student.parent_phone, smsMessage);
    await AttendanceLog.markSmsSent(log.id);
  }

  // 9. Return success to device
  return sendDeviceSuccess(res, {
    studentName: student.full_name,
    status: status,
    message: displayMessage,
    feedback: deviceFeedback
  });
};

// Helper functions
const sendDeviceError = (res, message, feedbackType) => {
  return res.status(400).json({
    success: false,
    message: message,
    deviceFeedback: feedbackType, // 'ERROR_BEEP', 'WARNING_BEEP'
    displayMessage: message
  });
};

const sendDeviceSuccess = (res, data) => {
  return res.status(200).json({
    success: true,
    data: data,
    deviceFeedback: data.feedback,
    displayMessage: data.message
  });
};
```

---

## 5. Phase 4: Teacher Mobile App

### 5.1 App Overview

#### Platform
- **iOS** (React Native)
- **Android** (React Native)
- Single codebase for both platforms

#### Tech Stack
- **React Native** - Cross-platform framework
- **React Navigation** - Screen navigation
- **Axios** - API calls
- **AsyncStorage** - Local data caching
- **React Native Paper** - UI components
- **JWT** - Authentication

### 5.2 App Features

#### Teacher Login
- Email and password authentication
- "Remember me" option
- Password reset via email

#### Home Screen
```
┌─────────────────────────────┐
│ Good Morning, Mrs. Smith    │
│ [Profile Photo]             │
├─────────────────────────────┤
│ My Classes Today            │
│                             │
│ ┌─────────────────────────┐ │
│ │ Grade 9-A (Form)        │ │
│ │ 35/35 students          │ │
│ │ ✅ 32  ⚠️ 2  ❌ 1      │ │
│ │ [View Attendance]       │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ Grade 9-B (Math)        │ │
│ │ 35/35 students          │ │
│ │ ✅ 30  ⚠️ 3  ❌ 2      │ │
│ │ [View Attendance]       │ │
│ └─────────────────────────┘ │
│                             │
│ Quick Actions:              │
│ [Mark Manual Attendance]    │
│ [View Today's Absent]       │
│ [Report Lost Card]          │
│                             │
└─────────────────────────────┘
```

#### Attendance Viewing
- View today's attendance for assigned classes
- Filter by date
- See individual student attendance history
- Export to PDF/Excel

#### Manual Attendance Marking
- Quick mark all present
- Individual student selection
- Add reason/notes
- Photo capture (optional - for proof)

#### Student Information
- View student details (read-only)
- Contact parent (call/SMS)
- View student attendance trends

#### Lost Card Reporting
- Report when student loses RFID card
- Sends request to admin for new card
- Temporary manual attendance marking

### 5.3 App Screens

#### Screen 1: Login
```
┌─────────────────────────────┐
│                             │
│      [School Logo]          │
│                             │
│  Teacher Portal             │
│                             │
│  Email:                     │
│  [____________]             │
│                             │
│  Password:                  │
│  [____________]  [👁]       │
│                             │
│  ☑ Remember me              │
│                             │
│  [    Sign In    ]          │
│                             │
│  Forgot Password?           │
│                             │
└─────────────────────────────┘
```

#### Screen 2: Dashboard
```
┌─────────────────────────────┐
│ ☰  Teacher Portal      [🔔] │
├─────────────────────────────┤
│                             │
│ Welcome back, Mrs. Smith!   │
│ [Photo]                     │
│                             │
│ Today's Summary             │
│ ┌─────┬─────┬─────┐        │
│ │✅ 62│⚠️ 5│❌ 3 │        │
│ │Pres.│Late │Abs. │        │
│ └─────┴─────┴─────┘        │
│                             │
│ My Classes (2)              │
│                             │
│ ┌─────────────────────────┐ │
│ │ 📚 Grade 9-A           │ │
│ │ Form Teacher           │ │
│ │ 32 Present, 3 Absent   │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ 📚 Grade 9-B           │ │
│ │ Mathematics            │ │
│ │ 30 Present, 5 Absent   │ │
│ └─────────────────────────┘ │
│                             │
│ Quick Actions               │
│ [✍️ Mark Attendance]        │
│ [📊 View Reports]           │
│ [⚠️ Report Lost Card]       │
│                             │
└─────────────────────────────┘
│ Home  Classes  Profile    │
└─────────────────────────────┘
```

#### Screen 3: Mark Manual Attendance
```
┌─────────────────────────────┐
│ ← Manual Attendance         │
├─────────────────────────────┤
│ Class: [Grade 9-A ▼]       │
│ Date:  [Today ▼]           │
│                             │
│ [Select All Present]        │
│                             │
│ ☑ John Smith       [✅]    │
│   RFID001                   │
│                             │
│ ☑ Sarah Johnson    [✅]    │
│   RFID002                   │
│                             │
│ ☐ Michael Brown    [❌]    │
│   RFID003 - Already marked  │
│                             │
│ ☑ Emily Davis      [⚠️]    │
│   RFID004                   │
│                             │
│ ☑ David Wilson     [❌]    │
│   RFID005                   │
│                             │
│ Reason (Required):          │
│ ┌─────────────────────────┐ │
│ │Lost card, manual mark   │ │
│ └─────────────────────────┘ │
│                             │
│ [Submit Attendance]         │
│                             │
└─────────────────────────────┘
```

#### Screen 4: Class Details
```
┌─────────────────────────────┐
│ ← Grade 9-A Students        │
├─────────────────────────────┤
│ Form Teacher: Mrs. Smith    │
│ Total Students: 35          │
│                             │
│ Today's Attendance:         │
│ ✅ 32  ⚠️ 2  ❌ 1         │
│                             │
│ [Export] [Mark Attendance]  │
│                             │
│ Search: [_________] [🔍]    │
│                             │
├─────────────────────────────┤
│ 1. John Smith         ✅   │
│    Grade 9-A | RFID001      │
│    Check-in: 07:15 AM       │
│                             │
│ 2. Sarah Johnson      ✅   │
│    Grade 9-A | RFID002      │
│    Check-in: 07:20 AM       │
│                             │
│ 3. Michael Brown      ⚠️   │
│    Grade 9-A | RFID003      │
│    Check-in: 08:55 AM (Late)│
│                             │
│ 4. Emily Davis        ❌   │
│    Grade 9-A | RFID004      │
│    Absent                   │
│                             │
│ [Load More]                 │
│                             │
└─────────────────────────────┘
```

### 5.4 API Endpoints for Teacher App

```javascript
// Teacher authentication
POST   /api/v1/auth/teacher/login             // Teacher login
GET    /api/v1/auth/teacher/me                // Get teacher profile
POST   /api/v1/auth/teacher/reset-password    // Password reset

// Teacher classes
GET    /api/v1/teacher/classes                // Get assigned classes
GET    /api/v1/teacher/classes/:id/students   // Get students in class
GET    /api/v1/teacher/classes/:id/attendance // Get attendance for class

// Teacher attendance
POST   /api/v1/teacher/attendance/manual      // Mark manual attendance
GET    /api/v1/teacher/attendance/today       // Get today's attendance summary

// Lost card reporting
POST   /api/v1/teacher/students/:id/report-lost-card  // Report lost card
```

---

## 6. Phase 5: Lost Card Management

### 6.1 Lost/Damaged Card Workflow

#### Scenario
Student loses or damages their RFID card and needs a replacement.

#### Workflow

```
   Student reports to Teacher
            ↓
   Teacher reports in app/dashboard
            ↓
   Request sent to School Admin
            ↓
   Admin reviews request
            ↓
     ┌──────┴──────┐
     │             │
  Approve      Reject
     │             │
     ↓             ↓
Issue new    Notify teacher
  card       (with reason)
     ↓
Update student
  RFID in DB
     ↓
Old card deactivated
New card activated
     ↓
Notify teacher & parent
```

### 6.2 Database Schema

**New Table: `card_requests`**
```sql
CREATE TABLE card_requests (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id) NOT NULL,
  school_id INTEGER REFERENCES schools(id) NOT NULL,
  requested_by INTEGER REFERENCES users(id) NOT NULL, -- Teacher who reported
  request_type VARCHAR(50) NOT NULL, -- 'lost', 'damaged', 'new'
  old_card_id VARCHAR(100), -- Previous RFID card ID
  new_card_id VARCHAR(100), -- New RFID card ID (after approval)
  reason TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6.3 UI Implementation

#### Teacher App: Report Lost Card
```
┌─────────────────────────────┐
│ ← Report Lost/Damaged Card  │
├─────────────────────────────┤
│ Student: [Search student]   │
│                             │
│ Selected: John Smith        │
│ Grade: 9-A                  │
│ Current Card: RFID001       │
│                             │
│ Request Type:               │
│ ⚪ Lost Card                │
│ ⚪ Damaged Card             │
│ ⚪ Card Not Working         │
│                             │
│ Description:                │
│ ┌─────────────────────────┐ │
│ │Student reported card    │ │
│ │lost during lunch break  │ │
│ │on 12 Oct 2025          │ │
│ └─────────────────────────┘ │
│                             │
│ [Cancel] [Submit Request]   │
│                             │
└─────────────────────────────┘
```

#### School Admin Dashboard: Card Requests
```
┌────────────────────────────────────────────────────────────┐
│ RFID Card Requests                         [Pending: 3]    │
├────────────────────────────────────────────────────────────┤
│ Tabs: [Pending] [Approved] [Rejected] [All]              │
│                                                             │
├─────────┬──────────────┬──────────┬───────────┬──────────┤
│ Student │ Request Type │ Old Card │ Requested │ Action   │
├─────────┼──────────────┼──────────┼───────────┼──────────┤
│ John    │ Lost Card    │ RFID001  │ 2 hrs ago │ [Approve]│
│ Smith   │ By: Mrs.S    │          │ Mrs. Smith│ [Reject] │
│ Grade   │ "Card lost   │          │           │ [Details]│
│ 9-A     │  at lunch"   │          │           │          │
│         │              │          │           │          │
│ Sarah   │ Damaged      │ RFID002  │ 1 day ago │ [Approve]│
│ Johnson │ By: Mr.J     │          │ Mr. John  │ [Reject] │
│ Grade   │ "Card        │          │           │ [Details]│
│ 9-A     │  cracked"    │          │           │          │
└─────────┴──────────────┴──────────┴───────────┴──────────┘
```

**Approve Card Request Modal**:
```
┌─────────────────────────────────────┐
│ Approve Card Request             [X]│
├─────────────────────────────────────┤
│ Student: John Smith                 │
│ Grade: 9-A                          │
│ Old Card: RFID001                   │
│                                     │
│ New Card ID:                        │
│ [RFID100    ]  [Scan Card]         │
│                                     │
│ ⚠️ Warning: Old card will be       │
│ deactivated immediately             │
│                                     │
│ Admin Notes:                        │
│ ┌─────────────────────────────────┐ │
│ │New card issued on 12 Oct 2025   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ☑ Send notification to teacher      │
│ ☑ Send SMS to parent               │
│                                     │
│      [Cancel]  [Approve & Issue]   │
│                                     │
└─────────────────────────────────────┘
```

### 6.4 Temporary Manual Attendance

While waiting for new card:
- Student's profile marked as "Card Pending"
- Teacher sees indicator in attendance list
- Teacher must mark manual attendance
- Automatic reminder to admin if request pending >2 days

---

## 7. Phase 6: Advanced Features

### 7.1 SMS Notifications

**Integration**: Twilio / MessageBird / Local SMS Gateway

**Notification Types**:
1. Student arrival SMS to parent
2. Student late arrival SMS to parent
3. Student absent notification (end of day)
4. New card issued notification
5. Manual attendance marked notification

**Implementation**:
```javascript
const sendSMS = async (phoneNumber, message) => {
  const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

  await client.messages.create({
    body: message,
    from: TWILIO_PHONE,
    to: phoneNumber
  });
};
```

### 7.2 Advanced Reporting

**Reports**:
1. **Monthly Attendance Report**
   - Per student attendance percentage
   - Class-wise comparison
   - Late arrival trends

2. **Student Attendance Trend**
   - Daily attendance graph
   - Identify habitually late/absent students

3. **Teacher Performance Report**
   - Manual attendance frequency
   - Response time to card requests

4. **Device Usage Report**
   - Check-ins per device
   - Device uptime/downtime

### 7.3 Parent Portal (Future Phase)

**Parent Login**:
- View their child's attendance
- Receive real-time notifications
- Submit leave applications
- View monthly reports

### 7.4 Biometric Integration

**Future Hardware**:
- Fingerprint scanners
- Face recognition cameras
- Combine with RFID for dual authentication

---

## 8. Complete Database Schema

### Full ERD (Entity Relationship Diagram)

```
┌─────────────┐         ┌─────────────┐
│   schools   │◄────────│    users    │
│             │         │  (admins,   │
│ • id (PK)   │         │  teachers)  │
│ • name      │         │             │
│ • code      │         │ • id (PK)   │
│ • address   │         │ • email     │
└─────────────┘         │ • role      │
       │                │ • school_id │
       │                └─────────────┘
       │                       │
       ↓                       │
┌─────────────┐                │
│   classes   │                │
│             │                │
│ • id (PK)   │                │
│ • school_id │                │
│ • name      │                │
└─────────────┘                │
       │                       │
       ↓                       │
┌─────────────┐                │
│  sections   │◄───────────────┘
│             │   (form_teacher)
│ • id (PK)   │
│ • class_id  │
│ • name      │
│ • form_tchr │
└─────────────┘
       │
       ↓
┌─────────────┐         ┌─────────────────┐
│  students   │─────────►│ attendance_logs │
│             │         │                 │
│ • id (PK)   │         │ • id (PK)       │
│ • school_id │         │ • student_id    │
│ • section_id│         │ • device_id     │
│ • rfid_card │         │ • check_in_time │
│ • name      │         │ • status        │
└─────────────┘         │ • marking_type  │
                        │ • marked_by     │
                        └─────────────────┘
       │
       ↓
┌─────────────┐
│card_requests│
│             │
│ • id (PK)   │
│ • student_id│
│ • old_card  │
│ • new_card  │
│ • status    │
└─────────────┘
```

### Complete SQL Schema

See **DATABASE_SCHEMA.sql** for full CREATE TABLE statements.

---

## 9. API Specifications

### Complete API List (150+ endpoints)

See **API_DOCUMENTATION.md** for:
- Full request/response schemas
- Authentication requirements
- Error codes
- Rate limiting
- Webhooks

---

## 10. Implementation Timeline

### Phase 1: Classes & Teachers (4 weeks)

**Week 1-2**: Backend
- Database migrations
- API endpoints for classes, sections
- Teacher management APIs
- Role-based access control

**Week 3-4**: Frontend
- Classes management UI
- Teacher management UI
- Assignment interface
- Testing

### Phase 2: Manual Attendance (3 weeks)

**Week 1-2**: Backend & Frontend
- Manual attendance APIs
- Admin UI for manual marking
- Approval workflow

**Week 3**: Testing
- Edge cases
- Teacher permissions
- Audit trails

### Phase 3: Attendance Rules (2 weeks)

**Week 1**: Backend
- Rules engine implementation
- Settings configuration
- Device API updates

**Week 2**: Frontend & Testing
- Settings UI
- Device testing
- Rule validation

### Phase 4: Teacher Mobile App (8 weeks)

**Week 1-2**: Setup & Architecture
- React Native setup
- Navigation structure
- API integration

**Week 3-5**: Core Features
- Login & authentication
- Dashboard
- Class viewing
- Manual attendance

**Week 6-7**: Polish & Testing
- UI/UX improvements
- iOS testing
- Android testing

**Week 8**: Deployment
- App Store submission
- Play Store submission

### Phase 5: Lost Card Management (2 weeks)

**Week 1**: Backend & UI
- Request system
- Admin approval workflow

**Week 2**: Integration & Testing
- Teacher app integration
- Notification system

### Phase 6: Advanced Features (Ongoing)

- SMS integration: 1 week
- Advanced reporting: 2 weeks
- Parent portal: 6 weeks
- Biometric: 4 weeks

---

## 📊 Summary

### Total Development Time: ~6 months

**Priority Order**:
1. ⭐ Phase 1: Classes & Teachers (Foundation)
2. ⭐ Phase 3: Attendance Rules (Critical for schools)
3. ⭐ Phase 2: Manual Attendance (Essential backup)
4. ⭐ Phase 4: Teacher App (High value)
5. Phase 5: Lost Cards (Nice to have)
6. Phase 6: Advanced Features (Future enhancement)

### Team Requirements

**Backend Developer**: 1 full-time
**Frontend Developer**: 1 full-time
**Mobile Developer**: 1 full-time (for Phase 4)
**UI/UX Designer**: 1 part-time
**QA Tester**: 1 part-time

### Budget Estimate

**Development**: $40,000 - $60,000
**Hardware (RFID devices)**: $300 - $500 per school
**Cloud Hosting**: $100 - $300/month
**SMS Gateway**: $0.01 - $0.05 per SMS

---

**Document Version**: 1.0
**Created**: October 12, 2025
**Status**: 📋 Planning Phase - Ready for Development
