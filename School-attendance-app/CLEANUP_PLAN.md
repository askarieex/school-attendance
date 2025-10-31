# 🧹 **APP CLEANUP PLAN**

## ✅ **FILES TO KEEP:**

### **Screens (Active):**
1. ✅ `welcome_screen.dart` - App entry point
2. ✅ `login_screen.dart` - Teacher/Parent login
3. ✅ `student_dashboard.dart` - Parent dashboard (viewing child attendance)
4. ✅ `teacher_home_new.dart` - Teacher home with sidebar ⭐ NEW
5. ✅ `class_details_screen.dart` - View students in class
6. ✅ `attendance_calendar_enhanced.dart` - Monthly calendar view ⭐ NEW

### **Services:**
1. ✅ `api_service.dart` - HTTP requests
2. ✅ `storage_service.dart` - Local storage
3. ✅ `teacher_service.dart` - Teacher-specific API calls

### **Providers:**
1. ✅ `auth_provider.dart` - Authentication state
2. ✅ `attendance_provider.dart` - Attendance state

### **Models:**
1. ✅ `user.dart` - User model
2. ✅ `student.dart` - Student model
3. ✅ `attendance_record.dart` - Attendance model
4. ✅ `class_info.dart` - Class model

### **Config:**
1. ✅ `api_config.dart` - API endpoints

### **Main:**
1. ✅ `main.dart` - App entry

---

## ❌ **FILES TO DELETE (Unused/Old):**

### **Old/Duplicate Screens:**
1. ❌ `attendance_calendar_screen.dart` - OLD version (replaced by enhanced)
2. ❌ `teacher_dashboard_screen.dart` - OLD teacher dashboard
3. ❌ `teacher_dashboard.dart` - VERY OLD teacher dashboard
4. ❌ `parent_dashboard.dart` - Not used (student_dashboard used instead)
5. ❌ `class_roster_screen.dart` - Not used
6. ❌ `attendance_history_screen.dart` - Not used
7. ❌ `request_absence_screen.dart` - Not implemented yet

**Total to delete: 7 files**

---

## 📝 **RENAME SUGGESTIONS:**

### **Current Name → Better Name:**
1. `student_dashboard.dart` → Keep as is (used for parents)
2. `teacher_home_new.dart` → Keep as is (clearly the new version)

---

## 📂 **FINAL PROJECT STRUCTURE:**

```
lib/
├── config/
│   └── api_config.dart
├── models/
│   ├── attendance_record.dart
│   ├── class_info.dart
│   ├── student.dart
│   └── user.dart
├── providers/
│   ├── attendance_provider.dart
│   └── auth_provider.dart
├── screens/
│   ├── attendance_calendar_enhanced.dart ⭐
│   ├── class_details_screen.dart
│   ├── login_screen.dart
│   ├── student_dashboard.dart (Parent view)
│   ├── teacher_home_new.dart ⭐
│   └── welcome_screen.dart
├── services/
│   ├── api_service.dart
│   ├── storage_service.dart
│   └── teacher_service.dart
└── main.dart
```

---

## 🎯 **CLEANUP ACTIONS:**

### **Step 1: Delete old files ✅**
- attendance_calendar_screen.dart
- teacher_dashboard_screen.dart
- teacher_dashboard.dart
- parent_dashboard.dart
- class_roster_screen.dart
- attendance_history_screen.dart
- request_absence_screen.dart

### **Step 2: Verify app still works ✅**
- Hot restart
- Test login
- Test teacher dashboard
- Test calendar

### **Step 3: Clean imports ✅**
- No unused imports remaining

---

## ✅ **RESULT:**

**Before:**
- 24 files
- 7 unused files
- Confusing structure

**After:**
- 17 files ✨
- All files used
- Clean structure
- Easy to maintain

---

**Clean, organized, production-ready code!** 🎉
