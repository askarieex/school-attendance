/// API Configuration
/// Contains all API endpoints and base URLs

class ApiConfig {
  // Base URL - Change this to your backend URL
  // static const String baseUrl = 'http://localhost:3001/api/v1'; // For local development
  static const String baseUrl = 'https://adtenz.site/api/v1'; // For production
  
  // Timeout settings - Lower for faster retry on mobile (better UX)
  static const Duration connectTimeout = Duration(seconds: 10);  // ✅ Reduced from 60s
  static const Duration receiveTimeout = Duration(seconds: 15);  // ✅ Reduced from 60s
  
  // Authentication Endpoints
  static const String login = '/auth/login';
  static const String refresh = '/auth/refresh';
  static const String getMe = '/auth/me';
  static const String changePassword = '/auth/change-password';
  
  // Student Endpoints
  static const String students = '/school/students';
  static const String attendance = '/school/attendance';
  static const String attendanceToday = '/school/attendance/today';
  static const String attendanceRange = '/school/attendance/range';
  static const String leaves = '/school/leaves';
  
  // Teacher Endpoints
  static const String teachers = '/school/teachers';
  static const String teacherAssignments = '/school/teachers'; // + /:id/assignments
  static const String sections = '/school/sections';
  static const String manualAttendance = '/school/attendance/manual';
  
  // Dashboard Endpoints
  static const String dashboardStats = '/school/stats/dashboard';
  static const String batchAttendanceStats = '/teacher/dashboard/batch-attendance-stats'; // ✅ NEW BATCH API
  static const String recentCheckins = '/school/dashboard/recent-checkins';
  static const String absentStudents = '/school/dashboard/absent';
}
