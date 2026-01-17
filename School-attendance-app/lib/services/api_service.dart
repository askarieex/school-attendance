import 'dart:convert';
import 'dart:async'; // ✅ BUG FIX: Add for TimeoutException
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import '../utils/logger.dart';

/// API Service - Handles all HTTP requests with caching
class ApiService {
  String? _accessToken;
  String? _refreshToken;

  // ✅ For handling concurrent token refresh requests
  bool _isRefreshing = false;
  Future<void>? _refreshFuture;

  // ✅ CRITICAL FIX: Callback to save tokens after refresh
  Function(String accessToken, String refreshToken)? _onTokensRefreshed;

  // ✅ ULTRA PERFORMANCE: Add HTTP cache (15 minute TTL)
  // Attendance data doesn't change frequently, so longer cache is safe
  final Map<String, _CacheEntry> _cache = {};
  static const _cacheDuration = Duration(minutes: 15);

  // ✅ BUG FIX: Add cache cleanup timer
  Timer? _cacheCleanupTimer;

  // Constructor - ✅ BUG FIX: Start cache cleanup
  ApiService() {
    // Clean cache every 5 minutes to prevent memory growth
    _cacheCleanupTimer = Timer.periodic(
      const Duration(minutes: 5),
      (_) => _cleanupExpiredCache(),
    );
  }

  // ✅ BUG FIX: Cleanup expired cache entries
  void _cleanupExpiredCache() {
    final now = DateTime.now();
    final beforeCount = _cache.length;
    _cache.removeWhere((key, entry) => now.isAfter(entry.expiresAt));
    final afterCount = _cache.length;

    if (beforeCount != afterCount) {
      Logger.performance('Cache cleanup: Removed ${beforeCount - afterCount} expired entries, $afterCount remaining');
    }

    // ✅ CRITICAL FIX: Enforce cache size limit
    _enforceCacheSizeLimit();
  }

  // Set tokens after login
  void setTokens(String accessToken, String refreshToken, {Function(String, String)? onRefreshed}) {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    if (onRefreshed != null) {
      _onTokensRefreshed = onRefreshed;
    }
  }

  // Clear tokens on logout
  void clearTokens() {
    _accessToken = null;
    _refreshToken = null;
    _cache.clear(); // Clear cache on logout
  }

  // Clear cache manually if needed
  void clearCache() {
    _cache.clear();
    Logger.performance('Cache cleared');
  }
  
  // Get headers with or without auth token
  Map<String, String> _getHeaders({bool requiresAuth = false}) {
    final headers = {
      'Content-Type': 'application/json',
    };
    
    if (requiresAuth && _accessToken != null) {
      headers['Authorization'] = 'Bearer $_accessToken';
    }
    
    return headers;
  }

  /// ✅ Refresh the access token using the refresh token
  Future<void> _performTokenRefresh() async {
    try {
      Logger.network('Refreshing token...');
      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}${ApiConfig.refresh}'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': _refreshToken}),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final newAccessToken = data['data']?['accessToken'];
        final newRefreshToken = data['data']?['refreshToken'];

        if (newAccessToken != null && newRefreshToken != null) {
          _accessToken = newAccessToken;
          _refreshToken = newRefreshToken;

          // ✅ CRITICAL FIX: Notify auth provider to save new tokens
          if (_onTokensRefreshed != null) {
            _onTokensRefreshed!(newAccessToken, newRefreshToken);
          }

          Logger.success('Token refreshed successfully - both tokens updated');
        } else {
          Logger.error('Token refresh response missing tokens');
          clearTokens();
          throw UnauthorizedException('Session expired. Please login again.');
        }
      } else {
        Logger.error('Token refresh failed with status ${response.statusCode}');
        clearTokens();
        throw UnauthorizedException('Session expired. Please login again.');
      }
    } catch (e) {
      Logger.error('Token refresh error', e);
      clearTokens();
      throw UnauthorizedException('Session expired. Please login again.');
    }
  }

  /// ✅ Wrapper for token refresh to handle concurrent requests
  Future<void> _handleTokenRefresh() {
    if (!_isRefreshing) {
      _isRefreshing = true;
      _refreshFuture = _performTokenRefresh().whenComplete(() {
        _isRefreshing = false;
        _refreshFuture = null;
      });
    }
    return _refreshFuture!;
  }
  
  // POST request
  // ✅ CRITICAL FIX: Use config timeout (60s for slow networks)
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
        ).timeout(
          ApiConfig.receiveTimeout, // ✅ Use 60s timeout from config
          onTimeout: () {
            throw TimeoutException('Request timed out. Please check your network connection.');
          },
        ),
        requiresAuth: requiresAuth,
      );
    } catch (e) {
      Logger.error('API Error (POST $endpoint)', e);
      throw ApiException('Network error: $e');
    }
  }
  
  // GET request with caching
  Future<Map<String, dynamic>> get(
    String endpoint, {
    Map<String, String>? queryParams,
    bool requiresAuth = true,
    bool useCache = true,
  }) async {
    var url = Uri.parse('${ApiConfig.baseUrl}$endpoint');
    if (queryParams != null) {
      url = url.replace(queryParameters: queryParams);
    }
    final cacheKey = url.toString();

    if (useCache && _cache.containsKey(cacheKey)) {
      final entry = _cache[cacheKey]!;
      if (DateTime.now().isBefore(entry.expiresAt)) {
        Logger.performance('Cache HIT: $url');
        return entry.data;
      }
      _cache.remove(cacheKey);
      Logger.performance('Cache EXPIRED: $url');
    }

    try {
      final data = await _requestWithRetry(
        () => http.get(
          url,
          headers: _getHeaders(requiresAuth: requiresAuth)
        ).timeout(
          ApiConfig.receiveTimeout, // ✅ Use 60s timeout from config
          onTimeout: () {
            throw TimeoutException('Request timed out. Please check your network connection.');
          },
        ),
        requiresAuth: requiresAuth,
      );

      if (useCache) {
        _cache[cacheKey] = _CacheEntry(
          data: data,
          expiresAt: DateTime.now().add(_cacheDuration),
        );
        Logger.performance('Cached: $url (TTL: ${_cacheDuration.inSeconds}s)');
      }
      return data;
    } catch (e) {
      Logger.error('API Error (GET $endpoint)', e);
      throw ApiException('Network error: $e');
    }
  }
  
  // PUT request
  Future<Map<String, dynamic>> put(
    String endpoint,
    Map<String, dynamic> body, {
    bool requiresAuth = true,
  }) async {
    try {
      return await _requestWithRetry(
        () => http.put(
          Uri.parse('${ApiConfig.baseUrl}$endpoint'),
          headers: _getHeaders(requiresAuth: requiresAuth),
          body: jsonEncode(body),
        ).timeout(
          ApiConfig.receiveTimeout, // ✅ Use 60s timeout from config
          onTimeout: () {
            throw TimeoutException('Request timed out. Please check your network connection.');
          },
        ),
        requiresAuth: requiresAuth,
      );
    } catch (e) {
      Logger.error('API Error (PUT $endpoint)', e);
      throw ApiException('Network error: $e');
    }
  }

  // DELETE request
  Future<Map<String, dynamic>> delete(
    String endpoint, {
    bool requiresAuth = true,
  }) async {
    try {
      return await _requestWithRetry(
        () => http.delete(
          Uri.parse('${ApiConfig.baseUrl}$endpoint'),
          headers: _getHeaders(requiresAuth: requiresAuth),
        ).timeout(
          ApiConfig.receiveTimeout, // ✅ Use 60s timeout from config
          onTimeout: () {
            throw TimeoutException('Request timed out. Please check your network connection.');
          },
        ),
        requiresAuth: requiresAuth,
      );
    } catch (e) {
      Logger.error('API Error (DELETE $endpoint)', e);
      throw ApiException('Network error: $e');
    }
  }

  /// ✅ ULTRA RELIABLE: Generic request handler with automatic retry for network failures
  Future<Map<String, dynamic>> _requestWithRetry(
    Future<http.Response> Function() request, {
    required bool requiresAuth,
    int retryCount = 0,
    int networkRetryCount = 0,
  }) async {
    try {
      final response = await request(); // Timeout is already handled in each method

      if (response.statusCode == 401 && requiresAuth && retryCount == 0) {
        Logger.network('Access token expired. Attempting refresh...');
        await _handleTokenRefresh();
        // Retry the original request with the new token
        return await _requestWithRetry(request, requiresAuth: true, retryCount: 1, networkRetryCount: networkRetryCount);
      }

      return _handleResponse(response);
    } on UnauthorizedException {
      // If refresh token fails, this will be thrown
      rethrow;
    } on TimeoutException catch (e) {
      // ✅ AUTO-RETRY on timeout (up to 2 times)
      if (networkRetryCount < 2) {
        Logger.warning('Timeout, retrying... (${networkRetryCount + 1}/2)');
        await Future.delayed(Duration(seconds: networkRetryCount + 1)); // Progressive delay
        return await _requestWithRetry(request, requiresAuth: requiresAuth, retryCount: retryCount, networkRetryCount: networkRetryCount + 1);
      }
      Logger.error('Request timeout after ${networkRetryCount + 1} attempts', e);
      throw ApiException('Connection timeout. Please check your internet.');
    } catch (e) {
      // ✅ AUTO-RETRY on network error (up to 2 times)
      if (networkRetryCount < 2 && e.toString().contains('SocketException')) {
        Logger.warning('Network error, retrying... (${networkRetryCount + 1}/2)');
        await Future.delayed(Duration(seconds: networkRetryCount + 1));
        return await _requestWithRetry(request, requiresAuth: requiresAuth, retryCount: retryCount, networkRetryCount: networkRetryCount + 1);
      }
      Logger.error('Request failed after ${networkRetryCount + 1} attempts', e);
      throw ApiException('Network error. Please check your connection.');
    }
  }
  
  // Handle API response
  Map<String, dynamic> _handleResponse(http.Response response) {
    final body = response.body;
    
    if (body.isEmpty) {
      throw ApiException('Empty response from server');
    }
    
    final data = jsonDecode(body) as Map<String, dynamic>;
    
    // Handle success (2xx status codes)
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return data;
    }
    
    // Handle errors
    final message = data['message'] ?? 'Unknown error occurred';
    
    if (response.statusCode == 401) {
      throw UnauthorizedException(message);
    } else if (response.statusCode == 404) {
      throw NotFoundException(message);
    } else if (response.statusCode == 400) {
      throw ValidationException(message);
    } else {
      throw ApiException('Error ${response.statusCode}: $message');
    }
  }

  // ✅ BUG FIX: Dispose method to cleanup resources
  void dispose() {
    _cacheCleanupTimer?.cancel();
    _cache.clear();
    clearTokens();
    Logger.info('API Service disposed');
  }
  
  // ✅ CRITICAL FIX: Limit cache size to prevent memory bloat
  void _enforceCacheSizeLimit() {
    const int maxCacheSize = 100;

    if (_cache.length > maxCacheSize) {
      // Sort by expiration time and remove oldest entries
      final sortedEntries = _cache.entries.toList()
        ..sort((a, b) => a.value.expiresAt.compareTo(b.value.expiresAt));

      final toRemove = _cache.length - maxCacheSize;
      for (int i = 0; i < toRemove; i++) {
        _cache.remove(sortedEntries[i].key);
      }

      Logger.performance('Cache size limit enforced: removed $toRemove entries, ${_cache.length} remaining');
    }
  }
}

// Custom Exceptions
class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  
  @override
  String toString() => message;
}

class UnauthorizedException extends ApiException {
  UnauthorizedException(String message) : super(message);
}

class NotFoundException extends ApiException {
  NotFoundException(String message) : super(message);
}

class ValidationException extends ApiException {
  ValidationException(String message) : super(message);
}

// ✅ Cache entry with expiration
class _CacheEntry {
  final Map<String, dynamic> data;
  final DateTime expiresAt;

  _CacheEntry({
    required this.data,
    required this.expiresAt,
  });
}
