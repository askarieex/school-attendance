class Student {
  final String id;
  final String name;
  final String parentId;
  final String grade;
  final String photoUrl;
  
  Student({
    required this.id,
    required this.name,
    required this.parentId,
    required this.grade,
    this.photoUrl = '',
  });
}
