import 'api_service.dart';

/// Subject Service - Handles all subject-related API calls
class SubjectService {
  final ApiService _apiService;

  SubjectService(this._apiService);

  /// Get all subjects for the school
  Future<List<Map<String, dynamic>>> getAllSubjects({
    bool includeInactive = false,
    bool includeStats = false,
  }) async {
    try {
      final queryParams = {
        if (includeInactive) 'includeInactive': 'true',
        if (includeStats) 'includeStats': 'true',
      };

      final response = await _apiService.get(
        '/school/subjects',
        queryParams: queryParams.isNotEmpty ? queryParams : null,
        requiresAuth: true,
      );

      if (response['success'] == true && response['data'] != null) {
        final subjects = response['data']['subjects'] as List;
        return subjects.cast<Map<String, dynamic>>();
      }

      return [];
    } catch (e) {
      print('❌ Get subjects error: $e');
      rethrow;
    }
  }

  /// Get a single subject by ID
  Future<Map<String, dynamic>?> getSubjectById(int id) async {
    try {
      final response = await _apiService.get(
        '/school/subjects/$id',
        requiresAuth: true,
      );

      if (response['success'] == true && response['data'] != null) {
        return response['data']['subject'];
      }

      return null;
    } catch (e) {
      print('❌ Get subject error: $e');
      rethrow;
    }
  }

  /// Create a new subject
  Future<Map<String, dynamic>> createSubject({
    required String subjectName,
    String? subjectCode,
    String? description,
    bool isActive = true,
  }) async {
    try {
      final response = await _apiService.post(
        '/school/subjects',
        {
          'subjectName': subjectName,
          if (subjectCode != null) 'subjectCode': subjectCode,
          if (description != null) 'description': description,
          'isActive': isActive,
        },
        requiresAuth: true,
      );

      if (response['success'] == true && response['data'] != null) {
        return response['data']['subject'];
      }

      throw ApiException('Failed to create subject');
    } catch (e) {
      print('❌ Create subject error: $e');
      rethrow;
    }
  }

  /// Update an existing subject
  Future<Map<String, dynamic>> updateSubject({
    required int id,
    String? subjectName,
    String? subjectCode,
    String? description,
    bool? isActive,
  }) async {
    try {
      final response = await _apiService.put(
        '/school/subjects/$id',
        {
          if (subjectName != null) 'subjectName': subjectName,
          if (subjectCode != null) 'subjectCode': subjectCode,
          if (description != null) 'description': description,
          if (isActive != null) 'isActive': isActive,
        },
        requiresAuth: true,
      );

      if (response['success'] == true && response['data'] != null) {
        return response['data']['subject'];
      }

      throw ApiException('Failed to update subject');
    } catch (e) {
      print('❌ Update subject error: $e');
      rethrow;
    }
  }

  /// Delete (deactivate) a subject
  Future<void> deleteSubject(int id, {bool hard = false}) async {
    try {
      final endpoint = hard
          ? '/school/subjects/$id?hard=true'
          : '/school/subjects/$id';

      final response = await _apiService.delete(
        endpoint,
        requiresAuth: true,
      );

      if (response['success'] != true) {
        throw ApiException('Failed to delete subject');
      }
    } catch (e) {
      print('❌ Delete subject error: $e');
      rethrow;
    }
  }

  /// Create default subjects for the school
  Future<List<Map<String, dynamic>>> createDefaultSubjects() async {
    try {
      final response = await _apiService.post(
        '/school/subjects/create-defaults',
        {},
        requiresAuth: true,
      );

      if (response['success'] == true && response['data'] != null) {
        final subjects = response['data']['subjects'] as List;
        return subjects.cast<Map<String, dynamic>>();
      }

      return [];
    } catch (e) {
      print('❌ Create default subjects error: $e');
      rethrow;
    }
  }

  /// Get subjects for a specific section
  Future<List<Map<String, dynamic>>> getSubjectsBySection(int sectionId) async {
    try {
      final response = await _apiService.get(
        '/school/subjects/section/$sectionId',
        requiresAuth: true,
      );

      if (response['success'] == true && response['data'] != null) {
        final subjects = response['data']['subjects'] as List;
        return subjects.cast<Map<String, dynamic>>();
      }

      return [];
    } catch (e) {
      print('❌ Get section subjects error: $e');
      rethrow;
    }
  }

  /// Get subject statistics
  Future<Map<String, dynamic>> getSubjectStatistics() async {
    try {
      final response = await _apiService.get(
        '/school/subjects/statistics',
        requiresAuth: true,
      );

      if (response['success'] == true && response['data'] != null) {
        return response['data']['statistics'];
      }

      return {};
    } catch (e) {
      print('❌ Get subject statistics error: $e');
      rethrow;
    }
  }
}
