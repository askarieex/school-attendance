# Academic Year System - Quick Reference Guide

**Date:** November 7, 2025

---

## 🔄 Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER ACTIONS                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────────────────────┐
        │   Open Settings > Academic Year Tab   │
        └───────────────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────────────────────┐
        │   Frontend: Settings.js               │
        │   - fetchAcademicYears()              │
        │   - Displays: Current + List         │
        └───────────────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────────────────────┐
        │   API Call: academicYearAPI.getAll()  │
        │   → GET /school/academic-years        │
        └───────────────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────────────────────┐
        │   Backend: academicYearController.js  │
        │   - getAcademicYears()                │
        │   - Calls Model.findAll()             │
        └───────────────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────────────────────┐
        │   Model: AcademicYear.js              │
        │   - AcademicYear.findAll(schoolId)   │
        │   - SELECT * FROM academic_years      │
        └───────────────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────────────────────┐
        │   Database: academic_years table      │
        │   - Returns all years for school      │
        │   - Ordered by start_date DESC        │
        └───────────────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────────────────────┐
        │   Response: JSON Array                │
        │   [                                    │
        │     { id: 6, year_name: '2025-2026',  │
        │       is_current: true },              │
        │     { id: 13, year_name: '2026-2027', │
        │       is_current: false }              │
        │   ]                                    │
        └───────────────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────────────────────┐
        │   Frontend Renders:                    │
        │   ┌─────────────────────────────┐    │
        │   │ CURRENT                      │    │
        │   │ 2025-2026                    │    │
        │   │ 01/04/2025 - 31/03/2026     │    │
        │   └─────────────────────────────┘    │
        │   ┌─────────────────────────────┐    │
        │   │ 2025-2026 [ACTIVE]          │ ←─ │─ BUG: Duplicate!
        │   └─────────────────────────────┘    │
        │   ┌─────────────────────────────┐    │
        │   │ 2026-2027 [Set as Current]  │    │
        │   └─────────────────────────────┘    │
        └───────────────────────────────────────┘
```

---

## 🎯 Set Current Year Flow

```
User clicks "Set as Current" on 2026-2027
                │
                ▼
┌───────────────────────────────────────┐
│ Frontend: handleSetCurrentYear(13)    │ ← BUG: No confirmation!
└───────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│ API: PUT /school/academic-years/13/   │
│      set-current                       │
└───────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│ Controller: setCurrentAcademicYear()   │
│ - Validates year exists                │
│ - Calls Model.setCurrent(13, 6)       │
└───────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│ Model: AcademicYear.setCurrent()       │
│ Step 1: UPDATE academic_years          │
│         SET is_current = FALSE         │
│         WHERE school_id = 6            │
│                                         │
│ Step 2: UPDATE academic_years          │
│         SET is_current = TRUE          │
│         WHERE id = 13                  │
└───────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│ Database Trigger Fires:                │
│ ensure_one_current_year_trigger        │
│ - Double-checks only ONE is_current    │
│ - Unsets others if needed              │
└───────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│ Result:                                │
│ • 2025-2026: is_current = FALSE        │
│ • 2026-2027: is_current = TRUE  ✅     │
│                                         │
│ Side Effect:                           │
│ • All student queries now filter by    │
│   '2026-2027'                          │
│ • Students with '2025-2026' won't show │
└───────────────────────────────────────┘
```

---

## 👨‍🎓 Student Academic Year Auto-Update

```
Admin creates new student in Class 1, Section A
                │
                ▼
┌────────────────────────────────────────┐
│ INSERT INTO students (                 │
│   full_name = 'John Doe',              │
│   section_id = 9,                      │
│   academic_year = NULL  ← Not provided │
│ )                                       │
└────────────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────┐
│ ⚡ TRIGGER FIRES:                      │
│ set_student_academic_year_trigger      │
└────────────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────┐
│ Function: set_student_academic_year()  │
│                                         │
│ IF NEW.section_id IS NOT NULL THEN     │
│   SELECT academic_year INTO var        │
│   FROM sections                        │
│   WHERE id = NEW.section_id            │
│                                         │
│   NEW.academic_year := var  ← Auto-set!│
│ END IF                                  │
└────────────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────┐
│ Result:                                │
│ Student created with:                  │
│ • section_id = 9                       │
│ • academic_year = '2025-2026'  ✅      │
│   (copied from section)                │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ ⚠️ BUG #3:                             │
│ If admin manually sets academic_year,  │
│ trigger OVERWRITES it on next update!  │
│                                         │
│ Example:                               │
│ 1. Admin sets academic_year = '2024-25'│
│ 2. Admin updates roll_number           │
│ 3. Trigger resets to section's year    │
│ 4. Manual change is LOST! ❌           │
└────────────────────────────────────────┘
```

---

## 🎓 Student Promotion Flow

```
Admin wants to promote all students from 2025-2026 → 2026-2027
                │
                ▼
┌────────────────────────────────────────┐
│ API: POST /school/academic-years/      │
│      promotion                          │
│ Body: {                                │
│   fromYear: '2025-2026',               │
│   toYear: '2026-2027',                 │
│   confirm: true                        │
│ }                                       │
└────────────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────┐
│ Controller: promoteStudents()          │
│ - Validates years exist                │
│ - Checks confirm = true                │
│ - Calls Model.promoteStudents()        │
└────────────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────┐
│ Model: AcademicYear.promoteStudents()  │
│                                         │
│ Step 1: Validate years exist           │
│ Step 2: Count students to promote      │
│ Step 3: DISABLE trigger (important!)   │
│         ALTER TABLE students            │
│         DISABLE TRIGGER                 │
│         set_student_academic_year_      │
│         trigger                         │
│                                         │
│ Step 4: UPDATE students                │
│         SET academic_year = '2026-2027'│
│         WHERE academic_year = '2025-26'│
│         AND is_active = TRUE           │
│                                         │
│ Step 5: Re-enable trigger              │
│         ALTER TABLE students            │
│         ENABLE TRIGGER                  │
│                                         │
│ Step 6: Log promotion                  │
└────────────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────┐
│ Result:                                │
│ • 150 students promoted ✅             │
│ • All now have academic_year =         │
│   '2026-2027'                          │
│                                         │
│ ⚠️ BUG #6:                             │
│ Attendance records NOT updated!        │
│ • Attendance still has old year        │
│ • Historical reports might be wrong    │
└────────────────────────────────────────┘
```

---

## 📊 Database Schema

```sql
┌──────────────────────────────────────────────────┐
│            academic_years table                   │
├──────────────────────────────────────────────────┤
│ id (PK)              SERIAL                       │
│ school_id (FK)       INTEGER → schools(id)       │
│ year_name            VARCHAR(50)  '2025-2026'    │
│ start_date           DATE          '2025-04-01'  │
│ end_date             DATE          '2026-03-31'  │
│ is_current           BOOLEAN       TRUE/FALSE    │ ← Only ONE per school!
│ working_days         VARCHAR(50)   'Mon-Sat'     │
│ weekly_holiday       VARCHAR(50)   'Sunday'      │
│ created_at           TIMESTAMP                    │
│ updated_at           TIMESTAMP                    │
├──────────────────────────────────────────────────┤
│ UNIQUE(school_id, year_name)                     │
└──────────────────────────────────────────────────┘
                │
                │ Referenced by
                ▼
┌──────────────────────────────────────────────────┐
│               students table                      │
├──────────────────────────────────────────────────┤
│ id (PK)              SERIAL                       │
│ school_id            INTEGER                      │
│ full_name            VARCHAR(255)                 │
│ section_id           INTEGER                      │
│ academic_year        VARCHAR(20)  ← ⚠️ No FK!    │ ← BUG: Should be VARCHAR(50)
│ ...                                               │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│          attendance_logs table                    │
├──────────────────────────────────────────────────┤
│ id (PK)              SERIAL                       │
│ student_id (FK)      INTEGER → students(id)      │
│ school_id            INTEGER                      │
│ date                 DATE                         │
│ academic_year        VARCHAR(20)  ← ⚠️ No FK!    │
│ ...                                               │
└──────────────────────────────────────────────────┘
```

---

## 🐛 Top 10 Critical Bugs (Quick Summary)

| # | Bug | Severity | Impact |
|---|-----|----------|--------|
| 1 | Duplicate current year displayed in UI | Medium | Confusing UX |
| 2 | No loading state when creating year | Low | Poor UX |
| 3 | Trigger overwrites manual academic year | **CRITICAL** | Data loss |
| 4 | No date overlap validation | High | Data integrity |
| 5 | Can delete year with students | **CRITICAL** | Orphaned data |
| 6 | Promotion doesn't update attendance | High | Incorrect reports |
| 7 | No promotion UI (feature missing) | Medium | Missing feature |
| 8 | No year name format validation | Medium | Bad data |
| 9 | No auto-generation of year name | Low | Poor UX |
| 10 | No confirmation for setting current | High | Accidental changes |

---

## ✅ Quick Fix Priority

### Fix Today (Critical):
1. **BUG #3**: Update student trigger to not overwrite manual year
2. **BUG #5**: Prevent deleting years with students
3. **BUG #10**: Add confirmation dialog for setting current

### Fix This Week (High):
4. Remove duplicate year display (BUG #1)
5. Add date overlap validation (BUG #4)
6. Add year format validation (BUG #8)
7. Make promotion transactional (ISSUE #2)

### Fix Next Week (Medium):
8. Build promotion UI (BUG #7)
9. Auto-generate year names (BUG #9)
10. Update attendance on promotion (BUG #6)

---

## 🎯 Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/school/academic-years` | Get all years for school |
| GET | `/school/academic-years/current` | Get current year |
| POST | `/school/academic-years` | Create new year |
| PUT | `/school/academic-years/:id` | Update year |
| PUT | `/school/academic-years/:id/set-current` | Set as current ⚡ |
| DELETE | `/school/academic-years/:id` | Delete year (if no students) |
| GET | `/school/academic-years/promotion/preview` | Preview promotion |
| POST | `/school/academic-years/promotion` | Promote students |

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `school-dashboard/src/pages/Settings.js` | UI for academic year management |
| `school-dashboard/src/utils/api.js` | API client methods |
| `backend/src/controllers/academicYearController.js` | Business logic |
| `backend/src/models/AcademicYear.js` | Database operations |
| `backend/src/routes/school.routes.js` | Route definitions |
| `backend/src/utils/academicYear.js` | Helper functions |
| `backend/migrations/013_add_academic_years_system.sql` | Database schema |

---

## 🔧 Quick SQL Fixes

### Fix #1: Prevent trigger from overwriting manual year
```sql
CREATE OR REPLACE FUNCTION set_student_academic_year()
RETURNS TRIGGER AS $$
DECLARE
  section_year VARCHAR(20);
BEGIN
  -- Only set if academic_year is NULL
  IF NEW.section_id IS NOT NULL AND NEW.academic_year IS NULL THEN
    SELECT academic_year INTO section_year
    FROM sections WHERE id = NEW.section_id;
    NEW.academic_year := section_year;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Fix #2: Add check before deleting year
```sql
-- Add to deleteAcademicYear controller
SELECT COUNT(*) as count
FROM students
WHERE academic_year = 'YEAR_TO_DELETE'

-- If count > 0, reject deletion
```

### Fix #3: Update column sizes
```sql
ALTER TABLE students ALTER COLUMN academic_year TYPE VARCHAR(50);
ALTER TABLE attendance_logs ALTER COLUMN academic_year TYPE VARCHAR(50);
ALTER TABLE sections ALTER COLUMN academic_year TYPE VARCHAR(50);
```

---

**Analyzed by:** Claude Code
**Date:** November 7, 2025
