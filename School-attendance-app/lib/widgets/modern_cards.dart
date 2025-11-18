import 'package:flutter/material.dart';

/// Premium gradient stat card with glassmorphism
Widget buildModernStatCard({
  required IconData icon,
  required String title,
  required String value,
  required String subtitle,
  required Gradient gradient,
}) {
  return Container(
    padding: const EdgeInsets.all(24),
    decoration: BoxDecoration(
      gradient: gradient,
      borderRadius: BorderRadius.circular(20),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withOpacity(0.08),
          blurRadius: 20,
          offset: const Offset(0, 8),
        ),
        BoxShadow(
          color: Colors.white.withOpacity(0.1),
          blurRadius: 0,
          offset: const Offset(0, -1),
        ),
      ],
    ),
    child: Row(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.25),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: Colors.white.withOpacity(0.3),
              width: 1.5,
            ),
          ),
          child: Icon(icon, color: Colors.white, size: 28),
        ),
        const SizedBox(width: 18),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  color: Colors.white.withOpacity(0.9),
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                value,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 36,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -1.5,
                  shadows: [
                    Shadow(
                      color: Colors.black12,
                      offset: Offset(0, 2),
                      blurRadius: 4,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: TextStyle(
                  color: Colors.white.withOpacity(0.85),
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

/// Premium compact stat card with gradient border
Widget buildCompactStatCard({
  required IconData icon,
  required String label,
  required String value,
  required Color color,
}) {
  return Container(
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
    child: Column(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: color.withOpacity(0.08),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: color, size: 22),
        ),
        const SizedBox(height: 14),
        Text(
          value,
          style: const TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.bold,
            color: Color(0xFF212529),
            letterSpacing: -0.8,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            color: Color(0xFF6C757D),
            fontWeight: FontWeight.w600,
          ),
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    ),
  );
}

/// Premium action card with gradient icon and better depth
Widget buildModernActionCard({
  required IconData icon,
  required String label,
  required String subtitle,
  required Gradient gradient,
  required VoidCallback onTap,
}) {
  // Map gradients to specific colors
  Color iconColor;
  Gradient iconGradient;
  
  // Determine color based on label
  if (label.contains('QR') || label.contains('Scanner')) {
    iconColor = const Color(0xFF00B4D8);
    iconGradient = const LinearGradient(
      colors: [Color(0xFF00B4D8), Color(0xFF0077B6)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    );
  } else if (label.contains('Mark') || label.contains('Attendance')) {
    iconColor = const Color(0xFF34C759);
    iconGradient = const LinearGradient(
      colors: [Color(0xFF34C759), Color(0xFF30D158)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    );
  } else if (label.contains('Report')) {
    iconColor = const Color(0xFF007AFF);
    iconGradient = const LinearGradient(
      colors: [Color(0xFF007AFF), Color(0xFF5E5CE6)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    );
  } else if (label.contains('Broadcast')) {
    iconColor = const Color(0xFFFF9500);
    iconGradient = const LinearGradient(
      colors: [Color(0xFFFF9500), Color(0xFFFF6B00)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    );
  } else if (label.contains('Leave')) {
    iconColor = const Color(0xFFAF52DE);
    iconGradient = const LinearGradient(
      colors: [Color(0xFFAF52DE), Color(0xFF8B5CF6)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    );
  } else if (label.contains('Student List')) {
    iconColor = const Color(0xFF00B4D8);
    iconGradient = const LinearGradient(
      colors: [Color(0xFF00B4D8), Color(0xFF0077B6)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    );
  } else if (label.contains('Calendar')) {
    iconColor = const Color(0xFF34C759);
    iconGradient = const LinearGradient(
      colors: [Color(0xFF30D158), Color(0xFF34C759)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    );
  } else if (label.contains('Assignment')) {
    iconColor = const Color(0xFFFF9500);
    iconGradient = const LinearGradient(
      colors: [Color(0xFFFF6B00), Color(0xFFFF9500)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    );
  } else if (label.contains('Grade')) {
    iconColor = const Color(0xFFFF2D55);
    iconGradient = const LinearGradient(
      colors: [Color(0xFFFF2D55), Color(0xFFFF3B30)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    );
  } else {
    iconColor = const Color(0xFF00B4D8);
    iconGradient = const LinearGradient(
      colors: [Color(0xFF00B4D8), Color(0xFF0077B6)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    );
  }
  
  return InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(18),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: iconColor.withOpacity(0.1),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: iconColor.withOpacity(0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              gradient: iconGradient,
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: iconColor.withOpacity(0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Icon(icon, color: Colors.white, size: 22),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    color: Color(0xFF1C1C1E),
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: Color(0xFF8E8E93),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: const Color(0xFFF5F5F7),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.chevron_right_rounded,
              color: Color(0xFF8E8E93),
              size: 18,
            ),
          ),
        ],
      ),
    ),
  );
}

/// Premium mini class card with gradient
Widget buildMiniClassCard({
  required String className,
  required String sectionName,
  required String subject,
  required int studentCount,
  required VoidCallback onTap,
}) {
  return InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(18),
    child: Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: const Color(0xFF00B4D8).withOpacity(0.1),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF00B4D8).withOpacity(0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF00B4D8), Color(0xFF0077B6)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF00B4D8).withOpacity(0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Icon(Icons.school, color: Colors.white, size: 22),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$className-$sectionName',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1C1C1E),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '$subject • $studentCount Students',
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF8E8E93),
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: const Color(0xFFF5F5F7),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: Color(0xFF8E8E93),
            ),
          ),
        ],
      ),
    ),
  );
}

/// Clean empty state card
Widget buildEmptyClassesCard() {
  return Container(
    padding: const EdgeInsets.all(40),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withOpacity(0.03),
          blurRadius: 10,
          offset: const Offset(0, 2),
        ),
      ],
    ),
    child: Column(
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFFF5F5F7),
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.class_outlined,
            size: 40,
            color: Color(0xFFAEAEB2),
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'No Classes Yet',
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w600,
            color: Color(0xFF1C1C1E),
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Your assigned classes will appear here',
          style: TextStyle(
            fontSize: 13,
            color: Color(0xFF8E8E93),
          ),
          textAlign: TextAlign.center,
        ),
      ],
    ),
  );
}
