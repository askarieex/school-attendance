import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:fl_chart/fl_chart.dart';
import '../services/api_service.dart';
import '../services/pdf_service.dart';
import '../utils/logger.dart';
import '../utils/time_utils.dart';

/// Comprehensive Reports Screen with Detailed Analytics and PDF Export
class ReportsScreen extends StatefulWidget {
  final ApiService apiService;
  final List<Map<String, dynamic>> classes;
  
  const ReportsScreen({
    super.key,
    required this.apiService,
    required this.classes,
  });

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  String _selectedReportType = 'daily';
  DateTime _selectedDate = TimeUtils.nowIST();
  int? _selectedSectionId;
  String? _selectedClassName;
  bool _isGenerating = false;
  bool _isExportingPdf = false;
  dynamic _reportData;
  
  @override
  void initState() {
    super.initState();
    if (widget.classes.isNotEmpty) {
      _selectedSectionId = widget.classes[0]['section_id'];
      _selectedClassName = '${widget.classes[0]['class_name']} - ${widget.classes[0]['section_name']}';
    }
  }
  
  Future<void> _generateReport() async {
    if (_selectedSectionId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a class')),
      );
      return;
    }
    
    setState(() => _isGenerating = true);
    
    try {
      String dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      String endpoint = '';
      
      if (_selectedReportType == 'daily') {
        endpoint = '/teacher/sections/$_selectedSectionId/attendance?date=$dateStr';
      } else if (_selectedReportType == 'monthly') {
        final year = _selectedDate.year;
        final month = _selectedDate.month;
        final startDate = '$year-${month.toString().padLeft(2, '0')}-01';
        final daysInMonth = DateTime(year, month + 1, 0).day;
        final endDate = '$year-${month.toString().padLeft(2, '0')}-${daysInMonth.toString().padLeft(2, '0')}';
        endpoint = '/teacher/sections/$_selectedSectionId/attendance/range?startDate=$startDate&endDate=$endDate';
      }
      
      Logger.network('Generating report: $endpoint');
      
      final response = await widget.apiService.get(endpoint, requiresAuth: true);
      
      if (response['success'] == true) {
        setState(() {
          _reportData = response['data'];
          _isGenerating = false;
        });
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Report generated successfully'),
              backgroundColor: Color(0xFF10B981),
            ),
          );
        }
      } else {
        throw Exception(response['message'] ?? 'Failed to generate report');
      }
    } catch (e) {
      Logger.error('Error generating report', e);
      setState(() => _isGenerating = false);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }
  
  Future<void> _exportToPdf() async {
    if (_reportData == null) return;
    
    setState(() => _isExportingPdf = true);
    
    try {
      if (_selectedReportType == 'daily') {
        await _exportDailyReportPdf();
      } else {
        await _exportMonthlyReportPdf();
      }
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('PDF export completed!'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('PDF export failed: $e'),
            backgroundColor: Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      setState(() => _isExportingPdf = false);
    }
  }
  
  Future<void> _exportDailyReportPdf() async {
    List logs = [];
    if (_reportData is List) {
      logs = _reportData as List;
    } else if (_reportData is Map) {
      logs = (_reportData as Map)['logs'] ?? [];
    }
    
    int present = 0, late = 0, absent = 0;
    List<Map<String, dynamic>> students = [];
    
    for (var log in logs) {
      if (log is Map<String, dynamic>) {
        final status = log['status']?.toString() ?? '';
        if (status == 'present') present++;
        else if (status == 'late') late++;
        else if (status == 'absent') absent++;
        students.add(log);
      }
    }
    
    await PdfService.generateDailyReportPdf(
      className: _selectedClassName ?? 'Class',
      date: _selectedDate,
      total: logs.length,
      present: present,
      late: late,
      absent: absent,
      students: students,
    );
  }
  
  Future<void> _exportMonthlyReportPdf() async {
    List logs = [];
    if (_reportData is Map<String, dynamic>) {
      final data = _reportData as Map<String, dynamic>;
      final logsData = data['logs'];
      if (logsData is List) {
        logs = logsData;
      }
    } else if (_reportData is List) {
      logs = _reportData as List;
    }
    
    int present = 0, late = 0, absent = 0;
    Map<String, Map<String, int>> studentStats = {};
    
    for (var log in logs) {
      if (log is Map) {
        final status = log['status']?.toString() ?? '';
        final studentName = log['student_name']?.toString() ?? log['full_name']?.toString() ?? 'Unknown';
        
        if (status == 'present') present++;
        else if (status == 'late') late++;
        else if (status == 'absent') absent++;
        
        if (!studentStats.containsKey(studentName)) {
          studentStats[studentName] = {'present': 0, 'late': 0, 'absent': 0, 'total': 0};
        }
        studentStats[studentName]!['total'] = (studentStats[studentName]!['total'] ?? 0) + 1;
        if (status == 'present') {
          studentStats[studentName]!['present'] = (studentStats[studentName]!['present'] ?? 0) + 1;
        } else if (status == 'late') {
          studentStats[studentName]!['late'] = (studentStats[studentName]!['late'] ?? 0) + 1;
        } else if (status == 'absent') {
          studentStats[studentName]!['absent'] = (studentStats[studentName]!['absent'] ?? 0) + 1;
        }
      }
    }
    
    await PdfService.generateMonthlyReportPdf(
      className: _selectedClassName ?? 'Class',
      month: _selectedDate,
      totalLogs: logs.length,
      present: present,
      late: late,
      absent: absent,
      studentStats: studentStats,
    );
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Column(
          children: [
            // Fixed Header
            _buildHeader(),
            
            // Fixed Filters
            _buildFilters(),
            
            // Scrollable Results
            Expanded(
              child: _reportData == null
                  ? _buildEmptyState()
                  : SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(20),
                      child: _buildReportResults(),
                    ),
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildHeader() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.pop(context),
          ),
          const Text(
            'Attendance Reports',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const Spacer(),
          if (_reportData != null)
            ElevatedButton.icon(
              onPressed: _isExportingPdf ? null : _exportToPdf,
              icon: _isExportingPdf
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.picture_as_pdf, size: 18),
              label: Text(_isExportingPdf ? 'Wait...' : 'PDF'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEF4444),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
            ),
        ],
      ),
    );
  }
  
  Widget _buildFilters() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildClassSelector(),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _buildReportTypeButton('daily', 'Daily Report')),
              const SizedBox(width: 12),
              Expanded(child: _buildReportTypeButton('monthly', 'Monthly Report')),
            ],
          ),
          const SizedBox(height: 16),
          _buildDatePicker(),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isGenerating ? null : _generateReport,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4F46E5),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isGenerating
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text(
                      'Generate Report',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildClassSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Select Class',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            color: const Color(0xFFF8FAFC),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<int>(
              value: _selectedSectionId,
              isExpanded: true,
              hint: const Text('Select a class'),
              items: widget.classes.map((classData) {
                return DropdownMenuItem<int>(
                  value: classData['section_id'],
                  child: Text('${classData['class_name']} - ${classData['section_name']}'),
                );
              }).toList(),
              onChanged: (value) {
                setState(() {
                  _selectedSectionId = value;
                  final selected = widget.classes.firstWhere((c) => c['section_id'] == value);
                  _selectedClassName = '${selected['class_name']} - ${selected['section_name']}';
                  _reportData = null;
                });
              },
            ),
          ),
        ),
      ],
    );
  }
  
  Widget _buildReportTypeButton(String type, String label) {
    final isSelected = _selectedReportType == type;
    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedReportType = type;
          _reportData = null;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF4F46E5) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFFE2E8F0),
            width: 2,
          ),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: isSelected ? Colors.white : const Color(0xFF64748B),
            ),
          ),
        ),
      ),
    );
  }
  
  Widget _buildDatePicker() {
    return GestureDetector(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: _selectedDate,
          firstDate: DateTime(2020),
          lastDate: DateTime.now(),
          builder: (context, child) {
            return Theme(
              data: ThemeData.light().copyWith(
                colorScheme: const ColorScheme.light(
                  primary: Color(0xFF4F46E5),
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
          setState(() {
            _selectedDate = picked;
            _reportData = null;
          });
        }
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          color: const Color(0xFFF8FAFC),
        ),
        child: Row(
          children: [
            const Icon(Icons.calendar_today, color: Color(0xFF4F46E5), size: 20),
            const SizedBox(width: 12),
            Text(
              _selectedReportType == 'daily'
                  ? DateFormat('EEEE, MMM dd, yyyy').format(_selectedDate)
                  : DateFormat('MMMM yyyy').format(_selectedDate),
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
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
          Icon(Icons.analytics_outlined, size: 80, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          Text(
            'Select filters and generate report',
            style: TextStyle(fontSize: 16, color: Colors.grey.shade600),
          ),
        ],
      ),
    );
  }
  
  Widget _buildReportResults() {
    if (_selectedReportType == 'daily') {
      return _buildDailyReport();
    } else {
      return _buildMonthlyReport();
    }
  }
  
  Widget _buildDailyReport() {
    List logs = [];
    if (_reportData is List) {
      logs = _reportData as List;
    } else if (_reportData is Map) {
      logs = (_reportData as Map)['logs'] ?? [];
    }
    
    int present = 0, late = 0, absent = 0, total = logs.length;
    for (var log in logs) {
      if (log is Map) {
        final status = log['status']?.toString() ?? '';
        if (status == 'present') present++;
        else if (status == 'late') late++;
        else if (status == 'absent') absent++;
      }
    }
    
    double presentPercent = total > 0 ? (present / total * 100) : 0;
    double latePercent = total > 0 ? (late / total * 100) : 0;
    double absentPercent = total > 0 ? (absent / total * 100) : 0;
    double punctualityRate = (present + late) > 0 ? (present / (present + late) * 100) : 0;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Daily Report - ${DateFormat('MMM dd, yyyy').format(_selectedDate)}',
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 20),
        
        // Summary Cards
        Row(
          children: [
            Expanded(child: _buildSummaryCard('Total', total, const Color(0xFF6366F1), Icons.people)),
            const SizedBox(width: 12),
            Expanded(child: _buildSummaryCard('Present', present, const Color(0xFF10B981), Icons.check_circle)),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: _buildSummaryCard('Late', late, const Color(0xFFF59E0B), Icons.access_time)),
            const SizedBox(width: 12),
            Expanded(child: _buildSummaryCard('Absent', absent, const Color(0xFFEF4444), Icons.cancel)),
          ],
        ),
        const SizedBox(height: 24),
        
        // Pie Chart
        if (total > 0) ...[
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                const Text('Attendance Distribution', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 20),
                SizedBox(
                  height: 200,
                  child: PieChart(
                    PieChartData(
                      sectionsSpace: 2,
                      centerSpaceRadius: 50,
                      sections: [
                        PieChartSectionData(
                          value: present.toDouble(),
                          title: '${presentPercent.toStringAsFixed(0)}%',
                          color: const Color(0xFF10B981),
                          radius: 60,
                          titleStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                        if (late > 0)
                          PieChartSectionData(
                            value: late.toDouble(),
                            title: '${latePercent.toStringAsFixed(0)}%',
                            color: const Color(0xFFF59E0B),
                            radius: 60,
                            titleStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                        if (absent > 0)
                          PieChartSectionData(
                            value: absent.toDouble(),
                            title: '${absentPercent.toStringAsFixed(0)}%',
                            color: const Color(0xFFEF4444),
                            radius: 60,
                            titleStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _buildLegend('Present', const Color(0xFF10B981)),
                    const SizedBox(width: 16),
                    _buildLegend('Late', const Color(0xFFF59E0B)),
                    const SizedBox(width: 16),
                    _buildLegend('Absent', const Color(0xFFEF4444)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
        ],
        
        // Key Insights
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('📊 Key Insights', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              _buildInsightRow('Attendance Rate', '${presentPercent.toStringAsFixed(1)}%', const Color(0xFF10B981)),
              if (late > 0)
                _buildInsightRow('Punctuality Rate', '${punctualityRate.toStringAsFixed(1)}%', const Color(0xFF6366F1)),
              _buildInsightRow('Absenteeism Rate', '${absentPercent.toStringAsFixed(1)}%', const Color(0xFFEF4444)),
              const Divider(height: 24),
              _buildPerformanceIndicator(presentPercent),
            ],
          ),
        ),
        const SizedBox(height: 24),
        
        // Student Details
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('👥 Student Attendance Details', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              const Divider(),
              const SizedBox(height: 16),
              if (logs.isEmpty)
                const Center(child: Padding(padding: EdgeInsets.all(20), child: Text('No attendance data for this date')))
              else
                ...logs.map((log) {
                  if (log is Map<String, dynamic>) {
                    return _buildStudentRow(log);
                  }
                  return const SizedBox.shrink();
                }).toList(),
            ],
          ),
        ),
      ],
    );
  }
  
  Widget _buildMonthlyReport() {
    List logs = [];
    if (_reportData is Map<String, dynamic>) {
      final data = _reportData as Map<String, dynamic>;
      final logsData = data['logs'];
      if (logsData is List) {
        logs = logsData;
      }
    } else if (_reportData is List) {
      logs = _reportData as List;
    }
    
    int present = 0, late = 0, absent = 0;
    Map<String, Map<String, int>> studentStats = {};
    Map<String, int> dateStats = {};
    
    for (var log in logs) {
      if (log is Map) {
        final status = log['status']?.toString() ?? '';
        final studentName = log['student_name']?.toString() ?? log['full_name']?.toString() ?? 'Unknown';
        final date = log['date']?.toString() ?? '';
        
        if (status == 'present') present++;
        else if (status == 'late') late++;
        else if (status == 'absent') absent++;
        
        if (!studentStats.containsKey(studentName)) {
          studentStats[studentName] = {'present': 0, 'late': 0, 'absent': 0, 'total': 0};
        }
        studentStats[studentName]!['total'] = (studentStats[studentName]!['total'] ?? 0) + 1;
        if (status == 'present') {
          studentStats[studentName]!['present'] = (studentStats[studentName]!['present'] ?? 0) + 1;
        } else if (status == 'late') {
          studentStats[studentName]!['late'] = (studentStats[studentName]!['late'] ?? 0) + 1;
        } else if (status == 'absent') {
          studentStats[studentName]!['absent'] = (studentStats[studentName]!['absent'] ?? 0) + 1;
        }
        
        if (status == 'present' || status == 'late') {
          dateStats[date] = (dateStats[date] ?? 0) + 1;
        }
      }
    }
    
    int total = logs.length;
    int daysInMonth = DateTime(_selectedDate.year, _selectedDate.month + 1, 0).day;
    double classAverage = studentStats.isEmpty
        ? 0
        : studentStats.values.map((s) => (s['present']! + s['late']!) / s['total']! * 100).reduce((a, b) => a + b) / studentStats.length;
    
    List<String> atRisk = [];
    List<String> topPerformers = [];
    
    studentStats.forEach((name, stats) {
      double rate = (stats['present']! + stats['late']!) / stats['total']! * 100;
      if (rate < 75) {
        atRisk.add(name);
      } else if (rate >= 95) {
        topPerformers.add(name);
      }
    });
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Monthly Report - ${DateFormat('MMMM yyyy').format(_selectedDate)}',
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 20),
        
        // Summary Cards
        Row(
          children: [
            Expanded(child: _buildSummaryCard('Total Logs', total, const Color(0xFF6366F1), Icons.assignment)),
            const SizedBox(width: 12),
            Expanded(child: _buildSummaryCard('Present', present, const Color(0xFF10B981), Icons.check_circle)),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: _buildSummaryCard('Late', late, const Color(0xFFF59E0B), Icons.access_time)),
            const SizedBox(width: 12),
            Expanded(child: _buildSummaryCard('Absent', absent, const Color(0xFFEF4444), Icons.cancel)),
          ],
        ),
        const SizedBox(height: 24),
        
        // Class Insights
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('📊 Class Insights', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              _buildInsightRow('Class Average Attendance', '${classAverage.toStringAsFixed(1)}%', const Color(0xFF6366F1)),
              _buildInsightRow('Top Performers (≥95%)', '${topPerformers.length} students', const Color(0xFF10B981)),
              _buildInsightRow('Need Attention (<75%)', '${atRisk.length} students', const Color(0xFFEF4444)),
              _buildInsightRow('Total Students Tracked', '${studentStats.length} students', const Color(0xFF64748B)),
            ],
          ),
        ),
        const SizedBox(height: 24),
        
        // Student-wise Attendance Rate
        if (studentStats.isNotEmpty) ...[
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('👥 Student-wise Performance', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text('Individual attendance rates and ratings', style: TextStyle(fontSize: 14, color: Colors.grey.shade600)),
                const SizedBox(height: 16),
                const Divider(),
                const SizedBox(height: 16),
                ...studentStats.entries.map((entry) {
                  final name = entry.key;
                  final stats = entry.value;
                  final totalDays = stats['total'] ?? 0;
                  final presentDays = (stats['present'] ?? 0) + (stats['late'] ?? 0);
                  final percentage = totalDays > 0 ? (presentDays / totalDays * 100) : 0.0;
                  
                  return _buildStudentAttendanceRate(
                    name,
                    percentage,
                    stats['present'] ?? 0,
                    stats['late'] ?? 0,
                    stats['absent'] ?? 0,
                    totalDays,
                  );
                }).toList(),
              ],
            ),
          ),
        ],
      ],
    );
  }
  
  Widget _buildStudentAttendanceRate(String name, double percentage, int present, int late, int absent, int total) {
    Color rateColor = const Color(0xFF10B981);
    String rating = 'Excellent';
    if (percentage < 75) {
      rateColor = const Color(0xFFEF4444);
      rating = 'Poor - Needs Attention';
    } else if (percentage < 85) {
      rateColor = const Color(0xFFF59E0B);
      rating = 'Average';
    } else if (percentage < 95) {
      rateColor = const Color(0xFF10B981);
      rating = 'Good';
    }
    
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: rateColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: rateColor),
                ),
                child: Text(
                  '${percentage.toStringAsFixed(1)}%',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: rateColor),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: percentage / 100,
              backgroundColor: Colors.grey.shade200,
              color: rateColor,
              minHeight: 8,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _buildSmallStatChip('P: $present', const Color(0xFF10B981)),
              const SizedBox(width: 8),
              _buildSmallStatChip('L: $late', const Color(0xFFF59E0B)),
              const SizedBox(width: 8),
              _buildSmallStatChip('A: $absent', const Color(0xFFEF4444)),
              const SizedBox(width: 8),
              Text('Total: $total days', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
            ],
          ),
          const SizedBox(height: 4),
          Text('Rating: $rating', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: rateColor)),
        ],
      ),
    );
  }
  
  Widget _buildSmallStatChip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
    );
  }
  
  Widget _buildInsightRow(String label, String value, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 14, color: Color(0xFF64748B))),
          Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }
  
  Widget _buildPerformanceIndicator(double percentage) {
    String message = '';
    Color color = const Color(0xFF10B981);
    IconData icon = Icons.sentiment_very_satisfied;
    
    if (percentage >= 90) {
      message = '🎉 Excellent! Class attendance is outstanding';
      color = const Color(0xFF10B981);
      icon = Icons.sentiment_very_satisfied;
    } else if (percentage >= 75) {
      message = '👍 Good attendance. Keep it up!';
      color = const Color(0xFF6366F1);
      icon = Icons.sentiment_satisfied;
    } else if (percentage >= 60) {
      message = '⚠️ Average. Room for improvement';
      color = const Color(0xFFF59E0B);
      icon = Icons.sentiment_neutral;
    } else {
      message = '🚨 Poor attendance. Immediate action needed';
      color = const Color(0xFFEF4444);
      icon = Icons.sentiment_dissatisfied;
    }
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 32),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: color),
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildLegend(String label, Color color) {
    return Row(
      children: [
        Container(width: 12, height: 12, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }
  
  Widget _buildSummaryCard(String label, int value, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 28),
          const SizedBox(height: 8),
          Text(value.toString(), style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 4),
          Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
        ],
      ),
    );
  }
  
  Widget _buildStudentRow(Map<String, dynamic> log) {
    final status = log['status']?.toString() ?? '';
    Color statusColor = Colors.grey;
    if (status == 'present') statusColor = const Color(0xFF10B981);
    else if (status == 'late') statusColor = const Color(0xFFF59E0B);
    else if (status == 'absent') statusColor = const Color(0xFFEF4444);
    
    final checkInTime = log['check_in_time']?.toString() ?? '';
    
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  log['student_name']?.toString() ?? log['full_name']?.toString() ?? 'Unknown',
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                ),
                if (checkInTime.isNotEmpty)
                  Text('Check-in: $checkInTime', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: statusColor.withOpacity(0.1),
              border: Border.all(color: statusColor),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              status.toUpperCase(),
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: statusColor),
            ),
          ),
        ],
      ),
    );
  }
}
