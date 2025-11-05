import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/subject_service.dart';

/// Teacher Management Screen - Clean and Easy to Use
/// Allows school admins to manage teachers and assign subjects
class TeacherManagementScreen extends StatefulWidget {
  final ApiService apiService;

  const TeacherManagementScreen({
    super.key,
    required this.apiService,
  });

  @override
  State<TeacherManagementScreen> createState() =>
      _TeacherManagementScreenState();
}

class _TeacherManagementScreenState extends State<TeacherManagementScreen> {
  late SubjectService _subjectService;
  List<Map<String, dynamic>> _teachers = [];
  List<Map<String, dynamic>> _subjects = [];
  List<Map<String, dynamic>> _sections = [];
  bool _isLoading = true;
  String? _errorMessage;
  String _searchQuery = '';
  String _filterSubject = 'All';

  @override
  void initState() {
    super.initState();
    _subjectService = SubjectService(widget.apiService);
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Load teachers, subjects, and sections in parallel
      final results = await Future.wait([
        _loadTeachers(),
        _loadSubjects(),
        _loadSections(),
      ]);

      setState(() {
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _loadTeachers() async {
    try {
      final response = await widget.apiService.get(
        '/school/teachers',
        requiresAuth: true,
      );

      if (response['success'] == true && response['data'] != null) {
        setState(() {
          _teachers = (response['data'] as List).cast<Map<String, dynamic>>();
        });
      }
    } catch (e) {
      print('❌ Load teachers error: $e');
      rethrow;
    }
  }

  Future<void> _loadSubjects() async {
    try {
      final subjects = await _subjectService.getAllSubjects();
      setState(() {
        _subjects = subjects;
      });
    } catch (e) {
      print('❌ Load subjects error: $e');
    }
  }

  Future<void> _loadSections() async {
    try {
      final response = await widget.apiService.get(
        '/school/sections',
        requiresAuth: true,
      );

      if (response['success'] == true && response['data'] != null) {
        setState(() {
          _sections = (response['data'] as List).cast<Map<String, dynamic>>();
        });
      }
    } catch (e) {
      print('❌ Load sections error: $e');
    }
  }

  List<Map<String, dynamic>> get _filteredTeachers {
    var filtered = _teachers;

    // Filter by search query
    if (_searchQuery.isNotEmpty) {
      filtered = filtered.where((teacher) {
        final name = (teacher['name'] ?? '').toString().toLowerCase();
        final email = (teacher['email'] ?? '').toString().toLowerCase();
        final query = _searchQuery.toLowerCase();

        return name.contains(query) || email.contains(query);
      }).toList();
    }

    // Filter by subject
    if (_filterSubject != 'All') {
      filtered = filtered.where((teacher) {
        final assignments = teacher['assignments'] as List? ?? [];
        return assignments.any((assignment) =>
            assignment['subject'] == _filterSubject);
      }).toList();
    }

    return filtered;
  }

  void _showAssignSubjectDialog(Map<String, dynamic> teacher) {
    int? selectedSectionId;
    int? selectedSubjectId;
    bool isFormTeacher = false;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text('Assign Subject to ${teacher['name']}'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Section Dropdown
                const Text(
                  'Select Section *',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<int>(
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  hint: const Text('Choose a section'),
                  value: selectedSectionId,
                  items: _sections.map((section) {
                    return DropdownMenuItem<int>(
                      value: section['id'],
                      child: Text(
                        '${section['class_name']} - ${section['section_name']}',
                      ),
                    );
                  }).toList(),
                  onChanged: (value) {
                    setDialogState(() {
                      selectedSectionId = value;
                    });
                  },
                ),
                const SizedBox(height: 16),

                // Subject Dropdown
                const Text(
                  'Select Subject *',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<int>(
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  hint: const Text('Choose a subject'),
                  value: selectedSubjectId,
                  items: _subjects.map((subject) {
                    return DropdownMenuItem<int>(
                      value: subject['id'],
                      child: Row(
                        children: [
                          Text(subject['subject_name'] ?? 'Unknown'),
                          if (subject['subject_code'] != null) ...[
                            const SizedBox(width: 8),
                            Text(
                              '(${subject['subject_code']})',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey.shade600,
                              ),
                            ),
                          ],
                        ],
                      ),
                    );
                  }).toList(),
                  onChanged: (value) {
                    setDialogState(() {
                      selectedSubjectId = value;
                    });
                  },
                ),
                const SizedBox(height: 16),

                // Form Teacher Checkbox
                CheckboxListTile(
                  title: const Text(
                    'Form Teacher',
                    style: TextStyle(fontSize: 14),
                  ),
                  subtitle: const Text(
                    'Responsible for this section',
                    style: TextStyle(fontSize: 12),
                  ),
                  value: isFormTeacher,
                  onChanged: (value) {
                    setDialogState(() {
                      isFormTeacher = value ?? false;
                    });
                  },
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                ),

                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline, size: 16, color: Colors.blue.shade700),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'A teacher can teach multiple subjects and sections',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.blue.shade700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                if (selectedSectionId == null || selectedSubjectId == null) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('⚠️ Please select both section and subject'),
                    ),
                  );
                  return;
                }

                try {
                  await widget.apiService.post(
                    '/school/teachers/${teacher['id']}/assign',
                    {
                      'sectionId': selectedSectionId,
                      'subjectId': selectedSubjectId,
                      'isFormTeacher': isFormTeacher,
                      'academicYear': '2025-2026',
                    },
                    requiresAuth: true,
                  );

                  if (context.mounted) {
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('✅ Subject assigned successfully'),
                      ),
                    );
                    await _loadTeachers();
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('❌ Error: $e')),
                    );
                  }
                }
              },
              child: const Text('Assign'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Teachers Management'),
        actions: [
          IconButton(
            icon: const Icon(Icons.school),
            tooltip: 'Manage Subjects',
            onPressed: () {
              // Navigate to Subject Management Screen
              // Navigator.push(context, MaterialPageRoute(...));
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Header Section
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.green.shade50,
              border: Border(
                bottom: BorderSide(color: Colors.grey.shade300),
              ),
            ),
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
                          'Teachers & Assignments',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Manage teachers and assign subjects to sections',
                          style: TextStyle(
                            color: Colors.grey.shade700,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          '${_teachers.length}',
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: Colors.green,
                          ),
                        ),
                        Text(
                          'Total Teachers',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Search and Filter Row
                Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: TextField(
                        decoration: InputDecoration(
                          hintText: 'Search by name or email...',
                          prefixIcon: const Icon(Icons.search),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          filled: true,
                          fillColor: Colors.white,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                        ),
                        onChanged: (value) {
                          setState(() {
                            _searchQuery = value;
                          });
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        decoration: InputDecoration(
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          filled: true,
                          fillColor: Colors.white,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          prefixIcon: const Icon(Icons.filter_list, size: 20),
                        ),
                        value: _filterSubject,
                        items: [
                          const DropdownMenuItem(
                            value: 'All',
                            child: Text('All Subjects'),
                          ),
                          ..._subjects.map((subject) {
                            return DropdownMenuItem(
                              value: subject['subject_name'],
                              child: Text(
                                subject['subject_name'] ?? 'Unknown',
                                overflow: TextOverflow.ellipsis,
                              ),
                            );
                          }),
                        ],
                        onChanged: (value) {
                          setState(() {
                            _filterSubject = value ?? 'All';
                          });
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Content Section
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _errorMessage != null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.error, size: 48, color: Colors.red),
                            const SizedBox(height: 16),
                            Text(_errorMessage!),
                            const SizedBox(height: 16),
                            ElevatedButton(
                              onPressed: _loadData,
                              child: const Text('Retry'),
                            ),
                          ],
                        ),
                      )
                    : _filteredTeachers.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.people,
                                  size: 64,
                                  color: Colors.grey.shade400,
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  _searchQuery.isEmpty
                                      ? 'No teachers yet'
                                      : 'No teachers found',
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  _searchQuery.isEmpty
                                      ? 'Add teachers from the admin panel'
                                      : 'Try a different search term',
                                  style: TextStyle(color: Colors.grey.shade600),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _filteredTeachers.length,
                            itemBuilder: (context, index) {
                              final teacher = _filteredTeachers[index];
                              return _buildTeacherCard(teacher);
                            },
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildTeacherCard(Map<String, dynamic> teacher) {
    final assignments = teacher['assignments'] as List? ?? [];
    final isActive = teacher['is_active'] ?? true;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ExpansionTile(
        leading: CircleAvatar(
          backgroundColor: isActive ? Colors.green : Colors.grey,
          child: Text(
            (teacher['name'] ?? 'T')[0].toUpperCase(),
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
          ),
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                teacher['name'] ?? 'Unknown',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: isActive ? Colors.black : Colors.grey,
                ),
              ),
            ),
            if (assignments.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${assignments.length} assignment${assignments.length > 1 ? 's' : ''}',
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.blue.shade700,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (teacher['email'] != null)
              Text(
                teacher['email'],
                style: const TextStyle(fontSize: 12),
              ),
            if (teacher['phone'] != null)
              Text(
                teacher['phone'],
                style: const TextStyle(fontSize: 12),
              ),
          ],
        ),
        trailing: ElevatedButton.icon(
          onPressed: () => _showAssignSubjectDialog(teacher),
          icon: const Icon(Icons.add, size: 16),
          label: const Text('Assign'),
          style: ElevatedButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          ),
        ),
        children: [
          if (assignments.isEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'No assignments yet. Click "Assign" to add subjects.',
                style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                textAlign: TextAlign.center,
              ),
            )
          else
            ...assignments.map((assignment) {
              final isFormTeacher = assignment['is_form_teacher'] ?? false;
              return ListTile(
                dense: true,
                leading: Icon(
                  Icons.class_,
                  size: 20,
                  color: Colors.blue.shade600,
                ),
                title: Text(
                  '${assignment['class_name']} - ${assignment['section_name']}',
                  style: const TextStyle(fontSize: 14),
                ),
                subtitle: Text(
                  assignment['subject'] ?? 'No subject',
                  style: const TextStyle(fontSize: 12),
                ),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (isFormTeacher)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.amber.shade100,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.star,
                              size: 12,
                              color: Colors.amber.shade700,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Form Teacher',
                              style: TextStyle(
                                fontSize: 10,
                                color: Colors.amber.shade700,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(Icons.delete, size: 18),
                      color: Colors.red,
                      onPressed: () async {
                        // Delete assignment logic
                        final result = await showDialog<bool>(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: const Text('Remove Assignment'),
                            content: const Text(
                              'Are you sure you want to remove this assignment?',
                            ),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.pop(context, false),
                                child: const Text('Cancel'),
                              ),
                              ElevatedButton(
                                onPressed: () => Navigator.pop(context, true),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.red,
                                ),
                                child: const Text('Remove'),
                              ),
                            ],
                          ),
                        );

                        if (result == true && context.mounted) {
                          try {
                            await widget.apiService.delete(
                              '/school/teachers/assignments/${assignment['id']}',
                              requiresAuth: true,
                            );

                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('✅ Assignment removed'),
                                ),
                              );
                              await _loadTeachers();
                            }
                          } catch (e) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('❌ Error: $e')),
                              );
                            }
                          }
                        }
                      },
                    ),
                  ],
                ),
              );
            }).toList(),
        ],
      ),
    );
  }
}
