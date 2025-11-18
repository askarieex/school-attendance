import React, { useState, useEffect } from 'react';
import { FiX, FiCalendar, FiUser } from 'react-icons/fi';
import { leavesAPI, studentsAPI } from '../utils/api';
import './LeaveModal.css';

const LeaveModal = ({ isOpen, onClose, onSuccess, preSelectedStudent, preSelectedDate }) => {
  const [formData, setFormData] = useState({
    studentId: '',
    leaveType: 'sick',
    startDate: '',
    endDate: '',
    reason: ''
  });
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchStudents();
      // Pre-fill form with selected student and date if available
      setFormData({
        studentId: preSelectedStudent?.id || '',
        leaveType: 'sick',
        startDate: preSelectedDate || '',
        endDate: preSelectedDate || '',
        reason: ''
      });
      setError('');
    }
  }, [isOpen, preSelectedStudent, preSelectedDate]);

  const fetchStudents = async () => {
    try {
      const response = await studentsAPI.getAll({ limit: 1000 });
      if (response.success) {
        const studentsList = response.data.students || response.data || [];
        setStudents(studentsList);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.studentId) {
      setError('Please select a student');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      setError('Please select start and end dates');
      return;
    }
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      setError('End date must be after or equal to start date');
      return;
    }

    setLoading(true);

    try {
      const response = await leavesAPI.create({
        studentId: parseInt(formData.studentId),
        leaveType: formData.leaveType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason,
        appliedVia: 'manual'
      });

      if (response.success) {
        onSuccess && onSuccess(response.data);
        onClose();
      } else {
        setError(response.message || 'Failed to create leave');
      }
    } catch (err) {
      console.error('Error creating leave:', err);
      setError(err.message || 'Failed to create leave. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="leave-modal-overlay" onClick={onClose}>
      <div className="leave-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="leave-modal-header">
          <div className="leave-modal-title-group">
            <FiCalendar className="leave-modal-icon" />
            <h2>Add Student Leave</h2>
          </div>
          <button className="leave-modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>

        {preSelectedStudent && preSelectedDate && (
          <div className="leave-modal-info">
            ℹ️ Pre-filled for <strong>{preSelectedStudent.full_name}</strong> on <strong>{new Date(preSelectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
            <br />
            <small>You can change the student or dates if needed</small>
          </div>
        )}

        {error && (
          <div className="leave-modal-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="leave-modal-form">
          <div className="leave-form-group">
            <label htmlFor="studentId">
              <FiUser /> Student *
            </label>
            <select
              id="studentId"
              name="studentId"
              value={formData.studentId}
              onChange={handleChange}
              required
              className="leave-form-select"
            >
              <option value="">Select a student</option>
              {students.map(student => (
                <option key={student.id} value={student.id}>
                  {student.full_name}
                  {student.roll_number ? ` (Roll: ${student.roll_number})` : ''}
                  {student.class_name ? ` - ${student.class_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="leave-form-row">
            <div className="leave-form-group">
              <label htmlFor="startDate">Start Date *</label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                required
                className="leave-form-input"
              />
            </div>

            <div className="leave-form-group">
              <label htmlFor="endDate">End Date *</label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                required
                className="leave-form-input"
              />
            </div>
          </div>

          <div className="leave-form-group">
            <label htmlFor="leaveType">Leave Type *</label>
            <select
              id="leaveType"
              name="leaveType"
              value={formData.leaveType}
              onChange={handleChange}
              required
              className="leave-form-select"
            >
              <option value="sick">Sick Leave</option>
              <option value="personal">Personal Leave</option>
              <option value="emergency">Emergency Leave</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="leave-form-group">
            <label htmlFor="reason">Reason</label>
            <textarea
              id="reason"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              placeholder="Enter reason for leave (optional)"
              rows="3"
              className="leave-form-textarea"
            />
          </div>

          <div className="leave-modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="leave-btn leave-btn-cancel"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="leave-btn leave-btn-submit"
              disabled={loading}
            >
              {loading ? 'Adding Leave...' : 'Add Leave'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeaveModal;
