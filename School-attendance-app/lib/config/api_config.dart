/// API Configuration
/// Contains all API endpoints and base URLs

class ApiConfig {
  // Base URL - Change this to your backend URL
  static const String baseUrl = 'http://localhost:3001/api/v1'; // For local development (YOUR BACKEND IS ON PORT 3001!)
  // static const String baseUrl = 'https://your-backend.com/api/v1'; // For production
  
  // Timeout settings
  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);
  
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
  static const String recentCheckins = '/school/dashboard/recent-checkins';
  static const String absentStudents = '/school/dashboard/absent';
}
