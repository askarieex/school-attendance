import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/teacher_service.dart';
import 'class_attendance_screen.dart';
import 'attendance_calendar_screen.dart';
import 'attendance_filter_screen.dart';
import 'settings_screen.dart';
import 'reports_screen.dart';
import 'help_support_screen.dart';
import 'leave_management_screen.dart';
import '../widgets/modern_cards.dart' as cards;

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
  Map<int, Map<String, int>> _attendanceStats = {}; // sectionId -> {present, late, absent}

  // Dashboard stats
  Map<String, dynamic> _dashboardStats = {
    'totalStudents': 0,
    'boysCount': 0,
    'girlsCount': 0,
    'presentToday': 0,
    'lateToday': 0,
    'absentToday': 0,
    'leaveToday': 0,
    'notMarkedToday': 0,
    'attendancePercentage': 100,
  };

  @override
  void initState() {
    super.initState();
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    _teacherService = TeacherService(authProvider.apiService);
    _loadClasses();

    // ✅ NEW: Listen for session expiration and redirect to login
    authProvider.addListener(_checkSessionExpiration);
  }

  @override
  void dispose() {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    authProvider.removeListener(_checkSessionExpiration);
    super.dispose();
  }

  void _checkSessionExpiration() {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (authProvider.sessionExpired && mounted) {
      // Show message and navigate to login
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Your session has expired. Please login again.'),
          backgroundColor: Color(0xFFEF4444),
          duration: Duration(seconds: 3),
        ),
      );
      authProvider.clearSessionExpired();
      Navigator.of(context).pushNamedAndRemoveUntil('/welcome', (route) => false);
    }
  }

  Future<void> _loadClasses() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (authProvider.currentUser?.id == null) return;

    setState(() => _isLoading = true);

    // ✅ PERFORMANCE TRACKING: Measure load time
    final stopwatch = Stopwatch()..start();

    try {
      // ✅ FIX: Removed teacherId param - backend uses JWT token to identify teacher
      final assignments = await _teacherService.getTeacherAssignments();

      // ✅ FILTER: Show ONLY classes where teacher is FORM TEACHER
      final formTeacherClasses = assignments.where((assignment) {
        return assignment['is_form_teacher'] == true;
      }).toList();

      // Stats will be logged by individual functions

      // ✅ PERFORMANCE: Load attendance stats and dashboard stats IN PARALLEL
      await Future.wait([
        _loadAttendanceStats(formTeacherClasses),
        _loadDashboardStats(),
      ]);

      setState(() {
        _classes = formTeacherClasses; // Show ONLY form teacher classes
        _isLoading = false;
      });

      // Performance tracking done by individual functions
      stopwatch.stop();
    } catch (e) {
      setState(() => _isLoading = false);
      // Errors are handled by individual functions
    }
  }

  Future<void> _loadDashboardStats() async {
    try {
      final stats = await _teacherService.getDashboardStats();
      setState(() {
        _dashboardStats = stats;
      });
      // Stats logged by service
    } catch (e) {
      // Keep default zeros - error logged by service
    }
  }

  Future<void> _loadAttendanceStats(List<Map<String, dynamic>> classes) async {
    final stats = <int, Map<String, int>>{};

    // ✅ NOTE: Sunday stats handled by backend - returns zeros appropriately
    // No need for client-side Sunday check as caching and backend handle it efficiently

    for (final classData in classes) {
      final sectionId = classData['section_id'] as int?;
      if (sectionId == null) continue;

      try {
        final todayStats = await _teacherService.getTodayAttendanceStats(sectionId);
        stats[sectionId] = {
          'present': todayStats['presentCount'] ?? 0,
          'late': todayStats['lateCount'] ?? 0,
          'absent': todayStats['absentCount'] ?? 0,
        };
      } catch (e) {
        stats[sectionId] = {'present': 0, 'late': 0, 'absent': 0};
      }
    }

    _attendanceStats = stats;
  }

  @override
  Widget build(BuildContext context) {
    // ✅ CRITICAL FIX: Use listen: false to prevent unnecessary rebuilds
    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    return Scaffold(
      backgroundColor: Colors.white, // Pure white background
      body: SafeArea(
        child: Column(
          children: [
            // Simple Top Bar
            _buildSimpleTopBar(context),
            // Body Content
            Expanded(
              child: _buildBody(),
            ),
          ],
        ),
      ),
      drawer: _buildDrawer(context, authProvider),
      bottomNavigationBar: _buildBottomNavigation(),
    );
  }

  Widget _buildSimpleTopBar(BuildContext context) {
    // ✅ CRITICAL FIX: Use listen: false to prevent rebuilds
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final schoolName = authProvider.currentUser?.schoolName ?? 'School';

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(
          bottom: BorderSide(
            color: Color(0xFFE0E0E0),
            width: 1,
          ),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Row(
        children: [
          // Menu Icon - Simple black
          Builder(
            builder: (context) => GestureDetector(
              onTap: () => Scaffold.of(context).openDrawer(),
              child: const Icon(Icons.menu, color: Colors.black, size: 24),
            ),
          ),
          const SizedBox(width: 16),
          // School Name - Clean text only
          Expanded(
            child: Text(
              schoolName,
              style: const TextStyle(
                color: Colors.black,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
            ),
          ),
          // Academic Year - Simple text badge
          if (authProvider.currentUser?.currentAcademicYear != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF2B9AFF), // Brand blue
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                authProvider.currentUser!.currentAcademicYear!,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDashboardHeader(BuildContext context, AuthProvider authProvider) {
    final now = DateTime.now();
    final hour = now.hour;
    String greeting;
    if (hour < 12) {
      greeting = 'Good Morning';
    } else if (hour < 17) {
      greeting = 'Good Afternoon';
    } else {
      greeting = 'Good Evening';
    }
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // School Name Badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF6366F1).withOpacity(0.25),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.school_rounded,
                  color: Colors.white,
                  size: 16,
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'Heritage School',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.3,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        // Greeting and User Info
        Text(
          '$greeting 👋',
          style: const TextStyle(
            color: Color(0xFF64748B),
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          authProvider.currentUser?.name ?? 'Teacher',
          style: const TextStyle(
            color: Color(0xFF0F172A),
            fontSize: 28,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.8,
          ),
        ),
        const SizedBox(height: 20),
        // Date and Time Card
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: const Color(0xFFE9ECEF),
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.02),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0D6EFD).withOpacity(0.08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.calendar_today_rounded,
                  color: Color(0xFF0D6EFD),
                  size: 22,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _getFormattedDate(),
                      style: const TextStyle(
                        color: Color(0xFF212529),
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      _getFormattedTime(),
                      style: const TextStyle(
                        color: Color(0xFF6C757D),
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                decoration: BoxDecoration(
                  color: const Color(0xFF0D6EFD),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF0D6EFD).withOpacity(0.2),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: const Text(
                  'Today',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _getFormattedTime() {
    final now = DateTime.now();
    final hour = now.hour > 12 ? now.hour - 12 : now.hour;
    final minute = now.minute.toString().padLeft(2, '0');
    final period = now.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $period';
  }

  Widget _buildDrawer(BuildContext context, AuthProvider authProvider) {
    return Drawer(
      backgroundColor: Colors.white,
      child: Column(
        children: [
          // ✅ CLEAN Header - No gradients
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(20, 56, 20, 20),
            decoration: const BoxDecoration(
              color: Color(0xFF2B9AFF), // Brand blue
              border: Border(
                bottom: BorderSide(
                  color: Color(0xFFE0E0E0),
                  width: 1,
                ),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Simple Avatar
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.person,
                      color: Colors.black,
                      size: 32,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  authProvider.currentUser?.name ?? 'Teacher',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  authProvider.currentUser?.email ?? '',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),
            
          // Modern Menu Items
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              children: [
                _buildPremiumDrawerItem(
                  icon: Icons.dashboard_rounded,
                  title: 'Dashboard',
                  index: 0,
                  gradient: const LinearGradient(
                    colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                  ),
                ),
                const SizedBox(height: 8),
                _buildPremiumDrawerItem(
                  icon: Icons.school_rounded,
                  title: 'My Classes',
                  index: 1,
                  gradient: const LinearGradient(
                    colors: [Color(0xFF10B981), Color(0xFF059669)],
                  ),
                ),
                const SizedBox(height: 8),
                _buildPremiumDrawerItem(
                  icon: Icons.calendar_today_rounded,
                  title: 'Attendance Calendar',
                  index: 2,
                  gradient: const LinearGradient(
                    colors: [Color(0xFF3B82F6), Color(0xFF2563EB)],
                  ),
                ),
                const SizedBox(height: 8),
                _buildPremiumDrawerItem(
                  icon: Icons.people_alt_rounded,
                  title: 'All Students',
                  index: 3,
                  gradient: const LinearGradient(
                    colors: [Color(0xFFF59E0B), Color(0xFFD97706)],
                  ),
                ),
                
                const SizedBox(height: 24),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Text(
                    'QUICK LINKS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF64748B),
                      letterSpacing: 1.2,
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                _buildSimpleDrawerItem(
                  icon: Icons.calendar_month_outlined,
                  title: 'Leaves',
                  onTap: () {
                    Navigator.pop(context);
                    final authProvider = Provider.of<AuthProvider>(context, listen: false);
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => LeaveManagementScreen(
                          apiService: authProvider.apiService,
                          classes: _classes,
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 4),
                _buildSimpleDrawerItem(
                  icon: Icons.bar_chart_rounded,
                  title: 'Reports',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (context) => const ReportsScreen()),
                    );
                  },
                ),
                const SizedBox(height: 4),
                _buildSimpleDrawerItem(
                  icon: Icons.help_outline_rounded,
                  title: 'Help & Support',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (context) => const HelpSupportScreen()),
                    );
                  },
                ),
                const SizedBox(height: 4),
                _buildSimpleDrawerItem(
                  icon: Icons.settings_rounded,
                  title: 'Settings',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (context) => const SettingsScreen()),
                    );
                  },
                ),
              ],
            ),
          ),
            
          // ✅ CLEAN Logout Button
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              border: Border(
                top: BorderSide(
                  color: Color(0xFFE0E0E0),
                  width: 1,
                ),
              ),
            ),
            child: GestureDetector(
              onTap: () {
                authProvider.logout();
                Navigator.pushReplacementNamed(context, '/welcome');
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  color: Colors.red,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.logout,
                      color: Colors.white,
                      size: 20,
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Logout',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPremiumDrawerItem({
    required IconData icon,
    required String title,
    required int index,
    required Gradient gradient, // Keep for compatibility but ignore
  }) {
    final isSelected = _selectedIndex == index;

    return GestureDetector(
      onTap: () {
        setState(() => _selectedIndex = index);
        Navigator.pop(context);
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 4),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF2B9AFF) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              color: isSelected ? Colors.white : Colors.black,
              size: 22,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  color: isSelected ? Colors.white : Colors.black,
                  fontSize: 15,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSimpleDrawerItem({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 4),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Icon(
              icon,
              color: Colors.black,
              size: 20,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  color: Colors.black,
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            const Icon(
              Icons.chevron_right,
              color: Color(0xFF666666),
              size: 18,
            ),
          ],
        ),
      ),
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

  // Dashboard View - Modern Clean Design
  Widget _buildDashboardView() {
    // ✅ PERFORMANCE FIX: Use listen: false to prevent unnecessary rebuilds
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final totalClasses = _classes.length;
    final totalStudents = _classes.fold<int>(
      0,
      (sum, c) => sum + (c['student_count'] as int? ?? 0),
    );

    return RefreshIndicator(
      onRefresh: _loadClasses,
      color: const Color(0xFF6366F1),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Beautiful Gradient Header
            _buildModernDashboardHeader(context, authProvider),
            const SizedBox(height: 24),

            // Today's Overview Title
            const Text(
              'Today\'s Overview',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              _getFormattedDate(),
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: Color(0xFF64748B),
              ),
            ),
            const SizedBox(height: 18),

            // ✅ IMPROVED: Clickable Attendance Summary Card with gradient
            GestureDetector(
              onTap: () {
                final authProvider = Provider.of<AuthProvider>(context, listen: false);
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => AttendanceFilterScreen(
                      apiService: authProvider.apiService,
                      classes: _classes,
                    ),
                  ),
                );
              },
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF2B9AFF), Color(0xFF0D6EFD)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF2B9AFF).withOpacity(0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Attendance Rate',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Colors.white.withOpacity(0.9),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '${_dashboardStats['attendancePercentage']}',
                                style: const TextStyle(
                                  fontSize: 48,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white,
                                  letterSpacing: -2,
                                ),
                              ),
                              const Padding(
                                padding: EdgeInsets.only(bottom: 8, left: 2),
                                child: Text(
                                  '%',
                                  style: TextStyle(
                                    fontSize: 24,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.trending_up,
                          color: Color(0xFF2B9AFF),
                          size: 32,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Container(
                    height: 1,
                    color: Colors.white,
                  ),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildGradientMiniStat(
                        '${(_dashboardStats['presentToday'] ?? 0) + (_dashboardStats['lateToday'] ?? 0)}',  // ✅ FIX: Combine present + late
                        'Present',
                        Icons.check_circle,
                      ),
                      Container(
                        width: 1,
                        height: 40,
                        color: Colors.white,
                      ),
                      _buildGradientMiniStat(
                        '${_dashboardStats['lateToday']}',
                        'Late',
                        Icons.access_time,
                      ),
                      Container(
                        width: 1,
                        height: 40,
                        color: Colors.white,
                      ),
                      _buildGradientMiniStat(
                        '${_dashboardStats['absentToday']}',
                        'Absent',
                        Icons.cancel,
                      ),
                    ],
                  ),

                ],
              ),
              ),
            ),

            const SizedBox(height: 20),

            // Student Statistics Grid
            const Text(
              'Student Statistics',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 16),

            Row(
              children: [
                Expanded(
                  child: _buildBeautifulStatCard(
                    icon: Icons.groups_rounded,
                    label: 'Total Students',
                    value: '${_dashboardStats['totalStudents']}',
                    color: const Color(0xFF00B4D8),
                    gradient: const LinearGradient(
                      colors: [Color(0xFF00B4D8), Color(0xFF0077B6)],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildBeautifulStatCard(
                    icon: Icons.school_rounded,
                    label: 'My Classes',
                    value: '$totalClasses',
                    color: const Color(0xFF6366F1),
                    gradient: const LinearGradient(
                      colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildBeautifulStatCard(
                    icon: Icons.male_rounded,
                    label: 'Boys',
                    value: '${_dashboardStats['boysCount']}',
                    color: const Color(0xFF3B82F6),
                    gradient: const LinearGradient(
                      colors: [Color(0xFF3B82F6), Color(0xFF2563EB)],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildBeautifulStatCard(
                    icon: Icons.female_rounded,
                    label: 'Girls',
                    value: '${_dashboardStats['girlsCount']}',
                    color: const Color(0xFFFF2D55),
                    gradient: const LinearGradient(
                      colors: [Color(0xFFFF2D55), Color(0xFFFF3B30)],
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 20),

            // Additional Stats Row
            Row(
              children: [
                Expanded(
                  child: _buildBeautifulStatCard(
                    icon: Icons.event_busy_rounded,
                    label: 'On Leave',
                    value: '${_dashboardStats['leaveToday']}',
                    color: const Color(0xFFAF52DE),
                    gradient: const LinearGradient(
                      colors: [Color(0xFFAF52DE), Color(0xFF8B5CF6)],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildBeautifulStatCard(
                    icon: Icons.pending_outlined,
                    label: 'Not Marked',
                    value: '${_dashboardStats['notMarkedToday']}',
                    color: const Color(0xFF8E8E93),
                    gradient: const LinearGradient(
                      colors: [Color(0xFF8E8E93), Color(0xFF636366)],
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 32),

            // Quick Actions Section
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Quick Actions',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.5,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            
            // Vertical list of action cards like reference
            cards.buildModernActionCard(
              icon: Icons.qr_code_scanner,
              label: 'QR Scanner',
              subtitle: 'Scan student ID',
              gradient: const LinearGradient(
                colors: [Color(0xFF00B4D8), Color(0xFF0077B6)],
              ),
              onTap: () {},
            ),
            const SizedBox(height: 12),
            cards.buildModernActionCard(
              icon: Icons.filter_list_rounded,
              label: 'Filter Students',
              subtitle: 'View by status (Present/Absent/Late/Leave)',
              gradient: const LinearGradient(
                colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
              ),
              onTap: () {
                final authProvider = Provider.of<AuthProvider>(context, listen: false);
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => AttendanceFilterScreen(
                      apiService: authProvider.apiService,
                      classes: _classes,
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 12),
            cards.buildModernActionCard(
              icon: Icons.edit_note,
              label: 'Mark Attendance',
              subtitle: 'Manual entry',
              gradient: const LinearGradient(
                colors: [Color(0xFF10B981), Color(0xFF059669)],
              ),
              onTap: () {
                setState(() => _selectedIndex = 1);
              },
            ),
            const SizedBox(height: 12),
            cards.buildModernActionCard(
              icon: Icons.analytics_outlined,
              label: 'Reports',
              subtitle: 'View analytics',
              gradient: const LinearGradient(
                colors: [Color(0xFF3B82F6), Color(0xFF2563EB)],
              ),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const ReportsScreen()),
                );
              },
            ),
            const SizedBox(height: 12),
            cards.buildModernActionCard(
              icon: Icons.campaign_outlined,
              label: 'Broadcast',
              subtitle: 'Send message',
              gradient: const LinearGradient(
                colors: [Color(0xFFF59E0B), Color(0xFFF97316)],
              ),
              onTap: () {},
            ),
            const SizedBox(height: 12),
            cards.buildModernActionCard(
              icon: Icons.event_available,
              label: 'Leave Management',
              subtitle: 'Mark student leaves',
              gradient: const LinearGradient(
                colors: [Color(0xFFAF52DE), Color(0xFF8B5CF6)],
              ),
              onTap: () {
                final authProvider = Provider.of<AuthProvider>(context, listen: false);
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => LeaveManagementScreen(
                      apiService: authProvider.apiService,
                      classes: _classes,
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 12),
            cards.buildModernActionCard(
              icon: Icons.people_alt_outlined,
              label: 'Student List',
              subtitle: 'View all students',
              gradient: const LinearGradient(
                colors: [Color(0xFF007AFF), Color(0xFF5E5CE6)],
              ),
              onTap: () {
                setState(() => _selectedIndex = 3);
              },
            ),
            const SizedBox(height: 12),
            cards.buildModernActionCard(
              icon: Icons.calendar_month,
              label: 'Attendance Calendar',
              subtitle: 'Monthly overview',
              gradient: const LinearGradient(
                colors: [Color(0xFF34C759), Color(0xFF30D158)],
              ),
              onTap: () {
                setState(() => _selectedIndex = 2);
              },
            ),
            const SizedBox(height: 12),
            cards.buildModernActionCard(
              icon: Icons.assignment_outlined,
              label: 'Assignments',
              subtitle: 'Create & manage',
              gradient: const LinearGradient(
                colors: [Color(0xFFFF9500), Color(0xFFFF6B00)],
              ),
              onTap: () {},
            ),
            const SizedBox(height: 12),
            cards.buildModernActionCard(
              icon: Icons.grade_outlined,
              label: 'Grades & Results',
              subtitle: 'View performance',
              gradient: const LinearGradient(
                colors: [Color(0xFFFF2D55), Color(0xFFFF3B30)],
              ),
              onTap: () {},
            ),
            
            const SizedBox(height: 36),
            
            // My Classes Section
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'My Classes',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1C1C1E),
                  ),
                ),
                TextButton(
                  onPressed: () {
                    setState(() => _selectedIndex = 1);
                  },
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFF007AFF),
                    padding: EdgeInsets.zero,
                  ),
                  child: const Text(
                    'See All',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            
            if (_classes.isEmpty)
              cards.buildEmptyClassesCard()
            else
              ..._classes.take(2).map((classData) {
                final className = classData['class_name'] ?? '';
                final sectionName = classData['section_name'] ?? '';
                final subject = classData['subject'] ?? '';
                final studentCount = classData['student_count'] ?? 0;
                
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: cards.buildMiniClassCard(
                    className: className,
                    sectionName: sectionName,
                    subject: subject,
                    studentCount: studentCount,
                    onTap: () {
                      final authProvider = Provider.of<AuthProvider>(context, listen: false);
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                                            builder: (context) => ClassAttendanceScreen(
                                              classData: classData,
                                            ),
                          
                        ),
                      );
                    },
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }

  String _getFormattedDate() {
    final now = DateTime.now();
    final days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${days[now.weekday - 1]}, ${months[now.month - 1]} ${now.day}';
  }

  Widget _buildBottomNavigation() {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(
          top: BorderSide(
            color: Color(0xFFE0E0E0),
            width: 1,
          ),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildNavItem(
            icon: Icons.home,
            label: 'Home',
            index: 0,
          ),
          _buildNavItem(
            icon: Icons.school,
            label: 'Classes',
            index: 1,
          ),
          _buildNavItem(
            icon: Icons.calendar_today,
            label: 'Calendar',
            index: 2,
          ),
          _buildNavItem(
            icon: Icons.people,
            label: 'Students',
            index: 3,
          ),
        ],
      ),
    );
  }

  Widget _buildNavItem({
    required IconData icon,
    required String label,
    required int index,
  }) {
    final isSelected = _selectedIndex == index;

    return GestureDetector(
      onTap: () => setState(() => _selectedIndex = index),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: isSelected ? const Color(0xFF2B9AFF) : Colors.black, // Brand blue when selected
              size: 24,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? const Color(0xFF2B9AFF) : const Color(0xFF666666),
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
              ),
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
      color: const Color(0xFF6366F1),
      child: _isLoading
          ? const Center(
              child: CircularProgressIndicator(
                color: Color(0xFF6366F1),
              ),
            )
          : _classes.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Icon(
                          Icons.school_outlined,
                          size: 64,
                          color: Color(0xFF94A3B8),
                        ),
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'No classes assigned',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                  itemCount: _classes.length + 1,
                  itemBuilder: (context, index) {
                    if (index == 0) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'My Classes',
                            style: TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF0F172A),
                              letterSpacing: -0.8,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '${_classes.length} ${_classes.length == 1 ? 'class' : 'classes'} assigned',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w500,
                              color: Color(0xFF64748B),
                            ),
                          ),
                          const SizedBox(height: 24),
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

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: const Color(0xFFE0E0E0),
          width: 1,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => ClassAttendanceScreen(
                  classData: classData,
                ),
              ),
            );
          },
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    // Simple icon
                    const Icon(Icons.school, color: Colors.black, size: 24),
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
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF0F172A),
                                  letterSpacing: -0.5,
                                ),
                              ),
                              if (isFormTeacher) ...[
                                const SizedBox(width: 10),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 5,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF2B9AFF), // Brand blue
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: const Text(
                                    'Form',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '$subject • $studentCount Students',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.arrow_forward_ios_rounded,
                        size: 16,
                        color: Color(0xFF94A3B8),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    _buildMiniStat(
                      (_attendanceStats[classData['section_id']]?['present'] ?? 0).toString(),
                      'Present',
                      const Color(0xFF10B981),
                    ),
                    const SizedBox(width: 10),
                    _buildMiniStat(
                      (_attendanceStats[classData['section_id']]?['late'] ?? 0).toString(),
                      'Late',
                      const Color(0xFFF59E0B),
                    ),
                    const SizedBox(width: 10),
                    _buildMiniStat(
                      (_attendanceStats[classData['section_id']]?['absent'] ?? 0).toString(),
                      'Absent',
                      const Color(0xFFEF4444),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ✅ CLEAN Mini stat - No opacity effects
  Widget _buildMiniStat(String value, String label, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: const Color(0xFFE0E0E0),
            width: 1,
          ),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: Colors.black,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: Color(0xFF666666),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Clean Dashboard Header
  Widget _buildModernDashboardHeader(BuildContext context, AuthProvider authProvider) {
    final now = DateTime.now();
    final hour = now.hour;
    String greeting;
    if (hour < 12) {
      greeting = 'Good Morning';
    } else if (hour < 17) {
      greeting = 'Good Afternoon';
    } else {
      greeting = 'Good Evening';
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          greeting,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: Color(0xFF666666),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          authProvider.currentUser?.name ?? 'Teacher',
          style: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w700,
            color: Colors.black,
          ),
        ),
      ],
    );
  }

  // Clean Simple Stat Card
  Widget _buildBeautifulStatCard({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
    required Gradient gradient, // Keep for compatibility but won't use
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: const Color(0xFFE0E0E0),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Simple icon - black or brand blue
          Icon(
            icon,
            color: color == const Color(0xFF2B9AFF) ? const Color(0xFF2B9AFF) : Colors.black,
            size: 24,
          ),
          const SizedBox(height: 12),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: Color(0xFF666666),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w700,
              color: Colors.black,
            ),
          ),
        ],
      ),
    );
  }

  // ✅ CLEAN Mini stat for attendance card
  Widget _buildGradientMiniStat(String value, String label, IconData icon) {
    return Column(
      children: [
        Icon(
          icon,
          color: Colors.white,
          size: 24,
        ),
        const SizedBox(height: 8),
        Text(
          value,
          style: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
      ],
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

  // Reports View - Navigate to Reports Screen
  Widget _buildReportsView() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const ReportsScreen()),
      );
      setState(() => _selectedIndex = 0);
    });
    return const Center(child: CircularProgressIndicator());
  }

  // Settings View - Navigate to Settings Screen
  Widget _buildSettingsView() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const SettingsScreen()),
      );
      setState(() => _selectedIndex = 0);
    });
    return const Center(child: CircularProgressIndicator());
  }

}
