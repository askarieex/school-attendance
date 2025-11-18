import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiMail, FiPhone, FiBook, FiKey, FiSearch, FiUsers, FiCheck, FiStar } from 'react-icons/fi';
import { teachersAPI, sectionsAPI, subjectsAPI } from '../utils/api';
import './Teachers.css';

const Teachers = () => {
  const [teachers, setTeachers] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  // New filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [newTeacher, setNewTeacher] = useState({
    fullName: '',
    email: '',
    phone: '',
    subjectSpecialization: '',
    qualification: '',
    dateOfJoining: '',
    password: 'teacher123'
  });

  const [assignment, setAssignment] = useState({
    sectionId: '',
    subjectId: '',
    isFormTeacher: false
  });

  useEffect(() => {
    fetchTeachers();
    fetchSections();
    fetchSubjects();
  }, [currentPage]);

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const response = await teachersAPI.getAll({ page: currentPage, limit: 20 });
      if (response.success || response.data) {
        setTeachers(response.data || []);
        setPagination(response.pagination);
      }
    } catch (err) {
      console.error('Error fetching teachers:', err);
      setError('Failed to load teachers');
    } finally {
      setLoading(false);
    }
  };

  const fetchSections = async () => {
    try {
      const response = await sectionsAPI.getAll();
      if (response.success) {
        setSections(response.data || []);
      }
    } catch (err) {
      console.error('Error fetching sections:', err);
    }
  };

  const fetchSubjects = async () => {
    try {
      const response = await subjectsAPI.getAll();
      if (response.success && response.data) {
        setSubjects(response.data.subjects || []);
      }
    } catch (err) {
      console.error('Error fetching subjects:', err);
    }
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    try {
      const response = await teachersAPI.create(newTeacher);
      if (response.success) {
        setShowAddModal(false);
        setNewTeacher({
          fullName: '',
          email: '',
          phone: '',
          subjectSpecialization: '',
          qualification: '',
          dateOfJoining: '',
          password: 'teacher123'
        });
        fetchTeachers();
        alert('Teacher added successfully!');
      }
    } catch (err) {
      console.error('Error creating teacher:', err);
      alert(err.message || 'Failed to create teacher');
    }
  };

  const handleDeleteTeacher = async (id) => {
    if (!window.confirm('Are you sure you want to delete this teacher?')) {
      return;
    }

    try {
      await teachersAPI.delete(id);
      fetchTeachers();
    } catch (err) {
      console.error('Error deleting teacher:', err);
      alert('Failed to delete teacher');
    }
  };

  const handleAssignToSection = async (e) => {
    e.preventDefault();
    try {
      await teachersAPI.assignToSection(selectedTeacher.id, {
        ...assignment,
        academicYear: '2025-2026'
      });
      setShowAssignModal(false);
      setAssignment({ sectionId: '', subjectId: '', isFormTeacher: false });
      setSelectedTeacher(null);
      fetchTeachers();
      alert('Teacher assigned successfully!');
    } catch (err) {
      console.error('Error assigning teacher:', err);
      alert(err.message || 'Failed to assign teacher');
    }
  };

  const handleRemoveAssignment = async (teacherId, assignmentId) => {
    if (!window.confirm('Remove this assignment?')) {
      return;
    }

    try {
      await teachersAPI.removeAssignment(teacherId, assignmentId);
      fetchTeachers();
    } catch (err) {
      console.error('Error removing assignment:', err);
      alert('Failed to remove assignment');
    }
  };

  if (loading) {
    return (
      <div className="teachers-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading teachers...</p>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const stats = {
    total: teachers.length,
    active: teachers.filter(t => t.user_active).length,
    inactive: teachers.filter(t => !t.user_active).length,
    withAssignments: teachers.filter(t => t.assignments && t.assignments.length > 0).length,
    formTeachers: teachers.filter(t => t.assignments?.some(a => a.is_form_teacher)).length
  };

  // Filter teachers based on search and filters
  const filteredTeachers = teachers.filter(teacher => {
    const matchesSearch = !searchTerm || 
      teacher.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.teacher_code?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSubject = !filterSubject || 
      teacher.subject_specialization?.toLowerCase().includes(filterSubject.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && teacher.user_active) ||
      (filterStatus === 'inactive' && !teacher.user_active);
    
    return matchesSearch && matchesSubject && matchesStatus;
  });

  return (
    <div className="teachers-container">
      <div className="teachers-header">
        <div>
          <h1>Teachers</h1>
          <p>Manage teachers and their class assignments</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          <FiPlus /> Add Teacher
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Statistics Summary */}
      {!loading && teachers.length > 0 && (
        <div className="stats-summary">
          <div className="summary-card">
            <div className="summary-icon total">
              <FiUsers />
            </div>
            <div className="summary-content">
              <span className="summary-value">{stats.total}</span>
              <span className="summary-label">Total Teachers</span>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon active">
              <FiCheck />
            </div>
            <div className="summary-content">
              <span className="summary-value">{stats.active}</span>
              <span className="summary-label">Active</span>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon assignments">
              <FiBook />
            </div>
            <div className="summary-content">
              <span className="summary-value">{stats.withAssignments}</span>
              <span className="summary-label">With Assignments</span>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon form-teachers">
              <FiStar />
            </div>
            <div className="summary-content">
              <span className="summary-value">{stats.formTeachers}</span>
              <span className="summary-label">Form Teachers</span>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      {!loading && teachers.length > 0 && (
        <div className="filters-bar">
          <div className="search-box">
            <FiSearch />
            <input
              type="text"
              placeholder="Search by name, email, or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
            <input
              type="text"
              placeholder="Filter by subject..."
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="filter-input"
            />
            {(searchTerm || filterSubject || filterStatus !== 'all') && (
              <button
                className="btn-clear-filters"
                onClick={() => {
                  setSearchTerm('');
                  setFilterSubject('');
                  setFilterStatus('all');
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {teachers.length === 0 ? (
        <div className="empty-state">
          <FiBook className="empty-icon" />
          <h3>No teachers yet</h3>
          <p>Add your first teacher to get started</p>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <FiPlus /> Add First Teacher
          </button>
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="empty-state">
          <FiSearch className="empty-icon" />
          <h3>No teachers found</h3>
          <p>Try adjusting your search or filters</p>
          <button
            className="btn-secondary"
            onClick={() => {
              setSearchTerm('');
              setFilterSubject('');
              setFilterStatus('all');
            }}
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <>
          <div className="results-info">
            <span>Showing {filteredTeachers.length} of {teachers.length} teachers</span>
          </div>
          <div className="teachers-grid">
            {filteredTeachers.map((teacher) => (
              <div key={teacher.id} className="teacher-card">
                <div className="teacher-header">
                  <div className="teacher-avatar">
                    {teacher.full_name?.charAt(0) || 'T'}
                  </div>
                  <div className="teacher-info">
                    <div className="teacher-name-row">
                      <h3>{teacher.full_name}</h3>
                      <span className={`status-badge ${teacher.user_active ? 'active' : 'inactive'}`}>
                        {teacher.user_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="teacher-code">{teacher.teacher_code}</p>
                    {teacher.qualification && (
                      <p className="teacher-qualification">
                        <FiBook className="inline-icon" />
                        {teacher.qualification}
                      </p>
                    )}
                  </div>
                </div>

                {/* Teacher Stats */}
                <div className="teacher-stats">
                  <div className="stat-item">
                    <span className="stat-value">{teacher.assignments?.length || 0}</span>
                    <span className="stat-label">Classes</span>
                  </div>
                  <div className="stat-divider"></div>
                  <div className="stat-item">
                    <span className="stat-value">{teacher.classes_count || 0}</span>
                    <span className="stat-label">Sections</span>
                  </div>
                  <div className="stat-divider"></div>
                  <div className="stat-item">
                    <span className="stat-value">
                      {teacher.assignments?.some(a => a.is_form_teacher) ? 'Yes' : 'No'}
                    </span>
                    <span className="stat-label">Form Teacher</span>
                  </div>
                </div>

                <div className="teacher-details">
                  {teacher.subject_specialization && (
                    <div className="detail-item">
                      <FiBook />
                      <div className="detail-content">
                        <span className="detail-label">Subject</span>
                        <span className="detail-value">{teacher.subject_specialization}</span>
                      </div>
                    </div>
                  )}
                  {teacher.email && (
                    <div className="detail-item">
                      <FiMail />
                      <div className="detail-content">
                        <span className="detail-label">Email</span>
                        <span className="detail-value">{teacher.email}</span>
                      </div>
                    </div>
                  )}
                  {teacher.phone && (
                    <div className="detail-item">
                      <FiPhone />
                      <div className="detail-content">
                        <span className="detail-label">Phone</span>
                        <span className="detail-value">{teacher.phone}</span>
                      </div>
                    </div>
                  )}
                </div>

                {teacher.assignments && teacher.assignments.length > 0 && (
                  <div className="teacher-assignments">
                    <h4>Teaching Assignments ({teacher.assignments.length})</h4>
                    <div className="assignments-table">
                      <div className="assignment-header">
                        <span>Grade</span>
                        <span>Section</span>
                        <span>Subject</span>
                        <span></span>
                      </div>
                      {teacher.assignments.map((assignment) => (
                        <div key={assignment.id} className="assignment-row">
                          <span className="grade-cell">{assignment.class_name}</span>
                          <span className="section-cell">{assignment.section_name}</span>
                          <span className="subject-cell">
                            {assignment.subject_name || 'N/A'}
                            {assignment.is_form_teacher && <span className="form-badge">Form</span>}
                          </span>
                          <button
                            className="remove-btn-table"
                            onClick={() => handleRemoveAssignment(teacher.id, assignment.id)}
                            title="Remove assignment"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="teacher-actions">
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      setSelectedTeacher(teacher);
                      setShowAssignModal(true);
                    }}
                  >
                    Assign Class
                  </button>
                  <button
                    className="btn-danger btn-sm"
                    onClick={() => handleDeleteTeacher(teacher.id)}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="pagination">
              <button
                className="btn-secondary"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                ← Previous
              </button>
              <div className="pagination-info">
                <span className="page-numbers">
                  Page {currentPage} of {pagination.pages}
                </span>
                <span className="teacher-count">
                  {((currentPage - 1) * 20) + 1}-{Math.min(currentPage * 20, pagination.total)} of {pagination.total} teachers
                </span>
              </div>
              <button
                className="btn-secondary"
                onClick={() => setCurrentPage(prev => Math.min(pagination.pages, prev + 1))}
                disabled={currentPage === pagination.pages}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
      {/* Add Teacher Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Teacher</h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleAddTeacher}>
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  value={newTeacher.fullName}
                  onChange={(e) => setNewTeacher({ ...newTeacher, fullName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={newTeacher.email}
                  onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={newTeacher.phone}
                  onChange={(e) => setNewTeacher({ ...newTeacher, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Subject Specialization</label>
                <input
                  type="text"
                  value={newTeacher.subjectSpecialization}
                  onChange={(e) => setNewTeacher({ ...newTeacher, subjectSpecialization: e.target.value })}
                  placeholder="e.g., Mathematics, Science"
                />
              </div>
              <div className="form-group">
                <label>Qualification</label>
                <input
                  type="text"
                  value={newTeacher.qualification}
                  onChange={(e) => setNewTeacher({ ...newTeacher, qualification: e.target.value })}
                  placeholder="e.g., B.Ed, M.Sc"
                />
              </div>
              <div className="form-group">
                <label>Date of Joining</label>
                <input
                  type="date"
                  value={newTeacher.dateOfJoining}
                  onChange={(e) => setNewTeacher({ ...newTeacher, dateOfJoining: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Initial Password</label>
                <input
                  type="text"
                  value={newTeacher.password}
                  onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
                  placeholder="Default: teacher123"
                />
                <small>Teacher can change this on first login</small>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Add Teacher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign to Section Modal */}
      {showAssignModal && selectedTeacher && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-content modal-assign" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-section">
                <h2>Assign Teaching</h2>
                <div className="teacher-mini-profile">
                  <div className="mini-avatar">{selectedTeacher.full_name?.charAt(0) || 'T'}</div>
                  <div className="mini-info">
                    <span className="mini-name">{selectedTeacher.full_name}</span>
                    <span className="mini-spec">{selectedTeacher.subject_specialization || 'Teacher'}</span>
                  </div>
                </div>
              </div>
              <button className="close-btn" onClick={() => setShowAssignModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleAssignToSection}>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Grade & Section *</label>
                  <select
                    value={assignment.sectionId}
                    onChange={(e) => setAssignment({ ...assignment, sectionId: parseInt(e.target.value) })}
                    required
                  >
                    <option value="">Choose class...</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.class_name} - {section.section_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Subject *</label>
                  <select
                    value={assignment.subjectId}
                    onChange={(e) => setAssignment({ ...assignment, subjectId: parseInt(e.target.value) })}
                    required
                  >
                    <option value="">Choose subject...</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.subject_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <div className="form-teacher-option">
                  <label className="checkbox-label-enhanced">
                    <input
                      type="checkbox"
                      checked={assignment.isFormTeacher}
                      onChange={(e) => setAssignment({ ...assignment, isFormTeacher: e.target.checked })}
                    />
                    <div className="checkbox-content">
                      <span className="checkbox-title">Make Form Teacher</span>
                      <small className="checkbox-desc">Give additional class management privileges</small>
                    </div>
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAssignModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <FiCheck /> Assign Teacher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Teachers;
