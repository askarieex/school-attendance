import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/teacher_service.dart';
import 'class_details_screen.dart';
import 'attendance_calendar_screen.dart';

/// Teacher Dashboard - Beautiful UI with Sidebar & Calendar
class TeacherDashboardScreen extends StatefulWidget {
  const TeacherDashboardScreen({super.key});

  @override
  State<TeacherDashboardScreen> createState() => _TeacherDashboardScreenState();
}

class _TeacherDashboardScreenState extends State<TeacherDashboardScreen> {
  late TeacherService _teacherService;
  List<Map<String, dynamic>> _classes = [];
  bool _isLoading = true;
  int _selectedIndex = 0; // 0=Dashboard, 1=Classes, 2=Calendar, 3=Students
  
  @override
  void initState() {
    super.initState();
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    _teacherService = TeacherService(authProvider.apiService);
    _loadClasses();
  }
  
  Future<void> _loadClasses() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (authProvider.currentUser?.id == null) return;
    
    setState(() => _isLoading = true);
    
    final assignments = await _teacherService.getTeacherAssignments(
      authProvider.currentUser!.id,
    );
    
    setState(() {
      _classes = assignments;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final schoolName = "Heritage School";

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(Icons.menu, color: Color(0xFF1F2937)),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        title: Row(
          children: [
            const Icon(Icons.school, color: Color(0xFFF59E0B), size: 20),
            const SizedBox(width: 8),
            Text(
              schoolName,
              style: const TextStyle(
                color: Color(0xFF1F2937),
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined, color: Color(0xFF6B7280)),
            onPressed: () {},
          ),
        ],
      ),
      drawer: _buildDrawer(context, authProvider),
      body: _buildBody(),
    );
  }

  Widget _buildDrawer(BuildContext context, AuthProvider authProvider) {
    return Drawer(
      child: Container(
        color: Colors.white,
        child: Column(
          children: [
            // Drawer Header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(20, 60, 20, 20),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFFF59E0B), Color(0xFFFB923C)],
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(30),
                    ),
                    child: const Icon(
                      Icons.school,
                      color: Color(0xFFF59E0B),
                      size: 32,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    authProvider.currentUser?.name ?? 'Teacher',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    authProvider.currentUser?.email ?? '',
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.9),
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
            
            // Menu Items
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: [
                  _buildDrawerItem(
                    icon: Icons.dashboard_outlined,
                    title: 'Dashboard',
                    index: 0,
                  ),
                  _buildDrawerItem(
                    icon: Icons.class_outlined,
                    title: 'My Classes',
                    index: 1,
                  ),
                  _buildDrawerItem(
                    icon: Icons.calendar_today_outlined,
                    title: 'Attendance Calendar',
                    index: 2,
                  ),
                  _buildDrawerItem(
                    icon: Icons.people_outline,
                    title: 'All Students',
                    index: 3,
                  ),
                  const Divider(),
                  _buildDrawerItem(
                    icon: Icons.bar_chart_outlined,
                    title: 'Reports',
                    index: 4,
                  ),
                  _buildDrawerItem(
                    icon: Icons.settings_outlined,
                    title: 'Settings',
                    index: 5,
                  ),
                ],
              ),
            ),
            
            // Logout
            Container(
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(color: Colors.grey.shade200),
                ),
              ),
              child: ListTile(
                leading: const Icon(Icons.logout, color: Color(0xFFEF4444)),
                title: const Text(
                  'Logout',
                  style: TextStyle(color: Color(0xFFEF4444)),
                ),
                onTap: () {
                  authProvider.logout();
                  Navigator.pushReplacementNamed(context, '/welcome');
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDrawerItem({
    required IconData icon,
    required String title,
    required int index,
  }) {
    final isSelected = _selectedIndex == index;
    
    return ListTile(
      leading: Icon(
        icon,
        color: isSelected ? const Color(0xFFF59E0B) : const Color(0xFF6B7280),
      ),
      title: Text(
        title,
        style: TextStyle(
          color: isSelected ? const Color(0xFFF59E0B) : const Color(0xFF1F2937),
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        ),
      ),
      selected: isSelected,
      selectedTileColor: const Color(0xFFF59E0B).withOpacity(0.1),
      onTap: () {
        setState(() => _selectedIndex = index);
        Navigator.pop(context); // Close drawer
      },
    );
  }

  Widget _buildBody() {
    switch (_selectedIndex) {
      case 0:
        return _buildDashboardView();
      case 1:
        return _buildClassesView();
      case 2:
        return _buildCalendarView();
      case 3:
        return _buildStudentsView();
      case 4:
        return _buildReportsView();
      case 5:
        return _buildSettingsView();
      default:
        return _buildDashboardView();
    }
  }

  // Dashboard View
  Widget _buildDashboardView() {
    final totalClasses = _classes.length;
    final totalStudents = _classes.fold<int>(
      0,
      (sum, c) => sum + (c['student_count'] as int? ?? 0),
    );

    return RefreshIndicator(
      onRefresh: _loadClasses,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Dashboard',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1F2937),
              ),
            ),
            const SizedBox(height: 20),
            
            // Stats Grid
            Row(
              children: [
                Expanded(
                  child: _buildStatCard(
                    icon: Icons.class_,
                    label: 'My Classes',
                    value: totalClasses.toString(),
                    color: const Color(0xFF2563EB),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildStatCard(
                    icon: Icons.people,
                    label: 'Total Students',
                    value: totalStudents.toString(),
                    color: const Color(0xFF10B981),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _buildStatCard(
                    icon: Icons.check_circle,
                    label: 'Present Today',
                    value: '0',
                    color: const Color(0xFF10B981),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildStatCard(
                    icon: Icons.pending,
                    label: 'Pending',
                    value: '0',
                    color: const Color(0xFFF59E0B),
                  ),
                ),
              ],
            ),
            
            const SizedBox(height: 32),
            
            // Quick Actions
            const Text(
              'Quick Actions',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1F2937),
              ),
            ),
            const SizedBox(height: 16),
            
            Row(
              children: [
                Expanded(
                  child: _buildActionButton(
                    icon: Icons.qr_code_scanner,
                    label: 'QR Scanner',
                    color: const Color(0xFF8B5CF6),
                    onTap: () {},
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildActionButton(
                    icon: Icons.campaign,
                    label: 'Broadcast',
                    color: const Color(0xFFF59E0B),
                    onTap: () {},
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // Classes View
  Widget _buildClassesView() {
    return RefreshIndicator(
      onRefresh: _loadClasses,
      child: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _classes.isEmpty
              ? const Center(child: Text('No classes assigned'))
              : ListView.builder(
                  padding: const EdgeInsets.all(20),
                  itemCount: _classes.length + 1,
                  itemBuilder: (context, index) {
                    if (index == 0) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'My Classes',
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1F2937),
                            ),
                          ),
                          const SizedBox(height: 20),
                        ],
                      );
                    }
                    
                    final classData = _classes[index - 1];
                    return _buildClassCard(classData);
                  },
                ),
    );
  }

  Widget _buildClassCard(Map<String, dynamic> classData) {
    final className = classData['class_name'] ?? '';
    final sectionName = classData['section_name'] ?? '';
    final subject = classData['subject'] ?? '';
    final studentCount = classData['student_count'] ?? 0;
    final isFormTeacher = classData['is_form_teacher'] == true;
    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 15,
            offset: const Offset(0, 2),
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
                builder: (context) => ClassDetailsScreen(
                  classData: classData,
                  apiService: authProvider.apiService,
                ),
              ),
            );
          },
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF2563EB), Color(0xFF3B82F6)],
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.class_, color: Colors.white, size: 24),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                '$className-$sectionName',
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF1F2937),
                                ),
                              ),
                              if (isFormTeacher) ...[
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF59E0B).withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text(
                                    'Form',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFFF59E0B),
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          Text(
                            '$subject • $studentCount Students',
                            style: const TextStyle(
                              fontSize: 14,
                              color: Color(0xFF6B7280),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.arrow_forward_ios, size: 16, color: Color(0xFF9CA3AF)),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    _buildMiniStat('0', 'Present', const Color(0xFF10B981)),
                    const SizedBox(width: 12),
                    _buildMiniStat('0', 'Late', const Color(0xFFF59E0B)),
                    const SizedBox(width: 12),
                    _buildMiniStat('0', 'Absent', const Color(0xFFEF4444)),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMiniStat(String value, String label, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Calendar View
  Widget _buildCalendarView() {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    
    return AttendanceCalendarScreen(
      apiService: authProvider.apiService,
      classes: _classes,
    );
  }

  // Students View
  Widget _buildStudentsView() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'All Students',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1F2937),
            ),
          ),
          const SizedBox(height: 20),
          
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Center(
              child: Column(
                children: [
                  Icon(Icons.people, size: 80, color: Color(0xFFE5E7EB)),
                  SizedBox(height: 16),
                  Text(
                    'Students List',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                  SizedBox(height: 8),
                  Text(
                    'Coming soon...',
                    style: TextStyle(color: Color(0xFF9CA3AF)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // Reports View
  Widget _buildReportsView() {
    return const Center(
      child: Text('Reports coming soon...'),
    );
  }

  // Settings View
  Widget _buildSettingsView() {
    return const Center(
      child: Text('Settings coming soon...'),
    );
  }

  Widget _buildStatCard({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 15,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color.withOpacity(0.1), color.withOpacity(0.15)],
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(height: 16),
          Text(
            value,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1F2937),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              color: Color(0xFF6B7280),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey.shade200),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: [
              Icon(icon, color: color, size: 32),
              const SizedBox(height: 12),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF1F2937),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
