import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';

/// API Service - Handles all HTTP requests with caching
class ApiService {
  String? _accessToken;

  // ✅ PERFORMANCE: Add HTTP cache (30 second TTL)
  final Map<String, _CacheEntry> _cache = {};
  static const _cacheDuration = Duration(seconds: 30);

  // Set token after login
  void setToken(String token) {
    _accessToken = token;
  }

  // Clear token on logout
  void clearToken() {
    _accessToken = null;
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
  
  // POST request
  Future<Map<String, dynamic>> post(
    String endpoint, 
    Map<String, dynamic> body, {
    bool requiresAuth = false,
  }) async {
    try {
      final url = Uri.parse('${ApiConfig.baseUrl}$endpoint');
      print('📤 POST: $url');
      print('📦 Body: ${jsonEncode(body)}');
      
      final response = await http.post(
        url,
        headers: _getHeaders(requiresAuth: requiresAuth),
        body: jsonEncode(body),
      ).timeout(ApiConfig.connectTimeout);
      
      print('📥 Response: ${response.statusCode}');
      print('📥 Body: ${response.body}');
      
      return _handleResponse(response);
    } catch (e) {
      print('❌ API Error: $e');
      throw ApiException('Network error: $e');
    }
  }
  
  // GET request with caching
  Future<Map<String, dynamic>> get(
    String endpoint, {
    Map<String, String>? queryParams,
    bool requiresAuth = true,
    bool useCache = true, // ✅ Option to disable cache for specific requests
  }) async {
    try {
      var url = Uri.parse('${ApiConfig.baseUrl}$endpoint');

      if (queryParams != null) {
        url = url.replace(queryParameters: queryParams);
      }

      final cacheKey = url.toString();

      // ✅ PERFORMANCE: Check cache first
      if (useCache && _cache.containsKey(cacheKey)) {
        final entry = _cache[cacheKey]!;
        if (DateTime.now().isBefore(entry.expiresAt)) {
          print('⚡ Cache HIT: $url');
          return entry.data;
        } else {
          // Cache expired, remove it
          _cache.remove(cacheKey);
          print('🕐 Cache EXPIRED: $url');
        }
      }

      print('📤 GET: $url');

      final response = await http.get(
        url,
        headers: _getHeaders(requiresAuth: requiresAuth),
      ).timeout(ApiConfig.receiveTimeout);

      print('📥 Response: ${response.statusCode}');

      final data = _handleResponse(response);

      // ✅ PERFORMANCE: Cache successful GET requests
      if (useCache && response.statusCode >= 200 && response.statusCode < 300) {
        _cache[cacheKey] = _CacheEntry(
          data: data,
          expiresAt: DateTime.now().add(_cacheDuration),
        );
        print('💾 Cached: $url (TTL: ${_cacheDuration.inSeconds}s)');
      }

      return data;
    } catch (e) {
      print('❌ API Error: $e');
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
      final url = Uri.parse('${ApiConfig.baseUrl}$endpoint');
      print('📤 PUT: $url');
      
      final response = await http.put(
        url,
        headers: _getHeaders(requiresAuth: requiresAuth),
        body: jsonEncode(body),
      ).timeout(ApiConfig.connectTimeout);
      
      print('📥 Response: ${response.statusCode}');
      
      return _handleResponse(response);
    } catch (e) {
      print('❌ API Error: $e');
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
