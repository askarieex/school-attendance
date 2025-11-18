import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiBook, FiSearch, FiStar, FiUsers } from 'react-icons/fi';
import { subjectsAPI } from '../utils/api';
import './Subjects.css';

const Subjects = () => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    subjectName: '',
    subjectCode: '',
    description: '',
    isActive: true
  });

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      const response = await subjectsAPI.getAll({ includeStats: true });
      console.log('Subjects API Response:', response);

      if (response.success && response.data) {
        // Backend returns: { success: true, data: { subjects: [...], count: 5 } }
        // After axios interceptor: { success: true, data: { subjects: [...] } }
        const subjectsArray = response.data.subjects || [];
        console.log('Extracted subjects:', subjectsArray);
        setSubjects(subjectsArray);
      }
    } catch (err) {
      console.error('Error fetching subjects:', err);
      setError('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDefaults = async () => {
    if (!window.confirm('Create 8 default subjects (Math, English, Science, etc.)?')) {
      return;
    }

    try {
      const response = await subjectsAPI.createDefaults();
      if (response.success) {
        alert('✅ Default subjects created successfully!');
        fetchSubjects();
      }
    } catch (err) {
      console.error('Error creating defaults:', err);
      alert(err.message || 'Failed to create default subjects');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSubject) {
        await subjectsAPI.update(editingSubject.id, formData);
        alert('✅ Subject updated successfully!');
      } else {
        await subjectsAPI.create(formData);
        alert('✅ Subject created successfully!');
      }
      setShowModal(false);
      setFormData({ subjectName: '', subjectCode: '', description: '', isActive: true });
      setEditingSubject(null);
      fetchSubjects();
    } catch (err) {
      console.error('Error saving subject:', err);
      alert(err.message || 'Failed to save subject');
    }
  };

  const handleEdit = (subject) => {
    setEditingSubject(subject);
    setFormData({
      subjectName: subject.subject_name,
      subjectCode: subject.subject_code || '',
      description: subject.description || '',
      isActive: subject.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this subject? This will only deactivate it if it has assignments.')) {
      return;
    }

    try {
      await subjectsAPI.delete(id);
      alert('✅ Subject deleted successfully!');
      fetchSubjects();
    } catch (err) {
      console.error('Error deleting subject:', err);
      alert(err.message || 'Failed to delete subject');
    }
  };

  const filteredSubjects = subjects.filter(subject =>
    subject.subject_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    subject.subject_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="subjects-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading subjects...</p>
        </div>
      </div>
    );
  }

  const stats = {
    total: subjects.length,
    active: subjects.filter(s => s.is_active).length,
    withAssignments: subjects.filter(s => (s.assignment_count || 0) > 0).length,
  };

  return (
    <div className="subjects-container">
      <div className="subjects-header">
        <div>
          <h1>Subjects Management</h1>
          <p>Create, edit, and manage subjects for teacher assignments</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={handleCreateDefaults}>
            <FiStar /> Create Defaults
          </button>
          <button className="btn-primary" onClick={() => {
            setEditingSubject(null);
            setFormData({ subjectName: '', subjectCode: '', description: '', isActive: true });
            setShowModal(true);
          }}>
            <FiPlus /> Add Subject
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Statistics Summary */}
      <div className="stats-summary">
        <div className="summary-card">
          <div className="summary-icon total">
            <FiBook />
          </div>
          <div className="summary-content">
            <span className="summary-value">{stats.total}</span>
            <span className="summary-label">Total Subjects</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon active">
            <FiStar />
          </div>
          <div className="summary-content">
            <span className="summary-value">{stats.active}</span>
            <span className="summary-label">Active</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon assignments">
            <FiUsers />
          </div>
          <div className="summary-content">
            <span className="summary-value">{stats.withAssignments}</span>
            <span className="summary-label">With Assignments</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-bar">
        <FiSearch />
        <input
          type="text"
          placeholder="Search subjects by name or code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Subjects Grid */}
      {filteredSubjects.length === 0 ? (
        <div className="empty-state">
          <FiBook className="empty-icon" />
          <h3>{searchTerm ? 'No subjects found' : 'No subjects yet'}</h3>
          <p>{searchTerm ? 'Try a different search term' : 'Click "Add Subject" to create your first subject'}</p>
          {!searchTerm && (
            <button className="btn-primary" onClick={handleCreateDefaults}>
              <FiStar /> Create Default Subjects
            </button>
          )}
        </div>
      ) : (
        <div className="subjects-grid">
          {filteredSubjects.map((subject) => (
            <div key={subject.id} className="subject-card">
              <div className="subject-header">
                <div className="subject-icon">
                  {(subject.subject_code || subject.subject_name?.charAt(0) || 'S').charAt(0)}
                </div>
                <div className="subject-status">
                  <span className={`status-badge ${subject.is_active ? 'active' : 'inactive'}`}>
                    {subject.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="subject-info">
                <h3>{subject.subject_name}</h3>
                {subject.subject_code && (
                  <p className="subject-code">Code: {subject.subject_code}</p>
                )}
                {subject.description && (
                  <p className="subject-description">{subject.description}</p>
                )}
              </div>

              <div className="subject-stats">
                <div className="stat-item">
                  <FiUsers className="stat-icon" />
                  <span>{subject.teacher_count || 0} teacher{(subject.teacher_count || 0) !== 1 ? 's' : ''}</span>
                </div>
                <div className="stat-item">
                  <FiBook className="stat-icon" />
                  <span>{subject.assignment_count || 0} assignment{(subject.assignment_count || 0) !== 1 ? 's' : ''}</span>
                </div>
              </div>

              <div className="subject-actions">
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => handleEdit(subject)}
                  title="Edit subject"
                >
                  <FiEdit2 /> Edit
                </button>
                <button
                  className="btn-danger btn-sm"
                  onClick={() => handleDelete(subject.id)}
                  title="Delete subject"
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Subject Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingSubject ? 'Edit Subject' : 'Add New Subject'}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Subject Name *</label>
                <input
                  type="text"
                  value={formData.subjectName}
                  onChange={(e) => setFormData({ ...formData, subjectName: e.target.value })}
                  placeholder="e.g., Mathematics, English"
                  required
                />
              </div>
              <div className="form-group">
                <label>Subject Code</label>
                <input
                  type="text"
                  value={formData.subjectCode}
                  onChange={(e) => setFormData({ ...formData, subjectCode: e.target.value })}
                  placeholder="e.g., MATH, ENG"
                  maxLength={20}
                />
                <small>Optional - Short code for the subject</small>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <span>Active</span>
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingSubject ? 'Update' : 'Create'} Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subjects;
