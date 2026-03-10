import React, { useState, useEffect } from 'react';
import {
  FiDatabase,
  FiRefreshCw,
  FiUploadCloud,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiDownloadCloud,
  FiTrash2,
  FiAlertCircle,
  FiExternalLink
} from 'react-icons/fi';
import { FaGoogle } from 'react-icons/fa';
import './BackupSettings.css';

const BackupSettings = () => {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Connection status
  const [isConnected, setIsConnected] = useState(false);

  // Backups list
  const [backups, setBackups] = useState([]);

  // Backup logs
  const [backupLogs, setBackupLogs] = useState([]);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';

  useEffect(() => {
    checkConnectionStatus();
    fetchBackupLogs();
  }, []);

  useEffect(() => {
    if (isConnected) {
      fetchBackupsList();
    }
  }, [isConnected]);

  const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const checkConnectionStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/school/backup/google-drive/status`, {
        headers: getAuthHeader()
      });

      const data = await response.json();

      if (data.success) {
        setIsConnected(data.data.connected);
      }
    } catch (err) {
      console.error('Error checking connection status:', err);
      setError('Failed to check Google Drive connection status');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGoogleDrive = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${API_BASE_URL}/school/backup/google-drive/connect`, {
        headers: getAuthHeader()
      });

      const data = await response.json();

      if (data.success && data.data.authUrl) {
        // Open Google OAuth page in new window
        window.open(data.data.authUrl, '_blank', 'width=600,height=700');

        // Poll for connection status every 3 seconds
        const pollInterval = setInterval(async () => {
          const statusResponse = await fetch(`${API_BASE_URL}/school/backup/google-drive/status`, {
            headers: getAuthHeader()
          });
          const statusData = await statusResponse.json();

          if (statusData.success && statusData.data.connected) {
            clearInterval(pollInterval);
            setIsConnected(true);
            setSuccessMessage('Google Drive connected successfully! ✅');
            setTimeout(() => setSuccessMessage(''), 5000);
            fetchBackupsList();
          }
        }, 3000);

        // Stop polling after 2 minutes
        setTimeout(() => clearInterval(pollInterval), 120000);
      } else {
        setError('Failed to generate Google Drive authorization URL');
      }
    } catch (err) {
      console.error('Error connecting Google Drive:', err);
      setError('Failed to connect Google Drive');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectGoogleDrive = async () => {
    const confirmed = window.confirm(
      '⚠️ DISCONNECT GOOGLE DRIVE\n\n' +
      'Are you sure you want to disconnect Google Drive?\n\n' +
      'This will:\n' +
      '• Stop automatic backups to Google Drive\n' +
      '• Remove access tokens from database\n' +
      '• Existing backups in Google Drive will NOT be deleted\n\n' +
      'You can reconnect anytime later.'
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${API_BASE_URL}/school/backup/google-drive/disconnect`, {
        method: 'POST',
        headers: getAuthHeader()
      });

      const data = await response.json();

      if (data.success) {
        setIsConnected(false);
        setBackups([]);
        setSuccessMessage('Google Drive disconnected successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError('Failed to disconnect Google Drive');
      }
    } catch (err) {
      console.error('Error disconnecting Google Drive:', err);
      setError('Failed to disconnect Google Drive');
    } finally {
      setLoading(false);
    }
  };

  const handleBackupNow = async () => {
    try {
      setUploading(true);
      setError('');
      setSuccessMessage('');

      const response = await fetch(`${API_BASE_URL}/school/backup/google-drive/upload-now`, {
        method: 'POST',
        headers: getAuthHeader()
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(`✅ Backup uploaded successfully! File: ${data.data.fileName}`);
        setTimeout(() => setSuccessMessage(''), 5000);

        // Refresh lists
        fetchBackupsList();
        fetchBackupLogs();
      } else {
        setError(data.message || 'Failed to create backup');
      }
    } catch (err) {
      console.error('Error creating backup:', err);
      setError('Failed to create and upload backup');
    } finally {
      setUploading(false);
    }
  };

  const fetchBackupsList = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/school/backup/google-drive/list`, {
        headers: getAuthHeader()
      });

      const data = await response.json();

      if (data.success) {
        setBackups(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching backups list:', err);
    }
  };

  const fetchBackupLogs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/school/backup/logs`, {
        headers: getAuthHeader()
      });

      const data = await response.json();

      if (data.success) {
        setBackupLogs(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching backup logs:', err);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="backup-settings-container">
      {/* Header */}
      <div className="backup-header">
        <div>
          <h1 className="page-title">
            <FiDatabase className="inline-icon" />
            Backup Settings
          </h1>
          <p className="page-subtitle">Manage your school's data backups and Google Drive integration</p>
        </div>
        <button className="btn btn-outline" onClick={() => {
          checkConnectionStatus();
          fetchBackupLogs();
          if (isConnected) fetchBackupsList();
        }}>
          <FiRefreshCw /> Refresh
        </button>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="alert alert-success">
          <FiCheckCircle />
          {successMessage}
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <FiXCircle />
          {error}
        </div>
      )}

      {loading && !isConnected && !uploading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading backup settings...</p>
        </div>
      ) : (
        <>
          {/* Google Drive Connection Card */}
          <div className="card backup-connection-card">
            {!isConnected ? (
              // Not Connected State
              <div className="connection-not-connected">
                <div className="connection-icon">
                  <FaGoogle size={48} color="#4285F4" />
                </div>
                <h2>Connect Your Google Drive</h2>
                <p className="connection-description">
                  Keep your school's data safe by automatically backing up to your own Google Drive account.
                </p>

                <div className="benefits-grid">
                  <div className="benefit-item">
                    <FiCheckCircle className="benefit-icon" />
                    <h4>15 GB Free Storage</h4>
                    <p>Use your Google account's free storage</p>
                  </div>
                  <div className="benefit-item">
                    <FiClock className="benefit-icon" />
                    <h4>Automatic Backups</h4>
                    <p>Daily backups at 2:00 AM automatically</p>
                  </div>
                  <div className="benefit-item">
                    <FiDownloadCloud className="benefit-icon" />
                    <h4>Access Anywhere</h4>
                    <p>Download backups from Google Drive anytime</p>
                  </div>
                  <div className="benefit-item">
                    <FiCheckCircle className="benefit-icon" />
                    <h4>100% Secure</h4>
                    <p>Industry-standard OAuth 2.0 authentication</p>
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-lg connect-btn"
                  onClick={handleConnectGoogleDrive}
                  disabled={loading}
                >
                  <FaGoogle />
                  {loading ? 'Connecting...' : 'Connect Google Drive'}
                </button>

                <div className="security-note">
                  <FiAlertCircle />
                  <p>
                    <strong>Private & Secure:</strong> We only access files we create.
                    Your other Google Drive files remain private. You can disconnect anytime.
                  </p>
                </div>
              </div>
            ) : (
              // Connected State
              <div className="connection-connected">
                <div className="connection-header">
                  <div className="connection-status">
                    <FiCheckCircle className="status-icon connected" />
                    <div>
                      <h3>Google Drive Connected</h3>
                      <p>Your backups are being saved to Google Drive</p>
                    </div>
                  </div>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={handleDisconnectGoogleDrive}
                    disabled={loading}
                  >
                    Disconnect
                  </button>
                </div>

                <div className="backup-actions">
                  <button
                    className="btn btn-primary"
                    onClick={handleBackupNow}
                    disabled={uploading}
                  >
                    <FiUploadCloud />
                    {uploading ? 'Creating Backup...' : 'Backup Now'}
                  </button>

                  <div className="backup-schedule">
                    <FiClock />
                    <div>
                      <strong>Next Automatic Backup:</strong>
                      <p>Tomorrow at 2:00 AM</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Backups in Google Drive */}
          {isConnected && (
            <div className="card">
              <div className="card-header">
                <h3>
                  <FaGoogle className="inline-icon" />
                  Your Backups on Google Drive
                </h3>
                <p className="card-subtitle">Recent backups stored in "School Attendance Backups" folder</p>
              </div>

              {backups.length === 0 ? (
                <div className="empty-state">
                  <FiDatabase size={48} />
                  <h4>No backups yet</h4>
                  <p>Click "Backup Now" to create your first backup</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>File Name</th>
                        <th>Date Created</th>
                        <th>File Size</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map((backup, index) => (
                        <tr key={backup.id || index}>
                          <td>
                            <div className="file-name">
                              <FiDatabase className="file-icon" />
                              {backup.name}
                            </div>
                          </td>
                          <td>{formatDate(backup.createdTime)}</td>
                          <td>{formatFileSize(backup.size)}</td>
                          <td>
                            <a
                              href={backup.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm btn-outline"
                            >
                              <FiExternalLink />
                              View in Drive
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Backup History Logs */}
          <div className="card">
            <div className="card-header">
              <h3>
                <FiClock className="inline-icon" />
                Backup History
              </h3>
              <p className="card-subtitle">Upload history and status logs</p>
            </div>

            {backupLogs.length === 0 ? (
              <div className="empty-state">
                <FiClock size={48} />
                <h4>No backup logs yet</h4>
                <p>Backup upload history will appear here</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>File Name</th>
                      <th>Provider</th>
                      <th>File Size</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backupLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDate(log.created_at)}</td>
                        <td>
                          <div className="file-name">
                            <FiDatabase className="file-icon" />
                            {log.backup_file}
                          </div>
                        </td>
                        <td>
                          <div className="provider-badge">
                            <FaGoogle />
                            {log.cloud_provider}
                          </div>
                        </td>
                        <td>{formatFileSize(log.file_size)}</td>
                        <td>
                          {log.status === 'success' ? (
                            <span className="status-badge success">
                              <FiCheckCircle />
                              Success
                            </span>
                          ) : (
                            <span className="status-badge error">
                              <FiXCircle />
                              Failed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Information Section */}
          <div className="card info-card">
            <h3>
              <FiAlertCircle className="inline-icon" />
              How Backups Work
            </h3>
            <div className="info-grid">
              <div className="info-item">
                <h4>📤 What Gets Backed Up?</h4>
                <p>Complete database backup including all students, attendance records, teachers, classes, and settings.</p>
              </div>
              <div className="info-item">
                <h4>🔄 Automatic Backups</h4>
                <p>System creates and uploads backups automatically every night at 2:00 AM.</p>
              </div>
              <div className="info-item">
                <h4>🗑️ Retention Policy</h4>
                <p>Backups older than 30 days are automatically deleted to save storage space.</p>
              </div>
              <div className="info-item">
                <h4>🔐 Security</h4>
                <p>Backups are stored in your own Google Drive account. Only you have access to them.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BackupSettings;
