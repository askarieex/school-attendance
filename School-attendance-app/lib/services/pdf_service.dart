git pushimport 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:intl/intl.dart';
import 'dart:io';
import 'package:path_provider/path_provider.dart';

/// PDF Service for generating professional attendance reports
class PdfService {
  /// Generate Daily Attendance Report PDF
  static Future<void> generateDailyReportPdf({
    required String className,
    required DateTime date,
    required int total,
    required int present,
    required int late,
    required int absent,
    required List<Map<String, dynamic>> students,
  }) async {
    final pdf = pw.Document();
    
    // Calculate percentages
    double presentPercent = total > 0 ? (present / total * 100) : 0;
    double latePercent = total > 0 ? (late / total * 100) : 0;
    double absentPercent = total > 0 ? (absent / total * 100) : 0;
    
    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(32),
        build: (context) => [
          // Header
          pw.Header(
            level: 0,
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  'Daily Attendance Report',
                  style: pw.TextStyle(
                    fontSize: 24,
                    fontWeight: pw.FontWeight.bold,
                    color: PdfColors.indigo700,
                  ),
                ),
                pw.SizedBox(height: 8),
                pw.Text(
                  className,
                  style: pw.TextStyle(
                    fontSize: 16,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.Text(
                  DateFormat('EEEE, MMMM dd, yyyy').format(date),
                  style: const pw.TextStyle(
                    fontSize: 14,
                    color: PdfColors.grey700,
                  ),
                ),
                pw.Divider(thickness: 2),
              ],
            ),
          ),
          
          pw.SizedBox(height: 20),
          
          // Summary Statistics
          pw.Text(
            'Attendance Summary',
            style: pw.TextStyle(
              fontSize: 18,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 12),
          
          pw.Table(
            border: pw.TableBorder.all(color: PdfColors.grey400),
            children: [
              // Header row
              pw.TableRow(
                decoration: const pw.BoxDecoration(color: PdfColors.grey300),
                children: [
                  _buildTableCell('Status', isHeader: true),
                  _buildTableCell('Count', isHeader: true),
                  _buildTableCell('Percentage', isHeader: true),
                ],
              ),
              // Data rows
              pw.TableRow(
                children: [
                  _buildTableCell('Total Students'),
                  _buildTableCell(total.toString()),
                  _buildTableCell('100%'),
                ],
              ),
              pw.TableRow(
                decoration: const pw.BoxDecoration(color: PdfColors.green50),
                children: [
                  _buildTableCell('Present', color: PdfColors.green700),
                  _buildTableCell(present.toString(), color: PdfColors.green700),
                  _buildTableCell('${presentPercent.toStringAsFixed(1)}%', color: PdfColors.green700),
                ],
              ),
              pw.TableRow(
                decoration: const pw.BoxDecoration(color: PdfColors.orange50),
                children: [
                  _buildTableCell('Late', color: PdfColors.orange700),
                  _buildTableCell(late.toString(), color: PdfColors.orange700),
                  _buildTableCell('${latePercent.toStringAsFixed(1)}%', color: PdfColors.orange700),
                ],
              ),
              pw.TableRow(
                decoration: const pw.BoxDecoration(color: PdfColors.red50),
                children: [
                  _buildTableCell('Absent', color: PdfColors.red700),
                  _buildTableCell(absent.toString(), color: PdfColors.red700),
                  _buildTableCell('${absentPercent.toStringAsFixed(1)}%', color: PdfColors.red700),
                ],
              ),
            ],
          ),
          
          pw.SizedBox(height: 30),
          
          // Student Details
          pw.Text(
            'Student Attendance Details',
            style: pw.TextStyle(
              fontSize: 18,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 12),
          
          pw.Table(
            border: pw.TableBorder.all(color: PdfColors.grey400),
            children: [
              // Header
              pw.TableRow(
                decoration: const pw.BoxDecoration(color: PdfColors.grey300),
                children: [
                  _buildTableCell('#', isHeader: true),
                  _buildTableCell('Student Name', isHeader: true),
                  _buildTableCell('Status', isHeader: true),
                  _buildTableCell('Check-in Time', isHeader: true),
                ],
              ),
              // Student rows
              ...students.asMap().entries.map((entry) {
                final index = entry.key;
                final student = entry.value;
                final status = student['status']?.toString() ?? '';
                final checkIn = student['check_in_time']?.toString() ?? '-';
                
                PdfColor statusColor = PdfColors.grey700;
                if (status == 'present') statusColor = PdfColors.green700;
                else if (status == 'late') statusColor = PdfColors.orange700;
                else if (status == 'absent') statusColor = PdfColors.red700;
                
                return pw.TableRow(
                  decoration: index % 2 == 0 
                      ? const pw.BoxDecoration(color: PdfColors.grey100)
                      : null,
                  children: [
                    _buildTableCell((index + 1).toString()),
                    _buildTableCell(
                      student['student_name']?.toString() ?? 
                      student['full_name']?.toString() ?? 
                      'Unknown'
                    ),
                    _buildTableCell(status.toUpperCase(), color: statusColor),
                    _buildTableCell(checkIn),
                  ],
                );
              }).toList(),
            ],
          ),
          
          pw.SizedBox(height: 30),
          
          // Insights
          pw.Text(
            'Key Insights',
            style: pw.TextStyle(
              fontSize: 18,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 12),
          
          pw.Bullet(
            text: 'Attendance Rate: ${presentPercent.toStringAsFixed(1)}%',
          ),
          if (late > 0)
            pw.Bullet(
              text: 'Punctuality Rate: ${((present / (present + late)) * 100).toStringAsFixed(1)}%',
            ),
          if (absent > 0)
            pw.Bullet(
              text: 'Absenteeism Rate: ${absentPercent.toStringAsFixed(1)}%',
            ),
        ],
        footer: (context) => pw.Container(
          alignment: pw.Alignment.centerRight,
          margin: const pw.EdgeInsets.only(top: 16),
          child: pw.Text(
            'Page ${context.pageNumber} of ${context.pagesCount}',
            style: const pw.TextStyle(color: PdfColors.grey600),
          ),
        ),
      ),
    );
    
    // Save or share PDF
    await Printing.layoutPdf(
      onLayout: (format) async => pdf.save(),
    );
  }
  
  /// Generate Monthly Attendance Report PDF
  static Future<void> generateMonthlyReportPdf({
    required String className,
    required DateTime month,
    required int totalLogs,
    required int present,
    required int late,
    required int absent,
    required Map<String, Map<String, int>> studentStats,
  }) async {
    final pdf = pw.Document();
    
    // Calculate class averages
    int totalDays = month.difference(DateTime(month.year, month.month, 1)).inDays;
    double classAverage = studentStats.isEmpty
        ? 0
        : studentStats.values
            .map((s) => (s['present']! + s['late']!) / s['total']! * 100)
            .reduce((a, b) => a + b) / studentStats.length;
    
    // Identify students needing attention
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
    
    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(32),
        build: (context) => [
          // Header
          pw.Header(
            level: 0,
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  'Monthly Attendance Report',
                  style: pw.TextStyle(
                    fontSize: 24,
                    fontWeight: pw.FontWeight.bold,
                    color: PdfColors.indigo700,
                  ),
                ),
                pw.SizedBox(height: 8),
                pw.Text(
                  className,
                  style: pw.TextStyle(
                    fontSize: 16,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.Text(
                  DateFormat('MMMM yyyy').format(month),
                  style: const pw.TextStyle(
                    fontSize: 14,
                    color: PdfColors.grey700,
                  ),
                ),
                pw.Divider(thickness: 2),
              ],
            ),
          ),
          
          pw.SizedBox(height: 20),
          
          // Overall Statistics
          pw.Text(
            'Overall Statistics',
            style: pw.TextStyle(
              fontSize: 18,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 12),
          
          pw.Table(
            border: pw.TableBorder.all(color: PdfColors.grey400),
            children: [
              pw.TableRow(
                decoration: const pw.BoxDecoration(color: PdfColors.grey300),
                children: [
                  _buildTableCell('Metric', isHeader: true),
                  _buildTableCell('Value', isHeader: true),
                ],
              ),
              pw.TableRow(
                children: [
                  _buildTableCell('Total Attendance Logs'),
                  _buildTableCell(totalLogs.toString()),
                ],
              ),
              pw.TableRow(
                children: [
                  _buildTableCell('Present'),
                  _buildTableCell('$present (${((present / totalLogs) * 100).toStringAsFixed(1)}%)', color: PdfColors.green700),
                ],
              ),
              pw.TableRow(
                children: [
                  _buildTableCell('Late'),
                  _buildTableCell('$late (${((late / totalLogs) * 100).toStringAsFixed(1)}%)', color: PdfColors.orange700),
                ],
              ),
              pw.TableRow(
                children: [
                  _buildTableCell('Absent'),
                  _buildTableCell('$absent (${((absent / totalLogs) * 100).toStringAsFixed(1)}%)', color: PdfColors.red700),
                ],
              ),
              pw.TableRow(
                children: [
                  _buildTableCell('Class Average Attendance'),
                  _buildTableCell('${classAverage.toStringAsFixed(1)}%'),
                ],
              ),
            ],
          ),
          
          pw.SizedBox(height: 30),
          
          // Student-wise Performance
          pw.Text(
            'Student-wise Attendance Rate',
            style: pw.TextStyle(
              fontSize: 18,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 12),
          
          pw.Table(
            border: pw.TableBorder.all(color: PdfColors.grey400),
            children: [
              pw.TableRow(
                decoration: const pw.BoxDecoration(color: PdfColors.grey300),
                children: [
                  _buildTableCell('Student Name', isHeader: true),
                  _buildTableCell('Present', isHeader: true),
                  _buildTableCell('Late', isHeader: true),
                  _buildTableCell('Absent', isHeader: true),
                  _buildTableCell('Rate', isHeader: true),
                  _buildTableCell('Rating', isHeader: true),
                ],
              ),
              ...studentStats.entries.map((entry) {
                final name = entry.key;
                final stats = entry.value;
                final rate = (stats['present']! + stats['late']!) / stats['total']! * 100;
                final rating = rate >= 95 ? 'Excellent' :
                              rate >= 85 ? 'Good' :
                              rate >= 75 ? 'Average' : 'Poor';
                
                PdfColor ratingColor = rate >= 85 
                    ? PdfColors.green700 
                    : rate >= 75 
                        ? PdfColors.orange700 
                        : PdfColors.red700;
                
                return pw.TableRow(
                  children: [
                    _buildTableCell(name),
                    _buildTableCell(stats['present'].toString()),
                    _buildTableCell(stats['late'].toString()),
                    _buildTableCell(stats['absent'].toString()),
                    _buildTableCell('${rate.toStringAsFixed(1)}%', color: ratingColor),
                    _buildTableCell(rating, color: ratingColor),
                  ],
                );
              }).toList(),
            ],
          ),
          
          pw.SizedBox(height: 30),
          
          // Insights & Recommendations
          pw.Text(
            'Insights & Recommendations',
            style: pw.TextStyle(
              fontSize: 18,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 12),
          
          if (topPerformers.isNotEmpty) ...[
            pw.Text(
              '✅ Top Performers (≥95% attendance):',
              style: pw.TextStyle(
                fontWeight: pw.FontWeight.bold,
                color: PdfColors.green700,
              ),
            ),
            ...topPerformers.map((name) => pw.Bullet(text: name)),
            pw.SizedBox(height: 12),
          ],
          
          if (atRisk.isNotEmpty) ...[
            pw.Text(
              '⚠️ Students Needing Attention (<75% attendance):',
              style: pw.TextStyle(
                fontWeight: pw.FontWeight.bold,
                color: PdfColors.red700,
              ),
            ),
            ...atRisk.map((name) => pw.Bullet(text: name)),
            pw.SizedBox(height: 12),
          ],
          
          pw.Bullet(
            text: 'Class Average: ${classAverage.toStringAsFixed(1)}%',
          ),
          pw.Bullet(
            text: 'Students with Excellent attendance: ${topPerformers.length}',
          ),
          pw.Bullet(
            text: 'Students requiring intervention: ${atRisk.length}',
          ),
        ],
        footer: (context) => pw.Container(
          alignment: pw.Alignment.centerRight,
          margin: const pw.EdgeInsets.only(top: 16),
          child: pw.Text(
            'Page ${context.pageNumber} of ${context.pagesCount} | Generated: ${DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now())}',
            style: const pw.TextStyle(color: PdfColors.grey600, fontSize: 10),
          ),
        ),
      ),
    );
    
    // Save or share PDF
    await Printing.layoutPdf(
      onLayout: (format) async => pdf.save(),
    );
  }
  
  static pw.Widget _buildTableCell(
    String text, {
    bool isHeader = false,
    PdfColor? color,
  }) {
    return pw.Padding(
      padding: const pw.EdgeInsets.all(8),
      child: pw.Text(
        text,
        style: pw.TextStyle(
          fontWeight: isHeader ? pw.FontWeight.bold : pw.FontWeight.normal,
          color: color ?? (isHeader ? PdfColors.black : PdfColors.grey800),
          fontSize: isHeader ? 12 : 10,
        ),
      ),
    );
  }
}
