import 'package:flutter/foundation.dart';
import '../models/attendance_record.dart';
import '../models/student.dart';
import '../models/class_info.dart';

class AttendanceProvider with ChangeNotifier {
  final List<AttendanceRecord> _records = [];
  final List<Student> _students = _generateDemoStudents();
  final List<ClassInfo> _classes = _generateDemoClasses();

  List<AttendanceRecord> get records => _records;
  List<Student> get students => _students;
  List<ClassInfo> get classes => _classes;

  AttendanceProvider() {
    _initializeDemoData();
  }

  void _initializeDemoData() {
    // Create demo attendance records for today
    final today = DateTime.now();
    for (var student in _students) {
      _records.add(AttendanceRecord(
        studentId: student.id,
        date: today,
        status: student.id == 'student_001' 
            ? AttendanceStatus.present 
            : (student.id == 'student_002' ? AttendanceStatus.late : AttendanceStatus.absent),
        arrivalTime: student.id == 'student_001' 
            ? DateTime(today.year, today.month, today.day, 8, 55) 
            : (student.id == 'student_002' ? DateTime(today.year, today.month, today.day, 9, 15) : null),
      ));
    }
  }

  AttendanceRecord? getTodayAttendance(String studentId) {
    final today = DateTime.now();
    try {
      return _records.firstWhere(
        (record) =>
            record.studentId == studentId &&
            record.date.year == today.year &&
            record.date.month == today.month &&
            record.date.day == today.day,
      );
    } catch (e) {
      return null;
    }
  }

  List<AttendanceRecord> getStudentHistory(String studentId) {
    return _records
        .where((record) => record.studentId == studentId)
        .toList()
      ..sort((a, b) => b.date.compareTo(a.date));
  }

  List<Student> getClassStudents(String classId) {
    final classInfo = _classes.firstWhere((c) => c.id == classId);
    return _students.where((s) => classInfo.studentIds.contains(s.id)).toList();
  }

  Map<String, int> getClassAttendanceSummary(String classId) {
    final students = getClassStudents(classId);
    int present = 0;
    int late = 0;
    int absent = 0;

    for (var student in students) {
      final attendance = getTodayAttendance(student.id);
      if (attendance != null) {
        switch (attendance.status) {
          case AttendanceStatus.present:
            present++;
            break;
          case AttendanceStatus.late:
            late++;
            break;
          case AttendanceStatus.absent:
            absent++;
            break;
        }
      }
    }

    return {
      'present': present,
      'late': late,
      'absent': absent,
      'total': students.length,
    };
  }

  void markAttendance(String studentId, AttendanceStatus status, {bool manual = false}) {
    final today = DateTime.now();
    final existingRecord = getTodayAttendance(studentId);

    if (existingRecord != null) {
      existingRecord.status = status;
      if (status == AttendanceStatus.present || status == AttendanceStatus.late) {
        // Update arrival time
      }
    } else {
      _records.add(AttendanceRecord(
        studentId: studentId,
        date: today,
        status: status,
        arrivalTime: status == AttendanceStatus.present || status == AttendanceStatus.late
            ? DateTime.now()
            : null,
        manuallyMarked: manual,
      ));
    }
    notifyListeners();
  }

  Student? getStudentById(String studentId) {
    try {
      return _students.firstWhere((s) => s.id == studentId);
    } catch (e) {
      return null;
    }
  }

  static List<Student> _generateDemoStudents() {
    return [
      Student(id: 'student_001', name: 'Emma Wilson', parentId: 'parent_001', grade: 'Grade 5A'),
      Student(id: 'student_002', name: 'Liam Brown', parentId: 'parent_002', grade: 'Grade 5A'),
      Student(id: 'student_003', name: 'Olivia Davis', parentId: 'parent_003', grade: 'Grade 5A'),
      Student(id: 'student_004', name: 'Noah Miller', parentId: 'parent_004', grade: 'Grade 5A'),
      Student(id: 'student_005', name: 'Ava Garcia', parentId: 'parent_005', grade: 'Grade 5A'),
      Student(id: 'student_006', name: 'Ethan Martinez', parentId: 'parent_006', grade: 'Grade 5A'),
      Student(id: 'student_007', name: 'Sophia Rodriguez', parentId: 'parent_007', grade: 'Grade 5A'),
      Student(id: 'student_008', name: 'Mason Hernandez', parentId: 'parent_008', grade: 'Grade 5A'),
      Student(id: 'student_009', name: 'Isabella Lopez', parentId: 'parent_009', grade: 'Grade 5A'),
      Student(id: 'student_010', name: 'William Wilson', parentId: 'parent_010', grade: 'Grade 5A'),
      Student(id: 'student_011', name: 'Charlotte Anderson', parentId: 'parent_011', grade: 'Grade 6B'),
      Student(id: 'student_012', name: 'James Taylor', parentId: 'parent_012', grade: 'Grade 6B'),
    ];
  }

  static List<ClassInfo> _generateDemoClasses() {
    return [
      ClassInfo(
        id: 'class_001',
        name: 'Grade 5A',
        teacherId: 'teacher_001',
        studentIds: [
          'student_001', 'student_002', 'student_003', 'student_004', 'student_005',
          'student_006', 'student_007', 'student_008', 'student_009', 'student_010',
        ],
      ),
      ClassInfo(
        id: 'class_002',
        name: 'Grade 6B',
        teacherId: 'teacher_001',
        studentIds: ['student_011', 'student_012'],
      ),
    ];
  }
}
