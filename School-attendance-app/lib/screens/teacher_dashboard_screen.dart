import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/teacher_service.dart';
import 'class_attendance_screen.dart';
import 'attendance_calendar_screen.dart';
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
  }

  Future<void> _loadClasses() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (authProvider.currentUser?.id == null) return;

    setState(() => _isLoading = true);

    final assignments = await _teacherService.getTeacherAssignments(
      authProvider.currentUser!.id,
    );

    // ✅ FILTER: Show ONLY classes where teacher is FORM TEACHER
    final formTeacherClasses = assignments.where((assignment) {
      return assignment['is_form_teacher'] == true;
    }).toList();

    print('📚 Total assignments: ${assignments.length}');
    print('📚 Form teacher classes: ${formTeacherClasses.length}');

    // ✅ Load today's attendance stats for each class
    await _loadAttendanceStats(formTeacherClasses);

    // ✅ Load comprehensive dashboard stats
    await _loadDashboardStats();

    setState(() {
      _classes = formTeacherClasses; // Show ONLY form teacher classes
      _isLoading = false;
    });
  }

  Future<void> _loadDashboardStats() async {
    try {
      final stats = await _teacherService.getDashboardStats();
      setState(() {
        _dashboardStats = stats;
      });
      print('📊 Dashboard stats loaded: $_dashboardStats');
    } catch (e) {
      print('⚠️ Failed to load dashboard stats: $e');
      // Keep default zeros
    }
  }

  Future<void> _loadAttendanceStats(List<Map<String, dynamic>> classes) async {
    final stats = <int, Map<String, int>>{};

    // ✅ CHECK: Don't load stats on Sunday
    final today = DateTime.now();
    if (today.weekday == DateTime.sunday) {
      print('📊 Skipping attendance stats - today is Sunday');
      // Set all stats to 0 on Sunday
      for (final classData in classes) {
        final sectionId = classData['section_id'] as int?;
        if (sectionId != null) {
          stats[sectionId] = {'present': 0, 'late': 0, 'absent': 0};
        }
      }
      _attendanceStats = stats;
      return;
    }

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
        print('📊 Section $sectionId stats: ${stats[sectionId]}');
      } catch (e) {
        print('⚠️ Failed to load stats for section $sectionId: $e');
        stats[sectionId] = {'present': 0, 'late': 0, 'absent': 0};
      }
    }

    _attendanceStats = stats;
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final schoolName = "Heritage School";

    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFA),
      body: SafeArea(
        child: Column(
          children: [
            // Simple Top Bar (menu + notification)
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
    final authProvider = Provider.of<AuthProvider>(context);
    final schoolName = authProvider.currentUser?.schoolName ?? 'School';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
      child: Row(
        children: [
          Builder(
            builder: (context) => InkWell(
              onTap: () => Scaffold.of(context).openDrawer(),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: const Color(0xFFE2E8F0),
                    width: 1,
                  ),
                ),
                child: const Icon(Icons.menu_rounded, color: Color(0xFF0F172A), size: 20),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                    ),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.school_rounded,
                    color: Colors.white,
                    size: 14,
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  schoolName,
                  style: const TextStyle(
                    color: Color(0xFF0F172A),
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.2,
                  ),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: const Color(0xFFE2E8F0),
                width: 1,
              ),
            ),
            child: const Icon(Icons.notifications_none_rounded, color: Color(0xFF0F172A), size: 20),
          ),
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
          // Modern Gradient Header
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(24, 56, 24, 24),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Modern Avatar
                Container(
                  width: 70,
                  height: 70,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.15),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.person_rounded,
                      color: Color(0xFF6366F1),
                      size: 38,
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  authProvider.currentUser?.name ?? 'Teacher',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  authProvider.currentUser?.email ?? '',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.85),
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
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
            
          // Modern Logout Button
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              border: Border(
                top: BorderSide(
                  color: const Color(0xFFE2E8F0),
                  width: 1.5,
                ),
              ),
            ),
            child: InkWell(
              onTap: () {
                authProvider.logout();
                Navigator.pushReplacementNamed(context, '/welcome');
              },
              borderRadius: BorderRadius.circular(14),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFEF4444), Color(0xFFDC2626)],
                  ),
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFEF4444).withOpacity(0.25),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.logout_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
                    SizedBox(width: 10),
                    Text(
                      'Logout',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
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
    required Gradient gradient,
  }) {
    final isSelected = _selectedIndex == index;
    
    return InkWell(
      onTap: () {
        setState(() => _selectedIndex = index);
        Navigator.pop(context);
      },
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          gradient: isSelected ? gradient : null,
          color: isSelected ? null : Colors.transparent,
          borderRadius: BorderRadius.circular(14),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: const Color(0xFF6366F1).withOpacity(0.2),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                color: isSelected ? Colors.white.withOpacity(0.2) : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(
                icon,
                color: isSelected ? Colors.white : const Color(0xFF64748B),
                size: 20,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  color: isSelected ? Colors.white : const Color(0xFF475569),
                  fontSize: 15,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                ),
              ),
            ),
            if (isSelected)
              Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
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
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                icon,
                color: const Color(0xFF64748B),
                size: 18,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  color: Color(0xFF475569),
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              color: const Color(0xFFCBD5E1),
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
    final authProvider = Provider.of<AuthProvider>(context);
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

            // Attendance Summary Card with Gradient
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF6366F1).withOpacity(0.3),
                    blurRadius: 24,
                    offset: const Offset(0, 8),
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
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Icon(
                          Icons.trending_up_rounded,
                          color: Colors.white,
                          size: 36,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Container(
                    height: 1,
                    color: Colors.white.withOpacity(0.2),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildGradientMiniStat(
                        '${(_dashboardStats['presentToday'] ?? 0) + (_dashboardStats['lateToday'] ?? 0)}',  // ✅ FIX: Combine present + late
                        'Present',
                        Icons.check_circle_rounded,
                      ),
                      Container(
                        width: 1,
                        height: 40,
                        color: Colors.white.withOpacity(0.2),
                      ),
                      _buildGradientMiniStat(
                        '${_dashboardStats['lateToday']}',
                        'Late',
                        Icons.access_time_rounded,
                      ),
                      Container(
                        width: 1,
                        height: 40,
                        color: Colors.white.withOpacity(0.2),
                      ),
                      _buildGradientMiniStat(
                        '${_dashboardStats['absentToday']}',
                        'Absent',
                        Icons.cancel_rounded,
                      ),
                    ],
                  ),

                ],
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
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 28),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: const Color(0xFFE2E8F0),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF6366F1).withOpacity(0.15),
            blurRadius: 40,
            offset: const Offset(0, 12),
            spreadRadius: -4,
          ),
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(
                icon: Icons.home_rounded,
                label: 'Home',
                index: 0,
              ),
              _buildNavItem(
                icon: Icons.school_rounded,
                label: 'Classes',
                index: 1,
              ),
              _buildNavItem(
                icon: Icons.calendar_today_rounded,
                label: 'Calendar',
                index: 2,
              ),
              _buildNavItem(
                icon: Icons.people_alt_rounded,
                label: 'Students',
                index: 3,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem({
    required IconData icon,
    required String label,
    required int index,
  }) {
    final isSelected = _selectedIndex == index;
    
    return TweenAnimationBuilder<double>(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOutCubic,
      tween: Tween(begin: 1.0, end: isSelected ? 1.0 : 1.0),
      builder: (context, scale, child) {
        return Transform.scale(
          scale: scale,
          child: GestureDetector(
            onTapDown: (_) {},
            onTapUp: (_) => setState(() => _selectedIndex = index),
            onTapCancel: () {},
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOutCubic,
              padding: EdgeInsets.symmetric(
                horizontal: isSelected ? 22 : 10,
                vertical: 14,
              ),
              decoration: BoxDecoration(
                gradient: isSelected 
                  ? const LinearGradient(
                      colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    )
                  : null,
                color: isSelected ? null : Colors.transparent,
                borderRadius: BorderRadius.circular(20),
                boxShadow: isSelected ? [
                  BoxShadow(
                    color: const Color(0xFF6366F1).withOpacity(0.4),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                    spreadRadius: -2,
                  ),
                ] : [],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    curve: Curves.easeOutCubic,
                    child: Icon(
                      icon,
                      color: isSelected ? Colors.white : const Color(0xFF94A3B8),
                      size: isSelected ? 25 : 24,
                    ),
                  ),
                  AnimatedSize(
                    duration: const Duration(milliseconds: 200),
                    curve: Curves.easeOutCubic,
                    child: isSelected
                      ? Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const SizedBox(width: 10),
                            Text(
                              label,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.2,
                              ),
                            ),
                          ],
                        )
                      : const SizedBox.shrink(),
                  ),
                ],
              ),
            ),
          ),
        );
      },
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
    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    return Container(
      margin: const EdgeInsets.only(bottom: 18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: const Color(0xFFE2E8F0),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF6366F1).withOpacity(0.06),
            blurRadius: 20,
            offset: const Offset(0, 8),
            spreadRadius: -4,
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
                                      builder: (context) => ClassAttendanceScreen(
                                        classData: classData,
                                      ),
                                    ),
                                  );
            
          },
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF6366F1).withOpacity(0.3),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: const Icon(Icons.school_rounded, color: Colors.white, size: 26),
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
                                    gradient: const LinearGradient(
                                      colors: [Color(0xFFF59E0B), Color(0xFFD97706)],
                                    ),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Text(
                                    'Form',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white,
                                      letterSpacing: 0.5,
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

  Widget _buildMiniStat(String value, String label, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: color.withOpacity(0.2),
            width: 1,
          ),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: color,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: color.withOpacity(0.8),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Modern Dashboard Header with Gradient
  Widget _buildModernDashboardHeader(BuildContext context, AuthProvider authProvider) {
    final now = DateTime.now();
    final hour = now.hour;
    String greeting;
    String emoji;
    if (hour < 12) {
      greeting = 'Good Morning';
      emoji = '☀️';
    } else if (hour < 17) {
      greeting = 'Good Afternoon';
      emoji = '🌤️';
    } else {
      greeting = 'Good Evening';
      emoji = '🌙';
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              greeting,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Color(0xFF64748B),
              ),
            ),
            const SizedBox(width: 6),
            Text(
              emoji,
              style: const TextStyle(fontSize: 20),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          authProvider.currentUser?.name ?? 'Teacher',
          style: const TextStyle(
            fontSize: 32,
            fontWeight: FontWeight.w900,
            color: Color(0xFF0F172A),
            letterSpacing: -1,
          ),
        ),
      ],
    );
  }

  // Beautiful Stat Card with Gradient
  Widget _buildBeautifulStatCard({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
    required Gradient gradient,
  }) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: color.withOpacity(0.1),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.08),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              gradient: gradient,
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: color.withOpacity(0.3),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Icon(
              icon,
              color: Colors.white,
              size: 24,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w900,
              color: color,
              letterSpacing: -1,
            ),
          ),
        ],
      ),
    );
  }

  // Mini stat for gradient card
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
            fontWeight: FontWeight.w900,
            color: Colors.white,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Colors.white.withOpacity(0.9),
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
