import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';

/// API Service - Handles all HTTP requests with caching
class ApiService {
  String? _accessToken;
  String? _refreshToken;

  // ✅ For handling concurrent token refresh requests
  bool _isRefreshing = false;
  Future<void>? _refreshFuture;

  // ✅ PERFORMANCE: Add HTTP cache (30 second TTL)
  final Map<String, _CacheEntry> _cache = {};
  static const _cacheDuration = Duration(seconds: 30);

  // Set tokens after login
  void setTokens(String accessToken, String refreshToken) {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
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
    print('🧹 Cache cleared');
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
      print('🔄 Refreshing token...');
      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}${ApiConfig.refresh}'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': _refreshToken}),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        _accessToken = data['data']?['accessToken'];
        _refreshToken = data['data']?['refreshToken'];
        print('✅ Token refreshed successfully');
      } else {
        print('❌ Token refresh failed');
        clearTokens();
        throw UnauthorizedException('Session expired. Please login again.');
      }
    } catch (e) {
      print('❌ Token refresh error: $e');
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
        ),
        requiresAuth: requiresAuth,
      );
    } catch (e) {
      print('❌ API Error (POST $endpoint): $e');
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
        print('⚡ Cache HIT: $url');
        return entry.data;
      }
      _cache.remove(cacheKey);
      print('🕐 Cache EXPIRED: $url');
    }

    try {
      final data = await _requestWithRetry(
        () => http.get(url, headers: _getHeaders(requiresAuth: requiresAuth)),
        requiresAuth: requiresAuth,
      );

      if (useCache) {
        _cache[cacheKey] = _CacheEntry(
          data: data,
          expiresAt: DateTime.now().add(_cacheDuration),
        );
        print('💾 Cached: $url (TTL: ${_cacheDuration.inSeconds}s)');
      }
      return data;
    } catch (e) {
      print('❌ API Error (GET $endpoint): $e');
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
        ),
        requiresAuth: requiresAuth,
      );
    } catch (e) {
      print('❌ API Error (PUT $endpoint): $e');
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
        ),
        requiresAuth: requiresAuth,
      );
    } catch (e) {
      print('❌ API Error (DELETE $endpoint): $e');
      throw ApiException('Network error: $e');
    }
  }

  /// ✅ Generic request handler with retry logic for token refresh
  Future<Map<String, dynamic>> _requestWithRetry(
    Future<http.Response> Function() request, {
    required bool requiresAuth,
    int retryCount = 0,
  }) async {
    try {
      final response = await request().timeout(ApiConfig.connectTimeout);
      
      if (response.statusCode == 401 && requiresAuth && retryCount == 0) {
        print('🔑 Access token expired. Attempting refresh...');
        await _handleTokenRefresh();
        // Retry the original request with the new token
        return await _requestWithRetry(request, requiresAuth: true, retryCount: 1);
      }
      
      return _handleResponse(response);
    } on UnauthorizedException {
      // If refresh token fails, this will be thrown
      rethrow;
    } catch (e) {
      print('❌ Request failed: $e');
      throw ApiException('Network error: $e');
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
