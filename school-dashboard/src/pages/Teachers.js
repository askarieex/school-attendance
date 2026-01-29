
import React, { useState, useEffect } from 'react';
import {
  FiPlus, FiTrash2, FiMail, FiPhone, FiBook,
  FiSearch, FiUsers, FiCheck, FiStar, FiChevronDown, FiChevronUp,
  FiFilter, FiX, FiAlertCircle, FiCalendar
} from 'react-icons/fi';
import { teachersAPI, sectionsAPI, subjectsAPI } from '../utils/api';
import './Teachers.css';

const Teachers = () => {
  // State Management
  const [teachers, setTeachers] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals & Selection
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  // UI State
  const [expandedTeacherId, setExpandedTeacherId] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Pagination & Filters
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Form States
  const [newTeacher, setNewTeacher] = useState({
    fullName: '', email: '', phone: '',
    subjectSpecialization: '', qualification: '',
    dateOfJoining: new Date().toISOString().split('T')[0],
    password: ''
  });

  const [assignment, setAssignment] = useState({
    sectionId: '', subjectId: '', isFormTeacher: false
  });

  // Effects
  useEffect(() => {
    fetchTeachers();
    fetchSections();
    fetchSubjects();
  }, [currentPage]);

  // Validation Logic
  const validateTeacherForm = () => {
    const errors = {};
    if (!newTeacher.fullName.trim()) errors.fullName = "Full Name is required";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newTeacher.email || !emailRegex.test(newTeacher.email)) {
      errors.email = "Please enter a valid email address";
    }

    if (newTeacher.phone && !/^\d{10}$/.test(newTeacher.phone.replace(/[- ]/g, ''))) {
      errors.phone = "Phone number must be 10 digits";
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
    if (newTeacher.password) {
      if (newTeacher.password.length < 6) {
        errors.password = "Password must be at least 6 characters";
      } else if (!passwordRegex.test(newTeacher.password)) {
        errors.password = "Password must contain at least one uppercase letter, one lowercase letter, and one number";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // API Calls
  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const response = await teachersAPI.getAll({ page: currentPage, limit: 12 });
      if (response.success || response.data) {
        setTeachers(response.data || []);
        setPagination(response.pagination);
      }
    } catch (err) {
      console.error('Error fetching teachers:', err);
      setError('Failed to load faculty data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSections = async () => {
    try {
      const response = await sectionsAPI.getAll();
      if (response.success) setSections(response.data || []);
    } catch (err) {
      console.error('Error fetching sections:', err);
    }
  };

  const fetchSubjects = async () => {
    try {
      const response = await subjectsAPI.getAll();
      // API returns { success: true, data: { subjects: [...] } }
      if (response.success && response.data) {
        const subjectList = response.data.subjects || response.data || [];
        setSubjects(Array.isArray(subjectList) ? subjectList : []);
      }
    } catch (err) {
      console.error('Error fetching subjects:', err);
    }
  };

  // Handlers
  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!validateTeacherForm()) return;

    try {
      const payload = {
        ...newTeacher,
        password: newTeacher.password || 'Teacher123'
      };
      const response = await teachersAPI.create(payload);
      if (response.success) {
        setShowAddModal(false);
        setNewTeacher({
          fullName: '', email: '', phone: '',
          subjectSpecialization: '', qualification: '',
          dateOfJoining: new Date().toISOString().split('T')[0],
          password: ''
        });
        setFormErrors({});
        fetchTeachers();
      }
    } catch (err) {
      console.error('Error creating teacher:', err);
      const errorData = err.response?.data;
      const newErrors = { submit: errorData?.message || err.message || 'Failed to create teacher' };

      if (errorData?.errors && Array.isArray(errorData.errors)) {
        errorData.errors.forEach(error => {
          if (error.field) {
            newErrors[error.field] = error.message;
          }
        });
      }
      setFormErrors(newErrors);
    }
  };

  const handleDeleteTeacher = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure? This action cannot be undone.')) return;
    try {
      await teachersAPI.delete(id);
      fetchTeachers();
    } catch (err) {
      console.error('Error deleting teacher:', err);
    }
  };

  const handleAssignToSection = async (e) => {
    e.preventDefault();
    try {
      // Get subject name from subjectId
      const selectedSubject = subjects.find(s => s.id.toString() === assignment.subjectId.toString());
      const subjectName = selectedSubject?.subject_name || '';

      await teachersAPI.assignToSection(selectedTeacher.id, {
        sectionId: assignment.sectionId,
        subject: subjectName, // Backend expects 'subject' (name), not 'subjectId'
        isFormTeacher: assignment.isFormTeacher
        // academicYear: Let backend calculate it automatically
      });
      setShowAssignModal(false);
      setAssignment({ sectionId: '', subjectId: '', isFormTeacher: false });
      setSelectedTeacher(null);
      fetchTeachers();
    } catch (err) {
      console.error('Error assigning teacher:', err);
      alert('Failed to assign class: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleRemoveAssignment = async (teacherId, assignmentId) => {
    if (!window.confirm("Remove this class assignment?")) return;
    try {
      await teachersAPI.removeAssignment(teacherId, assignmentId);
      fetchTeachers();
    } catch (err) {
      console.error("Error removing assignment", err);
    }
  }

  const toggleExpand = (id) => {
    setExpandedTeacherId(expandedTeacherId === id ? null : id);
  };

  // Filtering Logic
  const filteredTeachers = teachers.filter(teacher => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      teacher.full_name?.toLowerCase().includes(term) ||
      teacher.email?.toLowerCase().includes(term) ||
      teacher.teacher_code?.toLowerCase().includes(term);

    // Safety check for subject_specialization
    const teacherSubject = teacher.subject_specialization?.toLowerCase() || '';
    const matchesSubject = !filterSubject || teacherSubject.includes(filterSubject.toLowerCase());

    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && teacher.user_active) ||
      (filterStatus === 'inactive' && !teacher.user_active);

    return matchesSearch && matchesSubject && matchesStatus;
  });

  const stats = {
    total: teachers.length,
    active: teachers.filter(t => t.user_active).length,
    withAssignments: teachers.filter(t => t.assignments?.length > 0).length,
  };

  return (
    <div className="teachers-layout">
      {/* Header Section */}
      <header className="page-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Faculty Directory</h1>
            <p>Manage teachers, schedule assignments, and class allocations</p>
          </div>
          <button className="btn-primary" onClick={() => { setFormErrors({}); setShowAddModal(true); }}>
            <FiPlus /> Add Teacher
          </button>
        </div>

        {/* Quick Stats Row */}
        <div className="header-stats">
          <div className="stat-badge">
            <span className="label">Total Faculty</span>
            <span className="value">{stats.total}</span>
          </div>
          <div className="stat-badge success">
            <span className="label">Active</span>
            <span className="value">{stats.active}</span>
          </div>
          <div className="stat-badge warning">
            <span className="label">Teaching</span>
            <span className="value">{stats.withAssignments}</span>
          </div>
        </div>
      </header>

      {/* Filters & Search */}
      <div className="filters-container">
        <div className="search-wrapper">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search name, code, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filters-wrapper">
          <div className="select-wrapper">
            <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
              <option value="">All Subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.subject_name}>{s.subject_name}</option>
              ))}
            </select>
            <FiBook className="select-icon" />
          </div>
          <div className="select-wrapper">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <FiFilter className="select-icon" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading Faculty Data...</p>
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="empty-state-modern">
          <div className="empty-illustration">
            <FiUsers />
          </div>
          <h3>No Teachers Found</h3>
          <p>Try adjusting your search terms or add a new teacher.</p>
          <button className="btn-secondary" onClick={() => { setSearchTerm(''); setFilterStatus('all'); }}>
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="teachers-grid-modern">
          {filteredTeachers.map((teacher) => (
            <div key={teacher.id} className={`teacher-card-modern ${expandedTeacherId === teacher.id ? 'expanded' : ''}`}>
              <div className="card-actions-top">
                <div className={`status-dot ${teacher.user_active ? 'online' : 'offline'}`} title={teacher.user_active ? 'Active' : 'Inactive'} />
              </div>

              <div className="card-main-content">
                <div className="card-profile">
                  <div className="avatar-large">
                    {teacher.full_name?.charAt(0).toUpperCase() || 'T'}
                  </div>
                  <div className="profile-info">
                    <h3>{teacher.full_name}</h3>
                    <div className="badges-row">
                      <span className="code-badge">{teacher.teacher_code}</span>
                      {teacher.subject_specialization && (
                        <span className="subject-badge">{teacher.subject_specialization}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="card-details">
                  <div className="detail-row">
                    <FiMail className="icon" />
                    <span>{teacher.email}</span>
                  </div>
                  <div className="detail-row">
                    <FiPhone className="icon" />
                    <span>{teacher.phone || 'No phone'}</span>
                  </div>
                  {teacher.qualification && (
                    <div className="detail-row">
                      <FiBook className="icon" />
                      <span>{teacher.qualification}</span>
                    </div>
                  )}
                </div>

                <div className="card-stats-row">
                  <div className="stat-pill">
                    <strong>{teacher.assignments?.length || 0}</strong>
                    <span>Classes</span>
                  </div>
                  <div className="stat-pill">
                    <strong>{teacher.classes_count || 0}</strong>
                    <span>Sections</span>
                  </div>
                </div>

                <div className="card-footer">
                  <button
                    className="btn-action primary"
                    onClick={() => { setSelectedTeacher(teacher); setShowAssignModal(true); }}
                  >
                    Assign Class
                  </button>
                  <button
                    className={`btn-action secondary ${expandedTeacherId === teacher.id ? 'active' : ''}`}
                    onClick={() => toggleExpand(teacher.id)}
                  >
                    {expandedTeacherId === teacher.id ? <FiChevronUp /> : <FiChevronDown />}
                  </button>
                  <button
                    className="btn-action icon-only danger"
                    onClick={(e) => handleDeleteTeacher(teacher.id, e)}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>

              {/* Collapsible Assignments Section */}
              {expandedTeacherId === teacher.id && (
                <div className="teacher-schedule-section">
                  <h4><FiCalendar /> Teaching Schedule</h4>
                  {teacher.assignments && teacher.assignments.length > 0 ? (
                    <div className="assignments-list">
                      {teacher.assignments.map(ass => (
                        <div key={ass.id} className="schedule-item">
                          <div className="schedule-info">
                            <span className="class-name">{ass.class_name} - {ass.section_name}</span>
                            <span className="subject-name">{ass.subject_name}</span>
                            {ass.is_form_teacher && <span className="form-tag">Form Teacher</span>}
                          </div>
                          <button
                            className="remove-assignment-btn"
                            onClick={() => handleRemoveAssignment(teacher.id, ass.id)}
                            title="Unassign"
                          >
                            <FiX />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-assignments">
                      <p>No active teaching assignments</p>
                      <button className="btn-link" onClick={() => { setSelectedTeacher(teacher); setShowAssignModal(true); }}>Assign a class now</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Teacher Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Add New Faculty</h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleAddTeacher}>
              <div className="modal-body">
                {formErrors.submit && (
                  <div className="error-banner">
                    <FiAlertCircle /> {formErrors.submit}
                  </div>
                )}
                <div className="form-grid">
                  {/* Full Name */}
                  <div className="form-group full">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Sarah Smith"
                      value={newTeacher.fullName}
                      onChange={(e) => setNewTeacher({ ...newTeacher, fullName: e.target.value })}
                      className={formErrors.fullName ? 'error-input' : ''}
                    />
                    {formErrors.fullName && <span className="error-text">{formErrors.fullName}</span>}
                  </div>

                  {/* Email */}
                  <div className="form-group">
                    <label>Email Address *</label>
                    <input
                      type="email"
                      placeholder="sarah@school.com"
                      value={newTeacher.email}
                      onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                      className={formErrors.email ? 'error-input' : ''}
                    />
                    {formErrors.email && <span className="error-text">{formErrors.email}</span>}
                  </div>

                  {/* Phone */}
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      placeholder="10-digit number"
                      value={newTeacher.phone}
                      onChange={(e) => setNewTeacher({ ...newTeacher, phone: e.target.value })}
                      className={formErrors.phone ? 'error-input' : ''}
                    />
                    {formErrors.phone && <span className="error-text">{formErrors.phone}</span>}
                  </div>

                  {/* Password */}
                  <div className="form-group">
                    <label>Initial Password</label>
                    <input
                      type="text"
                      placeholder="Default: teacher123"
                      value={newTeacher.password}
                      onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
                      className={formErrors.password ? 'error-input' : ''}
                    />
                    {formErrors.password ? (
                      <span className="error-text">{formErrors.password}</span>
                    ) : (
                      <small>Leave blank for default</small>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Subject Specialization</label>
                    <input type="text" placeholder="e.g. Mathematics" value={newTeacher.subjectSpecialization} onChange={(e) => setNewTeacher({ ...newTeacher, subjectSpecialization: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Qualification</label>
                    <input type="text" placeholder="e.g. M.Sc, B.Ed" value={newTeacher.qualification} onChange={(e) => setNewTeacher({ ...newTeacher, qualification: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Joining Date</label>
                    <input type="date" value={newTeacher.dateOfJoining} onChange={(e) => setNewTeacher({ ...newTeacher, dateOfJoining: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-text" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedTeacher && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Assign Class to Teacher</h2>
              <button className="close-btn" onClick={() => setShowAssignModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleAssignToSection}>
              <div className="modal-body">
                <div className="assignment-preview">
                  <div className="preview-avatar">{selectedTeacher.full_name?.charAt(0)}</div>
                  <div className="preview-info">
                    <strong>{selectedTeacher.full_name}</strong>
                    <span>{selectedTeacher.subject_specialization}</span>
                  </div>
                </div>

                <div className="form-group">
                  <label>Class & Section</label>
                  <select required value={assignment.sectionId} onChange={(e) => setAssignment({ ...assignment, sectionId: e.target.value })}>
                    <option value="">Select Class...</option>
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>{s.class_name} - {s.section_name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Subject</label>
                  <select required value={assignment.subjectId} onChange={(e) => setAssignment({ ...assignment, subjectId: e.target.value })}>
                    <option value="">Select Subject...</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.subject_name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-checkbox">
                  <input type="checkbox" id="formTeacher" checked={assignment.isFormTeacher} onChange={(e) => setAssignment({ ...assignment, isFormTeacher: e.target.checked })} />
                  <label htmlFor="formTeacher">Assign as Form Teacher</label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-text" onClick={() => setShowAssignModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Confirm Assignment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Teachers;



