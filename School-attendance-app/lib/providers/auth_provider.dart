import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../config/api_config.dart';

class AuthProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  final StorageService _storageService = StorageService();
  
  User? _currentUser;
  String? _error;
  String? _accessToken;

  User? get currentUser => _currentUser;
  String? get error => _error;
  bool get isLoggedIn => _currentUser != null;
  bool get isParent => _currentUser?.role == UserRole.parent;
  bool get isTeacher => _currentUser?.role == UserRole.teacher;
  ApiService get apiService => _apiService; // Expose API service

  // Real API login for teachers
  Future<bool> loginTeacher(String email, String password) async {
    _error = null;
    notifyListeners();
    
    try {
      print('🔐 Attempting teacher login: $email');
      
      // Call real API
      final response = await _apiService.post(
        ApiConfig.login,
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
          schoolName: user['school_name'],  // ✅ FIX: Use snake_case from API
          currentAcademicYear: user['currentAcademicYear'],  // ✅ NEW: Academic year
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

  // Parent login (for future - currently same as teacher)
  Future<bool> loginParent(String email, String password) async {
    return await loginTeacher(email, password);
  }

  // Logout
  Future<void> logout() async {
    _currentUser = null;
    _accessToken = null;
    _apiService.clearTokens();
    await _storageService.clearAll();
    notifyListeners();
    print('✅ Logged out');
  }
  
  // Try to restore session from saved token
  Future<bool> tryAutoLogin() async {
    try {
      final accessToken = await _storageService.getAccessToken();
      final refreshToken = await _storageService.getRefreshToken();
      
      if (accessToken == null || refreshToken == null) {
        return false;
      }
      
      _apiService.setTokens(accessToken, refreshToken);
      _accessToken = accessToken;
      
      // Get current user data from API
      final response = await _apiService.get(ApiConfig.getMe);
      
      if (response['success'] == true && response['data'] != null) {
        final user = response['data'];
        
        _currentUser = User(
          id: user['id'].toString(),
          email: user['email'],
          name: user['full_name'] ?? user['email'],
          role: user['role'] == 'teacher' ? UserRole.teacher : UserRole.parent,
          schoolName: user['school_name'],
          currentAcademicYear: user['currentAcademicYear'],  // ✅ NEW: Academic year
        );
        
        notifyListeners();
        return true;
      }
      
      return false;
    } catch (e) {
      print('❌ Auto login failed: $e');
      await logout();
      return false;
    }
  }
  
  // ✅ CRITICAL FIX: Dispose API service to prevent memory leaks
  @override
  void dispose() {
    _apiService.dispose();
    super.dispose();
  }
}
