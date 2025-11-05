import 'api_service.dart';
import '../config/api_config.dart';

/// Teacher Service - Handles teacher-specific API calls
class TeacherService {
  final ApiService _apiService;
  
  TeacherService(this._apiService);
  
  /// Get teacher's assigned classes/sections from /auth/me
  /// GET /api/v1/auth/me (returns assignments for teachers)
  Future<List<Map<String, dynamic>>> getTeacherAssignments(String teacherId) async {
    try {
      print('📚 Fetching teacher assignments from /auth/me');
      
      // Use /auth/me endpoint which includes assignments for teachers
      final response = await _apiService.get(
        ApiConfig.getMe,
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
  
  /// Get students in a section (Teacher-specific endpoint)
  /// GET /api/v1/teacher/sections/:sectionId/students
  Future<List<Map<String, dynamic>>> getStudentsInSection(int sectionId) async {
    try {
      print('👥 Fetching students for section: $sectionId (teacher endpoint)');
      
      // Use teacher-specific endpoint (no admin privileges required)
      final response = await _apiService.get(
        '/teacher/sections/$sectionId/students',
        requiresAuth: true,
      );
      
      print('✅ Students response: $response');
      
      if (response['success'] == true && response['data'] != null) {
        final data = response['data'] as List;
        print('✅ Found ${data.length} students');
        return data.cast<Map<String, dynamic>>();
      }
      
      print('⚠️ No students in response');
      return [];
    } catch (e) {
      print('❌ Error fetching students: $e');
      rethrow; // Rethrow to handle in UI
    }
  }
  
  /// Get today's attendance stats for a section
  /// Uses teacher endpoint and calculates stats from attendance logs
  Future<Map<String, dynamic>> getTodayAttendanceStats(int sectionId) async {
    try {
      print('📊 Fetching today\'s attendance stats for section: $sectionId');

      // Get today's date in YYYY-MM-DD format
      final today = DateTime.now();
      final todayStr = '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';

      // Get today's attendance logs
      final logs = await getAttendanceForSection(sectionId, todayStr);

      // Calculate stats from logs
      int presentCount = 0;
      int lateCount = 0;
      int absentCount = 0;
      int leaveCount = 0;

      for (final log in logs) {
        final status = log['status'] as String?;
        if (status == 'present') {
          presentCount++;
        } else if (status == 'late') {
          lateCount++;
        } else if (status == 'absent') {
          absentCount++;
        } else if (status == 'leave') {
          leaveCount++;
        }
      }

      print('📊 Stats for section $sectionId: P=$presentCount, L=$lateCount, A=$absentCount, LV=$leaveCount');

      return {
        'presentCount': presentCount,
        'lateCount': lateCount,
        'absentCount': absentCount,
        'leaveCount': leaveCount,
        'totalMarked': logs.length,
      };
    } catch (e) {
      print('❌ Error fetching attendance stats: $e');
      return {
        'presentCount': 0,
        'lateCount': 0,
        'absentCount': 0,
        'leaveCount': 0,
        'totalMarked': 0,
      };
    }
  }

  /// Get attendance for a section on a specific date
  /// GET /api/v1/teacher/sections/:sectionId/attendance?date=YYYY-MM-DD
  Future<List<Map<String, dynamic>>> getAttendanceForSection(int sectionId, String date) async {
    try {
      print('📅 Fetching attendance for section: $sectionId on $date');

      final response = await _apiService.get(
        '/teacher/sections/$sectionId/attendance',
        queryParams: {'date': date},
        requiresAuth: true,
      );

      if (response['success'] == true && response['data'] != null) {
        final data = response['data'] as List;
        print('✅ Found ${data.length} attendance logs for $date');
        return data.cast<Map<String, dynamic>>();
      }

      return [];
    } catch (e) {
      print('❌ Error fetching attendance for $date: $e');
      rethrow;
    }
  }

  /// Mark attendance for a student
  /// POST /api/v1/teacher/sections/:sectionId/attendance
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

  /// Get comprehensive dashboard statistics
  /// GET /api/v1/teacher/dashboard/stats
  /// Returns: totalStudents, boysCount, girlsCount, presentToday, lateToday, absentToday, leaveToday, notMarkedToday, attendancePercentage
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

      print('⚠️ No dashboard stats in response');
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
    }
  }
}
