import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';
import '../config/api_config.dart';
import '../utils/logger.dart';

/// API Service - Optimized with Persistent Connection for Mobile Data
class ApiService {
  String? _accessToken;
  String? _refreshToken;

  // ✅ FIX: Use IOClient with custom HttpClient for TRUE connection reuse
  late final http.Client _client;

  bool _isRefreshing = false;
  Future<void>? _refreshFuture;
  Function(String accessToken, String refreshToken)? _onTokensRefreshed;

  final Map<String, _CacheEntry> _cache = {};
  static const _cacheDuration = Duration(minutes: 15);
  Timer? _cacheCleanupTimer;

  ApiService() {
    // ✅ CRITICAL: Create HttpClient with connection pooling
    final httpClient = HttpClient()
      ..idleTimeout = const Duration(seconds: 15) // ⚡ Increased to 15s to allow connection reuse during reading
      ..connectionTimeout = const Duration(seconds: 30) // ⚡ Keep 30s for slow starts
      ..maxConnectionsPerHost = 5;

    // Wrap in IOClient for use with http package API
    _client = IOClient(httpClient);

    // Clean cache every 5 minutes
    _cacheCleanupTimer = Timer.periodic(
      const Duration(minutes: 5),
      (_) => _cleanupExpiredCache(),
    );
    
    Logger.info('API Service initialized with optimized connection settings');
  }

  // ✅ Cache Invalidation Method
  void invalidateCache(String endpointPattern) {
    _cache.removeWhere((key, _) => key.contains(endpointPattern));
    Logger.performance('Cache invalidated for pattern: $endpointPattern');
  }

  void _cleanupExpiredCache() {
    final now = DateTime.now();
    _cache.removeWhere((key, entry) => now.isAfter(entry.expiresAt));
    _enforceCacheSizeLimit();
  }

  void setTokens(String accessToken, String refreshToken, {Function(String, String)? onRefreshed}) {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    if (onRefreshed != null) {
      _onTokensRefreshed = onRefreshed;
    }
  }

  void clearTokens() {
    _accessToken = null;
    _refreshToken = null;
    _cache.clear();
  }

  void clearCache() {
    _cache.clear();
    Logger.performance('Cache cleared');
  }

  Map<String, String> _getHeaders({bool requiresAuth = false}) {
    final headers = {
      'Content-Type': 'application/json',
      // 'Connection': 'keep-alive', // ❌ Removed: Let HttpClient handle this. Explicit keep-alive can cause issues on aggressive mobile networks.
      'User-Agent': 'SchoolAttendanceApp/1.0', // ✅ Added User-Agent to prevent blocking by some carriers
    };
    if (requiresAuth && _accessToken != null) {
      headers['Authorization'] = 'Bearer $_accessToken';
    }
    return headers;
  }

  Future<void> _performTokenRefresh() async {
    try {
      Logger.network('Refreshing token...');
      final response = await _client.post(
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
          if (_onTokensRefreshed != null) {
            _onTokensRefreshed!(newAccessToken, newRefreshToken);
          }
          Logger.success('Token refreshed successfully');
        } else {
          throw UnauthorizedException('Session expired');
        }
      } else {
        throw UnauthorizedException('Session expired');
      }
    } catch (e) {
      Logger.error('Token refresh error', e);
      clearTokens();
      throw UnauthorizedException('Session expired');
    }
  }

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

  // POST Request
  Future<Map<String, dynamic>> post(
    String endpoint,
    Map<String, dynamic> body, {
    bool requiresAuth = false,
  }) async {
    try {
      return await _requestWithRetry(
        () async {
          final uri = Uri.parse('${ApiConfig.baseUrl}$endpoint');
          final request = http.Request('POST', uri);
          request.headers.addAll(_getHeaders(requiresAuth: requiresAuth));
          request.body = jsonEncode(body);
          
          final streamedResponse = await _client.send(request).timeout(
             ApiConfig.receiveTimeout,
             onTimeout: () => throw TimeoutException('Request timed out'),
          );
          
          return http.Response.fromStream(streamedResponse);
        },
        requiresAuth: requiresAuth,
      );
    } catch (e) {
      Logger.error('API Error (POST $endpoint)', e);
      throw ApiException('Network error: $e');
    }
  }

  // GET Request
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
    }

    try {
      final data = await _requestWithRetry(
        () => _client.get(
          url,
          headers: _getHeaders(requiresAuth: requiresAuth)
        ).timeout(
          ApiConfig.receiveTimeout,
          onTimeout: () => throw TimeoutException('Request timed out'),
        ),
        requiresAuth: requiresAuth,
      );

      if (useCache) {
        _cache[cacheKey] = _CacheEntry(
          data: data,
          expiresAt: DateTime.now().add(_cacheDuration),
        );
      }
      return data;
    } catch (e) {
      Logger.error('API Error (GET $endpoint)', e);
      throw ApiException('Network error: $e');
    }
  }

  // PUT Request
  Future<Map<String, dynamic>> put(
    String endpoint,
    Map<String, dynamic> body, {
    bool requiresAuth = true,
  }) async {
    try {
      return await _requestWithRetry(
        () => _client.put(
          Uri.parse('${ApiConfig.baseUrl}$endpoint'),
          headers: _getHeaders(requiresAuth: requiresAuth),
          body: jsonEncode(body),
        ).timeout(
          ApiConfig.receiveTimeout,
          onTimeout: () => throw TimeoutException('Request timed out'),
        ),
        requiresAuth: requiresAuth,
      );
    } catch (e) {
      Logger.error('API Error (PUT $endpoint)', e);
      throw ApiException('Network error: $e');
    }
  }

  // DELETE Request
  Future<Map<String, dynamic>> delete(
    String endpoint, {
    bool requiresAuth = true,
  }) async {
    try {
      return await _requestWithRetry(
        () => _client.delete(
          Uri.parse('${ApiConfig.baseUrl}$endpoint'),
          headers: _getHeaders(requiresAuth: requiresAuth),
        ).timeout(
          ApiConfig.receiveTimeout,
          onTimeout: () => throw TimeoutException('Request timed out'),
        ),
        requiresAuth: requiresAuth,
      );
    } catch (e) {
      Logger.error('API Error (DELETE $endpoint)', e);
      throw ApiException('Network error: $e');
    }
  }

  Future<Map<String, dynamic>> _requestWithRetry(
    Future<http.Response> Function() request, {
    required bool requiresAuth,
    int retryCount = 0,
    int networkRetryCount = 0,
  }) async {
    try {
      final response = await request();

      if (response.statusCode == 401 && requiresAuth && retryCount == 0) {
        Logger.network('Access token expired. Attempting refresh...');
        await _handleTokenRefresh();
        return await _requestWithRetry(request, requiresAuth: true, retryCount: 1, networkRetryCount: networkRetryCount);
      }

      return _handleResponse(response);
    } on UnauthorizedException {
      rethrow;
    } on TimeoutException catch (e) {
      if (networkRetryCount < 2) {
        Logger.warning('Timeout, retrying... (${networkRetryCount + 1}/2)');
        await Future.delayed(Duration(seconds: networkRetryCount + 1));
        return await _requestWithRetry(request, requiresAuth: requiresAuth, retryCount: retryCount, networkRetryCount: networkRetryCount + 1);
      }
      Logger.error('Timeout after retries', e);
      throw ApiException('Connection timeout. Please check your internet.');
    } catch (e) {
      if (networkRetryCount < 2 && e.toString().contains('SocketException')) {
        Logger.warning('Network error, retrying... (${networkRetryCount + 1}/2)');
        await Future.delayed(Duration(seconds: networkRetryCount + 1));
        return await _requestWithRetry(request, requiresAuth: requiresAuth, retryCount: retryCount, networkRetryCount: networkRetryCount + 1);
      }
      Logger.error('Request failed', e);
      throw ApiException('Network error. Please check your connection.');
    }
  }

  Map<String, dynamic> _handleResponse(http.Response response) {
    final body = response.body;
    if (body.isEmpty) throw ApiException('Empty response');
    
    final data = jsonDecode(body) as Map<String, dynamic>;
    
    if (response.statusCode >= 200 && response.statusCode < 300) return data;
    
    final message = data['message'] ?? 'Unknown error';
    if (response.statusCode == 401) throw UnauthorizedException(message);
    if (response.statusCode == 404) throw NotFoundException(message);
    if (response.statusCode == 400) throw ValidationException(message);
    throw ApiException('Error ${response.statusCode}: $message');
  }

  void dispose() {
    _cacheCleanupTimer?.cancel();
    _cache.clear();
    _client.close();
    Logger.info('API Service disposed');
  }

  void _enforceCacheSizeLimit() {
    if (_cache.length > 100) {
      final sortedEntries = _cache.entries.toList()
        ..sort((a, b) => a.value.expiresAt.compareTo(b.value.expiresAt));
      final toRemove = _cache.length - 100;
      for (int i = 0; i < toRemove; i++) {
        _cache.remove(sortedEntries[i].key);
      }
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

class _CacheEntry {
  final Map<String, dynamic> data;
  final DateTime expiresAt;
  _CacheEntry({required this.data, required this.expiresAt});
}
