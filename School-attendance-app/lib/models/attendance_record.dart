enum AttendanceStatus { present, late, absent }

class AttendanceRecord {
  final String studentId;
  final DateTime date;
  AttendanceStatus status;
  final DateTime? arrivalTime;
  final bool manuallyMarked;
  
  AttendanceRecord({
    required this.studentId,
    required this.date,
    required this.status,
    this.arrivalTime,
    this.manuallyMarked = false,
  });

  String getStatusEmoji() {
    switch (status) {
      case AttendanceStatus.present:
        return '✅';
      case AttendanceStatus.late:
        return '🟡';
      case AttendanceStatus.absent:
        return '🔴';
    }
  }

  String getStatusText() {
    switch (status) {
      case AttendanceStatus.present:
        return 'Present';
      case AttendanceStatus.late:
        return 'Late';
      case AttendanceStatus.absent:
        return 'Absent';
    }
  }
}
