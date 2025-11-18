# 🎓 COMPLETE TEACHER SYSTEM DEEP ANALYSIS
## Web Dashboard & Flutter Mobile App - Full Data Flow Documentation

**Generated:** November 4, 2025
**System Version:** v2.0
**Analysis Scope:** Teachers & Subjects Management + Flutter Teacher Mobile App

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Web Dashboard Analysis](#web-dashboard-analysis)
   - [Teachers Management](#teachers-management-page)
   - [Subjects Management](#subjects-management-page)
3. [Flutter App Analysis](#flutter-mobile-app-analysis)
   - [Authentication Flow](#1-authentication-flow)
   - [Teacher Dashboard](#2-teacher-dashboard)
   - [Navigation & Data](#3-navigation--data-flow)
4. [Backend API Routes](#backend-api-routes)
5. [Security & Authorization](#security--authorization)
6. [Data Flow Diagrams](#data-flow-diagrams)

---

## EXECUTIVE SUMMARY

This document provides a complete analysis of the teacher management system across three platforms:

1. **Web Dashboard (React)** - School admins manage teachers and subjects
2. **Flutter Mobile App** - Teachers mark attendance and view classes
3. **Node.js Backend API** - Handles all data operations with PostgreSQL

### Key Technologies

- **Frontend:** React + React Router + Provider pattern
- **Mobile:** Flutter + Provider state management + SharedPreferences
- **Backend:** Node.js + Express + PostgreSQL
- **Auth:** JWT (Access + Refresh tokens)
- **API Design:** RESTful with multi-tenant isolation

---

# WEB DASHBOARD ANALYSIS

## 1. TEACHERS MANAGEMENT PAGE

**Location:** `/Users/askerymalik/Documents/Development/school-attendance-sysytem/school-dashboard/src/pages/Teachers.js`

### Component Overview

```javascript
const Teachers = () => {
  // State Management
  const [teachers, setTeachers] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
```

### Data Flow

#### 1. Initial Load (useEffect on line 39)

```javascript
useEffect(() => {
  fetchTeachers();
  fetchSections();
  fetchSubjects();
}, [currentPage]);
```

**API Calls:**

1. **GET /api/v1/school/teachers** (line 48)
   ```javascript
   const response = await teachersAPI.getAll({ page: currentPage, limit: 20 });
   ```
   - Returns: Teachers with assignments, statistics
   - Pagination: 20 teachers per page

2. **GET /api/v1/school/sections** (line 63)
   ```javascript
   const response = await sectionsAPI.getAll();
   ```
   - Returns: All sections for dropdown

3. **GET /api/v1/school/subjects** (line 74)
   ```javascript
   const response = await subjectsAPI.getAll();
   ```
   - Returns: All subjects for dropdown

#### 2. Create Teacher (line 83)

```javascript
const handleAddTeacher = async (e) => {
  e.preventDefault();

  const newTeacher = {
    fullName: '',
    email: '',
    phone: '',
    subjectSpecialization: '',
    qualification: '',
    dateOfJoining: '',
    password: 'teacher123'  // Default password
  };

  const response = await teachersAPI.create(newTeacher);
}
```

**POST /api/v1/school/teachers**
- Creates user account with role 'teacher'
- Auto-generates teacher_code
- Hashes password with bcrypt
- Returns teacher object with user_id

#### 3. Assign Teacher to Section (line 121)

```javascript
const handleAssignToSection = async (e) => {
  e.preventDefault();

  await teachersAPI.assignToSection(selectedTeacher.id, {
    sectionId: assignment.sectionId,
    subjectId: assignment.subjectId,
    isFormTeacher: assignment.isFormTeacher,
    academicYear: '2025-2026'
  });
}
```

**POST /api/v1/school/teachers/:id/assignments**
- Creates entry in `teacher_class_assignments` table
- Links: teacher → section → subject
- Marks as form teacher if checkbox selected

#### 4. Teacher Card Display (line 322)

Shows for each teacher:
- Name, email, phone
- Teacher code (e.g., TCH-001)
- Subject specialization
- Active/Inactive status
- **Assignment Table:**
  - Class + Section (e.g., Grade 6-A)
  - Subject (e.g., Mathematics)
  - Form teacher badge

#### 5. Statistics (line 164)

```javascript
const stats = {
  total: teachers.length,
  active: teachers.filter(t => t.user_active).length,
  inactive: teachers.filter(t => !t.user_active).length,
  withAssignments: teachers.filter(t => t.assignments && t.assignments.length > 0).length,
  formTeachers: teachers.filter(t => t.assignments?.some(a => a.is_form_teacher)).length
};
```

### Backend Controller

**File:** `/backend/src/controllers/teacherController.js`

#### GET All Teachers (line 9)

```javascript
const getTeachers = async (req, res) => {
  const { page = 1, limit = 20, subject, search } = req.query;
  const schoolId = req.tenantSchoolId;  // Multi-tenant isolation

  const filters = {};
  if (subject) filters.subject = subject;
  if (search) filters.search = search;

  const result = await Teacher.findAll(schoolId, parseInt(page), parseInt(limit), filters);

  sendPaginated(res, result.teachers, page, limit, result.total);
};
```

#### POST Create Teacher (line 33)

```javascript
const createTeacher = async (req, res) => {
  const schoolId = req.tenantSchoolId;
  const teacherData = req.body;

  // Validate required fields
  if (!teacherData.fullName || !teacherData.email) {
    return sendError(res, 'Full name and email are required', 400);
  }

  const teacher = await Teacher.create(teacherData, schoolId);

  sendSuccess(res, teacher, 'Teacher created successfully', 201);
};
```

#### POST Assign to Section (line 164)

```javascript
const assignTeacherToSection = async (req, res) => {
  const { id } = req.params;
  const assignmentData = req.body;

  // Security check: Verify section belongs to same school
  const Section = require('../models/Section');
  const section = await Section.findById(assignmentData.sectionId);

  const sectionClass = await Class.findById(section.class_id);
  if (sectionClass.school_id !== req.tenantSchoolId) {
    return sendError(res, 'Cannot assign teacher to another school\'s section', 403);
  }

  const assignment = await Teacher.assignToSection(id, assignmentData);

  sendSuccess(res, assignment, 'Teacher assigned to section successfully', 201);
};
```

---

## 2. SUBJECTS MANAGEMENT PAGE

**Location:** `/school-dashboard/src/pages/Subjects.js`

### Component Overview

```javascript
const Subjects = () => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
```

### Data Flow

#### 1. Fetch Subjects (line 25)

```javascript
const fetchSubjects = async () => {
  setLoading(true);
  const response = await subjectsAPI.getAll({ includeStats: true });

  if (response.success && response.data) {
    const subjectsArray = response.data.subjects || [];
    setSubjects(subjectsArray);
  }
};
```

**GET /api/v1/school/subjects?includeStats=true**

Response structure:
```json
{
  "success": true,
  "message": "Subjects retrieved successfully",
  "data": {
    "subjects": [
      {
        "id": 1,
        "subject_name": "Mathematics",
        "subject_code": "MATH",
        "description": "Mathematics subject",
        "is_active": true,
        "teacher_count": 3,
        "assignment_count": 5,
        "section_count": 5
      }
    ],
    "count": 12
  }
}
```

#### 2. Create Subject (line 63)

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();

  const formData = {
    subjectName: '',
    subjectCode: '',
    description: '',
    isActive: true
  };

  await subjectsAPI.create(formData);
};
```

**POST /api/v1/school/subjects**
- Validates unique subject name per school
- Auto-generates ID
- Returns created subject

#### 3. Create Default Subjects (line 46)

```javascript
const handleCreateDefaults = async () => {
  if (!window.confirm('Create 8 default subjects?')) return;

  const response = await subjectsAPI.createDefaults();
};
```

**POST /api/v1/school/subjects/create-defaults**

Creates 8 default subjects:
1. Mathematics (MATH)
2. English (ENG)
3. Science (SCI)
4. Social Studies (SS)
5. Computer Science (CS)
6. Physical Education (PE)
7. Art (ART)
8. Music (MUS)

#### 4. Subject Display (line 210)

Each subject card shows:
- Subject name
- Subject code
- Description
- Active/Inactive badge
- **Statistics:**
  - Number of teachers assigned
  - Number of class assignments

### Backend Controller

**File:** `/backend/src/controllers/subjectController.js`

#### GET All Subjects (line 14)

```javascript
const getAllSubjects = async (req, res) => {
  const schoolId = req.user.schoolId;
  const { includeInactive, includeStats } = req.query;

  const options = {
    includeInactive: includeInactive === 'true',
    includeStats: includeStats === 'true'
  };

  const subjects = await Subject.findAll(schoolId, options);

  return sendSuccess(res, {
    subjects,
    count: subjects.length
  }, 'Subjects retrieved successfully');
};
```

**⚠️ CRITICAL FIX APPLIED:**

Line 36-39 - Parameter order was corrected:
```javascript
// BEFORE (WRONG):
return sendSuccess(res, 'Subjects retrieved successfully', { subjects, count });

// AFTER (CORRECT):
return sendSuccess(res, { subjects, count }, 'Subjects retrieved successfully');
```

**sendSuccess signature:**
```javascript
sendSuccess(res, data, message, statusCode)
```

---

# FLUTTER MOBILE APP ANALYSIS

## 1. AUTHENTICATION FLOW

### Entry Point: main.dart

**Location:** `/School-attendance-app/lib/main.dart`

```dart
void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => AttendanceProvider()),
      ],
      child: MaterialApp(
        title: 'School Attendance',
        home: const WelcomeScreen(),
        routes: {
          '/teacher-login': (context) => const LoginScreen(isTeacher: true),
          '/teacher-dashboard': (context) => const TeacherDashboardScreen(),
        },
      ),
    );
  }
}
```

**State Management:** Provider pattern with ChangeNotifier

### Step 1: Welcome Screen

User taps "Teacher Login" → navigates to `/teacher-login`

### Step 2: Login Screen

**Location:** `/School-attendance-app/lib/screens/login_screen.dart`

```dart
class LoginScreen extends StatefulWidget {
  final bool isTeacher;  // true for teachers

  const LoginScreen({super.key, this.isTeacher = false});
}
```

#### UI Components:
- Email TextField (line 170)
- Password TextField with visibility toggle (line 239)
- Sign In button (line 382)

#### Login Handler (line 81):

```dart
Future<void> _handleLogin() async {
  if (!_formKey.currentState!.validate()) {
    return;
  }

  FocusScope.of(context).unfocus();
  _isLoading.value = true;

  try {
    final authProvider = context.read<AuthProvider>();

    final success = widget.isTeacher
        ? await authProvider.loginTeacher(
            _emailController.text.trim(),
            _passwordController.text,
          )
        : await authProvider.loginParent(
            _emailController.text.trim(),
            _passwordController.text,
          );

    if (!mounted) return;

    if (success) {
      Navigator.of(context).pushReplacementNamed(
        widget.isTeacher ? '/teacher-dashboard' : '/parent-dashboard',
      );
    } else {
      _errorMessage.value = authProvider.error ?? 'Login failed';
    }
  } catch (e) {
    _errorMessage.value = 'Network error. Please try again.';
  } finally {
    _isLoading.value = false;
  }
}
```

### Step 3: AuthProvider - Login Logic

**Location:** `/School-attendance-app/lib/providers/auth_provider.dart`

```dart
class AuthProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  final StorageService _storageService = StorageService();

  User? _currentUser;
  String? _error;
  String? _accessToken;

  // Getters
  User? get currentUser => _currentUser;
  String? get error => _error;
  bool get isLoggedIn => _currentUser != null;
  bool get isTeacher => _currentUser?.role == UserRole.teacher;
}
```

#### loginTeacher Method (line 23):

```dart
Future<bool> loginTeacher(String email, String password) async {
  _error = null;
  notifyListeners();

  try {
    print('🔐 Attempting teacher login: $email');

    // Call real API
    final response = await _apiService.post(
      ApiConfig.login,  // '/auth/login'
      {
        'email': email,
        'password': password,
      },
    );

    print('✅ Login response: $response');

    // Check if response has data
    if (response['success'] == true && response['data'] != null) {
      final data = response['data'];
      final user = data['user'];
      final accessToken = data['accessToken'];
      final refreshToken = data['refreshToken'];

      // Save tokens (with error handling for iOS simulator)
      try {
        await _storageService.saveAccessToken(accessToken);
        await _storageService.saveRefreshToken(refreshToken);
      } catch (storageError) {
        print('⚠️ Storage warning (non-critical): $storageError');
        // Continue anyway - tokens are in memory
      }

      _apiService.setTokens(accessToken, refreshToken);
      _accessToken = accessToken;

      // Create user object
      _currentUser = User(
        id: user['id'].toString(),
        email: user['email'],
        name: user['fullName'] ?? user['email'],
        role: user['role'] == 'teacher' ? UserRole.teacher : UserRole.parent,
        schoolName: user['school_name'],
      );

      print('✅ Login successful: ${_currentUser?.name}');
      notifyListeners();
      return true;
    } else {
      _error = response['message'] ?? 'Login failed';
      notifyListeners();
      return false;
    }
  } catch (e) {
    print('❌ Login error: $e');
    _error = 'Login failed: ${e.toString()}';
    notifyListeners();
    return false;
  }
}
```

### Step 4: API Service - HTTP Request

**Location:** `/School-attendance-app/lib/services/api_service.dart`

```dart
class ApiService {
  String? _accessToken;
  String? _refreshToken;

  // Cache for performance (30 second TTL)
  final Map<String, _CacheEntry> _cache = {};
  static const _cacheDuration = Duration(seconds: 30);
}
```

#### POST Method (line 90):

```dart
Future<Map<String, dynamic>> post(
  String endpoint,
  Map<String, dynamic> body, {
  bool requiresAuth = false,
}) async {
  try {
    return await _requestWithRetry(
      () => http.post(
        Uri.parse('${ApiConfig.baseUrl}$endpoint'),
        headers: _getHeaders(requiresAuth: requiresAuth),
        body: jsonEncode(body),
      ),
      requiresAuth: requiresAuth,
    );
  } catch (e) {
    print('❌ API Error (POST $endpoint): $e');
    throw ApiException('Network error: $e');
  }
}
```

#### Request with Retry (line 194):

```dart
Future<Map<String, dynamic>> _requestWithRetry(
  Future<http.Response> Function() request, {
  required bool requiresAuth,
  int retryCount = 0,
}) async {
  try {
    final response = await request().timeout(ApiConfig.connectTimeout);

    // Auto refresh token on 401
    if (response.statusCode == 401 && requiresAuth && retryCount == 0) {
      print('🔑 Access token expired. Attempting refresh...');
      await _handleTokenRefresh();
      // Retry the original request with the new token
      return await _requestWithRetry(request, requiresAuth: true, retryCount: 1);
    }

    return _handleResponse(response);
  } catch (e) {
    print('❌ Request failed: $e');
    throw ApiException('Network error: $e');
  }
}
```

### Step 5: Storage Service - Token Persistence

**Location:** `/School-attendance-app/lib/services/storage_service.dart`

Uses `SharedPreferences` (Flutter's local storage):

```dart
class StorageService {
  static const String _accessTokenKey = 'access_token';
  static const String _refreshTokenKey = 'refresh_token';
  static const String _userDataKey = 'user_data';

  // Save access token
  Future<void> saveAccessToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_accessTokenKey, token);
    print('✅ Access token saved');
  }

  // Get access token
  Future<String?> getAccessToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_accessTokenKey);
  }
}
```

**Storage Location:**
- **Android:** `/data/data/com.example.app/shared_prefs/FlutterSharedPreferences.xml`
- **iOS:** `NSUserDefaults`

### Step 6: API Configuration

**Location:** `/School-attendance-app/lib/config/api_config.dart`

```dart
class ApiConfig {
  // Base URL
  static const String baseUrl = 'http://localhost:3001/api/v1';

  // Timeout settings
  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);

  // Authentication Endpoints
  static const String login = '/auth/login';
  static const String refresh = '/auth/refresh';
  static const String getMe = '/auth/me';
}
```

---

## 2. TEACHER DASHBOARD

### Dashboard Entry

**Location:** `/School-attendance-app/lib/screens/teacher_dashboard_screen.dart`

```dart
class TeacherDashboardScreen extends StatefulWidget {
  const TeacherDashboardScreen({super.key});
}

class _TeacherDashboardScreenState extends State<TeacherDashboardScreen> {
  late TeacherService _teacherService;
  List<Map<String, dynamic>> _classes = [];
  bool _isLoading = true;
  int _selectedIndex = 0; // 0=Dashboard, 1=Classes, 2=Calendar
  Map<int, Map<String, int>> _attendanceStats = {}; // sectionId -> {present, late, absent}

  // Dashboard stats from backend
  Map<String, dynamic> _dashboardStats = {
    'totalStudents': 0,
    'boysCount': 0,
    'girlsCount': 0,
    'presentToday': 0,
    'lateToday': 0,
    'absentToday': 0,
    'leaveToday': 0,
    'notMarkedToday': 0,
    'attendancePercentage': 100,
  };
}
```

### initState - Load Data (line 42)

```dart
@override
void initState() {
  super.initState();
  final authProvider = Provider.of<AuthProvider>(context, listen: false);
  _teacherService = TeacherService(authProvider.apiService);
  _loadClasses();
}
```

### Load Classes (line 49)

```dart
Future<void> _loadClasses() async {
  final authProvider = Provider.of<AuthProvider>(context, listen: false);
  if (authProvider.currentUser?.id == null) return;

  setState(() => _isLoading = true);

  // Get teacher's assigned classes
  final assignments = await _teacherService.getTeacherAssignments(
    authProvider.currentUser!.id,
  );

  // ✅ FILTER: Show ONLY classes where teacher is FORM TEACHER
  final formTeacherClasses = assignments.where((assignment) {
    return assignment['is_form_teacher'] == true;
  }).toList();

  print('📚 Total assignments: ${assignments.length}');
  print('📚 Form teacher classes: ${formTeacherClasses.length}');

  // ✅ Load today's attendance stats for each class
  await _loadAttendanceStats(formTeacherClasses);

  // ✅ Load comprehensive dashboard stats
  await _loadDashboardStats();

  setState(() {
    _classes = formTeacherClasses;
    _isLoading = false;
  });
}
```

### Teacher Service

**Location:** `/School-attendance-app/lib/services/teacher_service.dart`

```dart
class TeacherService {
  final ApiService _apiService;

  TeacherService(this._apiService);
}
```

#### Get Teacher Assignments (line 12):

```dart
Future<List<Map<String, dynamic>>> getTeacherAssignments(String teacherId) async {
  try {
    print('📚 Fetching teacher assignments from /auth/me');

    // Use /auth/me endpoint which includes assignments for teachers
    final response = await _apiService.get(
      ApiConfig.getMe,  // '/auth/me'
      requiresAuth: true,
    );

    print('✅ Auth/me response: $response');

    if (response['success'] == true && response['data'] != null) {
      final userData = response['data'];

      // Check if assignments are included (for teachers)
      if (userData['assignments'] != null) {
        final assignments = userData['assignments'] as List;
        print('✅ Found ${assignments.length} assignments');
        return assignments.cast<Map<String, dynamic>>();
      }
    }

    print('⚠️ No assignments found in response');
    return [];
  } catch (e) {
    print('❌ Error fetching assignments: $e');
    return [];
  }
}
```

**Backend API:** `GET /api/v1/auth/me`

Returns:
```json
{
  "success": true,
  "data": {
    "id": 2,
    "email": "teacher@school.com",
    "fullName": "John Smith",
    "role": "teacher",
    "school_name": "CPS School",
    "assignments": [
      {
        "id": 1,
        "section_id": 5,
        "section_name": "A",
        "class_name": "Grade 6",
        "subject": "Mathematics",
        "subject_id": 1,
        "is_form_teacher": true,
        "student_count": 30
      }
    ]
  }
}
```

#### Get Dashboard Stats (line 197):

```dart
Future<Map<String, dynamic>> getDashboardStats() async {
  try {
    print('📊 Fetching dashboard statistics');

    final response = await _apiService.get(
      '/teacher/dashboard/stats',
      requiresAuth: true,
      useCache: false,  // Don't cache dashboard stats
    );

    if (response['success'] == true && response['data'] != null) {
      final stats = response['data'] as Map<String, dynamic>;
      print('📊 Dashboard stats: $stats');
      return stats;
    }

    return {
      'totalStudents': 0,
      'boysCount': 0,
      'girlsCount': 0,
      'presentToday': 0,
      'lateToday': 0,
      'absentToday': 0,
      'leaveToday': 0,
      'notMarkedToday': 0,
      'attendancePercentage': 100,
    };
  } catch (e) {
    print('❌ Error fetching dashboard stats: $e');
    return /* default zeros */;
  }
}
```

**Backend API:** `GET /api/v1/teacher/dashboard/stats`

### Dashboard UI (line 793)

Shows:

1. **Greeting Header** (line 1689)
   - Good Morning/Afternoon/Evening
   - Teacher name
   - School name

2. **Today's Overview Card** (line 836)
   - Attendance Rate (percentage)
   - Present count (present + late)
   - Late count
   - Absent count

3. **Student Statistics** (line 955)
   - Total Students
   - My Classes (form teacher only)
   - Boys count
   - Girls count
   - On Leave
   - Not Marked

4. **Quick Actions** (line 1056)
   - QR Scanner
   - Mark Attendance
   - Reports
   - Broadcast
   - Leave Management
   - Student List
   - Attendance Calendar
   - Assignments
   - Grades & Results

5. **My Classes Section** (line 1188)
   - Shows first 2 classes
   - Class name (e.g., Grade 6-A)
   - Subject
   - Student count
   - Tap to open attendance screen

### Bottom Navigation (line 1263)

```dart
Widget _buildBottomNavigation() {
  return Container(
    child: Row(
      children: [
        _buildNavItem(icon: Icons.home_rounded, label: 'Home', index: 0),
        _buildNavItem(icon: Icons.school_rounded, label: 'Classes', index: 1),
        _buildNavItem(icon: Icons.calendar_today_rounded, label: 'Calendar', index: 2),
        _buildNavItem(icon: Icons.people_alt_rounded, label: 'Students', index: 3),
      ],
    ),
  );
}
```

**Navigation States:**
- 0 = Dashboard View
- 1 = Classes List View
- 2 = Calendar View
- 3 = Students View

---

## 3. NAVIGATION & DATA FLOW

### Flow: Dashboard → Class → Students

#### Step 1: User Taps Class Card

**Dashboard View (line 1222):**

```dart
..._classes.take(2).map((classData) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: cards.buildMiniClassCard(
      className: className,
      sectionName: sectionName,
      subject: subject,
      studentCount: studentCount,
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ClassAttendanceScreen(
              classData: classData,
            ),
          ),
        );
      },
    ),
  );
})
```

**Classes View (line 1514):**

```dart
Widget _buildClassCard(Map<String, dynamic> classData) {
  return Container(
    child: InkWell(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ClassAttendanceScreen(
              classData: classData,
            ),
          ),
        );
      },
      child: /* Class card UI */
    ),
  );
}
```

#### Step 2: Class Attendance Screen Loads

**Location:** `/School-attendance-app/lib/screens/class_attendance_screen.dart`

```dart
class ClassAttendanceScreen extends StatefulWidget {
  final Map<String, dynamic> classData;  // Passed from dashboard

  const ClassAttendanceScreen({super.key, required this.classData});
}

class _ClassAttendanceScreenState extends State<ClassAttendanceScreen> {
  late TeacherService _teacherService;
  List<Map<String, dynamic>> _students = [];
  bool _isLoading = true;
  bool _isSunday = false;

  int _presentCount = 0;
  int _lateCount = 0;
  int _absentCount = 0;
}
```

#### initState - Load Students (line 28):

```dart
@override
void initState() {
  super.initState();
  final authProvider = Provider.of<AuthProvider>(context, listen: false);
  _teacherService = TeacherService(authProvider.apiService);
  _loadStudentsAndAttendance();
}
```

#### Load Students and Attendance (line 35):

```dart
Future<void> _loadStudentsAndAttendance() async {
  setState(() => _isLoading = true);

  try {
    // ✅ CHECK: Don't load attendance on Sunday
    final today = DateTime.now();
    if (today.weekday == DateTime.sunday) {
      setState(() {
        _isLoading = false;
        _isSunday = true;
      });
      return;
    }

    final sectionId = widget.classData['section_id'];

    // 1. Get students in section
    final students = await _teacherService.getStudentsInSection(sectionId);

    // 2. Get today's attendance
    final attendance = await _teacherService.getAttendanceForSection(
      sectionId,
      DateFormat('yyyy-MM-dd').format(DateTime.now()),
    );

    // 3. Merge students with their attendance status
    setState(() {
      _students = students.map((student) {
        final record = attendance.firstWhere(
          (att) => att['student_id'] == student['id'],
          orElse: () => {'status': 'pending'},
        );
        student['status'] = record['status'];
        return student;
      }).toList();

      _updateCounts();
      _isLoading = false;
    });
  } catch (e) {
    setState(() => _isLoading = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Error: ${e.toString()}')),
    );
  }
}
```

#### Get Students API Call (TeacherService line 45):

```dart
Future<List<Map<String, dynamic>>> getStudentsInSection(int sectionId) async {
  try {
    print('👥 Fetching students for section: $sectionId (teacher endpoint)');

    // Use teacher-specific endpoint (no admin privileges required)
    final response = await _apiService.get(
      '/teacher/sections/$sectionId/students',
      requiresAuth: true,
    );

    if (response['success'] == true && response['data'] != null) {
      final data = response['data'] as List;
      print('✅ Found ${data.length} students');
      return data.cast<Map<String, dynamic>>();
    }

    return [];
  } catch (e) {
    print('❌ Error fetching students: $e');
    rethrow;
  }
}
```

**Backend API:** `GET /api/v1/teacher/sections/:sectionId/students`

### Step 3: Display Student List (line 113)

```dart
Expanded(
  child: ListView.builder(
    padding: const EdgeInsets.all(16),
    itemCount: _students.length,
    itemBuilder: (context, index) {
      return _buildStudentTile(_students[index], index);
    },
  ),
)
```

#### Student Tile (line 188):

```dart
Widget _buildStudentTile(Map<String, dynamic> student, int index) {
  final status = student['status'] ?? 'pending';

  return Card(
    child: InkWell(
      onTap: () => _showAttendanceDialog(student),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            // Avatar
            Container(
              child: Text(student['full_name'][0].toUpperCase()),
            ),

            // Name and Roll Number
            Expanded(
              child: Column(
                children: [
                  Text(student['full_name']),
                  Text('Roll: ${student['roll_number']}'),
                ],
              ),
            ),

            // Status Badge
            Container(
              child: Text(
                status == 'pending' ? 'Mark' : status.toUpperCase(),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
```

### Step 4: Mark Attendance Dialog (line 287)

```dart
void _showAttendanceDialog(Map<String, dynamic> student) {
  TimeOfDay selectedTime = TimeOfDay.now();

  showModalBottomSheet(
    context: context,
    builder: (BuildContext context) {
      return StatefulBuilder(
        builder: (BuildContext context, StateSetter setModalState) {
          return Container(
            child: Column(
              children: [
                // Student info
                Text(student['full_name']),
                Text('Roll: ${student['roll_number']}'),

                // Time Picker
                InkWell(
                  onTap: () async {
                    final TimeOfDay? picked = await showTimePicker(
                      context: context,
                      initialTime: selectedTime,
                    );
                    if (picked != null) {
                      setModalState(() {
                        selectedTime = picked;
                      });
                    }
                  },
                  child: Text(selectedTime.format(context)),
                ),

                // Action Buttons
                ElevatedButton(
                  onPressed: () async {
                    Navigator.pop(context);
                    await _markAttendance(
                      student: student,
                      status: 'present',
                      time: selectedTime,
                    );
                  },
                  child: Text('Present'),
                ),

                ElevatedButton(
                  onPressed: () async {
                    Navigator.pop(context);
                    await _markAttendance(
                      student: student,
                      status: 'absent',
                      time: selectedTime,
                    );
                  },
                  child: Text('Absent'),
                ),

                ElevatedButton(
                  onPressed: () {
                    // Navigate to Leave Management
                  },
                  child: Text('Leave'),
                ),
              ],
            ),
          );
        },
      );
    },
  );
}
```

### Step 5: Mark Attendance (line 606)

```dart
Future<void> _markAttendance({
  required Map<String, dynamic> student,
  required String status,
  required TimeOfDay time,
}) async {
  final studentName = student['full_name'] ?? 'Student';
  final sectionId = widget.classData['section_id'];
  final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
  final checkInTime = '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}:00';

  // Update UI optimistically
  setState(() {
    student['status'] = status;
    _updateCounts();
  });

  try {
    final response = await _teacherService.markAttendance(
      sectionId: sectionId,
      studentId: student['id'],
      date: today,
      status: status,
      checkInTime: checkInTime,
    );

    // Backend may auto-calculate 'late' status
    final finalStatus = response['status'] ?? status;

    setState(() {
      student['status'] = finalStatus;
      _updateCounts();
    });

    if (mounted) {
      final statusLabel = finalStatus == 'late'
          ? 'LATE (auto-calculated)'
          : finalStatus.toUpperCase();

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$studentName marked as $statusLabel'),
          backgroundColor: const Color(0xFF10B981),
        ),
      );
    }
  } catch (e) {
    // Revert UI on error
    setState(() {
      student['status'] = student['status'];
      _updateCounts();
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Failed: ${e.toString()}'),
        backgroundColor: const Color(0xFFEF4444),
      ),
    );
  }
}
```

#### Mark Attendance API (TeacherService line 151):

```dart
Future<Map<String, dynamic>> markAttendance({
  required int sectionId,
  required int studentId,
  required String date,
  required String status,
  String? checkInTime,
  String? notes,
}) async {
  try {
    print('✏️ Marking attendance: student=$studentId, date=$date, status=$status, time=$checkInTime');

    final body = {
      'studentId': studentId,
      'date': date,
      'status': status,
    };

    if (checkInTime != null) {
      body['checkInTime'] = checkInTime;
    }

    if (notes != null) {
      body['notes'] = notes;
    }

    final response = await _apiService.post(
      '/teacher/sections/$sectionId/attendance',
      body,
      requiresAuth: true,
    );

    if (response['success'] == true) {
      print('✅ Attendance marked successfully');
      return response['data'] as Map<String, dynamic>;
    }

    throw Exception(response['message'] ?? 'Failed to mark attendance');
  } catch (e) {
    print('❌ Error marking attendance: $e');
    rethrow;
  }
}
```

**Backend API:** `POST /api/v1/teacher/sections/:sectionId/attendance`

---

# BACKEND API ROUTES

## Teacher Routes

**File:** `/backend/src/routes/teacher.routes.js`

### Middleware Stack:

```javascript
router.use(authenticate);           // Verify JWT token
router.use(enforceSchoolTenancy);  // Set req.tenantSchoolId
router.use(requireTeacher);         // Verify role === 'teacher'
```

### Endpoints:

#### 1. GET /api/v1/teacher/my-sections

**Purpose:** Get all sections assigned to logged-in teacher

**Line 78:**
```javascript
router.get('/my-sections', async (req, res) => {
  const userId = req.user.id;
  const schoolId = req.tenantSchoolId;

  // Get teacher_id from user_id
  const teacherResult = await query(
    'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2',
    [userId, schoolId]
  );

  const teacherId = teacherResult.rows[0].id;

  // Get teacher assignments
  const assignments = await Teacher.getAssignments(teacherId, '2025-2026');

  sendSuccess(res, assignments, 'Sections retrieved successfully');
});
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "section_id": 5,
      "section_name": "A",
      "class_name": "Grade 6",
      "subject": "Mathematics",
      "subject_id": 1,
      "is_form_teacher": true,
      "student_count": 30
    }
  ]
}
```

#### 2. GET /api/v1/teacher/sections/:sectionId/students

**Purpose:** Get students in a section (teacher can only access assigned sections)

**Line 35:**
```javascript
router.get(
  '/sections/:sectionId/students',
  validateTeacherSectionAccess('params', 'sectionId'),  // Authorization
  async (req, res) => {
    const { sectionId } = req.params;
    const schoolId = req.tenantSchoolId;

    const studentsResult = await query(
      `SELECT s.*,
              c.class_name,
              sec.section_name
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       LEFT JOIN sections sec ON s.section_id = sec.id
       WHERE s.section_id = $1
         AND s.school_id = $2
         AND s.is_active = TRUE
       ORDER BY
         CASE WHEN s.roll_number ~ '^[0-9]+$'
              THEN CAST(s.roll_number AS INTEGER)
              ELSE 999999
         END ASC,
         s.roll_number ASC,
         s.full_name ASC`,
      [sectionId, schoolId]
    );

    sendSuccess(res, studentsResult.rows, 'Students retrieved successfully');
  }
);
```

**Authorization Middleware (validateTeacherSectionAccess):**

```javascript
// Check if teacher is assigned to this section
const assignmentCheck = await query(
  'SELECT id FROM teacher_class_assignments WHERE teacher_id = $1 AND section_id = $2',
  [teacherId, sectionId]
);

if (assignmentCheck.rows.length === 0) {
  return sendError(res, 'You are not assigned to this section', 403);
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "full_name": "John Doe",
      "roll_number": "001",
      "gender": "male",
      "class_name": "Grade 6",
      "section_name": "A",
      "guardian_phone": "+1234567890"
    }
  ]
}
```

#### 3. POST /api/v1/teacher/sections/:sectionId/attendance

**Purpose:** Mark attendance for a student

**Line 110:**
```javascript
router.post(
  '/sections/:sectionId/attendance',
  validateTeacherSectionAccess('params', 'sectionId'),
  async (req, res) => {
    const { sectionId } = req.params;
    const { studentId, date, status, notes, checkInTime } = req.body;
    const userId = req.user.id;
    const schoolId = req.tenantSchoolId;

    // Validate required fields
    if (!studentId || !date || !status) {
      return sendError(res, 'studentId, date, and status are required', 400);
    }

    // ✅ SECURITY: Validate date is not in future
    const today = new Date();
    const attendanceDate = new Date(date);
    if (attendanceDate > today) {
      return sendError(res, 'Cannot mark attendance for future dates', 400);
    }

    // ✅ BUSINESS LOGIC: Validate not Sunday
    if (attendanceDate.getDay() === 0) {
      return sendError(res, 'Cannot mark attendance on Sundays', 400);
    }

    // ✅ BUSINESS LOGIC: Validate not a holiday
    const holidayCheck = await query(
      'SELECT id, holiday_name FROM holidays WHERE school_id = $1 AND holiday_date = $2',
      [schoolId, date]
    );
    if (holidayCheck.rows.length > 0) {
      return sendError(res, `Cannot mark attendance on holiday: ${holidayCheck.rows[0].holiday_name}`, 400);
    }

    // Use provided checkInTime or default to 09:00:00
    const timeToUse = checkInTime || '09:00:00';
    const checkInDateTime = `${date}T${timeToUse}`;

    // Check if attendance already exists
    const existingResult = await query(
      'SELECT id, status FROM attendance_logs WHERE student_id = $1 AND date = $2',
      [studentId, date]
    );

    // Auto-calculate late status if marking as 'present'
    let finalStatus = status;

    if (status === 'present') {
      const settingsResult = await query(
        'SELECT school_open_time, late_threshold_minutes FROM school_settings WHERE school_id = $1',
        [schoolId]
      );

      if (settingsResult.rows.length > 0) {
        const settings = settingsResult.rows[0];
        const [startHour, startMin] = settings.school_open_time.split(':').map(Number);
        const [checkHour, checkMin] = timeToUse.split(':').map(Number);

        const startMinutes = startHour * 60 + startMin;
        const checkMinutes = checkHour * 60 + checkMin;
        const diffMinutes = checkMinutes - startMinutes;

        // If late threshold exceeded, mark as late
        if (diffMinutes > (settings.late_threshold_minutes || 15)) {
          finalStatus = 'late';
          console.log(`🕐 Auto-calculated as LATE (${diffMinutes} min after start)`);
        }
      }
    }

    if (existingResult.rows.length > 0) {
      // Update existing
      await query(
        `UPDATE attendance_logs
         SET status = $1, check_in_time = $2, notes = $3, is_manual = TRUE, marked_by = $4
         WHERE id = $5`,
        [finalStatus, checkInDateTime, notes || null, userId, existingResult.rows[0].id]
      );
    } else {
      // Insert new
      await query(
        `INSERT INTO attendance_logs
         (student_id, school_id, check_in_time, status, date, is_manual, marked_by, notes)
         VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7)`,
        [studentId, schoolId, checkInDateTime, finalStatus, date, userId, notes || null]
      );
    }

    // 📱 WHATSAPP: Send alert to parent (for late/absent/leave)
    const todayIST = getCurrentDateIST();
    if (date === todayIST && (finalStatus === 'late' || finalStatus === 'absent' || finalStatus === 'leave')) {
      // Get student phone numbers
      const studentResult = await query(
        'SELECT full_name, guardian_phone, parent_phone, mother_phone FROM students WHERE id = $1',
        [studentId]
      );

      if (studentResult.rows.length > 0) {
        const studentData = studentResult.rows[0];
        const phoneToUse = studentData.guardian_phone || studentData.parent_phone || studentData.mother_phone;

        if (phoneToUse) {
          await whatsappService.sendAttendanceAlert({
            parentPhone: phoneToUse,
            studentName: studentData.full_name,
            studentId: studentId,
            schoolId: schoolId,
            status: finalStatus,
            checkInTime: timeToUse,
            schoolName: 'School Name',
            date: date
          });
        }
      }
    }

    sendSuccess(res, { studentId, date, status: finalStatus }, 'Attendance marked successfully');
  }
);
```

#### 4. GET /api/v1/teacher/sections/:sectionId/attendance

**Purpose:** Get attendance logs for a specific date

**Line 312:**
```javascript
router.get('/sections/:sectionId/attendance', async (req, res) => {
  const { sectionId } = req.params;
  const { date } = req.query;
  const schoolId = req.tenantSchoolId;

  if (!date) {
    return sendError(res, 'Date parameter is required (YYYY-MM-DD)', 400);
  }

  // Verify teacher is assigned to this section
  const teacherResult = await query(
    'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2',
    [req.user.id, schoolId]
  );

  const teacherId = teacherResult.rows[0].id;

  const assignmentCheck = await query(
    'SELECT id FROM teacher_class_assignments WHERE teacher_id = $1 AND section_id = $2',
    [teacherId, sectionId]
  );

  if (assignmentCheck.rows.length === 0) {
    return sendError(res, 'You are not assigned to this section', 403);
  }

  // Get attendance logs
  const logsResult = await query(
    `SELECT
      al.id,
      al.student_id,
      al.status,
      al.check_in_time,
      TO_CHAR(al.date, 'YYYY-MM-DD') as date,
      al.is_manual,
      al.notes,
      s.full_name as student_name,
      s.roll_number
     FROM attendance_logs al
     JOIN students s ON al.student_id = s.id
     WHERE al.school_id = $1
       AND s.section_id = $2
       AND al.date = $3
     ORDER BY s.roll_number ASC`,
    [schoolId, sectionId, date]
  );

  sendSuccess(res, logsResult.rows, 'Attendance logs retrieved successfully');
});
```

#### 5. GET /api/v1/teacher/dashboard/stats

**Purpose:** Get comprehensive dashboard statistics for teacher

**Line 431:**
```javascript
router.get('/dashboard/stats', async (req, res) => {
  const userId = req.user.id;
  const schoolId = req.tenantSchoolId;

  // Get teacher_id
  const teacherResult = await query(
    'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2',
    [userId, schoolId]
  );

  const teacherId = teacherResult.rows[0].id;

  // Get teacher's form teacher section IDs
  const sectionsResult = await query(
    `SELECT section_id FROM teacher_class_assignments
     WHERE teacher_id = $1 AND is_form_teacher = TRUE`,
    [teacherId]
  );

  const sectionIds = sectionsResult.rows.map(row => row.section_id);

  if (sectionIds.length === 0) {
    return sendSuccess(res, {
      totalStudents: 0,
      boysCount: 0,
      girlsCount: 0,
      presentToday: 0,
      lateToday: 0,
      absentToday: 0,
      leaveToday: 0,
      notMarkedToday: 0,
      attendancePercentage: 100,
    }, 'No form teacher classes assigned');
  }

  // Get today's date
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Get total student counts by gender
  const studentCountsResult = await query(
    `SELECT
       COUNT(*) as total,
       COUNT(CASE WHEN gender = 'male' THEN 1 END) as boys,
       COUNT(CASE WHEN gender = 'female' THEN 1 END) as girls
     FROM students
     WHERE section_id IN (${sectionIds.map((id, idx) => `$${idx + 2}`).join(',')})
       AND school_id = $1
       AND is_active = TRUE`,
    [schoolId, ...sectionIds]
  );

  const studentCounts = studentCountsResult.rows[0];
  const totalStudents = parseInt(studentCounts.total || 0);
  const boysCount = parseInt(studentCounts.boys || 0);
  const girlsCount = parseInt(studentCounts.girls || 0);

  // Get today's attendance stats (skip if Sunday)
  const isSunday = today.getDay() === 0;
  let todayStats = {
    presentToday: 0,
    lateToday: 0,
    absentToday: 0,
    leaveToday: 0,
    notMarkedToday: totalStudents,
    attendancePercentage: 100,
  };

  if (!isSunday && totalStudents > 0) {
    const attendanceResult = await query(
      `SELECT
         COUNT(CASE WHEN status = 'present' THEN 1 END) as present,
         COUNT(CASE WHEN status = 'late' THEN 1 END) as late,
         COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent,
         COUNT(CASE WHEN status = 'leave' THEN 1 END) as leave,
         COUNT(*) as total_marked
       FROM attendance_logs al
       JOIN students s ON al.student_id = s.id
       WHERE s.section_id IN (${sectionIds.map((id, idx) => `$${idx + 2}`).join(',')})
         AND al.school_id = $1
         AND al.date = $${sectionIds.length + 2}
         AND s.is_active = TRUE`,
      [schoolId, ...sectionIds, todayStr]
    );

    const attendance = attendanceResult.rows[0];
    const presentCount = parseInt(attendance.present || 0);
    const lateCount = parseInt(attendance.late || 0);
    const absentCount = parseInt(attendance.absent || 0);
    const leaveCount = parseInt(attendance.leave || 0);
    const totalMarked = parseInt(attendance.total_marked || 0);
    const notMarked = totalStudents - totalMarked;

    // Calculate attendance percentage (present + late) / total * 100
    const attendedCount = presentCount + lateCount;
    const attendancePercentage = totalStudents > 0
      ? Math.round((attendedCount / totalStudents) * 100)
      : 100;

    todayStats = {
      presentToday: presentCount,
      lateToday: lateCount,
      absentToday: absentCount,
      leaveToday: leaveCount,
      notMarkedToday: notMarked,
      attendancePercentage: attendancePercentage,
    };
  }

  const responseData = {
    totalStudents,
    boysCount,
    girlsCount,
    ...todayStats,
  };

  sendSuccess(res, responseData, 'Dashboard statistics retrieved successfully');
});
```

---

# SECURITY & AUTHORIZATION

## Multi-Tenant Isolation

**Middleware:** `enforceSchoolTenancy` in `/backend/src/middleware/multiTenant.js`

```javascript
const enforceSchoolTenancy = (req, res, next) => {
  if (!req.user || !req.user.schoolId) {
    return sendError(res, 'School context not found', 403);
  }

  req.tenantSchoolId = req.user.schoolId;
  next();
};
```

**Every query includes school_id:**
```sql
WHERE school_id = $1
```

## Teacher Authorization

**Middleware:** `requireTeacher` in `/backend/src/middleware/teacherAuth.js`

```javascript
const requireTeacher = async (req, res, next) => {
  if (req.user.role !== 'teacher') {
    return sendError(res, 'Access denied. Teachers only.', 403);
  }

  // Get teacher record
  const teacherResult = await query(
    'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2 AND is_active = TRUE',
    [req.user.id, req.tenantSchoolId]
  );

  if (teacherResult.rows.length === 0) {
    return sendError(res, 'Teacher profile not found', 404);
  }

  req.teacherId = teacherResult.rows[0].id;
  next();
};
```

**Section Access:** `validateTeacherSectionAccess`

```javascript
const validateTeacherSectionAccess = (paramType, paramName) => {
  return async (req, res, next) => {
    const sectionId = req[paramType][paramName];

    // Check if teacher is assigned to this section
    const assignmentCheck = await query(
      'SELECT id FROM teacher_class_assignments WHERE teacher_id = $1 AND section_id = $2',
      [req.teacherId, sectionId]
    );

    if (assignmentCheck.rows.length === 0) {
      return sendError(res, 'You are not assigned to this section', 403);
    }

    next();
  };
};
```

## JWT Token Security

**Access Token:**
- Expires: 15 minutes
- Stored in: Memory + SharedPreferences (Flutter)

**Refresh Token:**
- Expires: 7 days
- Stored in: SharedPreferences (Flutter)

**Auto-refresh on 401:**
```dart
if (response.statusCode == 401 && requiresAuth && retryCount == 0) {
  await _handleTokenRefresh();
  return await _requestWithRetry(request, requiresAuth: true, retryCount: 1);
}
```

---

# DATA FLOW DIAGRAMS

## Authentication Flow

```
┌─────────────┐
│ WelcomeScreen│
└──────┬──────┘
       │ User taps "Teacher Login"
       ▼
┌─────────────┐
│ LoginScreen │
└──────┬──────┘
       │ Email + Password
       ▼
┌─────────────────┐
│  AuthProvider   │
│  .loginTeacher()│
└──────┬──────────┘
       │ POST /auth/login
       ▼
┌─────────────────┐
│   ApiService    │
│   .post()       │
└──────┬──────────┘
       │ HTTP Request
       ▼
┌─────────────────┐
│ Backend         │
│ authController  │
└──────┬──────────┘
       │ Validate credentials
       │ Generate JWT tokens
       ▼
┌─────────────────┐
│ Response        │
│ {               │
│   accessToken,  │
│   refreshToken, │
│   user: {...}   │
│ }               │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ StorageService  │
│ Save tokens     │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ AuthProvider    │
│ Set currentUser │
│ notifyListeners()│
└──────┬──────────┘
       │
       ▼
┌──────────────────┐
│ Navigate to      │
│ TeacherDashboard │
└──────────────────┘
```

## Teacher Dashboard Flow

```
┌─────────────────────┐
│ TeacherDashboard    │
│ Screen.initState()  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ _loadClasses()      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ TeacherService      │
│ .getTeacherAssignments()│
└──────┬──────────────┘
       │ GET /auth/me
       ▼
┌─────────────────────┐
│ Backend             │
│ returns assignments │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Filter form teacher │
│ classes only        │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ For each class:     │
│ _loadAttendanceStats()│
└──────┬──────────────┘
       │ GET /teacher/sections/:id/attendance?date=today
       ▼
┌─────────────────────┐
│ Calculate:          │
│ - Present count     │
│ - Late count        │
│ - Absent count      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ _loadDashboardStats()│
└──────┬──────────────┘
       │ GET /teacher/dashboard/stats
       ▼
┌─────────────────────┐
│ Get comprehensive:  │
│ - Total students    │
│ - Boys/Girls count  │
│ - Today's stats     │
│ - Attendance %      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ setState()          │
│ Display dashboard   │
└─────────────────────┘
```

## Class Attendance Flow

```
┌─────────────────────┐
│ User taps class card│
└──────┬──────────────┘
       │ Navigator.push(ClassAttendanceScreen)
       ▼
┌─────────────────────┐
│ ClassAttendance     │
│ Screen.initState()  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Check if Sunday     │
└──────┬──────────────┘
       │ No
       ▼
┌─────────────────────┐
│ TeacherService      │
│ .getStudentsInSection()│
└──────┬──────────────┘
       │ GET /teacher/sections/:id/students
       ▼
┌─────────────────────┐
│ Backend validates:  │
│ - Teacher assigned? │
│ - Same school?      │
└──────┬──────────────┘
       │ Yes
       ▼
┌─────────────────────┐
│ Return students list│
│ (sorted by roll #)  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ TeacherService      │
│ .getAttendanceForSection()│
└──────┬──────────────┘
       │ GET /teacher/sections/:id/attendance?date=today
       ▼
┌─────────────────────┐
│ Return attendance   │
│ logs for today      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Merge students with │
│ attendance status   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Display student list│
│ with status badges  │
└─────────────────────┘
```

## Mark Attendance Flow

```
┌─────────────────────┐
│ User taps student   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Show BottomSheet    │
│ with time picker    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ User selects time   │
│ & status            │
└──────┬──────────────┘
       │ Tap "Present" or "Absent"
       ▼
┌─────────────────────┐
│ _markAttendance()   │
│ Update UI optimistic│
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ TeacherService      │
│ .markAttendance()   │
└──────┬──────────────┘
       │ POST /teacher/sections/:id/attendance
       │ Body: { studentId, date, status, checkInTime }
       ▼
┌─────────────────────┐
│ Backend validates:  │
│ - Not future date?  │
│ - Not Sunday?       │
│ - Not holiday?      │
│ - Teacher assigned? │
└──────┬──────────────┘
       │ All checks pass
       ▼
┌─────────────────────┐
│ Get school settings │
│ (open time, late    │
│  threshold)         │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Auto-calculate:     │
│ If check-in > 15min │
│ after school open   │
│ → Change to 'late'  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Check if existing   │
│ attendance record   │
└──────┬──────────────┘
       │ Exists?
       │
       ├─Yes─→ UPDATE
       │
       └─No──→ INSERT

       ▼
┌─────────────────────┐
│ Send WhatsApp alert │
│ (if late/absent)    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Return final status │
│ { status: 'late' }  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Update UI with      │
│ final status        │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Show SnackBar       │
│ "Student marked as  │
│  LATE (auto-calc)"  │
└─────────────────────┘
```

---

# CONCLUSION

This system implements a complete teacher management and attendance workflow across web and mobile platforms:

## Web Dashboard (School Admin)
- ✅ Create and manage teachers
- ✅ Assign teachers to sections with subjects
- ✅ Mark form teachers
- ✅ Manage subjects catalog
- ✅ Create default subjects
- ✅ View teacher statistics

## Flutter Mobile App (Teachers)
- ✅ Secure JWT authentication
- ✅ Token auto-refresh
- ✅ Teacher dashboard with real-time stats
- ✅ View assigned classes (form teacher only)
- ✅ Navigate to class attendance
- ✅ View student list
- ✅ Mark attendance with time picker
- ✅ Auto-calculate late status
- ✅ Sunday/holiday blocking
- ✅ WhatsApp parent alerts

## Security Features
- ✅ Multi-tenant data isolation
- ✅ Role-based authorization
- ✅ Teacher-section access validation
- ✅ JWT with refresh tokens
- ✅ Future date blocking
- ✅ Holiday validation

## State Management
- **Flutter:** Provider pattern with ChangeNotifier
- **React:** useState hooks with component state
- **API:** RESTful with proper HTTP caching (30s TTL)

---

**Document End**
