import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../utils/logger.dart';

/// Attendance Filter Screen - View students by status
/// Tabs: All | Present | Late | Absent | Leave
class AttendanceFilterScreen extends StatefulWidget {
  final ApiService apiService;
  final List<Map<String, dynamic>> classes;

  const AttendanceFilterScreen({
    super.key,
    required this.apiService,
    required this.classes,
  });

  @override
  State<AttendanceFilterScreen> createState() => _AttendanceFilterScreenState();
}

class _AttendanceFilterScreenState extends State<AttendanceFilterScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  int? _selectedSectionId;
  List<Map<String, dynamic>> _allStudents = [];
  List<Map<String, dynamic>> _filteredStudents = [];
  bool _isLoading = false;
  String _selectedDate = '';

  // Stats
  int _presentCount = 0;
  int _lateCount = 0;
  int _absentCount = 0;
  int _leaveCount = 0;
  int _notMarkedCount = 0;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    _tabController.addListener(_onTabChanged);

    // Set today's date
    final today = DateTime.now();
    _selectedDate = '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';

    if (widget.classes.isNotEmpty) {
      _selectedSectionId = widget.classes[0]['section_id'];
      _loadAttendance();
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _onTabChanged() {
    setState(() {
      _filterStudents();
    });
  }

  Future<void> _loadAttendance() async {
    if (_selectedSectionId == null) return;

    setState(() => _isLoading = true);

    try {
      Logger.network('Loading students and attendance for section $_selectedSectionId on $_selectedDate');

      // 1. Fetch students
      final studentsResponse = await widget.apiService.get(
        '/teacher/sections/$_selectedSectionId/students',
        requiresAuth: true,
        useCache: true,
      );

      List<Map<String, dynamic>> students = [];
      if (studentsResponse['success'] == true && studentsResponse['data'] != null) {
        students = (studentsResponse['data'] as List).cast<Map<String, dynamic>>();
      }

      // 2. Fetch attendance for selected date
      final attendanceResponse = await widget.apiService.get(
        '/teacher/sections/$_selectedSectionId/attendance?date=$_selectedDate',
        requiresAuth: true,
        useCache: true,
      );

      Map<int, String> attendanceMap = {};
      if (attendanceResponse['success'] == true && attendanceResponse['data'] != null) {
        final logs = attendanceResponse['data'] as List;
        for (var log in logs) {
          final studentId = log['student_id'];
          final status = log['status'];
          if (studentId != null) {
            attendanceMap[studentId] = status;
          }
        }
      }

      // 3. Combine students with attendance status
      final studentsWithStatus = students.map((student) {
        final studentId = student['id'];
        final status = attendanceMap[studentId] ?? 'not_marked';
        return {
          ...student,
          'attendance_status': status,
        };
      }).toList();

      // 4. Calculate stats
      _presentCount = studentsWithStatus.where((s) => s['attendance_status'] == 'present').length;
      _lateCount = studentsWithStatus.where((s) => s['attendance_status'] == 'late').length;
      _absentCount = studentsWithStatus.where((s) => s['attendance_status'] == 'absent').length;
      _leaveCount = studentsWithStatus.where((s) => s['attendance_status'] == 'leave').length;
      _notMarkedCount = studentsWithStatus.where((s) => s['attendance_status'] == 'not_marked').length;

      setState(() {
        _allStudents = studentsWithStatus;
        _isLoading = false;
        _filterStudents();
      });

      Logger.success('Loaded ${students.length} students with attendance for $_selectedDate');
    } catch (e) {
      Logger.error('Error loading attendance', e);
      setState(() => _isLoading = false);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error loading attendance: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _filterStudents() {
    switch (_tabController.index) {
      case 0: // All
        _filteredStudents = _allStudents;
        break;
      case 1: // Present
        _filteredStudents = _allStudents.where((s) => s['attendance_status'] == 'present').toList();
        break;
      case 2: // Late
        _filteredStudents = _allStudents.where((s) => s['attendance_status'] == 'late').toList();
        break;
      case 3: // Absent
        _filteredStudents = _allStudents.where((s) => s['attendance_status'] == 'absent').toList();
        break;
      case 4: // Leave
        _filteredStudents = _allStudents.where((s) => s['attendance_status'] == 'leave').toList();
        break;
    }
  }

  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.parse(_selectedDate),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF2B9AFF),
              onPrimary: Colors.white,
              onSurface: Color(0xFF1F2937),
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _selectedDate = '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
      });
      _loadAttendance();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Attendance Filter',
          style: TextStyle(
            color: Colors.black,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(140),
          child: Column(
            children: [
              // Class selector
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF3F4F6),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: DropdownButton<int>(
                    value: _selectedSectionId,
                    isExpanded: true,
                    underline: const SizedBox(),
                    icon: const Icon(Icons.arrow_drop_down, size: 24),
                    items: widget.classes.map((classData) {
                      final className = classData['class_name'] ?? '';
                      final sectionName = classData['section_name'] ?? '';
                      final subject = classData['subject'] ?? '';

                      return DropdownMenuItem<int>(
                        value: classData['section_id'],
                        child: Text(
                          '$className-$sectionName ($subject)',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      );
                    }).toList(),
                    onChanged: (value) {
                      setState(() => _selectedSectionId = value);
                      _loadAttendance();
                    },
                  ),
                ),
              ),

              // Date selector
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: GestureDetector(
                  onTap: _selectDate,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF2B9AFF),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.calendar_today, color: Colors.white, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          _formatDate(_selectedDate),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // Tabs
              Container(
                color: Colors.white,
                child: TabBar(
                  controller: _tabController,
                  isScrollable: true,
                  labelColor: const Color(0xFF2B9AFF),
                  unselectedLabelColor: const Color(0xFF64748B),
                  indicatorColor: const Color(0xFF2B9AFF),
                  labelStyle: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                  tabs: [
                    Tab(
                      child: Row(
                        children: [
                          const Text('All'),
                          const SizedBox(width: 6),
                          _buildTabBadge(_allStudents.length, const Color(0xFF6B7280)),
                        ],
                      ),
                    ),
                    Tab(
                      child: Row(
                        children: [
                          const Text('Present'),
                          const SizedBox(width: 6),
                          _buildTabBadge(_presentCount, const Color(0xFF10B981)),
                        ],
                      ),
                    ),
                    Tab(
                      child: Row(
                        children: [
                          const Text('Late'),
                          const SizedBox(width: 6),
                          _buildTabBadge(_lateCount, const Color(0xFFF59E0B)),
                        ],
                      ),
                    ),
                    Tab(
                      child: Row(
                        children: [
                          const Text('Absent'),
                          const SizedBox(width: 6),
                          _buildTabBadge(_absentCount, const Color(0xFFEF4444)),
                        ],
                      ),
                    ),
                    Tab(
                      child: Row(
                        children: [
                          const Text('Leave'),
                          const SizedBox(width: 6),
                          _buildTabBadge(_leaveCount, const Color(0xFF8B5CF6)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildStudentList(),
                _buildStudentList(),
                _buildStudentList(),
                _buildStudentList(),
                _buildStudentList(),
              ],
            ),
    );
  }

  Widget _buildTabBadge(int count, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        '$count',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }

  Widget _buildStudentList() {
    if (_filteredStudents.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.people_outline,
              size: 64,
              color: Colors.grey[400],
            ),
            const SizedBox(height: 16),
            Text(
              'No students found',
              style: TextStyle(
                fontSize: 16,
                color: Colors.grey[600],
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _filteredStudents.length,
      itemBuilder: (context, index) {
        return _buildStudentCard(_filteredStudents[index]);
      },
    );
  }

  Widget _buildStudentCard(Map<String, dynamic> student) {
    final name = student['full_name'] ?? 'Unknown';
    final rollNo = student['roll_number'] ?? 'N/A';
    final gender = student['gender'] ?? 'N/A';
    final status = student['attendance_status'] ?? 'not_marked';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: const Color(0xFFE5E7EB),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          // Avatar
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: _getStatusColor(status).withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Icon(
                gender == 'Male' ? Icons.person : Icons.person_outline,
                color: _getStatusColor(status),
                size: 28,
              ),
            ),
          ),
          const SizedBox(width: 14),

          // Student info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1F2937),
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(
                      'Roll: $rollNo',
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF6B7280),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      gender,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF6B7280),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Status badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: _getStatusColor(status),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              _getStatusLabel(status),
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'present':
        return const Color(0xFF10B981);
      case 'late':
        return const Color(0xFFF59E0B);
      case 'absent':
        return const Color(0xFFEF4444);
      case 'leave':
        return const Color(0xFF8B5CF6);
      default:
        return const Color(0xFF6B7280);
    }
  }

  String _getStatusLabel(String status) {
    switch (status) {
      case 'present':
        return 'Present';
      case 'late':
        return 'Late';
      case 'absent':
        return 'Absent';
      case 'leave':
        return 'Leave';
      default:
        return 'Not Marked';
    }
  }

  String _formatDate(String dateStr) {
    final date = DateTime.parse(dateStr);
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${months[date.month - 1]} ${date.day}, ${date.year}';
  }
}
