import React, { useState, useEffect } from 'react';
import { FiCalendar, FiDownload, FiSearch, FiFilter } from 'react-icons/fi';
import { attendanceAPI } from '../utils/api';
import './Attendance.css';

const Attendance = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0
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
      minute: '2-digit',
      second: '2-digit'
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

  const getStatusBadge = (status) => {
    const statusMap = {
      present: { class: 'badge-success', label: 'Present' },
      late: { class: 'badge-warning', label: 'Late' },
      absent: { class: 'badge-danger', label: 'Absent' }
    };

    const statusInfo = statusMap[status] || { class: 'badge-secondary', label: status };

    return <span className={`badge ${statusInfo.class}`}>{statusInfo.label}</span>;
  };

  return (
    <div className="attendance-container">
      <div className="attendance-header">
        <div>
          <h1>Attendance Logs</h1>
          <p>View and manage student attendance records</p>
        </div>
        <button className="btn btn-primary" onClick={handleExport}>
          <FiDownload /> Export Report
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <div className="attendance-toolbar">
        <div className="toolbar-left">
          <div className="search-box">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search by student name or RFID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <div className="toolbar-right">
          <div className="filter-group">
            <FiCalendar className="filter-icon" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <FiFilter className="filter-icon" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading attendance logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <p>No attendance records found for the selected filters</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Student Name</th>
                  <th>RFID UID</th>
                  <th>Grade/Section</th>
                  <th>Check-in Time</th>
                  <th>Check-out Time</th>
                  <th>Status</th>
                  <th>Device</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className="date-cell">{formatDate(log.timestamp)}</span>
                    </td>
                    <td>
                      <div className="student-name">{log.student_name}</div>
                    </td>
                    <td>
                      <span className="badge badge-blue">{log.rfid_uid}</span>
                    </td>
                    <td>
                      {log.grade && log.section
                        ? `${log.grade} - ${log.section}`
                        : log.grade || log.section || '-'}
                    </td>
                    <td>
                      <span className="time-cell">{formatTime(log.check_in_time || log.timestamp)}</span>
                    </td>
                    <td>
                      <span className="time-cell">{formatTime(log.check_out_time)}</span>
                    </td>
                    <td>{getStatusBadge(log.status || 'present')}</td>
                    <td>
                      <small className="device-info">{log.device_name || '-'}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-secondary"
                onClick={() => setPagination({ ...pagination, currentPage: pagination.currentPage - 1 })}
                disabled={pagination.currentPage === 1}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalRecords} records)
              </span>
              <button
                className="btn btn-secondary"
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

export default Attendance;
