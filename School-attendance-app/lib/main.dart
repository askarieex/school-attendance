import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'providers/auth_provider.dart';
import 'providers/attendance_provider.dart';
import 'screens/welcome_screen.dart';
import 'screens/login_screen.dart';
import 'screens/parent_dashboard_screen.dart';
import 'screens/teacher_dashboard_screen.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => AttendanceProvider()),
      ],
      child: MaterialApp(
        title: 'School Attendance',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.light(
            primary: const Color(0xFF2196F3),
            secondary: const Color(0xFF4CAF50),
            tertiary: const Color(0xFFFF9800),
            surface: const Color(0xFFF5F7FA),
            background: const Color(0xFFF5F7FA),
          ),
          useMaterial3: true,
          textTheme: GoogleFonts.poppinsTextTheme(),
          scaffoldBackgroundColor: const Color(0xFFF5F7FA),
          cardTheme: CardTheme(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
          ),
          appBarTheme: const AppBarTheme(
            centerTitle: false,
            elevation: 0,
            backgroundColor: Color(0xFFF5F7FA),
            foregroundColor: Color(0xFF1A1A1A),
          ),
        ),
        home: const WelcomeScreen(),
        routes: {
          '/welcome': (context) => const WelcomeScreen(),
          '/parent-login': (context) => const LoginScreen(isTeacher: false),
          '/teacher-login': (context) => const LoginScreen(isTeacher: true),
          '/parent-dashboard': (context) => const ParentDashboardScreen(),
          '/teacher-dashboard': (context) => const TeacherDashboardScreen(),
        },
      ),
    );
  }
}
