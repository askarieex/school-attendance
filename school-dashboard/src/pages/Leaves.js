import React, { useState, useEffect } from 'react';
import {
  FiCalendar, FiUserX, FiPlus, FiTrash2, FiEdit, FiCheck, FiX,
  FiFilter, FiSearch, FiRefreshCw
} from 'react-icons/fi';
import { leavesAPI, studentsAPI } from '../utils/api';
import LeaveModal from '../components/LeaveModal';
import './Leaves.css';

const Leaves = () => {
  const [leaves, setLeaves] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    fetchLeaves();
    fetchStudents();
  }, [selectedYear, selectedMonth, statusFilter, typeFilter]);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const response = await leavesAPI.getMonthly({
        year: selectedYear,
        month: selectedMonth
      });

      if (response.success && response.data) {
        let filteredLeaves = response.data;

        // Apply filters
        if (statusFilter !== 'all') {
          filteredLeaves = filteredLeaves.filter(leave => leave.status === statusFilter);
        }
        if (typeFilter !== 'all') {
          filteredLeaves = filteredLeaves.filter(leave => leave.leave_type === typeFilter);
        }

        setLeaves(filteredLeaves);
      }
    } catch (err) {
      console.error('Error fetching leaves:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const handleDeleteLeave = async (leaveId) => {
    if (!window.confirm('Are you sure you want to delete this leave?')) {
      return;
    }

    try {
      const response = await leavesAPI.delete(leaveId);
      if (response.success) {
        fetchLeaves();
      } else {
        alert(response.message || 'Failed to delete leave');
      }
    } catch (err) {
      console.error('Error deleting leave:', err);
      alert('Failed to delete leave');
    }
  };

  const handleUpdateStatus = async (leaveId, newStatus) => {
    try {
      const response = await leavesAPI.updateStatus(leaveId, newStatus);
      if (response.success) {
        fetchLeaves();
      } else {
        alert(response.message || 'Failed to update leave status');
      }
    } catch (err) {
      console.error('Error updating leave status:', err);
      alert('Failed to update leave status');
    }
  };

  const handleLeaveSuccess = () => {
    fetchLeaves();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getLeaveTypeBadge = (type) => {
    const badges = {
      sick: { label: 'Sick', className: 'leave-type-badge sick' },
      personal: { label: 'Personal', className: 'leave-type-badge personal' },
      emergency: { label: 'Emergency', className: 'leave-type-badge emergency' },
      other: { label: 'Other', className: 'leave-type-badge other' }
    };
    return badges[type] || badges.other;
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { label: 'Pending', className: 'leave-status-badge pending' },
      approved: { label: 'Approved', className: 'leave-status-badge approved' },
      rejected: { label: 'Rejected', className: 'leave-status-badge rejected' }
    };
    return badges[status] || badges.pending;
  };

  const filteredLeaves = leaves.filter(leave => {
    const studentName = leave.student_name || '';
    return studentName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const stats = {
    total: leaves.length,
    approved: leaves.filter(l => l.status === 'approved').length,
    pending: leaves.filter(l => l.status === 'pending').length,
    rejected: leaves.filter(l => l.status === 'rejected').length
  };

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  const years = [2023, 2024, 2025, 2026];

  return (
    <div className="leaves-container">
      {/* Header */}
      <div className="leaves-header">
        <div className="leaves-title-group">
          <div className="leaves-icon-badge">
            <FiUserX />
          </div>
          <div>
            <h1>Leave Management</h1>
            <p>Manage student leave applications</p>
          </div>
        </div>
        <button
          className="leaves-add-btn"
          onClick={() => setShowLeaveModal(true)}
        >
          <FiPlus /> Add Leave
        </button>
      </div>

      {/* Stats Bar */}
      <div className="leaves-stats">
        <div className="leave-stat">
          <span className="stat-label">Total</span>
          <span className="stat-number">{stats.total}</span>
        </div>
        <div className="leave-stat approved">
          <span className="stat-label">Approved</span>
          <span className="stat-number">{stats.approved}</span>
        </div>
        <div className="leave-stat pending">
          <span className="stat-label">Pending</span>
          <span className="stat-number">{stats.pending}</span>
        </div>
        <div className="leave-stat rejected">
          <span className="stat-label">Rejected</span>
          <span className="stat-number">{stats.rejected}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="leaves-filters">
        <div className="filter-group">
          <FiSearch className="filter-icon" />
          <input
            type="text"
            placeholder="Search student name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="filter-input"
          />
        </div>

        <div className="filter-group">
          <FiCalendar className="filter-icon" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="filter-select"
          >
            {months.map(month => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="filter-select"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <FiFilter className="filter-icon" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="filter-group">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Types</option>
            <option value="sick">Sick Leave</option>
            <option value="personal">Personal Leave</option>
            <option value="emergency">Emergency Leave</option>
            <option value="other">Other</option>
          </select>
        </div>

        <button className="filter-refresh-btn" onClick={fetchLeaves} title="Refresh">
          <FiRefreshCw />
        </button>
      </div>

      {/* Leaves Table */}
      {loading ? (
        <div className="leaves-loading">
          <div className="loading-spinner"></div>
          <p>Loading leaves...</p>
        </div>
      ) : filteredLeaves.length === 0 ? (
        <div className="leaves-empty">
          <FiUserX className="empty-icon" />
          <h3>No Leaves Found</h3>
          <p>No leaves match your current filters</p>
        </div>
      ) : (
        <div className="leaves-table-container">
          <table className="leaves-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Student Name</th>
                <th>Leave Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Duration</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Applied Via</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeaves.map((leave, index) => {
                const typeBadge = getLeaveTypeBadge(leave.leave_type);
                const statusBadge = getStatusBadge(leave.status);
                const startDate = new Date(leave.start_date);
                const endDate = new Date(leave.end_date);
                const duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

                return (
                  <tr key={leave.id}>
                    <td>{index + 1}</td>
                    <td className="student-name-cell">
                      <div className="student-avatar-tiny">
                        {leave.student_name?.charAt(0).toUpperCase() || 'S'}
                      </div>
                      <span>{leave.student_name || 'Unknown'}</span>
                    </td>
                    <td>
                      <span className={typeBadge.className}>{typeBadge.label}</span>
                    </td>
                    <td>{formatDate(leave.start_date)}</td>
                    <td>{formatDate(leave.end_date)}</td>
                    <td>{duration} day{duration > 1 ? 's' : ''}</td>
                    <td className="reason-cell">{leave.reason || '-'}</td>
                    <td>
                      <span className={statusBadge.className}>{statusBadge.label}</span>
                    </td>
                    <td className="applied-via-cell">{leave.applied_via || 'manual'}</td>
                    <td className="actions-cell">
                      {leave.status === 'pending' && (
                        <>
                          <button
                            className="action-icon-btn approve"
                            onClick={() => handleUpdateStatus(leave.id, 'approved')}
                            title="Approve"
                          >
                            <FiCheck />
                          </button>
                          <button
                            className="action-icon-btn reject"
                            onClick={() => handleUpdateStatus(leave.id, 'rejected')}
                            title="Reject"
                          >
                            <FiX />
                          </button>
                        </>
                      )}
                      <button
                        className="action-icon-btn delete"
                        onClick={() => handleDeleteLeave(leave.id)}
                        title="Delete"
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Leave Modal */}
      <LeaveModal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        onSuccess={handleLeaveSuccess}
      />
    </div>
  );
};

export default Leaves;
