import 'package:flutter/foundation.dart';
import 'package:jwt_decoder/jwt_decoder.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/secure_storage_service.dart';
import '../config/api_config.dart';
import '../utils/logger.dart';

class AuthProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  final SecureStorageService _storageService = SecureStorageService();

  User? _currentUser;
  String? _error;
  String? _accessToken;

  // ✅ NEW: Track session expiration for UI to handle navigation
  bool _sessionExpired = false;
  bool get sessionExpired => _sessionExpired;

  User? get currentUser => _currentUser;
  String? get error => _error;
  bool get isLoggedIn => _currentUser != null;
  bool get isParent => _currentUser?.role == UserRole.parent;
  bool get isTeacher => _currentUser?.role == UserRole.teacher;
  ApiService get apiService => _apiService; // Expose API service

  // ✅ NEW: Reset session expired flag (called after navigation to login)
  void clearSessionExpired() {
    _sessionExpired = false;
  }

  // ✅ CRITICAL FIX: Callback to save refreshed tokens to storage
  Future<void> _saveRefreshedTokens(String accessToken, String refreshToken) async {
    try {
      Logger.network('Saving refreshed tokens to secure storage...');
      await _storageService.saveAccessToken(accessToken);
      await _storageService.saveRefreshToken(refreshToken);
      Logger.success('Refreshed tokens saved successfully');
    } catch (e) {
      Logger.error('Failed to save refreshed tokens', e);
      // Non-critical - tokens are still in memory
    }
  }

  /// ✅ NEW: Check if access token is expired
  bool _isTokenExpired(String token) {
    try {
      return JwtDecoder.isExpired(token);
    } catch (e) {
      Logger.error('Failed to decode JWT token', e);
      return true; // Treat as expired if can't decode
    }
  }

  /// ✅ NEW: Get remaining token validity time
  Duration? _getTokenRemainingTime(String token) {
    try {
      final expirationDate = JwtDecoder.getExpirationDate(token);
      final now = DateTime.now();
      if (expirationDate.isAfter(now)) {
        return expirationDate.difference(now);
      }
      return null;
    } catch (e) {
      Logger.error('Failed to get token expiration', e);
      return null;
    }
  }

  // Real API login for teachers
  Future<bool> loginTeacher(String email, String password) async {
    _error = null;
    notifyListeners();

    try {
      Logger.network('Attempting teacher login: $email');

      // Call real API
      final response = await _apiService.post(
        ApiConfig.login,
        {
          'email': email,
          'password': password,
        },
      );

      Logger.success('Login response received');

      // Check if response has data
      if (response['success'] == true && response['data'] != null) {
        final data = response['data'];
        final user = data['user'];
        final accessToken = data['accessToken'];
        final refreshToken = data['refreshToken'];

        // Save tokens securely
        try {
          await _storageService.saveAccessToken(accessToken);
          await _storageService.saveRefreshToken(refreshToken);
        } catch (storageError) {
          Logger.error('Storage warning (non-critical)', storageError);
          // Continue anyway - tokens are in memory
        }

        // ✅ CRITICAL FIX: Set tokens with refresh callback
        _apiService.setTokens(accessToken, refreshToken, onRefreshed: _saveRefreshedTokens);
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

        Logger.success('Login successful: ${_currentUser?.name}');
        notifyListeners();
        return true;
      } else {
        _error = response['message'] ?? 'Login failed';
        Logger.warning('Login failed: $_error');
        notifyListeners();
        return false;
      }
    } catch (e) {
      Logger.error('Login error', e);
      _error = 'Network error. Please check your internet connection.';
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
    Logger.success('Logged out');
  }

  // ✅ IMPROVED: Try to restore session from saved token with JWT validation
  Future<bool> tryAutoLogin() async {
    try {
      Logger.info('🔐 Starting auto-login attempt...');
      final accessToken = await _storageService.getAccessToken();
      final refreshToken = await _storageService.getRefreshToken();

      if (accessToken == null || refreshToken == null) {
        Logger.warning('❌ No saved tokens found - user needs to login');
        return false;
      }

      Logger.success('✅ Found saved tokens in secure storage');

      // ✅ NEW: Check if access token is expired BEFORE making API call
      if (_isTokenExpired(accessToken)) {
        Logger.warning('⚠️ Access token expired, attempting refresh...');

        // Check if refresh token is also expired
        if (_isTokenExpired(refreshToken)) {
          Logger.error('❌ Refresh token also expired - full re-login required');
          _sessionExpired = true;
          await logout();
          return false;
        }

        Logger.info('✅ Refresh token still valid, refreshing access token...');

        // Refresh token is still valid - use it to get new access token
        try {
          Logger.network('🔄 Calling /auth/refresh endpoint...');
          final refreshResponse = await _apiService.post(
            ApiConfig.refresh,
            {'refreshToken': refreshToken},
          );

          if (refreshResponse['success'] == true && refreshResponse['data'] != null) {
            final newAccessToken = refreshResponse['data']['accessToken'];
            final newRefreshToken = refreshResponse['data']['refreshToken'];

            Logger.success('✅ Token refresh successful - saving new tokens to secure storage');

            // Save BOTH new tokens to secure storage
            await _storageService.saveAccessToken(newAccessToken);
            await _storageService.saveRefreshToken(newRefreshToken);
            _apiService.setTokens(newAccessToken, newRefreshToken, onRefreshed: _saveRefreshedTokens);
            _accessToken = newAccessToken;

            Logger.success('✅ Tokens updated - continuing with user data fetch');
            // Continue with user data fetch below
          } else {
            Logger.error('❌ Token refresh failed - invalid response from server');
            _sessionExpired = true;
            await logout();
            return false;
          }
        } catch (refreshError) {
          Logger.error('❌ Token refresh failed - network or server error', refreshError);
          _sessionExpired = true;
          await logout();
          return false;
        }
      } else {
        // Token is still valid - no refresh needed
        final remaining = _getTokenRemainingTime(accessToken);
        if (remaining != null) {
          final hours = remaining.inHours;
          final minutes = remaining.inMinutes % 60;
          Logger.success('✅ Access token still valid: ${hours}h ${minutes}m remaining');
        }

        // Set tokens with refresh callback
        _apiService.setTokens(accessToken, refreshToken, onRefreshed: _saveRefreshedTokens);
        _accessToken = accessToken;
      }

      // Now fetch user data with valid token
      try {
        Logger.network('📡 Fetching user data from /auth/me...');
        final response = await _apiService.get(ApiConfig.getMe);

        if (response['success'] == true && response['data'] != null) {
          final user = response['data'];

          _currentUser = User(
            id: user['id'].toString(),
            email: user['email'],
            name: user['full_name'] ?? user['fullName'] ?? user['email'],
            role: user['role'] == 'teacher' ? UserRole.teacher : UserRole.parent,
            schoolName: user['school_name'],
            currentAcademicYear: user['currentAcademicYear'],
          );

          Logger.success('🎉 AUTO-LOGIN SUCCESSFUL! Welcome back, ${_currentUser?.name}');
          notifyListeners();
          return true;
        } else {
          Logger.error('❌ Failed to fetch user data - invalid response');
          _sessionExpired = true;
          await logout();
          return false;
        }
      } catch (e) {
        Logger.error('❌ Error fetching user data from /auth/me', e);
        _sessionExpired = true;
        await logout();
        return false;
      }
    } catch (e) {
      Logger.error('❌ Auto login failed - unexpected error', e);
      _sessionExpired = true;
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
