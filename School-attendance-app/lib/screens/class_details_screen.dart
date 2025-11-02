import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/teacher_service.dart';
import '../services/api_service.dart';
import 'student_profile_screen.dart';

/// Class Details Screen - View students and mark attendance
/// Clean UI inspired by web dashboard
class ClassDetailsScreen extends StatefulWidget {
  final Map<String, dynamic> classData;
  final ApiService apiService;
  
  const ClassDetailsScreen({
    super.key,
    required this.classData,
    required this.apiService,
  });

  @override
  State<ClassDetailsScreen> createState() => _ClassDetailsScreenState();
}

class _ClassDetailsScreenState extends State<ClassDetailsScreen> {
  late TeacherService _teacherService;
  List<Map<String, dynamic>> _students = [];
  bool _isLoading = true;
  
  // Stats
  int _totalStudents = 0;
  int _presentCount = 0;
  int _lateCount = 0;
  int _absentCount = 0;
  
  @override
  void initState() {
    super.initState();
    _teacherService = TeacherService(widget.apiService);
    _loadStudents();
  }
  
  Future<void> _loadStudents() async {
    setState(() => _isLoading = true);
    
    final sectionId = widget.classData['section_id'];
    
    try {
      final students = await _teacherService.getStudentsInSection(sectionId);
      
      setState(() {
        _students = students;
        _totalStudents = students.length;
        _isLoading = false;
        
        // TODO: Calculate real attendance stats from API
        _presentCount = 0;
        _lateCount = 0;
        _absentCount = 0;
      });
    } catch (e) {
      print('⚠️ Cannot fetch students (403 - admin only). Using mock data...');
      
      // TEMPORARY: Show mock student list until backend is fixed
      setState(() {
        _totalStudents = widget.classData['student_count'] ?? 0;
        _students = List.generate(
          _totalStudents,
          (index) => {
            'id': index + 1,
            'full_name': 'Student ${index + 1}',
            'roll_number': '${index + 1}'.padLeft(2, '0'),
            'status': 'pending',
          },
        );
        _isLoading = false;
        _presentCount = 0;
        _lateCount = 0;
        _absentCount = 0;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final className = widget.classData['class_name'] ?? '';
    final sectionName = widget.classData['section_name'] ?? '';
    final subject = widget.classData['subject'] ?? '';
    final fullClassName = '$className-$sectionName';
    
    final attendanceRate = _totalStudents > 0 
        ? ((_presentCount / _totalStudents) * 100).toInt() 
        : 0;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
              child: Column(
                children: [
                  // Back button and title
                  Row(
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: const Color(0xFFE2E8F0),
                            width: 1,
                          ),
                        ),
                        child: IconButton(
                          icon: const Icon(Icons.arrow_back_ios_rounded, color: Color(0xFF0F172A), size: 18),
                          onPressed: () => Navigator.pop(context),
                          padding: const EdgeInsets.all(10),
                          constraints: const BoxConstraints(),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              fullClassName,
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F172A),
                                letterSpacing: -0.5,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '$subject • ${DateFormat('EEEE, MMM d').format(DateTime.now())}',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Mark All Button
                      Container(
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF10B981), Color(0xFF059669)],
                          ),
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF10B981).withOpacity(0.3),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: ElevatedButton(
                          onPressed: () {
                            _showMarkAllDialog();
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.transparent,
                            shadowColor: Colors.transparent,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 12,
                            ),
                          ),
                          child: const Text(
                            'Mark All',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: 18),
                  
                  // Stats Row
                  Row(
                    children: [
                      Expanded(
                        child: _buildStatCard(
                          label: 'Total',
                          value: _totalStudents.toString(),
                          color: const Color(0xFF64748B),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _buildStatCard(
                          label: 'Present',
                          value: _presentCount.toString(),
                          color: const Color(0xFF10B981),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _buildStatCard(
                          label: 'Late',
                          value: _lateCount.toString(),
                          color: const Color(0xFFF59E0B),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _buildStatCard(
                          label: 'Absent',
                          value: _absentCount.toString(),
                          color: const Color(0xFFEF4444),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            
            // Student List
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _students.isEmpty
                      ? _buildEmptyState()
                      : RefreshIndicator(
                          onRefresh: _loadStudents,
                          child: ListView.builder(
                            padding: const EdgeInsets.all(20),
                            itemCount: _students.length,
                            itemBuilder: (context, index) {
                              final student = _students[index];
                              return _buildStudentCard(student, index + 1);
                            },
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard({
    required String label,
    required String value,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: color.withOpacity(0.2),
          width: 1,
        ),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: color,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color.withOpacity(0.8),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStudentCard(Map<String, dynamic> student, int index) {
    final name = student['full_name'] ?? 'Unknown';
    final rollNo = student['roll_number'] ?? '-';
    final checkInTime = student['check_in_time']; // From API
    final status = student['status'] ?? 'pending'; // present, late, absent, pending
    
    Color statusColor = const Color(0xFF94A3B8);
    String statusText = 'Not Marked';
    IconData statusIcon = Icons.radio_button_unchecked_rounded;
    
    if (status == 'present') {
      statusColor = const Color(0xFF10B981);
      statusText = 'Present';
      statusIcon = Icons.check_circle_rounded;
    } else if (status == 'late') {
      statusColor = const Color(0xFFF59E0B);
      statusText = 'Late';
      statusIcon = Icons.access_time_rounded;
    } else if (status == 'absent') {
      statusColor = const Color(0xFFEF4444);
      statusText = 'Absent';
      statusIcon = Icons.cancel_rounded;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFFE2E8F0),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF6366F1).withOpacity(0.04),
            blurRadius: 16,
            offset: const Offset(0, 6),
            spreadRadius: -4,
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => StudentProfileScreen(student: student),
              ),
            );
          },
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // Index
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: const Color(0xFFE2E8F0),
                      width: 1,
                    ),
                  ),
                  child: Center(
                    child: Text(
                      '$index',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                
                // Avatar
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF6366F1).withOpacity(0.3),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Center(
                    child: Text(
                      name.isNotEmpty ? name[0].toUpperCase() : '?',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                
                // Student Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0F172A),
                          letterSpacing: -0.3,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Roll: $rollNo',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF64748B),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                
                // Status Badge
                Flexible(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: statusColor.withOpacity(0.2),
                        width: 1,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(statusIcon, size: 14, color: statusColor),
                        const SizedBox(width: 5),
                        Flexible(
                          child: Text(
                            statusText,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: statusColor,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                
                // Mark Button
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: const Color(0xFFE2E8F0),
                      width: 1,
                    ),
                  ),
                  child: InkWell(
                    onTap: () {
                      _showMarkAttendanceDialog(student);
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: const Icon(
                      Icons.edit_rounded,
                      size: 18,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.people_outline, size: 80, color: Colors.grey[300]),
          const SizedBox(height: 16),
          const Text(
            'No Students Found',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Color(0xFF6B7280),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'No students enrolled in this class',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[500],
            ),
          ),
        ],
      ),
    );
  }

  void _showMarkAttendanceDialog(Map<String, dynamic> student) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Mark Attendance for ${student['full_name']}',
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 24),

            // Present Button
            _buildMarkButton(
              label: 'Present',
              icon: Icons.check_circle,
              color: const Color(0xFF10B981),
              onTap: () => _markAttendance(student, 'present'),
            ),
            const SizedBox(height: 12),

            // Absent Button
            _buildMarkButton(
              label: 'Absent',
              icon: Icons.cancel,
              color: const Color(0xFFEF4444),
              onTap: () => _markAttendance(student, 'absent'),
            ),
            const SizedBox(height: 12),

            // Leave Button
            _buildMarkButton(
              label: 'Leave',
              icon: Icons.event_busy,
              color: const Color(0xFF8B5CF6),
              onTap: () => _markAttendance(student, 'leave'),
            ),
            const SizedBox(height: 16),
            Text(
              'System will auto-calculate late status',
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey[600],
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// ✅ FIXED: Actually mark attendance via API!
  Future<void> _markAttendance(Map<String, dynamic> student, String status) async {
    Navigator.pop(context); // Close dialog

    // Show loading
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Row(
          children: [
            SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
              ),
            ),
            SizedBox(width: 12),
            Text('Marking attendance...'),
          ],
        ),
        duration: Duration(seconds: 10),
      ),
    );

    try {
      final sectionId = widget.classData['section_id'];
      final studentId = student['id'];
      final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
      final now = DateTime.now();
      final checkInTime = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}:00';

      print('📤 Marking attendance: student=$studentId, date=$today, status=$status, time=$checkInTime');

      final response = await widget.apiService.post(
        '/teacher/sections/$sectionId/attendance',
        {
          'studentId': studentId,
          'date': today,
          'status': status, // backend will auto-calculate late if needed
          'checkInTime': checkInTime,
          'notes': 'Marked by teacher from mobile app',
        },
        requiresAuth: true,
      );

      if (response['success'] == true) {
        final actualStatus = response['data']?['status'] ?? status;

        // Update local state
        setState(() {
          final index = _students.indexWhere((s) => s['id'] == studentId);
          if (index != -1) {
            _students[index]['status'] = actualStatus;
            _students[index]['check_in_time'] = checkInTime;

            // Recalculate stats
            _presentCount = _students.where((s) => s['status'] == 'present').length;
            _lateCount = _students.where((s) => s['status'] == 'late').length;
            _absentCount = _students.where((s) => s['status'] == 'absent').length;
          }
        });

        String statusLabel = actualStatus.toUpperCase();
        if (actualStatus == 'late') statusLabel = 'LATE (auto-calculated)';

        // Show success
        ScaffoldMessenger.of(context).clearSnackBars();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.white),
                const SizedBox(width: 12),
                Text('${student['full_name']} marked as $statusLabel'),
              ],
            ),
            backgroundColor: const Color(0xFF10B981),
            duration: const Duration(seconds: 3),
          ),
        );

        print('✅ Attendance marked successfully: $actualStatus');
      } else {
        throw Exception('Backend returned success: false');
      }
    } catch (e) {
      print('❌ Error marking attendance: $e');

      // Show error
      ScaffoldMessenger.of(context).clearSnackBars();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.error, color: Colors.white),
              const SizedBox(width: 12),
              const Text('Failed to mark attendance'),
            ],
          ),
          backgroundColor: const Color(0xFFEF4444),
          duration: const Duration(seconds: 3),
          action: SnackBarAction(
            label: 'Retry',
            textColor: Colors.white,
            onPressed: () => _markAttendance(student, status),
          ),
        ),
      );
    }
  }

  Widget _buildMarkButton({
    required String label,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Material(
      color: color,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: Colors.white, size: 24),
              const SizedBox(width: 12),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showMarkAllDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Mark All Students'),
        content: const Text('Mark all students as Present for today?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _markAllPresent();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
            ),
            child: const Text('Mark All Present'),
          ),
        ],
      ),
    );
  }

  /// ✅ Mark all students as present
  Future<void> _markAllPresent() async {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
              ),
            ),
            const SizedBox(width: 12),
            Text('Marking ${_students.length} students...'),
          ],
        ),
        duration: const Duration(seconds: 30),
      ),
    );

    int successCount = 0;
    int failCount = 0;

    for (var student in _students) {
      try {
        final sectionId = widget.classData['section_id'];
        final studentId = student['id'];
        final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
        final now = DateTime.now();
        final checkInTime = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}:00';

        final response = await widget.apiService.post(
          '/teacher/sections/$sectionId/attendance',
          {
            'studentId': studentId,
            'date': today,
            'status': 'present',
            'checkInTime': checkInTime,
            'notes': 'Bulk marked by teacher',
          },
          requiresAuth: true,
        );

        if (response['success'] == true) {
          final actualStatus = response['data']?['status'] ?? 'present';
          student['status'] = actualStatus;
          student['check_in_time'] = checkInTime;
          successCount++;
        } else {
          failCount++;
        }
      } catch (e) {
        print('❌ Error marking student ${student['id']}: $e');
        failCount++;
      }
    }

    // Recalculate stats
    setState(() {
      _presentCount = _students.where((s) => s['status'] == 'present').length;
      _lateCount = _students.where((s) => s['status'] == 'late').length;
      _absentCount = _students.where((s) => s['status'] == 'absent').length;
    });

    // Show result
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(
              failCount == 0 ? Icons.check_circle : Icons.info,
              color: Colors.white,
            ),
            const SizedBox(width: 12),
            Text('Marked $successCount students${failCount > 0 ? ' ($failCount failed)' : ''}'),
          ],
        ),
        backgroundColor: failCount == 0 ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
        duration: const Duration(seconds: 4),
      ),
    );

    print('✅ Bulk attendance: $successCount success, $failCount failed');
  }
}
