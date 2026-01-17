/// Logger Utility - Conditional logging for production
/// Only logs in debug mode to improve performance
class Logger {
  // Check if running in debug mode
  static const bool _isDebug = bool.fromEnvironment('DEBUG', defaultValue: true);

  /// Log info message (only in debug mode)
  static void info(String message) {
    if (_isDebug) {
      print('ℹ️ $message');
    }
  }

  /// Log success message (only in debug mode)
  static void success(String message) {
    if (_isDebug) {
      print('✅ $message');
    }
  }

  /// Log warning message (only in debug mode)
  static void warning(String message) {
    if (_isDebug) {
      print('⚠️ $message');
    }
  }

  /// Log error message (ALWAYS logs, even in production)
  static void error(String message, [dynamic error, StackTrace? stackTrace]) {
    print('❌ $message');
    if (error != null) {
      print('Error: $error');
    }
    if (stackTrace != null && _isDebug) {
      print('Stack trace: $stackTrace');
    }
  }

  /// Log network request (only in debug mode)
  static void network(String message) {
    if (_isDebug) {
      print('🌐 $message');
    }
  }

  /// Log performance metric (only in debug mode)
  static void performance(String message) {
    if (_isDebug) {
      print('⚡ $message');
    }
  }
}
