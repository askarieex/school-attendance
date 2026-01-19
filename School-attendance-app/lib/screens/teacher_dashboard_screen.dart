import 'dart:ui';
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

      // ✅ CHANGED: Show ALL assigned classes (not just form teacher)
      // This allows teachers to see all classes they're assigned to

      // ✅ PERFORMANCE: Load attendance stats and dashboard stats IN PARALLEL
      await Future.wait([
        _loadAttendanceStats(assignments),  // Pass ALL assignments
        _loadDashboardStats(),
      ]);

      setState(() {
        _classes = assignments; // Show ALL assigned classes
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

    // Extract section IDs
    final sectionIds = classes
        .map((c) => c['section_id'] as int?)
        .where((id) => id != null)
        .cast<int>()
        .toList();

    if (sectionIds.isEmpty) return;

    try {
      // ✅ PERFORMANCE: Use BATCH API to fetch all stats in ONE request
      // This saves N API calls (where N = number of classes)
      final batchStats = await _teacherService.getBatchAttendanceStats(sectionIds);

      // Map batch response to local stats format
      batchStats.forEach((key, value) {
        final sectionId = int.tryParse(key);
        if (sectionId != null && value is Map) {
          stats[sectionId] = {
            'present': (value['present'] as int?) ?? 0,
            'late': (value['late'] as int?) ?? 0,
            'absent': (value['absent'] as int?) ?? 0,
          };
        }
      });
      
      // If batch API fails/returns empty (e.g. backend not updated), we might have 0 stats
      // but that's better than crashing.
      
    } catch (e) {
      // Fallback to zeros on error
      for (final id in sectionIds) {
        stats[id] = {'present': 0, 'late': 0, 'absent': 0};
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

  // Dashboard View - ✅ PREMIUM GLASSMORPHIC DESIGN (Refined)
  Widget _buildDashboardView() {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final attendancePercent = (_dashboardStats['attendancePercentage'] as num? ?? 0).toDouble();
    final presentCount = (_dashboardStats['presentToday'] ?? 0) + (_dashboardStats['lateToday'] ?? 0);
    final lateCount = _dashboardStats['lateToday'] ?? 0;
    final absentCount = _dashboardStats['absentToday'] ?? 0;
    final userName = authProvider.currentUser?.name ?? 'Teacher';

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FE),
      body: RefreshIndicator(
        onRefresh: _loadClasses,
        color: const Color(0xFF7C3AED),
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ══════════════════════════════════════════════════════════════
              // GRADIENT HEADER - CLEAN (No duplicate icons)
              // ══════════════════════════════════════════════════════════════
              Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF8B5CF6), Color(0xFF6366F1)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(32),
                    bottomRight: Radius.circular(32),
                  ),
                ),
                child: SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                    child: Row(
                      children: [
                        // Profile Avatar
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white.withOpacity(0.5), width: 2),
                            color: Colors.white.withOpacity(0.2),
                          ),
                          child: const Center(
                            child: Icon(Icons.person_rounded, color: Colors.white, size: 26),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Welcome back,',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Colors.white.withOpacity(0.85),
                                  letterSpacing: 0.3,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                userName,
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                  letterSpacing: -0.3,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // ══════════════════════════════════════════════════════════════
              // ATTENDANCE SUMMARY CARD
              // ══════════════════════════════════════════════════════════════
              Transform.translate(
                offset: const Offset(0, -24),
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 20),
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF8B5CF6).withOpacity(0.12),
                        blurRadius: 24,
                        offset: const Offset(0, 12),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      Text(
                        "Today's Attendance",
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey.shade600,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0.3,
                        ),
                      ),
                      const SizedBox(height: 16),
                      ShaderMask(
                        shaderCallback: (bounds) => const LinearGradient(
                          colors: [Color(0xFF8B5CF6), Color(0xFF6366F1)],
                        ).createShader(bounds),
                        child: Text(
                          '${attendancePercent.toInt()}%',
                          style: const TextStyle(
                            fontSize: 56,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                            height: 1,
                            letterSpacing: -2,
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      // Progress Bar
                      ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: LinearProgressIndicator(
                          value: attendancePercent / 100,
                          backgroundColor: Colors.grey.shade200,
                          valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF8B5CF6)),
                          minHeight: 8,
                        ),
                      ),
                      const SizedBox(height: 24),
                      // Stats Row
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _buildStatBadge('$presentCount', 'Present', const Color(0xFF10B981)),
                          _buildStatBadge('$absentCount', 'Absent', const Color(0xFFEF4444)),
                          _buildStatBadge('$lateCount', 'Late', const Color(0xFFF59E0B)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              // ══════════════════════════════════════════════════════════════
              // QUICK ACTIONS
              // ══════════════════════════════════════════════════════════════
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 0, 20, 16),
                child: Text(
                  'Quick Actions',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1F2937),
                    letterSpacing: -0.3,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    Expanded(
                      child: _buildQuickAction(
                        Icons.check_circle_outline_rounded,
                        'Mark Attendance',
                        'Quick check-in',
                        const Color(0xFF8B5CF6),
                        () => setState(() => _selectedIndex = 1),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: _buildQuickAction(
                        Icons.calendar_month_rounded,
                        'Calendar',
                        'Monthly view',
                        const Color(0xFF6366F1),
                        () => setState(() => _selectedIndex = 2),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    Expanded(
                      child: _buildQuickAction(
                        Icons.insert_chart_rounded,
                        'Reports',
                        'View analytics',
                        const Color(0xFF10B981),
                        () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ReportsScreen())),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: _buildQuickAction(
                        Icons.campaign_rounded,
                        'Send Alert',
                        'Notify parents',
                        const Color(0xFFEC4899),
                        () {},
                      ),
                    ),
                  ],
                ),
              ),

              // ══════════════════════════════════════════════════════════════
              // MY CLASSES - VERTICAL LIST
              // ══════════════════════════════════════════════════════════════
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 28, 20, 14),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'My Classes',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF1F2937),
                        letterSpacing: -0.3,
                      ),
                    ),
                    if (_classes.length > 3)
                      GestureDetector(
                        onTap: () => setState(() => _selectedIndex = 1),
                        child: Text(
                          'See All',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF8B5CF6),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              if (_classes.isEmpty)
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 20),
                  padding: const EdgeInsets.symmetric(vertical: 40),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Center(
                    child: Column(
                      children: [
                        Icon(Icons.school_outlined, size: 40, color: Colors.grey.shade400),
                        const SizedBox(height: 12),
                        Text('No classes assigned', style: TextStyle(color: Colors.grey.shade500)),
                      ],
                    ),
                  ),
                )
              else
                ...List.generate(
                  _classes.length > 3 ? 3 : _classes.length,
                  (index) => _buildClassListItem(_classes[index], index),
                ),

              // ══════════════════════════════════════════════════════════════
              // ATTENDANCE INSIGHTS CARD
              // ══════════════════════════════════════════════════════════════
              Container(
                margin: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.04),
                      blurRadius: 15,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEEF2FF),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(Icons.trending_up_rounded, color: Color(0xFF6366F1), size: 24),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Monthly Average',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF1F2937),
                                ),
                              ),
                              Text(
                                'January 2026',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Colors.grey.shade500,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          '${attendancePercent.toInt()}%',
                          style: const TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF6366F1),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Container(
                      height: 1,
                      color: Colors.grey.shade100,
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Best Day',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey.shade500,
                                ),
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                'Friday • 97%',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF1F2937),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Improvement',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey.shade500,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  const Icon(Icons.arrow_upward_rounded, color: Color(0xFF10B981), size: 16),
                                  const SizedBox(width: 4),
                                  const Text(
                                    '+3.2%',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF10B981),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // ══════════════════════════════════════════════════════════════
              // RECENT ACTIVITY
              // ══════════════════════════════════════════════════════════════
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 28, 20, 16),
                child: Text(
                  'Recent Activity',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1F2937),
                  ),
                ),
              ),
              _buildActivityItem(
                Icons.check_box_rounded,
                const Color(0xFF8B5CF6),
                'Attendance Marked',
                'You marked attendance for ${_classes.isNotEmpty ? "${_classes[0]['class_name']}-${_classes[0]['section_name']}" : "your class"}',
                'Today at 8:30 AM',
              ),
              _buildActivityItem(
                Icons.mail_rounded,
                const Color(0xFFEC4899),
                'Parent Notification Sent',
                'Absence alert sent to parents',
                'Today at 9:00 AM',
              ),
              _buildActivityItem(
                Icons.description_rounded,
                const Color(0xFF10B981),
                'Report Generated',
                'Monthly attendance report',
                'Yesterday at 4:15 PM',
              ),

              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPER WIDGETS - NEW PREMIUM DESIGN
  // ══════════════════════════════════════════════════════════════════════════

  Widget _buildStatBadge(String value, String label, Color color) {
    return Column(
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Center(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: Colors.grey.shade600,
          ),
        ),
      ],
    );
  }

  Widget _buildQuickAction(IconData icon, String title, String subtitle, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [color, color.withOpacity(0.8)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: Colors.white, size: 22),
            ),
            const SizedBox(height: 12),
            Text(
              title,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1F2937),
                letterSpacing: -0.2,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 11,
                color: Colors.grey.shade500,
                letterSpacing: 0.1,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildClassListItem(Map<String, dynamic> classData, int index) {
    final colors = [
      const Color(0xFF8B5CF6),
      const Color(0xFF10B981),
      const Color(0xFF3B82F6),
      const Color(0xFFF59E0B),
    ];
    final color = colors[index % colors.length];

    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => ClassAttendanceScreen(classData: classData)),
      ),
      child: Container(
        margin: const EdgeInsets.fromLTRB(20, 0, 20, 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            // Gradient Icon
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [color, color.withOpacity(0.7)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.school_rounded, color: Colors.white, size: 22),
            ),
            const SizedBox(width: 14),
            // Class Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${classData['class_name']}-${classData['section_name']}',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1F2937),
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(Icons.people_outline_rounded, size: 14, color: Colors.grey.shade500),
                      const SizedBox(width: 4),
                      Text(
                        '${classData['student_count'] ?? 0} Students',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade500,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            // Arrow
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: Color(0xFF9CA3AF)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActivityItem(IconData icon, Color color, String title, String subtitle, String time) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1F2937),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Text(
            time.split(' at ').last,
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey.shade400,
            ),
          ),
        ],
      ),
    );
  }

  // 💎 Premium Glass Card
  Widget _buildGlassCard() {
    return Container(
      height: 200,
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.9), // Higher opacity for cleaner look
        borderRadius: BorderRadius.circular(30),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF6366F1).withOpacity(0.2), // Soft Purple Shadow
            blurRadius: 30, // Big blur
            offset: const Offset(0, 15),
          ),
        ],
        border: Border.all(color: Colors.white, width: 2), // Clean white border
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Average Attendance',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF6B7280), // Medium Grey
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _getFormattedDate(),
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey.shade400,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5), // Light Green
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.trending_up, size: 16, color: Color(0xFF10B981)),
                    SizedBox(width: 6),
                    Text(
                      'Good',
                      style: TextStyle(
                        color: Color(0xFF10B981),
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Spacer(),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${_dashboardStats['attendancePercentage']}%',
                style: const TextStyle(
                  fontSize: 52, // HUGE
                  fontWeight: FontWeight.w900, // Black weight
                  color: Color(0xFF111827), // Almost Black
                  letterSpacing: -2.0,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Clean Progress Bar
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: LinearProgressIndicator(
              value: (_dashboardStats['attendancePercentage'] as num? ?? 0) / 100,
              backgroundColor: const Color(0xFFF3F4F6),
              valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF6366F1)), // Indigo
              minHeight: 10,
            ),
          ),
        ],
      ),
    );
  }

  // 💊 Premium Status Pill (Vertical)
  Widget _buildStatusPill(String label, String value, IconData icon, Color color, Color bgColor) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24), // Very rounded
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04), // Subtle shadow
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: bgColor, // Pastel background
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(height: 16),
          Text(
            value,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1F2937),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: Color(0xFF9CA3AF),
            ),
          ),
        ],
      ),
    );
  }
  
  // 🔘 Big Square Action Card
  Widget _buildBigActionCard(String label, IconData icon, Color color, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          height: 140, // Square-ish
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1), // Very light tint of the brand color
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: color.withOpacity(0.0), width: 0),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: color, size: 28),
              ),
              Text(
                label,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: color.withOpacity(0.8),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }


  // Helper Widget: Premium Class Card
  Widget _buildPremiumClassCard(Map<String, dynamic> classData) {
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ClassAttendanceScreen(classData: classData),
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
          border: Border.all(color: Colors.grey.withOpacity(0.1)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.class_rounded, color: Color(0xFF4F46E5), size: 28),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${classData['class_name']}-${classData['section_name']}',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1F2937),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.people_outline, size: 14, color: Color(0xFF6B7280)),
                      const SizedBox(width: 4),
                      Text(
                        '${classData['student_count'] ?? 0} Students',
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
            const CircleAvatar(
              backgroundColor: Color(0xFFF9FAFB),
              child: Icon(Icons.arrow_forward_ios_rounded, size: 16, color: Color(0xFF9CA3AF)),
            ),
          ],
        ),
      ),
    );
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
              color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFF9CA3AF),
              size: 24,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFF9CA3AF),
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Views Implementation
  Widget _buildClassesView() {
    return RefreshIndicator(
      onRefresh: _loadClasses,
      color: const Color(0xFF4F46E5),
      child: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF4F46E5)))
          : _classes.isEmpty
              ? _buildEmptyState()
              : ListView.builder(
                  padding: const EdgeInsets.all(20),
                  itemCount: _classes.length,
                  itemBuilder: (context, index) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 15),
                      child: _buildPremiumClassCard(_classes[index]),
                    );
                  },
                ),
    );
  }

  Widget _buildEmptyState() {
     return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFFF3F4F6),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.class_outlined, size: 48, color: Color(0xFF9CA3AF)),
            ),
            const SizedBox(height: 16),
            const Text(
              'No classes assigned',
              style: TextStyle(
                fontSize: 16,
                color: Color(0xFF6B7280),
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      );
  }

  Widget _buildCalendarView() {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    return AttendanceCalendarScreen(
      apiService: authProvider.apiService,
      classes: _classes,
    );
  }

  Widget _buildStudentsView() {
    return const Center(child: Text('All Students View'));
  }

  Widget _buildReportsView() {
    // Navigate immediately to reports screen
    WidgetsBinding.instance.addPostFrameCallback((_) {
       Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const ReportsScreen()),
      ).then((_) => setState(() => _selectedIndex = 0));
    });
    return const Center(child: CircularProgressIndicator());
  }

  Widget _buildSettingsView() {
     WidgetsBinding.instance.addPostFrameCallback((_) {
       Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const SettingsScreen()),
      ).then((_) => setState(() => _selectedIndex = 0));
    });
    return const Center(child: CircularProgressIndicator());
  }

  String _getFormattedDate() {
    final now = DateTime.now();
    final months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    final weekDays = [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    ];
    return '${weekDays[now.weekday - 1]}, ${now.day} ${months[now.month - 1]} ${now.year}';
  }
}

// 🌊 Modern Header Curve
class _ModernHeaderClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    var path = Path();
    path.lineTo(0, size.height - 60); // Start slightly higher

    // Smooth quadratic bezier curve
    var controlPoint = Offset(size.width / 2, size.height + 20); // Center, slightly below bottom
    var endPoint = Offset(size.width, size.height - 60);

    path.quadraticBezierTo(
      controlPoint.dx, controlPoint.dy,
      endPoint.dx, endPoint.dy,
    );

    path.lineTo(size.width, 0);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(CustomClipper<Path> oldClipper) => false;
}

