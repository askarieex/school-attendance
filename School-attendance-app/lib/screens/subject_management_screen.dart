import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/subject_service.dart';

/// Subject Management Screen - Clean and Easy to Use
/// Allows school admins to manage subjects with full CRUD operations
class SubjectManagementScreen extends StatefulWidget {
  final ApiService apiService;

  const SubjectManagementScreen({
    Key? key,
    required this.apiService,
  }) : super(key: key);

  @override
  _SubjectManagementScreenState createState() =>
      _SubjectManagementScreenState();
}

class _SubjectManagementScreenState extends State<SubjectManagementScreen> {
  late SubjectService _subjectService;
  List<Map<String, dynamic>> _subjects = [];
  bool _isLoading = true;
  String? _errorMessage;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _subjectService = SubjectService(widget.apiService);
    _loadSubjects();
  }

  Future<void> _loadSubjects() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final subjects = await _subjectService.getAllSubjects(
        includeStats: true,
      );
      setState(() {
        _subjects = subjects;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  List<Map<String, dynamic>> get _filteredSubjects {
    if (_searchQuery.isEmpty) return _subjects;

    return _subjects.where((subject) {
      final name = (subject['subject_name'] ?? '').toString().toLowerCase();
      final code = (subject['subject_code'] ?? '').toString().toLowerCase();
      final query = _searchQuery.toLowerCase();

      return name.contains(query) || code.contains(query);
    }).toList();
  }

  Future<void> _createDefaultSubjects() async {
    try {
      final result = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Create Default Subjects'),
          content: const Text(
            'This will create 8 default subjects:\n\n'
            '• Mathematics\n• English\n• Science\n• Social Studies\n'
            '• Computer Science\n• Physical Education\n• Art\n• Music\n\n'
            'Proceed?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Create'),
            ),
          ],
        ),
      );

      if (result == true) {
        await _subjectService.createDefaultSubjects();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✅ Default subjects created')),
        );
        await _loadSubjects();
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('❌ Error: $e')),
      );
    }
  }

  void _showSubjectDialog({Map<String, dynamic>? subject}) {
    final isEditing = subject != null;
    final nameController = TextEditingController(
      text: subject?['subject_name'] ?? '',
    );
    final codeController = TextEditingController(
      text: subject?['subject_code'] ?? '',
    );
    final descController = TextEditingController(
      text: subject?['description'] ?? '',
    );

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(isEditing ? 'Edit Subject' : 'Add Subject'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(
                  labelText: 'Subject Name *',
                  border: OutlineInputBorder(),
                ),
                textCapitalization: TextCapitalization.words,
              ),
              const SizedBox(height: 16),
              TextField(
                controller: codeController,
                decoration: const InputDecoration(
                  labelText: 'Subject Code (optional)',
                  border: OutlineInputBorder(),
                  hintText: 'e.g., MATH, ENG',
                ),
                textCapitalization: TextCapitalization.characters,
              ),
              const SizedBox(height: 16),
              TextField(
                controller: descController,
                decoration: const InputDecoration(
                  labelText: 'Description (optional)',
                  border: OutlineInputBorder(),
                ),
                maxLines: 3,
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
              final name = nameController.text.trim();
              if (name.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('⚠️ Subject name is required')),
                );
                return;
              }

              try {
                if (isEditing) {
                  await _subjectService.updateSubject(
                    id: subject['id'],
                    subjectName: name,
                    subjectCode: codeController.text.trim().isEmpty
                        ? null
                        : codeController.text.trim(),
                    description: descController.text.trim().isEmpty
                        ? null
                        : descController.text.trim(),
                  );
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('✅ Subject updated')),
                  );
                } else {
                  await _subjectService.createSubject(
                    subjectName: name,
                    subjectCode: codeController.text.trim().isEmpty
                        ? null
                        : codeController.text.trim(),
                    description: descController.text.trim().isEmpty
                        ? null
                        : descController.text.trim(),
                  );
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('✅ Subject created')),
                  );
                }

                Navigator.pop(context);
                await _loadSubjects();
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('❌ Error: $e')),
                );
              }
            },
            child: Text(isEditing ? 'Update' : 'Create'),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteSubject(Map<String, dynamic> subject) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Subject'),
        content: Text(
          'Are you sure you want to delete "${subject['subject_name']}"?\n\n'
          'This will only deactivate the subject if it has existing assignments.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (result == true) {
      try {
        await _subjectService.deleteSubject(subject['id']);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✅ Subject deleted')),
        );
        await _loadSubjects();
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('❌ Error: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Subjects Management'),
        actions: [
          IconButton(
            icon: const Icon(Icons.auto_awesome),
            tooltip: 'Create Default Subjects',
            onPressed: _createDefaultSubjects,
          ),
        ],
      ),
      body: Column(
        children: [
          // Header Section
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.blue.shade50,
              border: Border(
                bottom: BorderSide(color: Colors.grey.shade300),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Manage School Subjects',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Create, edit, and manage subjects for teacher assignments',
                  style: TextStyle(
                    color: Colors.grey.shade700,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  decoration: InputDecoration(
                    hintText: 'Search subjects...',
                    prefixIcon: const Icon(Icons.search),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                    filled: true,
                    fillColor: Colors.white,
                  ),
                  onChanged: (value) {
                    setState(() {
                      _searchQuery = value;
                    });
                  },
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
                              onPressed: _loadSubjects,
                              child: const Text('Retry'),
                            ),
                          ],
                        ),
                      )
                    : _filteredSubjects.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.school,
                                  size: 64,
                                  color: Colors.grey.shade400,
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  _searchQuery.isEmpty
                                      ? 'No subjects yet'
                                      : 'No subjects found',
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  _searchQuery.isEmpty
                                      ? 'Click + to add your first subject'
                                      : 'Try a different search term',
                                  style: TextStyle(color: Colors.grey.shade600),
                                ),
                                if (_searchQuery.isEmpty) ...[
                                  const SizedBox(height: 16),
                                  ElevatedButton.icon(
                                    onPressed: _createDefaultSubjects,
                                    icon: const Icon(Icons.auto_awesome),
                                    label: const Text('Create Default Subjects'),
                                  ),
                                ],
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _filteredSubjects.length,
                            itemBuilder: (context, index) {
                              final subject = _filteredSubjects[index];
                              return _buildSubjectCard(subject);
                            },
                          ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showSubjectDialog(),
        icon: const Icon(Icons.add),
        label: const Text('Add Subject'),
      ),
    );
  }

  Widget _buildSubjectCard(Map<String, dynamic> subject) {
    final isActive = subject['is_active'] ?? true;
    final assignmentCount = subject['assignment_count'] ?? 0;
    final teacherCount = subject['teacher_count'] ?? 0;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: isActive ? Colors.blue : Colors.grey,
          child: Text(
            (subject['subject_code'] ?? subject['subject_name']?[0] ?? 'S')
                .toString()
                .substring(0, 1)
                .toUpperCase(),
            style: const TextStyle(color: Colors.white),
          ),
        ),
        title: Text(
          subject['subject_name'] ?? 'Unknown',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: isActive ? Colors.black : Colors.grey,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (subject['subject_code'] != null)
              Text(
                'Code: ${subject['subject_code']}',
                style: const TextStyle(fontSize: 12),
              ),
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(Icons.person, size: 14, color: Colors.grey.shade600),
                const SizedBox(width: 4),
                Text(
                  '$teacherCount teacher(s)',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                ),
                const SizedBox(width: 12),
                Icon(Icons.assignment, size: 14, color: Colors.grey.shade600),
                const SizedBox(width: 4),
                Text(
                  '$assignmentCount assignment(s)',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                ),
              ],
            ),
          ],
        ),
        trailing: PopupMenuButton(
          itemBuilder: (context) => [
            const PopupMenuItem(
              value: 'edit',
              child: Row(
                children: [
                  Icon(Icons.edit, size: 18),
                  SizedBox(width: 8),
                  Text('Edit'),
                ],
              ),
            ),
            const PopupMenuItem(
              value: 'delete',
              child: Row(
                children: [
                  Icon(Icons.delete, size: 18, color: Colors.red),
                  SizedBox(width: 8),
                  Text('Delete', style: TextStyle(color: Colors.red)),
                ],
              ),
            ),
          ],
          onSelected: (value) {
            if (value == 'edit') {
              _showSubjectDialog(subject: subject);
            } else if (value == 'delete') {
              _deleteSubject(subject);
            }
          },
        ),
      ),
    );
  }
}
