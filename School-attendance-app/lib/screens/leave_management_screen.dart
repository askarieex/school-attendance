import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

/// Leave Management Screen - Full form for marking student leaves
/// Features:
/// - Student selection
/// - Date range selection (start/end date)
/// - Reason input
/// - Submit to backend
class LeaveManagementScreen extends StatefulWidget {
  final ApiService apiService;
  final List<Map<String, dynamic>> classes;

  const LeaveManagementScreen({
    super.key,
    required this.apiService,
    required this.classes,
  });

  @override
  State<LeaveManagementScreen> createState() => _LeaveManagementScreenState();
}

class _LeaveManagementScreenState extends State<LeaveManagementScreen> {
  int? _selectedSectionId;
  List<Map<String, dynamic>> _students = [];
  int? _selectedStudentId;
  DateTime? _startDate;
  DateTime? _endDate;
  final TextEditingController _reasonController = TextEditingController();
  bool _isLoading = false;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    if (widget.classes.isNotEmpty) {
      _selectedSectionId = widget.classes[0]['section_id'];
      _loadStudents();
    }
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  /// Load students for selected section
  Future<void> _loadStudents() async {
    if (_selectedSectionId == null) return;

    setState(() => _isLoading = true);

    try {
      final response = await widget.apiService.get(
        '/teacher/sections/$_selectedSectionId/students',
        requiresAuth: true,
      );

      if (response['success'] == true && response['data'] != null) {
        setState(() {
          _students = (response['data'] as List).cast<Map<String, dynamic>>();
          _selectedStudentId = null; // Reset selection
        });
      }
    } catch (e) {
      print('❌ Error loading students: $e');
      _showError('Failed to load students');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  /// Submit leave application
  Future<void> _submitLeave() async {
    // Validation
    if (_selectedStudentId == null) {
      _showError('Please select a student');
      return;
    }

    if (_startDate == null) {
      _showError('Please select start date');
      return;
    }

    if (_endDate == null) {
      _showError('Please select end date');
      return;
    }

    if (_startDate!.isAfter(_endDate!)) {
      _showError('Start date must be before or same as end date');
      return;
    }

    if (_reasonController.text.trim().isEmpty) {
      _showError('Please enter a reason for leave');
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      // Calculate number of days
      final days = _endDate!.difference(_startDate!).inDays + 1;

      // Mark leave for each day in the range
      for (int i = 0; i < days; i++) {
        final date = _startDate!.add(Duration(days: i));
        final dateStr = DateFormat('yyyy-MM-dd').format(date);

        await widget.apiService.post(
          '/teacher/sections/$_selectedSectionId/attendance',
          {
            'studentId': _selectedStudentId,
            'date': dateStr,
            'checkInTime': '00:00:00',
            'status': 'leave',
            'notes': _reasonController.text.trim(),
          },
          requiresAuth: true,
        );
      }

      _showSuccess('Leave marked successfully for $days day(s)');

      // Clear form
      setState(() {
        _selectedStudentId = null;
        _startDate = null;
        _endDate = null;
        _reasonController.clear();
      });
    } catch (e) {
      print('❌ Error submitting leave: $e');
      _showError('Failed to submit leave. Please try again.');
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.error, color: Colors.white),
            const SizedBox(width: 12),
            Text(message),
          ],
        ),
        backgroundColor: const Color(0xFFEF4444),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle, color: Colors.white),
            const SizedBox(width: 12),
            Text(message),
          ],
        ),
        backgroundColor: const Color(0xFF10B981),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Leave Management',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 18,
            color: Colors.white,
            letterSpacing: -0.3,
          ),
        ),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Form Card
                  Container(
                    padding: const EdgeInsets.all(22),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFFE2E8F0), width: 1.5),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF6366F1).withOpacity(0.06),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Class Selector
                        _buildSectionLabel('Select Class', Icons.school_rounded),
                        const SizedBox(height: 10),
                        _buildClassDropdown(),
                        const SizedBox(height: 22),

                        // Student Selector
                        _buildSectionLabel('Select Student', Icons.person_rounded),
                        const SizedBox(height: 10),
                        _buildStudentDropdown(),
                        const SizedBox(height: 22),

                        // Date Range
                        _buildSectionLabel('Leave Duration', Icons.calendar_today_rounded),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: _buildDatePicker(
                                label: 'Start Date',
                                date: _startDate,
                                hint: 'Select date',
                                onTap: () => _pickDate(isStartDate: true),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _buildDatePicker(
                                label: 'End Date',
                                date: _endDate,
                                hint: 'Select date',
                                onTap: () => _pickDate(isStartDate: false),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 22),

                        // Reason
                        _buildSectionLabel('Reason for Leave', Icons.edit_note_rounded),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _reasonController,
                          maxLines: 4,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF0F172A),
                          ),
                          decoration: InputDecoration(
                            hintText: 'e.g., Medical leave, Family emergency...',
                            hintStyle: const TextStyle(
                              color: Color(0xFF94A3B8),
                              fontSize: 13,
                            ),
                            filled: true,
                            fillColor: const Color(0xFFF8FAFC),
                            contentPadding: const EdgeInsets.all(16),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.5),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.5),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(color: Color(0xFF6366F1), width: 2),
                            ),
                          ),
                        ),
                        const SizedBox(height: 22),

                        // Days Summary
                        if (_startDate != null && _endDate != null)
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFFEEF2FF), Color(0xFFE0E7FF)],
                              ),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: const Color(0xFF6366F1).withOpacity(0.3),
                                width: 1.5,
                              ),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF6366F1),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Icon(
                                    Icons.event_available_rounded,
                                    color: Colors.white,
                                    size: 20,
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'Total Leave Days',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: Color(0xFF64748B),
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '${_endDate!.difference(_startDate!).inDays + 1} day(s)',
                                        style: const TextStyle(
                                          fontSize: 20,
                                          fontWeight: FontWeight.w800,
                                          color: Color(0xFF6366F1),
                                          letterSpacing: -0.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        if (_startDate != null && _endDate != null)
                          const SizedBox(height: 22),

                        // Submit Button
                        Container(
                          width: double.infinity,
                          height: 56,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                            ),
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF6366F1).withOpacity(0.4),
                                blurRadius: 16,
                                offset: const Offset(0, 8),
                              ),
                            ],
                          ),
                          child: ElevatedButton(
                            onPressed: _isSubmitting ? null : _submitLeave,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.transparent,
                              shadowColor: Colors.transparent,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            child: _isSubmitting
                                ? const SizedBox(
                                    height: 22,
                                    width: 22,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.5,
                                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                    ),
                                  )
                                : const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(Icons.check_circle_rounded, size: 22),
                                      SizedBox(width: 10),
                                      Text(
                                        'Submit Leave Application',
                                        style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700,
                                          color: Colors.white,
                                          letterSpacing: 0.3,
                                        ),
                                      ),
                                    ],
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildSectionLabel(String label, [IconData? icon]) {
    return Row(
      children: [
        if (icon != null) ...[
          Icon(
            icon,
            size: 18,
            color: const Color(0xFF6366F1),
          ),
          const SizedBox(width: 8),
        ],
        Text(
          label,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: Color(0xFF0F172A),
            letterSpacing: -0.2,
          ),
        ),
      ],
    );
  }

  Widget _buildClassDropdown() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1.5),
      ),
      child: DropdownButton<int>(
        value: _selectedSectionId,
        isExpanded: true,
        underline: const SizedBox(),
        icon: const Icon(Icons.expand_more_rounded, color: Color(0xFF6366F1)),
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: Color(0xFF0F172A),
        ),
        items: widget.classes.map((classData) {
          final className = classData['class_name'] ?? '';
          final sectionName = classData['section_name'] ?? '';
          final subject = classData['subject'] ?? '';

          return DropdownMenuItem<int>(
            value: classData['section_id'],
            child: Text('$className-$sectionName ($subject)'),
          );
        }).toList(),
        onChanged: (value) {
          setState(() {
            _selectedSectionId = value;
            _selectedStudentId = null; // Reset student selection
          });
          _loadStudents();
        },
      ),
    );
  }

  Widget _buildStudentDropdown() {
    if (_students.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: const Color(0xFFFEF2F2),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFFECACA), width: 1.5),
        ),
        child: Row(
          children: [
            const Icon(Icons.info_outline_rounded, color: Color(0xFFEF4444), size: 20),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'No students available',
                style: TextStyle(
                  color: Color(0xFFDC2626),
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1.5),
      ),
      child: DropdownButton<int>(
        value: _selectedStudentId,
        isExpanded: true,
        underline: const SizedBox(),
        icon: const Icon(Icons.expand_more_rounded, color: Color(0xFF6366F1)),
        hint: const Text(
          'Select a student',
          style: TextStyle(
            color: Color(0xFF94A3B8),
            fontWeight: FontWeight.w500,
          ),
        ),
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: Color(0xFF0F172A),
        ),
        items: _students.map((student) {
          final name = student['full_name'] ?? '';
          final rollNo = student['roll_number'] ?? '';

          return DropdownMenuItem<int>(
            value: student['id'],
            child: Text('$name (Roll: $rollNo)'),
          );
        }).toList(),
        onChanged: (value) {
          setState(() => _selectedStudentId = value);
        },
      ),
    );
  }

  Widget _buildDatePicker({
    required String label,
    required DateTime? date,
    required String hint,
    required VoidCallback onTap,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Color(0xFF64748B),
            letterSpacing: 0.2,
          ),
        ),
        const SizedBox(height: 8),
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: date != null
                    ? [const Color(0xFFEEF2FF), const Color(0xFFE0E7FF)]
                    : [const Color(0xFFF8FAFC), const Color(0xFFF8FAFC)],
              ),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: date != null ? const Color(0xFF6366F1) : const Color(0xFFE2E8F0),
                width: 1.5,
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.calendar_today_rounded,
                  color: date != null ? const Color(0xFF6366F1) : const Color(0xFF94A3B8),
                  size: 18,
                ),
                const SizedBox(width: 10),
                Flexible(
                  child: Text(
                    date != null ? DateFormat('MMM dd, yyyy').format(date) : hint,
                    style: TextStyle(
                      fontSize: 13,
                      color: date != null ? const Color(0xFF6366F1) : const Color(0xFF94A3B8),
                      fontWeight: date != null ? FontWeight.w700 : FontWeight.w500,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _pickDate({required bool isStartDate}) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF8B5CF6),
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
        if (isStartDate) {
          _startDate = picked;
          // Auto-adjust end date if it's before start date
          if (_endDate != null && _endDate!.isBefore(picked)) {
            _endDate = picked;
          }
        } else {
          _endDate = picked;
        }
      });
    }
  }
}
