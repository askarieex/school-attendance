import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'welcome_screen.dart';
import 'parent_dashboard_screen.dart';
import 'teacher_dashboard_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkLoginStatus();
  }

  Future<void> _checkLoginStatus() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    // Try to auto-login
    final bool isLoggedIn = await authProvider.tryAutoLogin();

    if (!mounted) return;

    // Navigate based on login status
    if (isLoggedIn) {
      // User is logged in, go to appropriate dashboard
      if (authProvider.isTeacher) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const TeacherDashboardScreen()),
        );
      } else {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const ParentDashboardScreen()),
        );
      }
    } else {
      // Not logged in, go to welcome screen
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const WelcomeScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,  // ✅ White background like Adtenz branding
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Logo container with app icon
            Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF00D4FF).withOpacity(0.2),
                    blurRadius: 30,
                    spreadRadius: 5,
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(28),
                child: Image.asset(
                  'assets/images/app_icon.png',
                  fit: BoxFit.contain,
                ),
              ),
            ),
            const SizedBox(height: 32),

            // App name - ADTENZ branding
            const Text(
              'ADTENZ',
              style: TextStyle(
                fontSize: 32,
                fontWeight: FontWeight.w800,
                color: Color(0xFF1A1A1A),  // Black text
                letterSpacing: 2.0,
              ),
            ),
            const SizedBox(height: 8),

            // Tagline
            const Text(
              'Smarter Attendance. Smarter Schools.',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: Color(0xFF666666),
              ),
            ),
            const SizedBox(height: 40),

            // Loading indicator with brand color
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF00D4FF)),  // Cyan brand color
              ),
            ),
          ],
        ),
      ),
    );
  }
}
