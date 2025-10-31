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
  
  /// Get today's attendance for a section
  /// GET /api/v1/school/attendance/today
  Future<Map<String, dynamic>> getTodayAttendanceStats(int sectionId) async {
    try {
      print('📊 Fetching today\'s attendance stats for section: $sectionId');
      
      final response = await _apiService.get(
        ApiConfig.attendanceToday,
        queryParams: {
          'sectionId': sectionId.toString(),
        },
        requiresAuth: true,
      );
      
      if (response['success'] == true && response['data'] != null) {
        return response['data'] as Map<String, dynamic>;
      }
      
      return {};
    } catch (e) {
      print('❌ Error fetching attendance stats: $e');
      return {};
    }
  }
}
