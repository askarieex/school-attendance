import React, { useState, useEffect } from 'react';
import { FiFileText, FiDownload, FiRefreshCw, FiFilter, FiX, FiEye } from 'react-icons/fi';
import axios from 'axios';
import '../styles/AuditLogs.css';

// Use localhost for testing
// Production: const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://adtenz.site/api/v1';
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    actionType: '',
    resourceType: '',
    startDate: '',
    endDate: ''
  });

  // Stats
  const [stats, setStats] = useState(null);
  const [showStats, setShowStats] = useState(true);

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [page, filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = {
        page,
        limit: 20,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
      };

      const response = await axios.get(
        `${API_BASE_URL}/super/audit-logs`,
        {
          params,
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.success) {
        setLogs(response.data.logs);
        setTotalPages(response.data.pagination.totalPages);
        setTotalCount(response.data.pagination.totalCount);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_BASE_URL}/super/audit-logs/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const exportToCsv = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams(
        Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
      );

      window.location.href = `${API_BASE_URL}/super/audit-logs/export?${params}&token=${token}`;
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setTimeout(() => setExporting(false), 2000);
    }
  };

  const applyFilters = () => {
    setPage(1);
    fetchLogs();
  };

  const clearFilters = () => {
    setFilters({
      actionType: '',
      resourceType: '',
      startDate: '',
      endDate: ''
    });
    setPage(1);
  };

  const viewDetails = (log) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getActionColor = (action) => {
    const colors = {
      create: '#10b981',
      update: '#3b82f6',
      delete: '#ef4444',
      login: '#8b5cf6',
      password_reset: '#f59e0b',
      config_change: '#06b6d4'
    };
    return colors[action] || '#6b7280';
  };

  return (
    <div className="audit-logs-container">
      {/* Header */}
      <div className="audit-header">
        <div className="header-left">
          <FiFileText size={28} />
          <div>
            <h1>Audit Logs</h1>
            <p>Track all administrative actions and changes</p>
          </div>
        </div>
        <div className="header-actions">
          <button 
            className="btn-action btn-filter"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FiFilter />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          <button 
            className="btn-action btn-refresh"
            onClick={fetchLogs}
          >
            <FiRefreshCw />
            Refresh
          </button>
          <button 
            className="btn-action btn-export"
            onClick={exportToCsv}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <FiRefreshCw className="spin" />
                Exporting...
              </>
            ) : (
              <>
                <FiDownload />
                Export CSV
              </>
            )}
          </button>
        </div>
      </div>

      {/* Statistics */}
      {showStats && stats && (
        <div className="stats-section">
          <div className="stats-header">
            <h2>Statistics ({stats.period})</h2>
            <button className="btn-close-stats" onClick={() => setShowStats(false)}>
              <FiX />
            </button>
          </div>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Actions</h3>
              <p className="stat-value">{stats.total.toLocaleString()}</p>
            </div>
            
            <div className="stat-card">
              <h3>Top Action</h3>
              <p className="stat-value">
                {stats.byActionType[0]?.action_type || 'N/A'}
              </p>
              <p className="stat-label">{stats.byActionType[0]?.count || 0} times</p>
            </div>

            <div className="stat-card">
              <h3>Most Active User</h3>
              <p className="stat-value truncate">
                {stats.topUsers[0]?.user_email || 'N/A'}
              </p>
              <p className="stat-label">{stats.topUsers[0]?.count || 0} actions</p>
            </div>

            <div className="stat-card">
              <h3>Top Resource</h3>
              <p className="stat-value">
                {stats.byResourceType[0]?.resource_type || 'N/A'}
              </p>
              <p className="stat-label">{stats.byResourceType[0]?.count || 0} changes</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="filters-section">
          <div className="filters-grid">
            <div className="filter-group">
              <label>Action Type</label>
              <select
                value={filters.actionType}
                onChange={(e) => setFilters({...filters, actionType: e.target.value})}
              >
                <option value="">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="login">Login</option>
                <option value="password_reset">Password Reset</option>
                <option value="config_change">Config Change</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Resource Type</label>
              <select
                value={filters.resourceType}
                onChange={(e) => setFilters({...filters, resourceType: e.target.value})}
              >
                <option value="">All Resources</option>
                <option value="school">School</option>
                <option value="user">User</option>
                <option value="device">Device</option>
                <option value="setting">Setting</option>
                <option value="password">Password</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              />
            </div>

            <div className="filter-group">
              <label>End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              />
            </div>
          </div>

          <div className="filters-actions">
            <button className="btn-clear" onClick={clearFilters}>
              Clear Filters
            </button>
            <button className="btn-apply" onClick={applyFilters}>
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="logs-section">
        <div className="logs-header">
          <h2>Audit Logs</h2>
          <p className="logs-count">
            Showing {logs.length} of {totalCount.toLocaleString()} logs
          </p>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <FiFileText size={48} />
            <p>No audit logs found</p>
          </div>
        ) : (
          <>
            <div className="logs-table-container">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Description</th>
                    <th>IP Address</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="time-cell">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="user-cell">
                        <div className="user-info-cell">
                          <strong>{log.user_email || 'System'}</strong>
                          <span className="user-role">{log.user_role}</span>
                        </div>
                      </td>
                      <td>
                        <span 
                          className="action-badge"
                          style={{ background: `${getActionColor(log.action_type)}20`, color: getActionColor(log.action_type) }}
                        >
                          {log.action_type}
                        </span>
                      </td>
                      <td>
                        <span className="resource-badge">
                          {log.resource_type}
                          {log.resource_id && ` #${log.resource_id}`}
                        </span>
                      </td>
                      <td className="description-cell">
                        {log.description || '-'}
                      </td>
                      <td className="ip-cell">
                        {log.ip_address || '-'}
                      </td>
                      <td>
                        <button
                          className="btn-view"
                          onClick={() => viewDetails(log)}
                          title="View Details"
                        >
                          <FiEye />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="page-btn"
                >
                  Previous
                </button>
                
                <span className="page-info">
                  Page {page} of {totalPages}
                </span>
                
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="page-btn"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedLog && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Audit Log Details</h2>
              <button className="btn-close" onClick={() => setShowDetailModal(false)}>
                <FiX />
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Time</label>
                  <p>{formatDate(selectedLog.created_at)}</p>
                </div>

                <div className="detail-item">
                  <label>User</label>
                  <p>{selectedLog.user_email || 'System'}</p>
                </div>

                <div className="detail-item">
                  <label>Role</label>
                  <p>{selectedLog.user_role || '-'}</p>
                </div>

                <div className="detail-item">
                  <label>Action Type</label>
                  <p>
                    <span 
                      className="action-badge"
                      style={{ background: `${getActionColor(selectedLog.action_type)}20`, color: getActionColor(selectedLog.action_type) }}
                    >
                      {selectedLog.action_type}
                    </span>
                  </p>
                </div>

                <div className="detail-item">
                  <label>Resource Type</label>
                  <p>{selectedLog.resource_type}</p>
                </div>

                <div className="detail-item">
                  <label>Resource ID</label>
                  <p>{selectedLog.resource_id || '-'}</p>
                </div>

                <div className="detail-item full-width">
                  <label>Description</label>
                  <p>{selectedLog.description || '-'}</p>
                </div>

                <div className="detail-item">
                  <label>IP Address</label>
                  <p>{selectedLog.ip_address || '-'}</p>
                </div>

                <div className="detail-item full-width">
                  <label>User Agent</label>
                  <p className="small-text">{selectedLog.user_agent || '-'}</p>
                </div>

                {selectedLog.old_value && (
                  <div className="detail-item full-width">
                    <label>Old Value</label>
                    <pre className="json-display">
                      {JSON.stringify(selectedLog.old_value, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.new_value && (
                  <div className="detail-item full-width">
                    <label>New Value</label>
                    <pre className="json-display">
                      {JSON.stringify(selectedLog.new_value, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-confirm" onClick={() => setShowDetailModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
