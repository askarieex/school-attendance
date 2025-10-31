import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

/// Attendance Calendar - Full-featured like web dashboard
/// - Holidays detection
/// - Sunday auto-detection  
/// - Edit attendance by tapping
/// - Beautiful responsive UI
/// - Percentage calculation
class AttendanceCalendarScreen extends StatefulWidget {
  final ApiService apiService;
  final List<Map<String, dynamic>> classes;
  
  const AttendanceCalendarScreen({
    super.key,
    required this.apiService,
    required this.classes,
  });

  @override
  State<AttendanceCalendarScreen> createState() => _AttendanceCalendarScreenState();
}

class _AttendanceCalendarScreenState extends State<AttendanceCalendarScreen> {
  DateTime _selectedMonth = DateTime.now();
  int? _selectedSectionId;
  List<Map<String, dynamic>> _students = [];
  Map<int, Map<int, String>> _attendanceData = {}; // {studentId: {day: status}}
  List<String> _holidays = []; // List of holiday dates "YYYY-MM-DD"
  bool _isLoading = false;
  
  // Stats
  int _totalStudents = 0;
  int _presentCount = 0;
  int _lateCount = 0;
  int _absentCount = 0;
  int _holidaysCount = 0;
  
  @override
  void initState() {
    super.initState();
    if (widget.classes.isNotEmpty) {
      _selectedSectionId = widget.classes[0]['section_id'];
      _loadData();
    }
  }
  
  Future<void> _loadData() async {
    await _loadHolidays();
    await _loadStudentsAndAttendance();
  }
  
  /// Load holidays from API
  Future<void> _loadHolidays() async {
    try {
      final year = _selectedMonth.year;
      
      print('🎉 Fetching holidays for year $year...');
      
      // Fetch REAL holidays from API
      final response = await widget.apiService.get(
        '/teacher/holidays?year=$year',
        requiresAuth: true,
      );
      
      if (response['success'] == true && response['data'] != null) {
        final holidaysList = response['data'] as List;
        
        // Extract holiday dates
        _holidays = holidaysList
            .map((h) => h['holiday_date']?.toString() ?? '')
            .where((d) => d.isNotEmpty)
            .toList();
        
        print('🎉 Loaded ${_holidays.length} holidays: $_holidays');
      } else {
        _holidays = [];
        print('⚠️ No holidays data in response');
      }
    } catch (e) {
      print('❌ Error loading holidays: $e');
      _holidays = [];
    }
  }
  
  /// Load students and their attendance
  Future<void> _loadStudentsAndAttendance() async {
    if (_selectedSectionId == null) return;
    
    setState(() => _isLoading = true);
    
    try {
      // 1. Fetch students
      final studentsResponse = await widget.apiService.get(
        '/teacher/sections/$_selectedSectionId/students',
        requiresAuth: true,
      );
      
      List<Map<String, dynamic>> students = [];
      if (studentsResponse['success'] == true && studentsResponse['data'] != null) {
        students = (studentsResponse['data'] as List).cast<Map<String, dynamic>>();
      }
      
      print('✅ Found ${students.length} students');
      
      // 2. Fetch attendance for each day of the month
      final year = _selectedMonth.year;
      final month = _selectedMonth.month;
      final daysInMonth = DateTime(year, month + 1, 0).day;
      
      Map<int, Map<int, String>> attendanceMap = {};
      
      for (var student in students) {
        attendanceMap[student['id']] = {};
      }
      
      // Fetch attendance logs for the month from API
      for (int day = 1; day <= daysInMonth; day++) {
        final date = DateTime(year, month, day);
        
        // Skip future dates
        if (date.isAfter(DateTime.now())) {
          continue;
        }
        
        // Mark Sundays
        if (_isSunday(day)) {
          for (var student in students) {
            attendanceMap[student['id']]![day] = 'S';
          }
          continue;
        }
        
        // Mark Holidays
        if (_isHoliday(day)) {
          for (var student in students) {
            attendanceMap[student['id']]![day] = 'H';
          }
          continue;
        }
        
        // Fetch REAL attendance data from API
        final dateStr = '$year-${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';
        
        try {
          final response = await widget.apiService.get(
            '/teacher/sections/$_selectedSectionId/attendance?date=$dateStr',
            requiresAuth: true,
          );
          
          if (response['success'] == true && response['data'] != null) {
            final logs = response['data'] as List;
            
            print('✅ Fetched ${logs.length} logs for $dateStr');
            
            // Map logs to students
            for (var log in logs) {
              final studentId = log['student_id'];
              final status = log['status'] ?? 'present';
              
              if (attendanceMap.containsKey(studentId)) {
                // Map status to our format
                if (status == 'present') {
                  attendanceMap[studentId]![day] = 'P';
                } else if (status == 'late') {
                  attendanceMap[studentId]![day] = 'L';
                } else if (status == 'absent') {
                  attendanceMap[studentId]![day] = 'A';
                }
              }
            }
          }
        } catch (e) {
          print('❌ Error fetching attendance for $dateStr: $e');
          // Don't mark anything if API fails (leaves empty)
        }
      }
      
      _calculateStats(attendanceMap, daysInMonth);
      
      setState(() {
        _students = students;
        _attendanceData = attendanceMap;
        _totalStudents = students.length;
        _isLoading = false;
      });
      
      print('✅ Attendance loaded successfully');
      
    } catch (e) {
      print('❌ Error loading attendance: $e');
      setState(() => _isLoading = false);
    }
  }
  
  /// Calculate statistics
  void _calculateStats(Map<int, Map<int, String>> data, int daysInMonth) {
    _presentCount = 0;
    _lateCount = 0;
    _absentCount = 0;
    _holidaysCount = 0;
    
    // Count holidays in this month
    for (int day = 1; day <= daysInMonth; day++) {
      if (_isHoliday(day)) _holidaysCount++;
    }
    
    for (var studentData in data.values) {
      for (var status in studentData.values) {
        switch (status) {
          case 'P':
            _presentCount++;
            break;
          case 'L':
            _lateCount++;
            break;
          case 'A':
            _absentCount++;
            break;
        }
      }
    }
  }
  
  /// Check if day is Sunday
  bool _isSunday(int day) {
    final date = DateTime(_selectedMonth.year, _selectedMonth.month, day);
    return date.weekday == DateTime.sunday;
  }
  
  /// Check if day is a holiday
  bool _isHoliday(int day) {
    final year = _selectedMonth.year;
    final month = _selectedMonth.month;
    final dateStr = '$year-${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';
    return _holidays.contains(dateStr);
  }
  
  /// Calculate student attendance percentage
  double _calculatePercentage(int studentId) {
    final studentDays = _attendanceData[studentId] ?? {};
    final total = studentDays.values.where((s) => s == 'P' || s == 'L' || s == 'A').length;
    final present = studentDays.values.where((s) => s == 'P').length;
    final late = studentDays.values.where((s) => s == 'L').length;
    
    if (total == 0) return 0;
    return ((present + late) / total) * 100; // Late counts as present
  }
  
  /// Edit attendance - tap on box to change status
  void _editAttendance(int studentId, int day, String studentName) {
    final currentStatus = _attendanceData[studentId]?[day] ?? '';
    
    // Can't edit Sunday or Holiday
    if (currentStatus == 'S' || currentStatus == 'H') {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Cannot edit ${currentStatus == 'S' ? 'Sunday' : 'Holiday'}'),
          duration: const Duration(seconds: 2),
        ),
      );
      return;
    }
    
    // Show edit dialog
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => _buildEditDialog(studentId, day, studentName, currentStatus),
    );
  }
  
  Widget _buildEditDialog(int studentId, int day, String studentName, String currentStatus) {
    final dateStr = '${_selectedMonth.year}-${_selectedMonth.month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';
    final now = DateTime.now();
    final checkInTime = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}:00';
    
    return Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Mark Attendance',
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '$studentName - Day $day',
            style: const TextStyle(
              fontSize: 16,
              color: Color(0xFF6B7280),
            ),
          ),
          const SizedBox(height: 24),
          
          // Status buttons (3 options only)
          _buildStatusButton(
            'Present',
            'present',
            const Color(0xFF10B981),
            Icons.check_circle,
            currentStatus == 'P' || currentStatus == 'L',
            () => _updateAttendance(studentId, day, 'present', dateStr, checkInTime),
          ),
          const SizedBox(height: 12),
          _buildStatusButton(
            'Absent',
            'absent',
            const Color(0xFFEF4444),
            Icons.cancel,
            currentStatus == 'A',
            () => _updateAttendance(studentId, day, 'absent', dateStr, checkInTime),
          ),
          const SizedBox(height: 12),
          _buildStatusButton(
            'Leave',
            'leave',
            const Color(0xFF8B5CF6),
            Icons.event_busy,
            false,
            () => _updateAttendance(studentId, day, 'leave', dateStr, checkInTime),
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
    );
  }
  
  Widget _buildStatusButton(
    String label,
    String status,
    Color color,
    IconData icon,
    bool isSelected,
    VoidCallback onTap,
  ) {
    return Material(
      color: isSelected ? color : Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
          decoration: BoxDecoration(
            border: Border.all(
              color: isSelected ? color : color.withOpacity(0.3),
              width: 2,
            ),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Icon(
                icon,
                color: isSelected ? Colors.white : color,
                size: 24,
              ),
              const SizedBox(width: 12),
              Text(
                label,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: isSelected ? Colors.white : color,
                ),
              ),
              const Spacer(),
              if (isSelected)
                const Icon(Icons.check, color: Colors.white),
            ],
          ),
        ),
      ),
    );
  }
  
  /// Update attendance in state and backend
  void _updateAttendance(int studentId, int day, String newStatus, String dateStr, String checkInTime) async {
    // Close dialog first
    Navigator.pop(context);
    
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
            Text('Updating attendance...'),
          ],
        ),
        duration: Duration(seconds: 10),
      ),
    );
    
    try {
      print('📤 Marking attendance: student=$studentId, date=$dateStr, status=$newStatus, time=$checkInTime');
      
      // Save to backend first (backend will auto-calculate late status)
      final response = await widget.apiService.post(
        '/teacher/sections/$_selectedSectionId/attendance',
        {
          'studentId': studentId,
          'date': dateStr,
          'checkInTime': checkInTime,
          'status': newStatus, // present, absent, or leave
          'notes': 'Marked by teacher from mobile app',
        },
        requiresAuth: true,
      );
      
      if (response['success'] == true) {
        // Backend might have auto-calculated late status
        final actualStatus = response['data']?['status'] ?? newStatus;
        
        // Map backend status to display format
        String displayStatus = '';
        if (actualStatus == 'present') displayStatus = 'P';
        else if (actualStatus == 'late') displayStatus = 'L';
        else if (actualStatus == 'absent') displayStatus = 'A';
        else if (actualStatus == 'leave') displayStatus = 'LV';
        
        // Update local state after successful backend save
        setState(() {
          _attendanceData[studentId]![day] = displayStatus;
        });
        
        // Recalculate stats
        final daysInMonth = DateTime(_selectedMonth.year, _selectedMonth.month + 1, 0).day;
        _calculateStats(_attendanceData, daysInMonth);
        setState(() {});
        
        print('✅ Attendance updated successfully: $studentId on $dateStr = $actualStatus (display: $displayStatus)');
        
        // Show success message with actual calculated status
        String statusLabel = actualStatus.toUpperCase();
        if (actualStatus == 'late') statusLabel = 'LATE (auto-calculated)';
        
        ScaffoldMessenger.of(context).clearSnackBars();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.white),
                const SizedBox(width: 12),
                Text('Marked as $statusLabel'),
              ],
            ),
            backgroundColor: const Color(0xFF10B981),
            duration: const Duration(seconds: 3),
          ),
        );
      } else {
        throw Exception('Backend returned success: false');
      }
    } catch (e) {
      print('❌ Error updating attendance: $e');
      
      // Show error message
      ScaffoldMessenger.of(context).clearSnackBars();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.error, color: Colors.white),
              const SizedBox(width: 12),
              const Text('Failed to update attendance'),
            ],
          ),
          backgroundColor: const Color(0xFFEF4444),
          duration: const Duration(seconds: 3),
          action: SnackBarAction(
            label: 'Retry',
            textColor: Colors.white,
            onPressed: () => _updateAttendance(studentId, day, newStatus, dateStr, checkInTime),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final monthName = DateFormat('MMMM yyyy').format(_selectedMonth);
    final daysInMonth = DateTime(_selectedMonth.year, _selectedMonth.month + 1, 0).day;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Column(
        children: [
          // Header
          _buildHeader(monthName),
          
          // Calendar Grid
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _students.isEmpty
                    ? const Center(child: Text('No students found'))
                    : _buildCalendarGrid(daysInMonth),
          ),
          
          // Legend
          _buildLegend(),
        ],
      ),
    );
  }

  Widget _buildHeader(String monthName) {
    final attendanceRate = _totalStudents > 0 && (_presentCount + _lateCount + _absentCount) > 0
        ? (((_presentCount + _lateCount) / (_presentCount + _lateCount + _absentCount)) * 100).toInt()
        : 0;

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Attendance Calendar',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1F2937),
            ),
          ),
          const SizedBox(height: 12),
          
          // Month navigation
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                icon: const Icon(Icons.chevron_left, size: 28),
                onPressed: () {
                  setState(() {
                    _selectedMonth = DateTime(
                      _selectedMonth.year,
                      _selectedMonth.month - 1,
                    );
                  });
                  _loadData();
                },
              ),
              Text(
                monthName,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1F2937),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.chevron_right, size: 28),
                onPressed: () {
                  setState(() {
                    _selectedMonth = DateTime(
                      _selectedMonth.year,
                      _selectedMonth.month + 1,
                    );
                  });
                  _loadData();
                },
              ),
            ],
          ),
          
          const SizedBox(height: 12),
          
          // Stats chips - More compact
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildStatChip('$_totalStudents', 'Total', const Color(0xFF6B7280)),
                const SizedBox(width: 6),
                _buildStatChip('$_presentCount', 'Present', const Color(0xFF10B981)),
                const SizedBox(width: 6),
                _buildStatChip('$_lateCount', 'Late', const Color(0xFFF59E0B)),
                const SizedBox(width: 6),
                _buildStatChip('$_absentCount', 'Absent', const Color(0xFFEF4444)),
                const SizedBox(width: 6),
                _buildStatChip('$_holidaysCount', 'Holidays', const Color(0xFF8B5CF6)),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF2563EB), Color(0xFF3B82F6)],
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    '$attendanceRate%',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 12),
          
          // Class selector - More compact
          if (widget.classes.isNotEmpty)
            Container(
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
                  _loadData();
                },
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildStatChip(String value, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCalendarGrid(int daysInMonth) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Day headers - More compact
            Row(
              children: [
                const SizedBox(width: 140), // Student name column width
                ...List.generate(daysInMonth, (index) {
                  final day = index + 1;
                  final date = DateTime(_selectedMonth.year, _selectedMonth.month, day);
                  final dayName = DateFormat('EEE').format(date);
                  final isSunday = date.weekday == DateTime.sunday;
                  final isHoliday = _isHoliday(day);
                  
                  return Container(
                    width: 44,
                    margin: const EdgeInsets.only(right: 3),
                    padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
                    decoration: BoxDecoration(
                      color: isSunday || isHoliday 
                          ? const Color(0xFFFEF3C7) 
                          : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      children: [
                        Text(
                          day.toString().padLeft(2, '0'),
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                            color: isSunday || isHoliday 
                                ? const Color(0xFFF59E0B)
                                : const Color(0xFF1F2937),
                          ),
                        ),
                        Text(
                          dayName,
                          style: TextStyle(
                            fontSize: 9,
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ),
            const SizedBox(height: 10),
            
            // Student rows
            ..._students.map((student) {
              return _buildStudentRow(student, daysInMonth);
            }).toList(),
          ],
        ),
      ),
    );
  }

  Widget _buildStudentRow(Map<String, dynamic> student, int daysInMonth) {
    final studentId = student['id'];
    final name = student['full_name'] as String;
    final rollNo = student['roll_number'] as String;
    final percentage = _calculatePercentage(studentId);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Student info - More compact
          Container(
            width: 140,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.03),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                    color: Color(0xFF1F2937),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  'Roll: $rollNo',
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey[600],
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: _getPercentageColor(percentage),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '${percentage.toInt()}%',
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          // Attendance boxes - Compact & tap-friendly
          ...List.generate(daysInMonth, (index) {
            final day = index + 1;
            final status = _attendanceData[studentId]?[day] ?? '';
            
            return GestureDetector(
              onTap: () => _editAttendance(studentId, day, name),
              child: Container(
                width: 44,
                height: 52,
                margin: const EdgeInsets.only(right: 3),
                decoration: BoxDecoration(
                  color: _getStatusColor(status),
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.08),
                      blurRadius: 3,
                      offset: const Offset(0, 1),
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    status,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'P':
        return const Color(0xFF10B981); // Green
      case 'L':
        return const Color(0xFFF59E0B); // Orange
      case 'A':
        return const Color(0xFFEF4444); // Red
      case 'S':
        return const Color(0xFF9CA3AF); // Gray
      case 'H':
        return const Color(0xFF8B5CF6); // Purple
      default:
        return const Color(0xFFF3F4F6); // Light gray
    }
  }

  Color _getPercentageColor(double percentage) {
    if (percentage >= 85) return const Color(0xFF10B981);
    if (percentage >= 75) return const Color(0xFFF59E0B);
    return const Color(0xFFEF4444);
  }

  Widget _buildLegend() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Column(
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.center,
            children: [
              _buildLegendItem('P', 'Present', const Color(0xFF10B981)),
              _buildLegendItem('L', 'Late', const Color(0xFFF59E0B)),
              _buildLegendItem('A', 'Absent', const Color(0xFFEF4444)),
              _buildLegendItem('S', 'Sunday', const Color(0xFF9CA3AF)),
              _buildLegendItem('H', 'Holiday', const Color(0xFF8B5CF6)),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF2563EB), Color(0xFF3B82F6)],
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF2563EB).withOpacity(0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.touch_app, size: 18, color: Colors.white),
                SizedBox(width: 8),
                Text(
                  'Tap any box to edit attendance',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLegendItem(String symbol, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Center(
              child: Text(
                symbol,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
