import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../utils/logger.dart';

/// Secure Storage Service - Handles encrypted local data storage
/// Uses flutter_secure_storage for secure token storage
class SecureStorageService {
  // Secure storage instance with encryption
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
    ),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock,
    ),
  );

  static const String _accessTokenKey = 'secure_access_token';
  static const String _refreshTokenKey = 'secure_refresh_token';
  static const String _userDataKey = 'secure_user_data';

  /// Save access token (encrypted)
  Future<void> saveAccessToken(String token) async {
    try {
      await _storage.write(key: _accessTokenKey, value: token);
      Logger.success('Access token saved securely');
    } catch (e) {
      Logger.error('Failed to save access token', e);
      rethrow;
    }
  }

  /// Get access token (decrypted)
  Future<String?> getAccessToken() async {
    try {
      final token = await _storage.read(key: _accessTokenKey);
      if (token != null) {
        Logger.info('Access token retrieved');
      }
      return token;
    } catch (e) {
      Logger.error('Failed to retrieve access token', e);
      return null;
    }
  }

  /// Save refresh token (encrypted)
  Future<void> saveRefreshToken(String token) async {
    try {
      await _storage.write(key: _refreshTokenKey, value: token);
      Logger.success('Refresh token saved securely');
    } catch (e) {
      Logger.error('Failed to save refresh token', e);
      rethrow;
    }
  }

  /// Get refresh token (decrypted)
  Future<String?> getRefreshToken() async {
    try {
      final token = await _storage.read(key: _refreshTokenKey);
      if (token != null) {
        Logger.info('Refresh token retrieved');
      }
      return token;
    } catch (e) {
      Logger.error('Failed to retrieve refresh token', e);
      return null;
    }
  }

  /// Save user data (encrypted)
  Future<void> saveUserData(String userData) async {
    try {
      await _storage.write(key: _userDataKey, value: userData);
      Logger.success('User data saved securely');
    } catch (e) {
      Logger.error('Failed to save user data', e);
      rethrow;
    }
  }

  /// Get user data (decrypted)
  Future<String?> getUserData() async {
    try {
      return await _storage.read(key: _userDataKey);
    } catch (e) {
      Logger.error('Failed to retrieve user data', e);
      return null;
    }
  }

  /// Clear all secure data (logout)
  Future<void> clearAll() async {
    try {
      await _storage.delete(key: _accessTokenKey);
      await _storage.delete(key: _refreshTokenKey);
      await _storage.delete(key: _userDataKey);
      Logger.success('All secure data cleared');
    } catch (e) {
      Logger.error('Failed to clear secure data', e);
      // Continue anyway - best effort
    }
  }

  /// Check if tokens exist
  Future<bool> hasTokens() async {
    try {
      final accessToken = await getAccessToken();
      final refreshToken = await getRefreshToken();
      return accessToken != null && refreshToken != null;
    } catch (e) {
      Logger.error('Failed to check tokens', e);
      return false;
    }
  }
}
