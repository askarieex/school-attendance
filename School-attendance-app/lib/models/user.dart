enum UserRole { parent, teacher }

class User {
  final String id;
  final String email;
  final String name;
  final UserRole role;
  final String? schoolName;
  final String? schoolLogo;  // ✅ NEW: School logo URL
  final String? currentAcademicYear;

  User({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    this.schoolName,
    this.schoolLogo,  // ✅ NEW
    this.currentAcademicYear,
  });

  // ✅ Factory constructor for creating a new User instance from a map
  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      email: json['email'],
      name: json['name'],
      role: json['role'] == 'teacher' ? UserRole.teacher : UserRole.parent,
      schoolName: json['schoolName'],
      schoolLogo: json['schoolLogo'],  // ✅ NEW: Parse school logo
      currentAcademicYear: json['currentAcademicYear'],
    );
  }

  // ✅ Method to convert User instance to a map
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'role': role == UserRole.teacher ? 'teacher' : 'parent',
      'schoolName': schoolName,
      'schoolLogo': schoolLogo,  // ✅ NEW: Include school logo
      'currentAcademicYear': currentAcademicYear,
    };
  }
}
