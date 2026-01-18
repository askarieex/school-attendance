import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/teacher_service.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'leave_management_screen.dart';

class ClassAttendanceScreen extends StatefulWidget {
  final Map<String, dynamic> classData;

  const ClassAttendanceScreen({super.key, required this.classData});

  @override
  State<ClassAttendanceScreen> createState() => _ClassAttendanceScreenState();
}

class _ClassAttendanceScreenState extends State<ClassAttendanceScreen> {
  late TeacherService _teacherService;
  List<Map<String, dynamic>> _students = [];
  bool _isLoading = true;
  bool _isSunday = false;

  int _presentCount = 0;
  int _lateCount = 0;
  int _absentCount = 0;

  @override
  void initState() {
    super.initState();
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    _teacherService = TeacherService(authProvider.apiService);
    _loadStudentsAndAttendance();
  }

  Future<void> _loadStudentsAndAttendance() async {
    setState(() => _isLoading = true);
    try {
      // ✅ CHECK: Don't load attendance on Sunday
      final today = DateTime.now();
      if (today.weekday == DateTime.sunday) {
        setState(() {
          _isLoading = false;
          _isSunday = true;
        });
        return;
      }

      final sectionId = widget.classData['section_id'];
      
      // ✅ PERFORMANCE FIX: Load students and attendance IN PARALLEL
      final results = await Future.wait([
        _teacherService.getStudentsInSection(sectionId),
        _teacherService.getAttendanceForSection(
          sectionId,
          DateFormat('yyyy-MM-dd').format(DateTime.now()),
        ),
      ]);
      
      final students = results[0] as List<Map<String, dynamic>>;
      final attendance = results[1] as List<Map<String, dynamic>>;

      setState(() {
        _students = students.map((student) {
          final record = attendance.firstWhere(
            (att) => att['student_id'] == student['id'],
            orElse: () => {'status': 'pending'},
          );
          student['status'] = record['status'];
          return student;
        }).toList();
        _updateCounts();
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      // Use WidgetsBinding to show snackbar after build is complete
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: ${e.toString()}')),
          );
        }
      });
    }
  }

  void _updateCounts() {
    _presentCount = _students.where((s) => s['status'] == 'present').length;
    _lateCount = _students.where((s) => s['status'] == 'late').length;
    _absentCount = _students.where((s) => s['status'] == 'absent').length;
  }

  @override
  Widget build(BuildContext context) {
    final className = widget.classData['class_name'] ?? '';
    final sectionName = widget.classData['section_name'] ?? '';
    final fullClassName = '$className-$sectionName';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 1,
        shadowColor: Colors.black.withOpacity(0.05),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(fullClassName, style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold)),
        actions: [_buildMarkAllButton()],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _isSunday
              ? _buildSundayScreen()
              : Column(
                  children: [
                    _buildSummaryCards(),
                    Expanded(
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _students.length,
                        itemBuilder: (context, index) {
                          return _buildStudentTile(_students[index], index);
                        },
                      ),
                    ),
                  ],
                ),
    );
  }

  Widget _buildMarkAllButton() {
    return PopupMenuButton<String>(
      onSelected: (value) {
        // Handle mark all logic
      },
      itemBuilder: (BuildContext context) => <PopupMenuEntry<String>>[
        const PopupMenuItem<String>(
          value: 'present',
          child: Text('Mark All Present'),
        ),
        const PopupMenuItem<String>(
          value: 'absent',
          child: Text('Mark All Absent'),
        ),
      ],
      child: Container(
        margin: const EdgeInsets.only(right: 16),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Text('Mark All', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildSummaryCards() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Colors.grey[200]!)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildSummaryCard('Total', _students.length.toString(), const Color(0xFF6366F1), Icons.people),
          _buildSummaryCard('Present', _presentCount.toString(), const Color(0xFF10B981), Icons.check_circle),
          _buildSummaryCard('Late', _lateCount.toString(), const Color(0xFFF59E0B), Icons.access_time),
          _buildSummaryCard('Absent', _absentCount.toString(), const Color(0xFFEF4444), Icons.cancel),
        ],
      ),
    );
  }

  Widget _buildSummaryCard(String title, String count, Color color, IconData icon) {
    return Column(
      children: [
        Icon(icon, color: color, size: 28),
        const SizedBox(height: 8),
        Text(count, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 4),
        Text(title, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
      ],
    );
  }

  Widget _buildStudentTile(Map<String, dynamic> student, int index) {
    final status = student['status'] ?? 'pending';
    final Color statusColor = status == 'present' || status == 'late'
        ? const Color(0xFF10B981)
        : status == 'leave'
            ? const Color(0xFFAF52DE)
            : status == 'absent'
                ? const Color(0xFFEF4444)
                : const Color(0xFF94A3B8);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0.5,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.grey[200]!),
      ),
      child: InkWell(
        onTap: () => _showAttendanceDialog(student),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [statusColor.withOpacity(0.2), statusColor.withOpacity(0.1)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Center(
                  child: Text(
                    student['full_name'][0].toUpperCase(),
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: statusColor,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      student['full_name'],
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Roll: ${student['roll_number']}',
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  status == 'pending' ? 'Mark' : status.toUpperCase(),
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: statusColor,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                Icons.chevron_right_rounded,
                color: Colors.grey[400],
                size: 24,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Show beautiful attendance dialog with time picker
  void _showAttendanceDialog(Map<String, dynamic> student) {
    TimeOfDay selectedTime = TimeOfDay.now();
    final studentName = student['full_name'] ?? 'Student';
    final currentStatus = student['status'] ?? 'pending';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (BuildContext context, StateSetter setModalState) {
            return Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(24),
                  topRight: Radius.circular(24),
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header
                    Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Center(
                            child: Text(
                              studentName[0].toUpperCase(),
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                studentName,
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                              Text(
                                'Roll: ${student['roll_number']}',
                                style: const TextStyle(
                                  fontSize: 14,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          onPressed: () => Navigator.pop(context),
                          icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Current Status Badge
                    if (currentStatus != 'pending')
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text(
                              'Current Status:',
                              style: TextStyle(
                                fontSize: 13,
                                color: Color(0xFF64748B),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              currentStatus.toUpperCase(),
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                          ],
                        ),
                      ),
                    const SizedBox(height: 20),

                    // Time Picker
                    const Text(
                      'Select Check-in Time',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 12),
                    InkWell(
                      onTap: () async {
                        final TimeOfDay? picked = await showTimePicker(
                          context: context,
                          initialTime: selectedTime,
                          builder: (BuildContext context, Widget? child) {
                            return Theme(
                              data: ThemeData.light().copyWith(
                                colorScheme: const ColorScheme.light(
                                  primary: Color(0xFF6366F1),
                                  onPrimary: Colors.white,
                                  surface: Colors.white,
                                  onSurface: Color(0xFF0F172A),
                                ),
                              ),
                              child: child!,
                            );
                          },
                        );
                        if (picked != null) {
                          setModalState(() {
                            selectedTime = picked;
                          });
                        }
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                          borderRadius: BorderRadius.circular(12),
                          color: const Color(0xFFF8FAFC),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.access_time_rounded, color: Color(0xFF6366F1), size: 24),
                                const SizedBox(width: 12),
                                Text(
                                  selectedTime.format(context),
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                              ],
                            ),
                            const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF64748B)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Action Buttons
                    Column(
                      children: [
                        // Present Button (full width with checkmark)
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: () async {
                              Navigator.pop(context);
                              await _markAttendance(
                                student: student,
                                status: 'present',
                                time: selectedTime,
                              );
                            },
                            icon: const Icon(Icons.check_circle_rounded, size: 22),
                            label: const Text(
                              'Present',
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF10B981),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              elevation: 0,
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        // Absent Button (full width with X icon)
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: () async {
                              Navigator.pop(context);
                              await _markAttendance(
                                student: student,
                                status: 'absent',
                                time: selectedTime,
                              );
                            },
                            icon: const Icon(Icons.cancel_rounded, size: 22),
                            label: const Text(
                              'Absent',
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: const Color(0xFFEF4444),
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                                side: const BorderSide(color: Color(0xFFEF4444), width: 2),
                              ),
                              elevation: 0,
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        // Leave Button (full width with calendar icon)
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: () {
                              Navigator.pop(context);
                              // Navigate to Leave Management page
                              final authProvider = Provider.of<AuthProvider>(context, listen: false);
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => LeaveManagementScreen(
                                    apiService: authProvider.apiService,
                                    classes: [widget.classData],
                                  ),
                                ),
                              );
                            },
                            icon: const Icon(Icons.event_busy_rounded, size: 22),
                            label: const Text(
                              'Leave',
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: const Color(0xFFAF52DE),
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                                side: const BorderSide(color: Color(0xFFAF52DE), width: 2),
                              ),
                              elevation: 0,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Info text about auto-late calculation
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.info_outline_rounded, color: Color(0xFF92400E), size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Tip: Set the actual arrival time to ensure correct status',
                              style: TextStyle(
                                fontSize: 12,
                                color: const Color(0xFF92400E).withOpacity(0.9),
                                fontStyle: FontStyle.italic,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: MediaQuery.of(context).viewInsets.bottom),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  /// Mark attendance with time
  Future<void> _markAttendance({
    required Map<String, dynamic> student,
    required String status,
    required TimeOfDay time,
  }) async {
    final studentName = student['full_name'] ?? 'Student';
    final sectionId = widget.classData['section_id'];
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final checkInTime = '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}:00';

    // Update UI optimistically
    setState(() {
      student['status'] = status;
      _updateCounts();
    });

    try {
      final response = await _teacherService.markAttendance(
        sectionId: sectionId,
        studentId: student['id'],
        date: today,
        status: status,
        checkInTime: checkInTime,
      );

      // Backend may auto-calculate 'late' status
      final finalStatus = response['status'] ?? status;

      setState(() {
        student['status'] = finalStatus;
        _updateCounts();
      });

      if (mounted) {
        final statusLabel = finalStatus == 'late'
            ? 'LATE (auto-calculated)'
            : finalStatus.toUpperCase();

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$studentName marked as $statusLabel'),
            duration: const Duration(seconds: 2),
            backgroundColor: const Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      // Revert UI on error
      setState(() {
        student['status'] = student['status'];
        _updateCounts();
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to mark attendance: ${e.toString()}'),
            duration: const Duration(seconds: 3),
            backgroundColor: const Color(0xFFEF4444),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Widget _buildSundayScreen() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Large calendar icon
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFFF9500), Color(0xFFFF6B00)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(30),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFFF9500).withOpacity(0.3),
                    blurRadius: 30,
                    offset: const Offset(0, 15),
                  ),
                ],
              ),
              child: const Icon(
                Icons.weekend_rounded,
                size: 80,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 32),

            // Title
            const Text(
              'It\'s Sunday!',
              style: TextStyle(
                fontSize: 32,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
                letterSpacing: -1,
              ),
            ),
            const SizedBox(height: 12),

            // Subtitle
            const Text(
              'No school today',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w500,
                color: Color(0xFF64748B),
              ),
            ),
            const SizedBox(height: 24),

            // Description card
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: const Color(0xFFFFEDD5),
                  width: 2,
                ),
              ),
              child: Column(
                children: [
                  const Icon(
                    Icons.info_outline_rounded,
                    color: Color(0xFFFF9500),
                    size: 28,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Attendance cannot be marked on Sundays',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF92400E),
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Please come back on Monday to mark attendance',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: const Color(0xFF92400E).withOpacity(0.7),
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // Back button
            ElevatedButton.icon(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.arrow_back_rounded),
              label: const Text('Go Back'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6366F1),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 0,
              ),
            ),
          ],
        ),
      ),
    );
  }
}