import React, { useState, useEffect } from 'react';
import './ManualAttendanceModal.css';

const ManualAttendanceModal = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  students, 
  classes,
  preselectedStudentId = null,
  preselectedDate = null 
}) => {
  const [formData, setFormData] = useState({
    studentId: '',
    date: '',
    time: '',
    status: 'present',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');

  // Initialize date and time to current IST
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const istDate = new Date(now.getTime() + (330 * 60 * 1000)); // IST offset

      const year = istDate.getUTCFullYear();
      const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(istDate.getUTCDate()).padStart(2, '0');
      const hours = String(istDate.getUTCHours()).padStart(2, '0');
      const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');

      setFormData(prev => ({
        ...prev,
        studentId: preselectedStudentId || prev.studentId,
        date: preselectedDate || `${year}-${month}-${day}`,
        time: `${hours}:${minutes}`
      }));

      // If preselected student, also set the class filter
      if (preselectedStudentId && students) {
        const student = students.find(s => s.id === preselectedStudentId);
        if (student && student.class_id) {
          setSelectedClassFilter(student.class_id.toString());
        }
      }
    }
  }, [isOpen, preselectedStudentId, preselectedDate, students]);

  // Filter students based on search term and class
  useEffect(() => {
    let filtered = students || [];

    // Filter by class
    if (selectedClassFilter !== 'all') {
      filtered = filtered.filter(s => s.class_id === parseInt(selectedClassFilter));
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.full_name?.toLowerCase().includes(term) ||
        s.roll_number?.toString().includes(term) ||
        s.rfid_card_id?.toLowerCase().includes(term)
      );
    }

    setFilteredStudents(filtered);
  }, [searchTerm, students, selectedClassFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.studentId) {
      setError('Please select a student');
      return;
    }
    if (!formData.date) {
      setError('Please select a date');
      return;
    }
    if (!formData.time) {
      setError('Please select a time');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';
      const response = await fetch(`${API_BASE_URL}/school/attendance/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId: parseInt(formData.studentId),
          date: formData.date,
          checkInTime: formData.time,
          status: formData.status,
          notes: formData.notes.trim() || undefined
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to mark attendance');
      }

      // Success
      onSuccess && onSuccess(data.data);
      handleClose();

    } catch (err) {
      console.error('Error marking manual attendance:', err);
      setError(err.message || 'Failed to mark attendance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      studentId: '',
      date: '',
      time: '',
      status: 'present',
      notes: ''
    });
    setSearchTerm('');
    setSelectedClassFilter('all');
    setError('');
    onClose();
  };

  const selectedStudent = students?.find(s => s.id === parseInt(formData.studentId));

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manual Attendance</h2>
          <button className="modal-close" onClick={handleClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="manual-attendance-form">
          {error && (
            <div className="error-banner">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          {/* Class Filter */}
          <div className="form-group">
            <label>Filter by Class (Optional)</label>
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="form-select"
            >
              <option value="all">All Classes</option>
              {classes?.map(cls => (
                <option key={cls.id} value={cls.id}>
                  {cls.class_name}
                </option>
              ))}
            </select>
          </div>

          {/* Student Search */}
          <div className="form-group">
            <label>Search Student</label>
            <input
              type="text"
              placeholder="Search by name, roll no, or RFID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
            />
          </div>

          {/* Student Selection */}
          <div className="form-group">
            <label>Select Student *</label>
            <select
              value={formData.studentId}
              onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
              className="form-select"
              required
            >
              <option value="">-- Select Student --</option>
              {filteredStudents.map(student => (
                <option key={student.id} value={student.id}>
                  {student.full_name} ({student.roll_number || 'No Roll'}) - {student.class_name} {student.section_name}
                </option>
              ))}
            </select>
            {filteredStudents.length === 0 && searchTerm && (
              <small className="text-muted">No students found</small>
            )}
            {filteredStudents.length === 0 && !searchTerm && students.length === 0 && (
              <small className="text-muted">Loading students...</small>
            )}
          </div>

          {/* Selected Student Info */}
          {selectedStudent && (
            <div className="selected-student-info">
              <strong>{selectedStudent.full_name}</strong>
              <span className="student-details">
                Roll No: {selectedStudent.roll_number || 'N/A'} |
                Class: {selectedStudent.class_name} {selectedStudent.section_name} |
                RFID: {selectedStudent.rfid_card_id || 'N/A'}
              </span>
            </div>
          )}

          {/* Date */}
          <div className="form-group">
            <label>Date *</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="form-input"
              required
            />
            <small className="text-muted">You can select any date (past or present)</small>
          </div>

          {/* Time */}
          <div className="form-group">
            <label>Check-in Time *</label>
            <input
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              className="form-input"
              required
            />
            <small className="text-muted">
              System will automatically calculate if student is Present or Late based on school timings
            </small>
          </div>

          {/* Mark as Absent Option */}
          <div className="form-group">
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={formData.status === 'absent'}
                onChange={(e) => setFormData({ ...formData, status: e.target.checked ? 'absent' : 'present' })}
              />
              <span>Mark as Absent (student didn't attend)</span>
            </label>
            <small className="text-muted">
              Check this box only if the student was absent. Otherwise, status will be auto-calculated from check-in time.
            </small>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label>Notes / Reason (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g., Hardware malfunction, Lost RFID card, Forgotten card, etc."
              className="form-textarea"
              rows="3"
            />
            <small className="text-muted">Add any relevant notes about this manual entry</small>
          </div>

          {/* Action Buttons */}
          <div className="modal-actions">
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Marking Attendance...' : 'Mark Attendance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualAttendanceModal;
