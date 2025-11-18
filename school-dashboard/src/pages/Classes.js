import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiUsers, FiBook } from 'react-icons/fi';
import { classesAPI, sectionsAPI, academicYearAPI } from '../utils/api';
import './Classes.css';

const Classes = () => {
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [expandedClass, setExpandedClass] = useState(null);

  // Form states
  const [newClass, setNewClass] = useState({
    className: '',
    academicYear: '',
    description: ''
  });

  const [newSection, setNewSection] = useState({
    sectionName: '',
    maxCapacity: 40,
    roomNumber: ''
  });

  useEffect(() => {
    fetchClasses();
    fetchAcademicYears();
  }, []);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const response = await classesAPI.getAll();
      if (response.success) {
        setClasses(response.data);
      } else {
        setError('Failed to load classes');
      }
    } catch (err) {
      console.error('Error fetching classes:', err);
      setError('An error occurred while loading classes');
    } finally {
      setLoading(false);
    }
  };

  const fetchAcademicYears = async () => {
    try {
      const response = await academicYearAPI.getAll();
      if (response.success) {
        setAcademicYears(response.data);
        // Set default academic year to current or first available
        if (response.data.length > 0) {
          const currentYear = response.data.find(year => year.is_current);
          setNewClass(prev => ({
            ...prev,
            academicYear: currentYear ? currentYear.year_name : response.data[0].year_name
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching academic years:', err);
    }
  };

  const handleAddClass = async (e) => {
    e.preventDefault();

    // Validate academic year is selected
    if (!newClass.academicYear) {
      alert('Please select an academic year');
      return;
    }

    try {
      const response = await classesAPI.create(newClass);
      if (response.success) {
        setShowAddClassModal(false);
        // Reset form to default academic year
        const currentYear = academicYears.find(year => year.is_current);
        setNewClass({
          className: '',
          academicYear: currentYear ? currentYear.year_name : (academicYears[0]?.year_name || ''),
          description: ''
        });
        fetchClasses();
      }
    } catch (err) {
      console.error('Error creating class:', err);
      alert(err.message || 'Failed to create class');
    }
  };

  const handleAddSection = async (e) => {
    e.preventDefault();
    try {
      const response = await sectionsAPI.create(selectedClass.id, newSection);
      if (response.success) {
        setShowAddSectionModal(false);
        setNewSection({ sectionName: '', maxCapacity: 40, roomNumber: '' });
        setSelectedClass(null);
        fetchClasses();
      }
    } catch (err) {
      console.error('Error creating section:', err);
      alert(err.message || 'Failed to create section');
    }
  };

  const handleDeleteClass = async (classId) => {
    if (!window.confirm('Are you sure you want to delete this class? This will also deactivate all sections.')) {
      return;
    }

    try {
      await classesAPI.delete(classId);
      fetchClasses();
    } catch (err) {
      console.error('Error deleting class:', err);
      alert('Failed to delete class');
    }
  };

  const toggleExpand = async (classItem) => {
    if (expandedClass === classItem.id) {
      setExpandedClass(null);
    } else {
      setExpandedClass(classItem.id);
      // Fetch sections for this class
      try {
        const response = await sectionsAPI.getByClass(classItem.id);
        if (response.success) {
          setClasses(prevClasses =>
            prevClasses.map(c =>
              c.id === classItem.id ? { ...c, sections: response.data } : c
            )
          );
        }
      } catch (err) {
        console.error('Error fetching sections:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="classes-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading classes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="classes-container">
      <div className="classes-header">
        <div>
          <h1>Classes & Sections</h1>
          <p>Manage your school's classes and sections</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddClassModal(true)}>
          <FiPlus /> Add Class
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {classes.length === 0 ? (
        <div className="empty-state">
          <FiBook className="empty-icon" />
          <h3>No classes yet</h3>
          <p>Get started by creating your first class</p>
          <button className="btn-primary" onClick={() => setShowAddClassModal(true)}>
            <FiPlus /> Add First Class
          </button>
        </div>
      ) : (
        <div className="classes-list">
          {classes.map((classItem) => (
            <div key={classItem.id} className="class-card">
              <div className="class-header" onClick={() => toggleExpand(classItem)}>
                <div className="class-info">
                  <h3>{classItem.class_name}</h3>
                  <p>{classItem.description}</p>
                  <div className="class-meta">
                    <span className="badge badge-blue">
                      {classItem.section_count} Sections
                    </span>
                    <span className="badge badge-green">
                      {classItem.student_count} Students
                    </span>
                    <span className="badge badge-gray">
                      {classItem.academic_year}
                    </span>
                  </div>
                </div>
                <div className="class-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn-icon btn-success"
                    onClick={() => {
                      setSelectedClass(classItem);
                      setShowAddSectionModal(true);
                    }}
                    title="Add Section"
                  >
                    <FiPlus />
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => handleDeleteClass(classItem.id)}
                    title="Delete Class"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>

              {expandedClass === classItem.id && classItem.sections && (
                <div className="sections-list">
                  <h4>Sections</h4>
                  {classItem.sections.length === 0 ? (
                    <p className="no-sections">No sections yet. Add one to get started.</p>
                  ) : (
                    <div className="sections-grid">
                      {classItem.sections.map((section) => (
                        <div key={section.id} className="section-card">
                          <div className="section-header">
                            <h5>Section {section.section_name}</h5>
                            {section.room_number && (
                              <span className="room-badge">Room {section.room_number}</span>
                            )}
                          </div>
                          <div className="section-info">
                            <div className="info-item">
                              <FiUsers />
                              <span>
                                {section.student_count || 0} / {section.max_capacity} students
                              </span>
                            </div>
                            {section.form_teacher_name && (
                              <div className="info-item">
                                <span className="teacher-label">Form Teacher:</span>
                                <span>{section.form_teacher_name}</span>
                              </div>
                            )}
                          </div>
                          <div className="section-progress">
                            <div
                              className="progress-bar"
                              style={{
                                width: `${((section.student_count || 0) / section.max_capacity) * 100}%`
                              }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Class Modal */}
      {showAddClassModal && (
        <div className="modal-overlay" onClick={() => setShowAddClassModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Class</h2>
              <button className="close-btn" onClick={() => setShowAddClassModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleAddClass}>
              <div className="form-group">
                <label>Class Name *</label>
                <input
                  type="text"
                  value={newClass.className}
                  onChange={(e) => setNewClass({ ...newClass, className: e.target.value })}
                  placeholder="e.g., Grade 9, Grade 10"
                  required
                />
              </div>
              <div className="form-group">
                <label>Academic Year *</label>
                {academicYears.length === 0 ? (
                  <div className="alert alert-warning" style={{ marginTop: '8px', padding: '12px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px' }}>
                    <p style={{ margin: 0, color: '#856404' }}>
                      ⚠️ No academic years found. Please create one first in <strong>Settings → Academic Year</strong>
                    </p>
                  </div>
                ) : (
                  <select
                    value={newClass.academicYear}
                    onChange={(e) => setNewClass({ ...newClass, academicYear: e.target.value })}
                    required
                  >
                    <option value="">Select Academic Year</option>
                    {academicYears.map((year) => (
                      <option key={year.id} value={year.year_name}>
                        {year.year_name} {year.is_current ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newClass.description}
                  onChange={(e) => setNewClass({ ...newClass, description: e.target.value })}
                  placeholder="Optional description"
                  rows="3"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddClassModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Add Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Section Modal */}
      {showAddSectionModal && selectedClass && (
        <div className="modal-overlay" onClick={() => setShowAddSectionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Section to {selectedClass.class_name}</h2>
              <button className="close-btn" onClick={() => setShowAddSectionModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleAddSection}>
              <div className="form-group">
                <label>Section Name *</label>
                <input
                  type="text"
                  value={newSection.sectionName}
                  onChange={(e) => setNewSection({ ...newSection, sectionName: e.target.value })}
                  placeholder="e.g., A, B, C"
                  required
                />
              </div>
              <div className="form-group">
                <label>Max Capacity *</label>
                <input
                  type="number"
                  value={newSection.maxCapacity}
                  onChange={(e) => setNewSection({ ...newSection, maxCapacity: parseInt(e.target.value) })}
                  min="1"
                  required
                />
              </div>
              <div className="form-group">
                <label>Room Number</label>
                <input
                  type="text"
                  value={newSection.roomNumber}
                  onChange={(e) => setNewSection({ ...newSection, roomNumber: e.target.value })}
                  placeholder="e.g., 101, 102"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddSectionModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Add Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Classes;
