import React, { useState, useEffect } from 'react';
import {
  FiCpu, FiRefreshCw, FiCheckCircle, FiXCircle, FiAlertCircle,
  FiClock, FiUsers, FiActivity, FiUpload, FiEye, FiWifi, FiWifiOff
} from 'react-icons/fi';
import { devicesAPI } from '../utils/api';
import { useToast } from '../components/Toast';
import './Devices.css';

const Devices = () => {
  const toast = useToast();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState({});
  const [verifying, setVerifying] = useState({});
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncDetails, setSyncDetails] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchDevices();
  }, []);

  // Auto-refresh every 10 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchDevices(true); // Silent refresh
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchDevices = async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      const response = await devicesAPI.getAll();

      if (response.success) {
        setDevices(response.data || []);
      } else {
        toast.error('Failed to fetch devices');
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
      if (!silent) {
        toast.error('Failed to load devices');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const viewSyncStatus = async (device) => {
    try {
      const response = await devicesAPI.getSyncStatus(device.id);

      if (response.success) {
        setSyncDetails(response.data);
        setSelectedDevice(device);
        setShowSyncModal(true);
      } else {
        toast.error('Failed to fetch sync status');
      }
    } catch (error) {
      console.error('Error fetching sync status:', error);
      toast.error('Failed to load sync details');
    }
  };

  const handleFullSync = async (deviceId) => {
    setSyncing(prev => ({ ...prev, [deviceId]: true }));

    try {
      const response = await devicesAPI.syncStudents(deviceId);

      if (response.success) {
        toast.success(`Sync initiated! ${response.data.commandsQueued} students queued.`);
        // Refresh devices after 2 seconds
        setTimeout(() => fetchDevices(true), 2000);
      } else {
        toast.error(response.message || 'Sync failed');
      }
    } catch (error) {
      console.error('Error syncing device:', error);
      toast.error('Failed to initiate sync');
    } finally {
      setSyncing(prev => ({ ...prev, [deviceId]: false }));
    }
  };

  const handleVerifySync = async (deviceId) => {
    setVerifying(prev => ({ ...prev, [deviceId]: true }));

    try {
      const response = await devicesAPI.verifySync(deviceId);

      if (response.success) {
        const { verification } = response.data;
        const message = verification.missing > 0 || verification.extra > 0
          ? `Found ${verification.missing} missing and ${verification.extra} extra students. Corrections queued.`
          : 'Device is in perfect sync!';

        toast.success(message);
        // Refresh devices after 2 seconds
        setTimeout(() => fetchDevices(true), 2000);
      } else {
        toast.error(response.message || 'Verification failed');
      }
    } catch (error) {
      console.error('Error verifying sync:', error);
      toast.error('Failed to verify sync');
    } finally {
      setVerifying(prev => ({ ...prev, [deviceId]: false }));
    }
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Never';

    const now = new Date();
    const seen = new Date(lastSeen);
    const diffMs = now - seen;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const getDeviceStatus = (device) => {
    if (!device.last_seen) return { status: 'unknown', color: '#9ca3af', label: 'Unknown' };

    const now = new Date();
    const lastSeen = new Date(device.last_seen);
    const diffMinutes = (now - lastSeen) / 60000;

    if (diffMinutes < 2) return { status: 'online', color: '#10b981', label: 'Online' };
    if (diffMinutes < 10) return { status: 'warning', color: '#f59e0b', label: 'Delayed' };
    return { status: 'offline', color: '#ef4444', label: 'Offline' };
  };

  const getSyncHealth = (device) => {
    // This would come from sync status in real implementation
    // For now, we'll show a placeholder
    return device.sync_health || 0;
  };

  if (loading) {
    return (
      <div className="devices-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading devices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="devices-container">
      {/* Header */}
      <div className="devices-header">
        <div className="header-left">
          <div className="header-icon">
            <FiCpu size={32} />
          </div>
          <div>
            <h1>Biometric Devices</h1>
            <p>Manage and monitor your ZKTeco devices</p>
          </div>
        </div>

        <div className="header-actions">
          <div className="auto-refresh-toggle">
            <label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span>Auto-refresh (10s)</span>
            </label>
          </div>

          <button className="btn-refresh" onClick={() => fetchDevices()}>
            <FiRefreshCw />
            Refresh
          </button>
        </div>
      </div>

      {/* Devices Grid */}
      {devices.length === 0 ? (
        <div className="empty-state">
          <FiCpu size={64} />
          <h3>No Devices Found</h3>
          <p>Contact your administrator to register biometric devices for your school.</p>
        </div>
      ) : (
        <div className="devices-grid">
          {devices.map((device) => {
            const status = getDeviceStatus(device);
            const syncHealth = getSyncHealth(device);
            const isSyncing = syncing[device.id];
            const isVerifying = verifying[device.id];

            return (
              <div key={device.id} className="device-card">
                {/* Device Header */}
                <div className="device-card-header">
                  <div className="device-info">
                    <div className="device-icon" style={{ backgroundColor: `${status.color}20` }}>
                      <FiCpu style={{ color: status.color }} />
                    </div>
                    <div>
                      <h3>{device.device_name || device.serial_number}</h3>
                      <p className="device-serial">SN: {device.serial_number}</p>
                    </div>
                  </div>

                  <div className="device-status">
                    {status.status === 'online' ? (
                      <FiWifi style={{ color: status.color }} />
                    ) : (
                      <FiWifiOff style={{ color: status.color }} />
                    )}
                    <span className="status-badge" style={{ backgroundColor: `${status.color}20`, color: status.color }}>
                      {status.label}
                    </span>
                  </div>
                </div>

                {/* Device Stats */}
                <div className="device-stats">
                  <div className="stat-item">
                    <FiClock className="stat-icon" />
                    <div>
                      <span className="stat-label">Last Seen</span>
                      <span className="stat-value">{formatLastSeen(device.last_seen)}</span>
                    </div>
                  </div>

                  <div className="stat-item">
                    <FiActivity className="stat-icon" />
                    <div>
                      <span className="stat-label">Sync Health</span>
                      <span className="stat-value">{syncHealth}%</span>
                    </div>
                  </div>

                  <div className="stat-item">
                    <FiUsers className="stat-icon" />
                    <div>
                      <span className="stat-label">Total Users</span>
                      <span className="stat-value">{device.total_users || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Sync Progress (if available) */}
                {syncHealth !== null && (
                  <div className="sync-progress">
                    <div className="progress-header">
                      <span>Sync Status</span>
                      <span>{syncHealth}%</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${syncHealth}%`,
                          backgroundColor: syncHealth >= 90 ? '#10b981' : syncHealth >= 70 ? '#f59e0b' : '#ef4444'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Device Actions */}
                <div className="device-actions">
                  <button
                    className="btn-action btn-view"
                    onClick={() => viewSyncStatus(device)}
                    title="View detailed sync status"
                  >
                    <FiEye />
                    View Details
                  </button>

                  <button
                    className="btn-action btn-verify"
                    onClick={() => handleVerifySync(device.id)}
                    disabled={isVerifying || status.status === 'offline'}
                    title="Check if device is in sync with database"
                  >
                    {isVerifying ? (
                      <>
                        <FiRefreshCw className="spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <FiCheckCircle />
                        Verify Sync
                      </>
                    )}
                  </button>

                  <button
                    className="btn-action btn-sync"
                    onClick={() => handleFullSync(device.id)}
                    disabled={isSyncing || status.status === 'offline'}
                    title="Sync all students to device"
                  >
                    {isSyncing ? (
                      <>
                        <FiRefreshCw className="spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <FiUpload />
                        Full Sync
                      </>
                    )}
                  </button>
                </div>

                {/* Offline Warning */}
                {status.status === 'offline' && (
                  <div className="device-warning">
                    <FiAlertCircle />
                    <span>Device is offline. Sync operations are disabled.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sync Details Modal */}
      {showSyncModal && syncDetails && (
        <div className="modal-overlay" onClick={() => setShowSyncModal(false)}>
          <div className="modal-content sync-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Device Sync Details</h2>
              <button className="btn-close" onClick={() => setShowSyncModal(false)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              {/* Device Info */}
              <div className="sync-device-info">
                <h3>{syncDetails.device.name}</h3>
                <div className="device-meta">
                  <span>Serial: {syncDetails.device.serialNumber}</span>
                  <span className={`status-indicator ${syncDetails.device.isOnline ? 'online' : 'offline'}`}>
                    {syncDetails.device.isOnline ? 'Online' : 'Offline'}
                  </span>
                  <span>Last Seen: {formatLastSeen(syncDetails.device.lastSeen)}</span>
                </div>
              </div>

              {/* Sync Summary */}
              <div className="sync-summary">
                <h4>Sync Summary</h4>
                <div className="summary-grid">
                  <div className="summary-card">
                    <div className="summary-value">{syncDetails.summary.total}</div>
                    <div className="summary-label">Total Students</div>
                  </div>
                  <div className="summary-card success">
                    <div className="summary-value">{syncDetails.summary.synced}</div>
                    <div className="summary-label">Synced</div>
                  </div>
                  <div className="summary-card warning">
                    <div className="summary-value">{syncDetails.summary.pending}</div>
                    <div className="summary-label">Pending</div>
                  </div>
                  <div className="summary-card danger">
                    <div className="summary-value">{syncDetails.summary.failed}</div>
                    <div className="summary-label">Failed</div>
                  </div>
                </div>

                <div className="sync-health-bar">
                  <div className="health-label">
                    <span>Sync Health</span>
                    <span className="health-percentage">{syncDetails.syncHealthPercentage}%</span>
                  </div>
                  <div className="health-progress">
                    <div
                      className="health-fill"
                      style={{
                        width: `${syncDetails.syncHealthPercentage}%`,
                        backgroundColor: syncDetails.syncHealthPercentage >= 90 ? '#10b981' :
                                       syncDetails.syncHealthPercentage >= 70 ? '#f59e0b' : '#ef4444'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Student List */}
              <div className="sync-students-list">
                <h4>Student Sync Status ({syncDetails.students.length})</h4>
                <div className="students-table-container">
                  <table className="students-sync-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Class</th>
                        <th>RFID</th>
                        <th>Status</th>
                        <th>Last Sync</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncDetails.students.map((student) => (
                        <tr key={student.id}>
                          <td>{student.full_name}</td>
                          <td>{student.class_name} - {student.section_name}</td>
                          <td>{student.rfid_card_id}</td>
                          <td>
                            <span className={`sync-status-badge status-${student.sync_status}`}>
                              {student.sync_status === 'synced' && <FiCheckCircle />}
                              {student.sync_status === 'pending' && <FiClock />}
                              {student.sync_status === 'failed' && <FiXCircle />}
                              {student.sync_status}
                            </span>
                          </td>
                          <td>{student.last_sync_success ? formatLastSeen(student.last_sync_success) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {syncDetails.pendingCommands > 0 && (
                <div className="pending-commands-alert">
                  <FiAlertCircle />
                  <span>{syncDetails.pendingCommands} pending command(s) waiting to be processed by device</span>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowSyncModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Devices;
