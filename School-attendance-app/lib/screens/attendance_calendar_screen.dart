import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../utils/logger.dart';
import '../utils/time_utils.dart';

/// 🎯 SIMPLE CLEAN ATTENDANCE CALENDAR
/// - Month view with student list
/// - Tap to edit attendance  
/// - Clean minimal UI
/// - No complex scroll sync
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
  DateTime _selectedMonth = TimeUtils.nowIST();
  int? _selectedSectionId;
  List<Map<String, dynamic>> _students = [];
  Map<int, Map<int, String>> _attendanceData = {}; // {studentId: {day: status}}
  bool _isLoading = false;
  
  @override
  void initState() {
    super.initState();
    if (widget.classes.isNotEmpty) {
      _selectedSectionId = widget.classes[0]['section_id'];
      _loadData();
    }
  }
  
  Future<void> _loadData() async {
    if (_selectedSectionId == null) return;
    
    setState(() => _isLoading = true);
    
    try {
      // Load students
      final studentsResponse = await widget.apiService.get(
        '/teacher/sections/$_selectedSectionId/students',
        requiresAuth: true,
      );
      
      List<Map<String, dynamic>> students = [];
      if (studentsResponse['success'] == true && studentsResponse['data'] != null) {
        students = (studentsResponse['data'] as List).cast<Map<String, dynamic>>();
      }
      
      // Load attendance for month
      final year = _selectedMonth.year;
      final month = _selectedMonth.month;
      final daysInMonth = DateTime(year, month + 1, 0).day;
      
      final startDateStr = '$year-${month.toString().padLeft(2, '0')}-01';
      final endDateStr = '$year-${month.toString().padLeft(2, '0')}-${daysInMonth.toString().padLeft(2, '0')}';
      
      final attendanceResponse = await widget.apiService.get(
        '/teacher/sections/$_selectedSectionId/attendance/range?startDate=$startDateStr&endDate=$endDateStr',
        requiresAuth: true,
      );
      
      Map<int, Map<int, String>> attendanceMap = {};
      
      // Initialize map
      for (var student in students) {
        final studentId = int.tryParse(student['id'].toString());
        if (studentId != null) {
          attendanceMap[studentId] = {};
        }
      }
      
      // Fill attendance data
      if (attendanceResponse['success'] == true && attendanceResponse['data'] != null) {
        final data = attendanceResponse['data'];
        List logs = [];
        Map<String, dynamic> calendar = {};
        
        if (data is Map) {
          logs = data['logs'] ?? [];
          calendar = Map<String, dynamic>.from(data['calendar'] ?? {});
        } else if (data is List) {
          logs = data;
        }
        
        // Map logs
        for (var log in logs) {
          final studentId = int.tryParse(log['student_id'].toString());
          final status = log['status'];
          final dateStr = log['date'] as String;
          
          if (studentId == null || !attendanceMap.containsKey(studentId)) continue;
          
          final logDate = DateTime.parse(dateStr);
          final day = logDate.day;
          
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
        
        // Apply holidays and weekends
        calendar.forEach((date, meta) {
          final dayDate = DateTime.parse(date);
          final day = dayDate.day;
          
          if (meta['type'] == 'HOLIDAY') {
            for (var entry in attendanceMap.entries) {
              entry.value[day] = 'H';
            }
          } else if (meta['type'] == 'WEEKEND') {
            for (var entry in attendanceMap.entries) {
              entry.value[day] = 'S';
            }
          }
        });
      }
      
      setState(() {
        _students = students;
        _attendanceData = attendanceMap;
        _isLoading = false;
      });
      
    } catch (e) {
      Logger.error('Error loading calendar data', e);
      setState(() => _isLoading = false);
    }
  }
  
  Color _getStatusColor(String status) {
    switch (status) {
      case 'P': return const Color(0xFF10B981); // Green
      case 'L': return const Color(0xFFF59E0B); // Orange
      case 'A': return const Color(0xFFEF4444); // Red
      case 'LV': return const Color(0xFF8B5CF6); // Purple
case 'H': return const Color(0xFF6B7280); // Gray
      case 'S': return const Color(0xFF6B7280); // Gray
      default: return Colors.transparent;
    }
  }
  
  String _getStatusLabel(String status) {
    switch (status) {
      case 'P': return 'P';
      case 'L': return 'L';
      case 'A': return 'A';
      case 'LV': return 'LV';
      case 'H': return 'H';
      case 'S': return 'S';
      default: return '-';
    }
  }
  
  bool _isToday(int day) {
    final now = TimeUtils.nowIST();
    return _selectedMonth.year == now.year && 
           _selectedMonth.month == now.month && 
           day == now.day;
  }
  
  void _showEditDialog(int studentId, int day) async {
    final student = _students.firstWhere((s) => int.parse(s['id'].toString()) == studentId);
    final currentStatus = _attendanceData[studentId]?[day] ?? '';
    
    // Can't edit holiday or weekend
    if (currentStatus == 'H' || currentStatus == 'S') {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Cannot edit ${currentStatus == 'H' ? 'Holiday' : 'Weekend'}')),
      );
      return;
    }
    
    // Can't edit future dates
    final selectedDate = DateTime(_selectedMonth.year, _selectedMonth.month, day);
    final today = TimeUtils.nowIST();
    if (selectedDate.isAfter(DateTime(today.year, today.month, today.day))) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cannot mark future dates')),
      );
      return;
    }
    
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Mark Attendance',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              '${student['full_name']} - Day $day',
              style: const TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 24),
            _buildStatusOption('Present', 'present', Icons.check_circle, const Color(0xFF10B981), studentId, day),
            const SizedBox(height: 12),
            _buildStatusOption('Absent', 'absent', Icons.cancel, const Color(0xFFEF4444), studentId, day),
            const SizedBox(height: 12),
            _buildStatusOption('Leave', 'leave', Icons.event_busy, const Color(0xFF8B5CF6), studentId, day),
          ],
        ),
      ),
    );
  }
  
  Widget _buildStatusOption(String label, String status, IconData icon, Color color, int studentId, int day) {
    return InkWell(
      onTap: () async {
        Navigator.pop(context);
        await _updateAttendance(studentId, day, status);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
        decoration: BoxDecoration(
          border: Border.all(color: color.withOpacity(0.3)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(icon, color: color),
            const SizedBox(width: 12),
            Text(label, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: color)),
          ],
        ),
      ),
    );
  }
  
  Future<void> _updateAttendance(int studentId, int day, String status) async {
    try {
      final dateStr = '${_selectedMonth.year}-${_selectedMonth.month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';
      final now = DateTime.now();
      final checkInTime = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}:00';
      
      final response = await widget.apiService.post(
        '/teacher/sections/$_selectedSectionId/attendance',
        {
          'studentId': studentId,
          'date': dateStr,
          'checkInTime': checkInTime,
          'status': status,
        },
        requiresAuth: true,
      );
      
      if (response['success'] == true) {
        await _loadData();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Attendance updated'), backgroundColor: Color(0xFF10B981)),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to update'), backgroundColor: Color(0xFFEF4444)),
        );
      }
    }
  }
  
  @override
  Widget build(BuildContext context) {
    final monthName = DateFormat('MMMM yyyy').format(_selectedMonth);
    final daysInMonth = DateTime(_selectedMonth.year, _selectedMonth.month + 1, 0).day;
    
    // Get selected class name
    String selectedClassName = 'Select Class';
    if (_selectedSectionId != null) {
      final selectedClass = widget.classes.firstWhere(
        (c) => c['section_id'] == _selectedSectionId,
        orElse: () => {},
      );
      if (selectedClass.isNotEmpty) {
        selectedClassName = '${selectedClass['class_name']} - ${selectedClass['section_name']}';
      }
    }
    
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FE),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text('Attendance Calendar', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold)),
        iconTheme: const IconThemeData(color: Colors.black87),
      ),
      body: Column(
        children: [
          // Class Selector Header
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                const Icon(Icons.school, color: Color(0xFF2563EB), size: 20),
                const SizedBox(width: 8),
                const Text(
                  'Class:',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.black54),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF2563EB).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFF2563EB).withOpacity(0.3)),
                    ),
                    child: DropdownButton<int>(
                      value: _selectedSectionId,
                      isExpanded: true,
                      underline: const SizedBox(),
                      icon: const Icon(Icons.keyboard_arrow_down, color: Color(0xFF2563EB)),
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF2563EB)),
                      items: widget.classes.map((classData) {
                        return DropdownMenuItem<int>(
                          value: classData['section_id'],
                          child: Text('${classData['class_name']} - ${classData['section_name']}'),
                        );
                      }).toList(),
                      onChanged: (newSectionId) {
                        setState(() => _selectedSectionId = newSectionId);
                        _loadData();
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          // Month selector
          Container(
            color: Colors.white,
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  icon: const Icon(Icons.chevron_left),
                  onPressed: () {
                    setState(() => _selectedMonth = DateTime(_selectedMonth.year, _selectedMonth.month - 1));
                    _loadData();
                  },
                ),
                Text(monthName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                IconButton(
                  icon: const Icon(Icons.chevron_right),
                  onPressed: () {
                    setState(() => _selectedMonth = DateTime(_selectedMonth.year, _selectedMonth.month + 1));
                    _loadData();
                  },
                ),
              ],
            ),
          ),
          
          // Legend
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Wrap(
              spacing: 12,
              runSpacing: 8,
              children: [
                _buildLegendItem('P', 'Present', const Color(0xFF10B981)),
                _buildLegendItem('L', 'Late', const Color(0xFFF59E0B)),
                _buildLegendItem('A', 'Absent', const Color(0xFFEF4444)),
                _buildLegendItem('LV', 'Leave', const Color(0xFF8B5CF6)),
                _buildLegendItem('H', 'Holiday', const Color(0xFF6B7280)),
                _buildLegendItem('S', 'Weekend', const Color(0xFF6B7280)),
              ],
            ),
          ),
          
          if (_isLoading)
            const LinearProgressIndicator(),
          
          // Calendar table
          Expanded(
            child: _students.isEmpty && !_isLoading
                ? const Center(child: Text('No students found'))
                : SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        // Header row
                        Row(
                          children: [
                            Container(
                              width: 120,
                              padding: const EdgeInsets.all(8),
                              child: const Text('Student', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                            ),
                            Expanded(
                              child: SingleChildScrollView(
                                scrollDirection: Axis.horizontal,
                                child: Row(
                                  children: List.generate(daysInMonth, (index) {
                                    final day = index + 1;
                                    return Container(
                                      width: 32,
                                      height: 32,
                                      alignment: Alignment.center,
                                      decoration: BoxDecoration(
                                        color: _isToday(day) ? const Color(0xFF2563EB).withOpacity(0.1) : null,
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        '$day',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: _isToday(day) ? FontWeight.bold : FontWeight.normal,
                                          color: _isToday(day) ? const Color(0xFF2563EB) : Colors.black87,
                                        ),
                                      ),
                                    );
                                  }),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const Divider(),
                        
                        // Student rows
                        ..._students.map((student) {
                          final studentId = int.parse(student['id'].toString());
                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              children: [
                                // Student name
                                Container(
                                  width: 120,
                                  padding: const EdgeInsets.all(8),
                                  child: Text(
                                    student['full_name'] ?? 'Unknown',
                                    style: const TextStyle(fontSize: 12),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                // Days
                                Expanded(
                                  child: SingleChildScrollView(
                                    scrollDirection: Axis.horizontal,
                                    child: Row(
                                      children: List.generate(daysInMonth, (index) {
                                        final day = index + 1;
                                        final status = _attendanceData[studentId]?[day] ?? '';
                                        
                                        return GestureDetector(
                                          onTap: () => _showEditDialog(studentId, day),
                                          child: Container(
                                            width: 32,
                                            height: 32,
                                            alignment: Alignment.center,
                                            decoration: BoxDecoration(
                                              color: _getStatusColor(status).withOpacity(status.isEmpty ? 0 : 0.15),
                                              borderRadius: BorderRadius.circular(4),
                                              border: status.isNotEmpty ? Border.all(color: _getStatusColor(status), width: 1) : null,
                                            ),
                                            child: Text(
                                              _getStatusLabel(status),
                                              style: TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.bold,
                                                color: _getStatusColor(status),
                                              ),
                                            ),
                                          ),
                                        );
                                      }),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildLegendItem(String symbol, String label, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 20,
          height: 20,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: color.withOpacity(0.15),
            border: Border.all(color: color),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(symbol, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: color)),
        ),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 11)),
      ],
    );
  }
}
