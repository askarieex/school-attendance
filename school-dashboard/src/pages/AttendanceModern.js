import React, { useState, useEffect } from 'react';
import {
  FiCalendar, FiDownload, FiSearch, FiFilter, FiRefreshCw,
  FiCheckCircle, FiClock, FiXCircle, FiUsers, FiEdit
} from 'react-icons/fi';
import { attendanceAPI } from '../utils/api';
import './AttendanceModern.css';

const AttendanceModern = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0
  });

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    late: 0,
    absent: 0
  });

  useEffect(() => {
    fetchAttendance();
  }, [searchTerm, dateFilter, statusFilter, pagination.currentPage]);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.currentPage,
        limit: 20,
        search: searchTerm
      };

      if (dateFilter) {
        params.date = dateFilter;
      }

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const response = await attendanceAPI.getLogs(params);

      if (response.success) {
        setLogs(response.data || []);
        if (response.pagination) {
          setPagination(response.pagination);
        }

        // Calculate statistics
        const allLogs = response.data || [];
        const presentCount = allLogs.filter(log => log.status === 'present').length;
        const lateCount = allLogs.filter(log => log.status === 'late').length;
        const absentCount = allLogs.filter(log => log.status === 'absent').length;

        setStats({
          total: allLogs.length,
          present: presentCount,
          late: lateCount,
          absent: absentCount
        });
      } else {
        setError('Failed to load attendance logs');
      }
    } catch (err) {
      console.error('Error fetching attendance:', err);
      setError('An error occurred while loading attendance logs');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = {
        date: dateFilter,
        format: 'csv'
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const response = await attendanceAPI.export(params);

      if (response.success) {
        alert('Export started! The file will be downloaded shortly.');
      } else {
        alert('Export failed');
      }
    } catch (err) {
      console.error('Error exporting:', err);
      alert('An error occurred while exporting');
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusIcon = (status) => {
    const iconMap = {
      present: <FiCheckCircle className="status-icon status-present" />,
      late: <FiClock className="status-icon status-late" />,
      absent: <FiXCircle className="status-icon status-absent" />
    };
    return iconMap[status] || <FiCheckCircle className="status-icon" />;
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      present: { class: 'status-badge-present', label: 'PRESENT' },
      late: { class: 'status-badge-late', label: 'LATE' },
      absent: { class: 'status-badge-absent', label: 'ABSENT' }
    };

    const statusInfo = statusMap[status] || { class: 'status-badge-default', label: status };

    return (
      <span className={`status-badge ${statusInfo.class}`}>
        {getStatusIcon(status)}
        {statusInfo.label}
      </span>
    );
  };

  const calculatePercentage = (count) => {
    if (stats.total === 0) return 0;
    return ((count / stats.total) * 100).toFixed(0);
  };

  return (
    <div className="attendance-modern-container">
      {/* Header Section */}
      <div className="attendance-header-section">
        <div className="header-title-group">
          <div className="header-icon">
            <FiCheckCircle />
          </div>
          <div>
            <h1 className="page-title">Attendance Management</h1>
            <p className="page-subtitle">Today's attendance records</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-refresh" onClick={fetchAttendance}>
            <FiRefreshCw /> Refresh
          </button>
          <button className="btn-export" onClick={handleExport}>
            <FiDownload /> Export CSV
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card stat-total">
          <div className="stat-card-left">
            <div className="stat-icon-wrapper stat-icon-total">
              <FiUsers />
            </div>
          </div>
          <div className="stat-card-right">
            <div className="stat-label">TOTAL STUDENTS</div>
            <div className="stat-value">{stats.total}</div>
          </div>
        </div>

        <div className="stat-card stat-present">
          <div className="stat-card-left">
            <div className="stat-icon-wrapper stat-icon-present">
              <FiCheckCircle />
            </div>
            <div className="stat-progress">
              <div className="stat-label">PRESENT</div>
              <div className="stat-percentage">{calculatePercentage(stats.present)}%</div>
            </div>
          </div>
          <div className="stat-card-right">
            <div className="stat-value-large">{stats.present}</div>
          </div>
        </div>

        <div className="stat-card stat-late">
          <div className="stat-card-left">
            <div className="stat-icon-wrapper stat-icon-late">
              <FiClock />
            </div>
            <div className="stat-progress">
              <div className="stat-label">LATE</div>
              <div className="stat-percentage">{calculatePercentage(stats.late)}%</div>
            </div>
          </div>
          <div className="stat-card-right">
            <div className="stat-value-large">{stats.late}</div>
          </div>
        </div>

        <div className="stat-card stat-absent">
          <div className="stat-card-left">
            <div className="stat-icon-wrapper stat-icon-absent">
              <FiXCircle />
            </div>
            <div className="stat-progress">
              <div className="stat-label">ABSENT</div>
              <div className="stat-percentage">{calculatePercentage(stats.absent)}%</div>
            </div>
          </div>
          <div className="stat-card-right">
            <div className="stat-value-large">{stats.absent}</div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert-error">
          <FiXCircle />
          {error}
        </div>
      )}

      {/* Filters Section */}
      <div className="filters-section">
        <div className="search-box-modern">
          <FiSearch className="search-icon-modern" />
          <input
            type="text"
            placeholder="Search by student name or RFID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input-modern"
          />
        </div>

        <div className="filter-controls">
          <div className="filter-item">
            <FiCalendar className="filter-icon-modern" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="filter-input-modern"
            />
          </div>

          <div className="filter-item">
            <FiFilter className="filter-icon-modern" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select-modern"
            >
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
            </select>
          </div>

          <div className="filter-item">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="filter-select-modern"
            >
              <option value="all">All Classes</option>
              <option value="1">Class 1</option>
              <option value="2">Class 2</option>
            </select>
          </div>

          <div className="filter-item">
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="filter-select-modern"
            >
              <option value="all">All Sections</option>
              <option value="A">Section A</option>
              <option value="B">Section B</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Section */}
      {loading ? (
        <div className="loading-modern">
          <div className="spinner-modern"></div>
          <p>Loading attendance records...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="empty-state-modern">
          <FiUsers className="empty-icon" />
          <h3>No Attendance Records</h3>
          <p>No attendance records found for the selected date and filters</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper-modern">
            <table className="attendance-table-modern">
              <thead>
                <tr>
                  <th>STUDENT NAME</th>
                  <th>RFID UID</th>
                  <th>CLASS</th>
                  <th>SECTION</th>
                  <th>CHECK-IN TIME</th>
                  <th>CHECK-OUT TIME</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div className="student-cell">
                        <div className="student-avatar">
                          {(log.student_name || 'U')[0].toUpperCase()}
                        </div>
                        <div className="student-info">
                          <div className="student-name-primary">{log.student_name}</div>
                          <div className="student-roll">Roll #{log.id || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="rfid-badge">{log.rfid_uid}</span>
                    </td>
                    <td>
                      <span className="class-text">{log.grade || '-'}</span>
                    </td>
                    <td>
                      <span className="section-text">{log.section || '-'}</span>
                    </td>
                    <td>
                      <div className="time-cell">
                        <FiClock className="time-icon" />
                        {formatTime(log.check_in_time || log.timestamp)}
                      </div>
                    </td>
                    <td>
                      <div className="time-cell">
                        {log.check_out_time ? (
                          <>
                            <FiClock className="time-icon" />
                            {formatTime(log.check_out_time)}
                          </>
                        ) : (
                          <span className="time-pending">-</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {getStatusBadge(log.status || 'present')}
                    </td>
                    <td>
                      <button className="btn-action-edit">
                        <FiEdit />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination-modern">
              <button
                className="btn-pagination"
                onClick={() => setPagination({ ...pagination, currentPage: pagination.currentPage - 1 })}
                disabled={pagination.currentPage === 1}
              >
                Previous
              </button>
              <div className="pagination-info-modern">
                Page <span className="page-number">{pagination.currentPage}</span> of{' '}
                <span className="page-number">{pagination.totalPages}</span>
                <span className="record-count">({pagination.totalRecords} records)</span>
              </div>
              <button
                className="btn-pagination"
                onClick={() => setPagination({ ...pagination, currentPage: pagination.currentPage + 1 })}
                disabled={pagination.currentPage === pagination.totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AttendanceModern;
