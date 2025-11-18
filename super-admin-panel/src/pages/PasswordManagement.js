import React, { useState } from 'react';
import { FiSearch, FiKey, FiCopy, FiCheckCircle, FiAlertCircle, FiRefreshCw, FiX } from 'react-icons/fi';
import axios from 'axios';
import '../styles/PasswordManagement.css';

// Use localhost for testing
// Production: const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://adtenz.site/api/v1';
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';

const PasswordManagement = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState(null);
  
  // Reset Password Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forceChange, setForceChange] = useState(true);
  const [resetting, setResetting] = useState(false);

  // Temp Password Modal State
  const [showTempModal, setShowTempModal] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [generating, setGenerating] = useState(false);

  const searchUsers = async () => {
    if (!searchQuery || searchQuery.length < 2) {
      showMessage('Please enter at least 2 characters', 'error');
      return;
    }

    setSearching(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_BASE_URL}/super/users/search`,
        {
          params: { q: searchQuery },
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.success) {
        setSearchResults(response.data);
        if (response.data.length === 0) {
          showMessage('No users found', 'error');
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
      showMessage('Search failed', 'error');
    } finally {
      setSearching(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      searchUsers();
    }
  };

  const openResetModal = (user) => {
    setSelectedUser(user);
    setShowResetModal(true);
    setNewPassword('');
    setConfirmPassword('');
    setForceChange(true);
  };

  const closeResetModal = () => {
    setShowResetModal(false);
    setSelectedUser(null);
    setNewPassword('');
    setConfirmPassword('');
  };

  const resetPassword = async () => {
    if (!newPassword) {
      showMessage('Password is required', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage('Passwords do not match', 'error');
      return;
    }

    if (newPassword.length < 8) {
      showMessage('Password must be at least 8 characters', 'error');
      return;
    }

    setResetting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/super/users/${selectedUser.id}/reset-password`,
        {
          newPassword,
          forceChange
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.success) {
        showMessage(`Password reset successfully for ${selectedUser.email}`, 'success');
        closeResetModal();
      }
    } catch (error) {
      console.error('Password reset failed:', error);
      showMessage(error.response?.data?.error || 'Password reset failed', 'error');
    } finally {
      setResetting(false);
    }
  };

  const generateTempPassword = async (user) => {
    setSelectedUser(user);
    setGenerating(true);
    setShowTempModal(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/super/users/${user.id}/generate-temp-password`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.success) {
        setTempPassword(response.data.tempPassword);
        showMessage('Temporary password generated!', 'success');
      }
    } catch (error) {
      console.error('Temp password generation failed:', error);
      showMessage('Failed to generate temporary password', 'error');
      setShowTempModal(false);
    } finally {
      setGenerating(false);
    }
  };

  const closeTempModal = () => {
    setShowTempModal(false);
    setTempPassword('');
    setSelectedUser(null);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showMessage('Copied to clipboard!', 'success');
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  return (
    <div className="password-management-container">
      {/* Header */}
      <div className="pm-header">
        <div className="header-left">
          <FiKey size={28} />
          <div>
            <h1>Password Management</h1>
            <p>Reset passwords for any user in the system</p>
          </div>
        </div>
      </div>

      {/* Message Alert */}
      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.type === 'success' ? <FiCheckCircle /> : <FiAlertCircle />}
          {message.text}
        </div>
      )}

      {/* Search Section */}
      <div className="search-section">
        <h2>Search Users</h2>
        <div className="search-bar">
          <FiSearch />
          <input
            type="text"
            placeholder="Search by email or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button 
            className="btn-search"
            onClick={searchUsers}
            disabled={searching}
          >
            {searching ? (
              <>
                <FiRefreshCw className="spin" />
                Searching...
              </>
            ) : (
              'Search'
            )}
          </button>
        </div>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="results-section">
          <h2>Search Results ({searchResults.length})</h2>
          <div className="results-grid">
            {searchResults.map((user) => (
              <div key={user.id} className="user-card">
                <div className="user-info">
                  <div className="user-avatar">
                    {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-details">
                    <h3>{user.full_name || 'No Name'}</h3>
                    <p className="user-email">{user.email}</p>
                    <div className="user-meta">
                      <span className={`badge badge-${user.role}`}>
                        {user.role}
                      </span>
                      <span className="school-name">
                        {user.school_name || 'Super Admin'}
                      </span>
                      <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="user-actions">
                  <button
                    className="btn-action btn-reset"
                    onClick={() => openResetModal(user)}
                    title="Reset Password"
                  >
                    <FiKey />
                    Reset Password
                  </button>
                  <button
                    className="btn-action btn-temp"
                    onClick={() => generateTempPassword(user)}
                    title="Generate Temporary Password"
                  >
                    <FiRefreshCw />
                    Generate Temp
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="modal-overlay" onClick={closeResetModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reset Password</h2>
              <button className="btn-close" onClick={closeResetModal}>
                <FiX />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="user-summary">
                <strong>User:</strong> {selectedUser?.email}
              </div>

              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 8 characters)"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={forceChange}
                    onChange={(e) => setForceChange(e.target.checked)}
                  />
                  Force password change on next login
                </label>
              </div>

              <div className="password-requirements">
                <h4>Password Requirements:</h4>
                <ul>
                  <li className={newPassword.length >= 8 ? 'valid' : ''}>
                    At least 8 characters
                  </li>
                  <li className={/[A-Z]/.test(newPassword) ? 'valid' : ''}>
                    One uppercase letter
                  </li>
                  <li className={/[a-z]/.test(newPassword) ? 'valid' : ''}>
                    One lowercase letter
                  </li>
                  <li className={/[0-9]/.test(newPassword) ? 'valid' : ''}>
                    One number
                  </li>
                  <li className={/[^A-Za-z0-9]/.test(newPassword) ? 'valid' : ''}>
                    One special character
                  </li>
                </ul>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeResetModal}>
                Cancel
              </button>
              <button
                className="btn-confirm"
                onClick={resetPassword}
                disabled={resetting}
              >
                {resetting ? (
                  <>
                    <FiRefreshCw className="spin" />
                    Resetting...
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Temporary Password Modal */}
      {showTempModal && (
        <div className="modal-overlay" onClick={closeTempModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Temporary Password Generated</h2>
              <button className="btn-close" onClick={closeTempModal}>
                <FiX />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="user-summary">
                <strong>User:</strong> {selectedUser?.email}
              </div>

              {generating ? (
                <div className="generating-state">
                  <FiRefreshCw className="spin" size={40} />
                  <p>Generating temporary password...</p>
                </div>
              ) : (
                <>
                  <div className="temp-password-display">
                    <h3>Temporary Password:</h3>
                    <div className="password-box">
                      <code>{tempPassword}</code>
                      <button
                        className="btn-copy"
                        onClick={() => copyToClipboard(tempPassword)}
                        title="Copy to clipboard"
                      >
                        <FiCopy />
                      </button>
                    </div>
                  </div>

                  <div className="warning-box">
                    <FiAlertCircle />
                    <div>
                      <strong>Important:</strong>
                      <p>This password will only be displayed once. Please copy it and send it to the user securely. The user will be forced to change this password on their next login.</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-confirm" onClick={closeTempModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PasswordManagement;
