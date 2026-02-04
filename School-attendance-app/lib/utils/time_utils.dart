
import 'package:intl/intl.dart';

class TimeUtils {
  /// IST Offset: UTC + 5:30
  static const Duration istOffset = Duration(hours: 5, minutes: 30);

  /// Get current DateTime in IST
  static DateTime nowIST() {
    return DateTime.now().toUtc().add(istOffset);
  }

  /// Get today's date string in YYYY-MM-DD format (IST)
  static String todayIST() {
    final now = nowIST();
    return DateFormat('yyyy-MM-dd').format(now);
  }

  /// Get formatted date for display (e.g., "Feb 04, 2026")
  static String formatDisplayDate(DateTime date) {
    return DateFormat('MMM dd, yyyy').format(date);
  }

  /// Check if a date is today (in IST)
  static bool isToday(DateTime date) {
    final now = nowIST();
    return date.year == now.year && 
           date.month == now.month && 
           date.day == now.day;
  }
}
