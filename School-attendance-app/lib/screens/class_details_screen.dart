import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/teacher_service.dart';
import '../services/api_service.dart';

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
              color: Colors.white,
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  // Back button and title
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.arrow_back, color: Color(0xFF1F2937)),
                        onPressed: () => Navigator.pop(context),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              fullClassName,
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF1F2937),
                              ),
                            ),
                            Text(
                              '$subject • ${DateFormat('EEEE, MMM d').format(DateTime.now())}',
                              style: const TextStyle(
                                fontSize: 14,
                                color: Color(0xFF6B7280),
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Mark All Button (Compact)
                      ElevatedButton(
                        onPressed: () {
                          _showMarkAllDialog();
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF10B981),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                        ),
                        child: const Text(
                          'Mark All',
                          style: TextStyle(fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: 20),
                  
                  // Stats Row (Scrollable to prevent overflow)
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildStatChip(
                          label: 'Total',
                          value: _totalStudents.toString(),
                          color: const Color(0xFF6B7280),
                        ),
                        const SizedBox(width: 8),
                        _buildStatChip(
                          label: 'Present',
                          value: _presentCount.toString(),
                          color: const Color(0xFF10B981),
                        ),
                        const SizedBox(width: 8),
                        _buildStatChip(
                          label: 'Late',
                          value: _lateCount.toString(),
                          color: const Color(0xFFF59E0B),
                        ),
                        const SizedBox(width: 8),
                        _buildStatChip(
                          label: 'Absent',
                          value: _absentCount.toString(),
                          color: const Color(0xFFEF4444),
                        ),
                        const SizedBox(width: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFF2563EB).withOpacity(0.1),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            '$attendanceRate%',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF2563EB),
                            ),
                          ),
                        ),
                      ],
                    ),
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

  Widget _buildStatChip({
    required String label,
    required String value,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: color,
              fontWeight: FontWeight.w600,
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
    
    Color statusColor = const Color(0xFF6B7280);
    String statusText = 'Not Marked';
    IconData statusIcon = Icons.circle_outlined;
    
    if (status == 'present') {
      statusColor = const Color(0xFF10B981);
      statusText = 'Present';
      statusIcon = Icons.check_circle;
    } else if (status == 'late') {
      statusColor = const Color(0xFFF59E0B);
      statusText = 'Late';
      statusIcon = Icons.access_time;
    } else if (status == 'absent') {
      statusColor = const Color(0xFFEF4444);
      statusText = 'Absent';
      statusIcon = Icons.cancel;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            // Index
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: Text(
                  '$index',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF6B7280),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            
            // Avatar
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF2563EB), Color(0xFF3B82F6)],
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  name[0].toUpperCase(),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            
            // Student Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1F2937),
                    ),
                  ),
                  Text(
                    'Roll No: $rollNo${checkInTime != null ? " • $checkInTime" : ""}',
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                ],
              ),
            ),
            
            // Status Badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: statusColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(statusIcon, size: 16, color: statusColor),
                  const SizedBox(width: 6),
                  Text(
                    statusText,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: statusColor,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            
            // Mark Button
            IconButton(
              icon: const Icon(Icons.edit, size: 20),
              color: const Color(0xFF6B7280),
              onPressed: () {
                _showMarkAttendanceDialog(student);
              },
            ),
          ],
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
              onTap: () {
                // TODO: Mark as present
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('${student['full_name']} marked Present')),
                );
              },
            ),
            const SizedBox(height: 12),
            
            // Late Button
            _buildMarkButton(
              label: 'Late',
              icon: Icons.access_time,
              color: const Color(0xFFF59E0B),
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('${student['full_name']} marked Late')),
                );
              },
            ),
            const SizedBox(height: 12),
            
            // Absent Button
            _buildMarkButton(
              label: 'Absent',
              icon: Icons.cancel,
              color: const Color(0xFFEF4444),
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('${student['full_name']} marked Absent')),
                );
              },
            ),
          ],
        ),
      ),
    );
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
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('All students marked Present!')),
              );
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
}
