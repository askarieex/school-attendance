import 'api_service.dart';
import '../utils/logger.dart';

/// Teacher Service - Handles teacher-specific API calls
class TeacherService {
  final ApiService _apiService;

  TeacherService(this._apiService);
  
  /// Get teacher's assigned classes/sections
  /// GET /api/v1/teacher/my-sections (dedicated teacher sections endpoint)
  Future<List<Map<String, dynamic>>> getTeacherAssignments() async {
    try {
      Logger.network('Fetching teacher sections from /teacher/my-sections');

      // ✅ PERFORMANCE: Enable caching - sections don't change frequently
      final response = await _apiService.get(
        '/teacher/my-sections',
        requiresAuth: true,
        useCache: true,  // ✅ ENABLE caching for better performance
      );

      Logger.success('Teacher sections response received');

      if (response['success'] == true && response['data'] != null) {
        final sections = response['data'] as List;
        Logger.success('Found ${sections.length} assigned sections');
        return sections.cast<Map<String, dynamic>>();
      }

      Logger.warning('No sections found in response');
      return [];
    } catch (e) {
      Logger.error('Error fetching sections', e);
      rethrow;  // ✅ Rethrow to show error in UI instead of silently returning empty array
    }
  }
  
  /// Get students in a section (Teacher-specific endpoint)
  /// GET /api/v1/teacher/sections/:sectionId/students
  Future<List<Map<String, dynamic>>> getStudentsInSection(int sectionId) async {
    try {
      Logger.network('Fetching students for section: $sectionId (teacher endpoint)');

      // ✅ PERFORMANCE: Enable caching - student lists don't change frequently
      final response = await _apiService.get(
        '/teacher/sections/$sectionId/students',
        requiresAuth: true,
        useCache: true,  // ✅ ENABLE caching for better performance
      );

      Logger.success('Students response received');

      if (response['success'] == true && response['data'] != null) {
        final data = response['data'] as List;
        Logger.success('Found ${data.length} students');
        return data.cast<Map<String, dynamic>>();
      }

      Logger.warning('No students in response');
      return [];
    } catch (e) {
      Logger.error('Error fetching students', e);
      rethrow; // Rethrow to handle in UI
    }
  }
  
  /// Get today's attendance stats for a section
  /// Uses teacher endpoint and calculates stats from attendance logs
  Future<Map<String, dynamic>> getTodayAttendanceStats(int sectionId) async {
    try {
      Logger.network('Fetching today\'s attendance stats for section: $sectionId');

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

      Logger.info('Stats for section $sectionId: P=$presentCount, L=$lateCount, A=$absentCount, LV=$leaveCount');

      return {
        'presentCount': presentCount,
        'lateCount': lateCount,
        'absentCount': absentCount,
        'leaveCount': leaveCount,
        'totalMarked': logs.length,
      };
    } catch (e) {
      Logger.error('Error fetching attendance stats', e);
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
      Logger.network('Fetching attendance for section: $sectionId on $date');

      // ✅ PERFORMANCE: Enable caching - attendance records are immutable for past dates
      final response = await _apiService.get(
        '/teacher/sections/$sectionId/attendance',
        queryParams: {'date': date},
        requiresAuth: true,
        useCache: true,  // ✅ ENABLE caching for better performance
      );

      if (response['success'] == true && response['data'] != null) {
        final data = response['data'] as List;
        Logger.success('Found ${data.length} attendance logs for $date');
        return data.cast<Map<String, dynamic>>();
      }

      return [];
    } catch (e) {
      Logger.error('Error fetching attendance for $date', e);
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
      Logger.network('Marking attendance: student=$studentId, date=$date, status=$status, time=$checkInTime');

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
        Logger.success('Attendance marked successfully');
        return response['data'] as Map<String, dynamic>;
      }

      throw Exception(response['message'] ?? 'Failed to mark attendance');
    } catch (e) {
      Logger.error('Error marking attendance', e);
      rethrow;
    }
  }

  /// Get comprehensive dashboard statistics
  /// GET /api/v1/teacher/dashboard/stats
  /// Returns: totalStudents, boysCount, girlsCount, presentToday, lateToday, absentToday, leaveToday, notMarkedToday, attendancePercentage
  Future<Map<String, dynamic>> getDashboardStats() async {
    try {
      Logger.network('Fetching dashboard statistics');

      // ✅ PERFORMANCE: Enable caching with short TTL - dashboard updates frequently but not every second
      final response = await _apiService.get(
        '/teacher/dashboard/stats',
        requiresAuth: true,
        useCache: true,  // ✅ ENABLE caching for better performance (15 min TTL is fine for dashboard)
      );

      if (response['success'] == true && response['data'] != null) {
        final stats = response['data'] as Map<String, dynamic>;
        Logger.success('Dashboard stats received');
        return stats;
      }

      Logger.warning('No dashboard stats in response');
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
      Logger.error('Error fetching dashboard stats', e);
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
  }
  
  /// Get attendance stats for multiple sections in one request
  /// GET /api/v1/teacher/dashboard/batch-attendance-stats
  Future<Map<String, dynamic>> getBatchAttendanceStats(List<int> sectionIds, [String? date]) async {
    try {
      if (sectionIds.isEmpty) return {};

      // Get today's date if not provided
      if (date == null) {
        final today = DateTime.now();
        date = '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
      }

      Logger.network('Fetching batch attendance stats for sections: $sectionIds on $date');

      // ✅ PERFORMANCE: Enable caching - efficient batch loading
      final response = await _apiService.get(
        ApiConfig.batchAttendanceStats,
        queryParams: {
          'sectionIds': sectionIds.join(','),
          'date': date,
        },
        requiresAuth: true,
        useCache: true, // ✅ ENABLE caching
      );

      if (response['success'] == true && response['data'] != null) {
        final data = response['data'] as Map<String, dynamic>;
        Logger.success('Batch stats received for ${data.length} sections');
        return data;
      }

      Logger.warning('No batch stats in response');
      return {};
    } catch (e) {
      Logger.error('Error fetching batch stats', e);
      return {};
    }
  }
}
