import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../utils/logger.dart';

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
  
  // ✅ PAGINATION: Show only 8 students per page for better performance
  int _currentPage = 0;
  static const int _studentsPerPage = 8;
  
  // 🔄 SCROLL SYNC CONTROLLERS
  late ScrollController _verticalNameController;
  late ScrollController _verticalGridController;
  late ScrollController _horizontalHeaderController;
  late ScrollController _horizontalGridController;
  
  // Prevent circular sync loops
  bool _isSyncingName = false;
  bool _isSyncingGrid = false;
  bool _isSyncingHeader = false;
  bool _isSyncingBody = false;

  @override
  void initState() {
    super.initState();
    Logger.info('📅 Calendar initialized with ${widget.classes.length} classes');
    
    // Initialize Scroll Controllers
    _verticalNameController = ScrollController();
    _verticalGridController = ScrollController();
    _horizontalHeaderController = ScrollController();
    _horizontalGridController = ScrollController();

    // 🔗 SYNC LOGIC: Vertical
    _verticalNameController.addListener(() {
      if (_isSyncingName) return;
      _isSyncingGrid = true;
      if (_verticalNameController.hasClients && _verticalGridController.hasClients) {
        _verticalGridController.jumpTo(_verticalNameController.offset);
      }
      _isSyncingGrid = false;
    });

    _verticalGridController.addListener(() {
      if (_isSyncingGrid) return;
      _isSyncingName = true;
      if (_verticalGridController.hasClients && _verticalNameController.hasClients) {
        _verticalNameController.jumpTo(_verticalGridController.offset);
      }
      _isSyncingName = false;
    });
    
    // 🔗 SYNC LOGIC: Horizontal (Header + Body)
    _horizontalHeaderController.addListener(() {
       if (_isSyncingHeader) return;
       _isSyncingBody = true;
       if (_horizontalHeaderController.hasClients && _horizontalGridController.hasClients) {
         _horizontalGridController.jumpTo(_horizontalHeaderController.offset);
       }
       _isSyncingBody = false;
    });
    
    _horizontalGridController.addListener(() {
       if (_isSyncingBody) return;
       _isSyncingHeader = true;
       if (_horizontalHeaderController.hasClients && _horizontalHeaderController.hasClients) {
         _horizontalHeaderController.jumpTo(_horizontalGridController.offset);
       }
       _isSyncingHeader = false;
    });

    if (widget.classes.isEmpty) {
      Logger.warning('⚠️ No classes available for calendar view');
    } else {
      _selectedSectionId = widget.classes[0]['section_id'];
      Logger.info('Selected section ID: $_selectedSectionId (${widget.classes[0]['class_name']}-${widget.classes[0]['section_name']})');
      _loadData();
    }
  }
  
  @override
  void dispose() {
    _verticalNameController.dispose();
    _verticalGridController.dispose();
    _horizontalHeaderController.dispose();
    _horizontalGridController.dispose();
    super.dispose();
  }
  
  Future<void> _loadData() async {
    await _loadHolidays();
    await _loadStudentsAndAttendance();
  }
  
  /// ✅ ULTRA PERFORMANCE: Load holidays AND students data in PARALLEL
  Future<void> _loadHolidays() async {
    try {
      final year = _selectedMonth.year;

      Logger.network('Fetching holidays for year $year...');

      // Fetch REAL holidays from API
      final response = await widget.apiService.get(
        '/teacher/holidays?year=$year',
        requiresAuth: true,
        useCache: true, // ✅ Cache holidays - they don't change often
      );

      if (response['success'] == true && response['data'] != null) {
        final holidaysList = response['data'] as List;

        // Extract holiday dates
        _holidays = holidaysList
            .map((h) => h['holiday_date']?.toString() ?? '')
            .where((d) => d.isNotEmpty)
            .toList();

        Logger.success('Loaded ${_holidays.length} holidays: $_holidays');
      } else {
        _holidays = [];
        Logger.warning('No holidays data in response');
      }
    } catch (e) {
      Logger.error('Error loading holidays', e);
      _holidays = [];
    }
  }

  /// ✅ ULTRA PERFORMANCE: Load students and their attendance
  Future<void> _loadStudentsAndAttendance() async {
    if (_selectedSectionId == null) return;

    // ✅ ULTRA PERFORMANCE: Non-blocking loading (no dialog, just state change)
    setState(() => _isLoading = true);

    try {
      // ✅ ULTRA PERFORMANCE: Fetch students data with cache
      final studentsResponse = await widget.apiService.get(
        '/teacher/sections/$_selectedSectionId/students',
        requiresAuth: true,
        useCache: true, // ✅ Cache student list
      );

      List<Map<String, dynamic>> students = [];
      if (studentsResponse['success'] == true && studentsResponse['data'] != null) {
        students = (studentsResponse['data'] as List).cast<Map<String, dynamic>>();
      } else {
        Logger.warning('API returned no students or error: ${studentsResponse['message'] ?? 'Unknown error'}');
      }

      Logger.success('Found ${students.length} students');

      // ✅ DEBUG: Print first 3 students to verify data structure
      if (students.isNotEmpty) {
        Logger.info('First student: ${students[0]}');
        if (students.length > 1) Logger.info('Second student: ${students[1]}');
        if (students.length > 2) Logger.info('Third student: ${students[2]}');

        // ✅ Validate student data structure
        for (var i = 0; i < students.length; i++) {
          final student = students[i];
          if (student['id'] == null) {
            Logger.warning('Student at index $i has null ID: $student');
          }
          if (student['full_name'] == null || student['full_name'].toString().isEmpty) {
            Logger.warning('Student at index $i has null/empty name: ID=${student['id']}');
          }
        }
      } else {
        Logger.warning('⚠️ No students found in section $_selectedSectionId');
      }

      // 2. Fetch attendance for each day of the month
      final year = _selectedMonth.year;
      final month = _selectedMonth.month;
      final daysInMonth = DateTime(year, month + 1, 0).day;

      Map<int, Map<int, String>> attendanceMap = {};

      // ✅ Initialize attendance map with SAFE integer IDs
      for (var student in students) {
        final studentId = int.tryParse(student['id'].toString());
        if (studentId != null) {
          attendanceMap[studentId] = {};
        } else {
          Logger.warning('Student with invalid ID found: ${student['id']}');
        }
      }

      // 🚀 ULTRA PERFORMANCE FIX: Use BATCH API instead of 30+ individual calls!
      Logger.network('Loading attendance for ${DateFormat('MMMM yyyy').format(_selectedMonth)}...');

      final today = DateTime.now();
      final todayDate = DateTime(today.year, today.month, today.day);

      // Calculate date range (1st of month to today or end of month, whichever is earlier)
      final startDate = DateTime(year, month, 1);
      final endOfMonth = DateTime(year, month, daysInMonth);
      final endDate = endOfMonth.isBefore(todayDate) ? endOfMonth : todayDate;

      // Skip if start date is in future
      if (startDate.isAfter(todayDate)) {
        Logger.info('Month is in future, no attendance to load');
      } else {
        // 🚀 SINGLE BATCH API CALL instead of 30+ calls!
        final startDateStr = '${startDate.year}-${startDate.month.toString().padLeft(2, '0')}-${startDate.day.toString().padLeft(2, '0')}';
        final endDateStr = '${endDate.year}-${endDate.month.toString().padLeft(2, '0')}-${endDate.day.toString().padLeft(2, '0')}';

        Logger.network('Fetching attendance range: $startDateStr to $endDateStr');

        try {
          final response = await widget.apiService.get(
            '/teacher/sections/$_selectedSectionId/attendance/range?startDate=$startDateStr&endDate=$endDateStr',
            requiresAuth: true,
            useCache: true, // ✅ Cache for 5 minutes
          );

          if (response['success'] == true && response['data'] != null) {
            final logs = response['data'] as List;

            Logger.success('Received ${logs.length} attendance records from batch API');

            // Map logs to students and days
            for (var log in logs) {
              final studentId = int.tryParse(log['student_id'].toString()); // ✅ Force int
              final status = log['status'];
              final dateStr = log['date'] as String;

              if (studentId == null || !attendanceMap.containsKey(studentId)) {
                continue;
              }

              // Extract day from date string (YYYY-MM-DD)
              final logDate = DateTime.parse(dateStr);
              final day = logDate.day;

              // Map status to our format
              if (status == 'present') {
                attendanceMap[studentId]![day] = 'P';
              } else if (status == 'late') {
                attendanceMap[studentId]![day] = 'L';
              } else if (status == 'absent') {
                attendanceMap[studentId]![day] = 'A';
              } else if (status == 'leave') {
                attendanceMap[studentId]![day] = 'LV';
              }
            }

            Logger.performance('Batch API loaded successfully! (1 request instead of $daysInMonth)');
          }
        } catch (e) {
          Logger.error('Error fetching attendance range', e);
        }
      }

      // ✅ CRITICAL FIX: Override Sundays and Holidays AFTER loading API data
      // This ensures correct display even if there's bad data in the database
      Logger.info('Overriding Sundays and Holidays...');

      for (int day = 1; day <= daysInMonth; day++) {
        final today = DateTime.now();
        final todayDate = DateTime(today.year, today.month, today.day);
        final dayDate = DateTime(year, month, day);

        // Skip future dates
        if (dayDate.isAfter(todayDate)) {
          continue;
        }

        // OVERRIDE with Sunday marker (even if API returned data)
        if (_isSunday(day)) {
          for (var student in students) {
            attendanceMap[student['id']]![day] = 'S';
          }
          Logger.info('  Day $day marked as Sunday');
        }

        // OVERRIDE with Holiday marker (even if API returned data)
        if (_isHoliday(day)) {
          for (var student in students) {
            attendanceMap[student['id']]![day] = 'H';
          }
          Logger.info('  Day $day marked as Holiday');
        }
      }
      
      _calculateStats(attendanceMap, daysInMonth);
      
      setState(() {
        _students = students;
        _attendanceData = attendanceMap;
        _totalStudents = students.length;
        _isLoading = false;
      });
      
      Logger.success('Attendance loaded successfully');

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
  
  /// Calculate statistics - ✅ FIXED: Only count actual marked attendance
  void _calculateStats(Map<int, Map<int, String>> data, int daysInMonth) {
    _presentCount = 0;
    _lateCount = 0;
    _absentCount = 0;
    _holidaysCount = 0;
    
    // Count holidays and Sundays in this month
    for (int day = 1; day <= daysInMonth; day++) {
      if (_isHoliday(day) || _isSunday(day)) _holidaysCount++;
    }
    
    // ✅ FIX: Only count actual marked statuses (P, L, A)
    // Don't count S=Sunday, H=Holiday, LV=Leave, or empty as absent
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
            // Only count if status is explicitly 'A' (marked absent)
            _absentCount++;
            break;
          // S, H, LV, empty are NOT counted as absent
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
  
  // ✅ PAGINATION HELPERS
  int get _totalPages => (_students.length / _studentsPerPage).ceil();
  
  List<Map<String, dynamic>> get _paginatedStudents {
    final startIndex = _currentPage * _studentsPerPage;
    final endIndex = (startIndex + _studentsPerPage).clamp(0, _students.length);
    return _students.sublist(startIndex, endIndex);
  }
  
  Widget _buildPaginationControls() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey.shade200)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Previous Button
          IconButton(
            icon: const Icon(Icons.chevron_left, size: 28),
            onPressed: _currentPage > 0
                ? () => setState(() => _currentPage--)
                : null,
            color: _currentPage > 0 ? const Color(0xFF2563EB) : Colors.grey.shade400,
          ),
          const SizedBox(width: 8),
          // Page indicator
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFF2563EB),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Text(
              '${_currentPage + 1} / $_totalPages',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 13,
              ),
            ),
          ),
          const SizedBox(width: 8),
          // Next Button
          IconButton(
            icon: const Icon(Icons.chevron_right, size: 28),
            onPressed: _currentPage < _totalPages - 1
                ? () => setState(() => _currentPage++)
                : null,
            color: _currentPage < _totalPages - 1 ? const Color(0xFF2563EB) : Colors.grey.shade400,
          ),
        ],
      ),
    );
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

    // Can't edit Sunday or Holiday (but Leave is editable)
    if (currentStatus == 'S') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Cannot edit Sunday'),
          duration: Duration(seconds: 2),
        ),
      );
      return;
    }

    if (currentStatus == 'H') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Cannot edit Holiday'),
          duration: Duration(seconds: 2),
        ),
      );
      return;
    }

    // ✅ SECURITY FIX: Can't edit future dates
    final selectedDate = DateTime(_selectedMonth.year, _selectedMonth.month, day);
    final today = DateTime.now();
    final todayDate = DateTime(today.year, today.month, today.day);

    if (selectedDate.isAfter(todayDate)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              Icon(Icons.warning, color: Colors.white),
              SizedBox(width: 12),
              Text('Cannot mark attendance for future dates'),
            ],
          ),
          backgroundColor: Color(0xFFEF4444),
          duration: Duration(seconds: 3),
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

    // Initialize selected time (outside StatefulBuilder to persist)
    TimeOfDay selectedTime = TimeOfDay.now();

    return StatefulBuilder(
      builder: (context, setState) {
        String checkInTime = '${selectedTime.hour.toString().padLeft(2, '0')}:${selectedTime.minute.toString().padLeft(2, '0')}:00';

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
              const SizedBox(height: 20),

              // ✅ TIME PICKER - NEW FEATURE!
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF3F4F6),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.access_time, color: Color(0xFF6B7280), size: 20),
                        SizedBox(width: 8),
                        Text(
                          'Check-in Time:',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF374151),
                          ),
                        ),
                      ],
                    ),
                    InkWell(
                      onTap: () async {
                        final TimeOfDay? picked = await showTimePicker(
                          context: context,
                          initialTime: selectedTime,
                          builder: (context, child) {
                            return Theme(
                              data: Theme.of(context).copyWith(
                                colorScheme: const ColorScheme.light(
                                  primary: Color(0xFF2563EB),
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
                            selectedTime = picked;
                            checkInTime = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}:00';
                          });
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF2563EB),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          children: [
                            Text(
                              selectedTime.format(context),
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(width: 6),
                            const Icon(Icons.edit, color: Colors.white, size: 16),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

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
                currentStatus == 'LV',
                () => _updateAttendance(studentId, day, 'leave', dateStr, checkInTime),
              ),
              const SizedBox(height: 16),
              Text(
                '💡 Tip: Set the actual arrival time to ensure correct status',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[600],
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],
          ),
        );
      },
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
              color: isSelected ? color : Color.fromRGBO(color.red, color.green, color.blue, 0.3),
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
      Logger.network('Marking attendance: student=$studentId, date=$dateStr, status=$newStatus, time=$checkInTime');
      
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
        
        Logger.success('Attendance updated successfully: $studentId on $dateStr = $actualStatus (display: $displayStatus)');
        
        // Show success message with actual calculated status
        String statusLabel = actualStatus.toUpperCase();
        if (actualStatus == 'late') statusLabel = 'LATE (auto-calculated)';

        // ✅ FIX: Check mounted before using context
        if (!mounted) return;
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
      // Show error message
      // ✅ FIX: Check mounted before using context
      if (!mounted) return;
      ScaffoldMessenger.of(context).clearSnackBars();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Row(
            children: [
              Icon(Icons.error, color: Colors.white),
              SizedBox(width: 12),
              Text('Failed to update attendance'),
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

          // ✅ ULTRA PERFORMANCE: Non-blocking loading progress bar
          if (_isLoading)
            const LinearProgressIndicator(
              backgroundColor: Color(0xFFE5E7EB),
              color: Color(0xFF2563EB),
              minHeight: 3,
            ),

          // Calendar Grid
          Expanded(
            child: _students.isEmpty && !_isLoading
                ? Center(
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
                          'No Students Found',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.grey[700],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _selectedSectionId == null
                              ? 'No section selected'
                              : 'This section has no students yet',
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  )
                : _students.isNotEmpty
                    ? _buildCalendarGrid(daysInMonth)
                    : const SizedBox.shrink(), // Empty while loading
          ),
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
          if (widget.classes.isEmpty)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFF59E0B)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning, color: Color(0xFFF59E0B), size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'No sections assigned. Contact school admin.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey[800],
                      ),
                    ),
                  ),
                ],
              ),
            )
          else
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
                  setState(() {
                    _selectedSectionId = value;
                    _currentPage = 0; // Reset pagination when changing section
                  });
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
        color: Color.fromRGBO(color.red, color.green, color.blue, 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Color.fromRGBO(color.red, color.green, color.blue, 0.3)),
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
    // 🚀 Performance: Calculate exact width once
    // 150 (Name Cell) + (Days * 46 cellWidth) + Padding
    final double gridWidth = 150.0 + (daysInMonth * 46.0) + 32.0;

    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const ClampingScrollPhysics(), // Prevent bounce effect on horizontal
          child: SizedBox(
            height: constraints.maxHeight, // ✅ Forces full height, enabling virtualized list
            width: gridWidth,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Day headers
                Container(
                  height: 50, // Fixed height for header
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Row(
                    children: [
                      const SizedBox(width: 130), // Alignment spacer
                      ...List.generate(daysInMonth, (index) {
                        final day = index + 1;
                        final date = DateTime(_selectedMonth.year, _selectedMonth.month, day);
                        final dayName = DateFormat('EEE').format(date);
                        final isSunday = date.weekday == DateTime.sunday;
                        final isHoliday = _isHoliday(day);

                        return Container(
                          width: 40,
                          margin: const EdgeInsets.only(right: 3),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: isSunday || isHoliday
                                ? const Color(0xFFFEF3C7)
                                : const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                day.toString().padLeft(2, '0'),
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12,
                                  color: isSunday || isHoliday
                                      ? const Color(0xFFF59E0B)
                                      : const Color(0xFF1F2937),
                                ),
                              ),
                              Text(
                                dayName,
                                style: TextStyle(
                                  fontSize: 8,
                                  color: Colors.grey[600],
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                    ],
                  ),
                ),
                const SizedBox(height: 8),

                // ✅ PAGINATION: Show 8 students per page for better performance
                Expanded(
                  child: Column(
                    children: [
                      Expanded(
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
                          itemCount: _paginatedStudents.length,
                          itemExtent: 72.0,
                          cacheExtent: 500,
                          physics: const AlwaysScrollableScrollPhysics(),
                          itemBuilder: (context, index) {
                            return SizedBox(
                              width: gridWidth - 32, // Match grid width minus padding
                              child: _buildStudentRow(_paginatedStudents[index], daysInMonth),
                            );
                          },
                        ),
                      ),
                      // Pagination Controls
                      if (_students.length > _studentsPerPage)
                        _buildPaginationControls(),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildStudentRow(Map<String, dynamic> student, int daysInMonth) {
    // 🎨 DESIGN: Zebra Striping for readability
    final index = _students.indexOf(student);
    final isEven = index % 2 == 0;
    final rowColor = isEven ? Colors.white : const Color(0xFFF9FAFB); // White / Light Grey
    
    final studentId = int.tryParse(student['id'].toString()) ?? 0;
    final name = student['full_name']?.toString() ?? 'Unknown';
    final rollNo = student['roll_number']?.toString() ?? 'N/A';
    final percentage = _calculatePercentage(studentId);

    // ✅ ULTRA PERFORMANCE: Cache row
    return RepaintBoundary(
      child: Container(
        height: 72, // Compact & Clean
        color: rowColor, // Background striping
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Student info - Flat & Clean, no heavy borders
            _buildNameCell(student, index),
            
            // Attendance cells - NO Expanded, parent has horizontal scroll
            _buildAttendanceRow(student, daysInMonth, index),
          ],
        ),
      ),
    );
  }

  // 🟦 NAME CELL (Left Column) - Premium UI with Avatar
  Widget _buildNameCell(Map<String, dynamic> student, int index) {
    final name = student['full_name']?.toString() ?? 'Unknown';
    final rollNo = student['roll_number']?.toString() ?? 'N/A';
    final studentId = int.tryParse(student['id'].toString()) ?? 0;
    final percentage = _calculatePercentage(studentId);
    
    // Colorful Avatar Initials
    final String initials = name.isNotEmpty ? name[0].toUpperCase() : '?';
    final List<Color> avatarColors = [
      const Color(0xFF3B82F6), // Blue
      const Color(0xFF10B981), // Green
      const Color(0xFFF59E0B), // Amber
      const Color(0xFF8B5CF6), // Violet
      const Color(0xFFEC4899), // Pink
      const Color(0xFFEF4444), // Red
    ];
    final avatarColor = avatarColors[index % avatarColors.length];
    
    final isEven = index % 2 == 0;
    
    return Container(
      width: 150, // Fixed width for the name cell
      height: 72, // Match row height
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      alignment: Alignment.centerLeft,
      decoration: BoxDecoration(
        color: isEven ? Colors.white : const Color(0xFFF8FAFC), // Zebra
        border: Border(
          right: BorderSide(color: Colors.grey.shade200, width: 1), // Separator
        ),
      ),
      child: Row(
        children: [
          // Avatar
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: avatarColor.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              initials,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: avatarColor,
              ),
            ),
          ),
          const SizedBox(width: 8),
          
          // Name & Stats
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 11, // Sized to fit
                    color: Color(0xFF1F2937),
                    letterSpacing: -0.2,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    // Percentage Pill
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      decoration: BoxDecoration(
                        color: _getPercentageColor(percentage).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(3),
                      ),
                      child: Text(
                        '${percentage.toInt()}%',
                        style: TextStyle(
                          fontSize: 8,
                          fontWeight: FontWeight.bold,
                          color: _getPercentageColor(percentage),
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                    // Roll No - Flexible to prevent overflow
                    Flexible(
                      child: Text(
                        '#$rollNo',
                        style: TextStyle(
                          fontSize: 9,
                          color: Colors.grey[500],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // 🟧 ATTENDANCE ROW (Right Grid)
  Widget _buildAttendanceRow(Map<String, dynamic> student, int daysInMonth, int index) {
    final studentId = int.tryParse(student['id'].toString()) ?? 0;
    final name = student['full_name']?.toString() ?? 'Unknown';
    
    final isEven = index % 2 == 0;
    const double cellWidth = 46.0;

    return Container(
      height: 72, // Match row height
      color: isEven ? Colors.white : const Color(0xFFF8FAFC), // Match Name Column
      child: Row(
        children: List.generate(daysInMonth, (dIndex) {
          final day = dIndex + 1;
          final status = _attendanceData[studentId]?[day] ?? '';
          
          final selectedDate = DateTime(_selectedMonth.year, _selectedMonth.month, day);
          final today = DateTime.now();
          final todayDate = DateTime(today.year, today.month, today.day);
          final isFutureDate = selectedDate.isAfter(todayDate);

          return GestureDetector(
            onTap: () {
              // Haptic feedback for premium feel
              // HapticFeedback.selectionClick(); // Requires import
              _editAttendance(studentId, day, name);
            },
            behavior: HitTestBehavior.opaque,
            child: Container(
              width: cellWidth,
              decoration: BoxDecoration(
                border: Border(
                  right: BorderSide(color: Colors.grey.shade100, width: 0.5),
                ),
              ),
              child: Center(
                child: _buildStatusBadge(status, isFutureDate),
              ),
            ),
          );
        }),
      ),
    );
  }

  // 🎨 COMPONENT: New "Soft" Status Badge
  Widget _buildStatusBadge(String status, bool isFuture) {
    if (isFuture && status.isEmpty) {
      return Container(
        width: 6,
        height: 6,
        decoration: BoxDecoration(
          color: Colors.grey.shade200,
          shape: BoxShape.circle,
        ),
      );
    }

    if (status.isEmpty) {
      return const SizedBox(); // Empty cell
    }

    Color color;
    Color bgColor;
    String text = status;

    switch (status) {
      case 'P':
        color = const Color(0xFF059669); // Emerald 600
        bgColor = const Color(0xFFECFDF5); // Emerald 50
        break;
      case 'L':
        color = const Color(0xFFD97706); // Amber 600
        bgColor = const Color(0xFFFFFBEB); // Amber 50
        break;
      case 'A':
        color = const Color(0xFFDC2626); // Red 600
        bgColor = const Color(0xFFFEF2F2); // Red 50
        break;
      case 'S':
        color = const Color(0xFF4B5563); // Grey 600
        bgColor = const Color(0xFFF3F4F6); // Grey 100
        break;
      case 'H':
        color = const Color(0xFF7C3AED); // Violet 600
        bgColor = const Color(0xFFF5F3FF); // Violet 50
        break;
      case 'LV':
        color = const Color(0xFF2563EB); // Blue 600
        bgColor = const Color(0xFFEFF6FF); // Blue 50
        break;
      default:
        color = Colors.black;
        bgColor = Colors.grey.shade100;
    }

    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8), // Soft square
      ),
      alignment: Alignment.center,
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.bold,
          fontSize: 12,
        ),
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
      case 'LV':
        return const Color(0xFF8B5CF6); // Purple (Leave)
      case 'S':
        return const Color(0xFF9CA3AF); // Gray (Sunday)
      case 'H':
        return const Color(0xFFEC4899); // Pink (Holiday)
      default:
        return const Color(0xFFF3F4F6); // Light gray
    }
  }

  Color _getPercentageColor(double percentage) {
    if (percentage >= 85) return const Color(0xFF10B981);
    if (percentage >= 75) return const Color(0xFFF59E0B);
    return const Color(0xFFEF4444);
  }

}
