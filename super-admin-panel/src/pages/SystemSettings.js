import React, { useState, useEffect } from 'react';
import { FiSettings, FiSave, FiRefreshCw, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import axios from 'axios';
import '../styles/SystemSettings.css';

// Use localhost for testing
// Production: const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://adtenz.site/api/v1';
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';

const SystemSettings = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [message, setMessage] = useState(null);
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [testNumber, setTestNumber] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/super/settings/grouped`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success) {
        // Convert array to object by category
        const grouped = {};
        Object.keys(response.data).forEach(category => {
          grouped[category] = {};
          response.data[category].forEach(setting => {
            grouped[category][setting.setting_key] = setting.setting_value;
          });
        });
        setSettings(grouped);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      showMessage('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');

      // Flatten settings for batch update
      const settingsArray = [];
      Object.keys(settings).forEach(category => {
        Object.keys(settings[category]).forEach(key => {
          settingsArray.push({
            key: key,
            value: settings[category][key]
          });
        });
      });

      const response = await axios.post(
        `${API_BASE_URL}/super/settings/batch`,
        { settings: settingsArray },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.success) {
        showMessage('Settings saved successfully!', 'success');
        fetchSettings(); // Refresh settings
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      showMessage(error.response?.data?.error || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const testWhatsAppConnection = async () => {
    if (!testNumber) {
      showMessage('Please enter a test phone number', 'error');
      return;
    }

    setTestingWhatsApp(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/super/settings/test-whatsapp`,
        { testNumber },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.success) {
        showMessage('WhatsApp test message sent successfully!', 'success');
      }
    } catch (error) {
      console.error('WhatsApp test failed:', error);
      showMessage(error.response?.data?.error || 'WhatsApp test failed', 'error');
    } finally {
      setTestingWhatsApp(false);
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  if (loading) {
    return (
      <div className="settings-loading">
        <div className="spinner"></div>
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="settings-container">
      {/* Header */}
      <div className="settings-header">
        <div className="header-left">
          <FiSettings size={28} />
          <div>
            <h1>System Settings</h1>
            <p>Configure platform-wide settings</p>
          </div>
        </div>
        <button
          className="btn-save"
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? (
            <>
              <FiRefreshCw className="spin" />
              Saving...
            </>
          ) : (
            <>
              <FiSave />
              Save Changes
            </>
          )}
        </button>
      </div>

      {/* Message Alert */}
      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.type === 'success' ? <FiCheckCircle /> : <FiAlertCircle />}
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="settings-tabs">
        <button
          className={activeTab === 'general' ? 'active' : ''}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          className={activeTab === 'whatsapp' ? 'active' : ''}
          onClick={() => setActiveTab('whatsapp')}
        >
          WhatsApp
        </button>
        <button
          className={activeTab === 'email' ? 'active' : ''}
          onClick={() => setActiveTab('email')}
        >
          Email
        </button>
        <button
          className={activeTab === 'storage' ? 'active' : ''}
          onClick={() => setActiveTab('storage')}
        >
          Storage
        </button>
        <button
          className={activeTab === 'security' ? 'active' : ''}
          onClick={() => setActiveTab('security')}
        >
          Security
        </button>
      </div>

      {/* Settings Content */}
      <div className="settings-content">

        {/* GENERAL TAB */}
        {activeTab === 'general' && (
          <div className="settings-section">
            <h2>General Settings</h2>
            <div className="settings-grid">
              <div className="form-group">
                <label>Platform Name</label>
                <input
                  type="text"
                  value={settings.general?.platform_name || ''}
                  onChange={(e) => handleSettingChange('general', 'platform_name', e.target.value)}
                  placeholder="School Attendance System"
                />
              </div>

              <div className="form-group">
                <label>Platform URL</label>
                <input
                  type="url"
                  value={settings.general?.platform_url || ''}
                  onChange={(e) => handleSettingChange('general', 'platform_url', e.target.value)}
                  placeholder="http://localhost:3001"
                />
              </div>

              <div className="form-group">
                <label>Default Timezone</label>
                <select
                  value={settings.general?.default_timezone || 'Asia/Kolkata'}
                  onChange={(e) => handleSettingChange('general', 'default_timezone', e.target.value)}
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  <option value="Australia/Sydney">Australia/Sydney (AEDT)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Default Language</label>
                <select
                  value={settings.general?.default_language || 'en'}
                  onChange={(e) => handleSettingChange('general', 'default_language', e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="hi">Hindi</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* WHATSAPP TAB */}
        {activeTab === 'whatsapp' && (
          <div className="settings-section">
            <h2>WhatsApp Configuration (YCloud)</h2>
            <p className="section-description">
              Configure your master YCloud API key. This will be used for all schools unless a school has their own API key.
            </p>

            <div className="settings-grid">
              <div className="form-group full-width">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.whatsapp?.whatsapp_enabled === 'true'}
                    onChange={(e) => handleSettingChange('whatsapp', 'whatsapp_enabled', e.target.checked ? 'true' : 'false')}
                  />
                  Enable WhatsApp Notifications Globally
                </label>
              </div>

              <div className="form-group full-width">
                <label>YCloud API Key (Master)</label>
                <input
                  type="password"
                  value={settings.whatsapp?.ycloud_api_key || ''}
                  onChange={(e) => handleSettingChange('whatsapp', 'ycloud_api_key', e.target.value)}
                  placeholder="Enter your YCloud API Key"
                  style={{ fontFamily: 'monospace' }}
                />
                <small style={{ color: '#64748b', marginTop: '4px', display: 'block' }}>
                  Get your API key from YCloud Dashboard → API Keys
                </small>
              </div>

              <div className="form-group">
                <label>WhatsApp Business Phone ID</label>
                <input
                  type="text"
                  value={settings.whatsapp?.whatsapp_phone_id || ''}
                  onChange={(e) => handleSettingChange('whatsapp', 'whatsapp_phone_id', e.target.value)}
                  placeholder="Your WhatsApp Phone Number ID"
                />
              </div>

              <div className="form-group">
                <label>WhatsApp Business Account ID</label>
                <input
                  type="text"
                  value={settings.whatsapp?.whatsapp_business_account_id || ''}
                  onChange={(e) => handleSettingChange('whatsapp', 'whatsapp_business_account_id', e.target.value)}
                  placeholder="Your WABA ID"
                />
              </div>

              <div className="form-group">
                <label>Daily Message Limit</label>
                <input
                  type="number"
                  value={settings.whatsapp?.whatsapp_daily_limit || '5000'}
                  onChange={(e) => handleSettingChange('whatsapp', 'whatsapp_daily_limit', e.target.value)}
                  min="100"
                  max="100000"
                />
              </div>
            </div>

            {/* Template Configuration Section */}
            <div style={{
              background: '#fefce8',
              border: '1px solid #facc15',
              borderRadius: '8px',
              padding: '16px',
              marginTop: '24px',
              marginBottom: '20px'
            }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#854d0e' }}>📝 Message Templates (Meta Approved)</h4>
              <p style={{ margin: '0 0 16px 0', color: '#713f12', fontSize: '14px' }}>
                Templates must be created and approved in <strong>Meta Business Manager</strong> → WhatsApp Manager → Message Templates.
                Your template should use these parameters: <br />
                <code style={{ background: '#fef9c3', padding: '2px 6px', borderRadius: '4px' }}>
                  {'{{1}}'} = Student Name, {'{{2}}'} = Time, {'{{3}}'} = Date, {'{{4}}'} = School Name
                </code>
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '13px' }}>🔔 Late Template</label>
                  <input
                    type="text"
                    value={settings.whatsapp?.whatsapp_template_late || 'attendance_late'}
                    onChange={(e) => handleSettingChange('whatsapp', 'whatsapp_template_late', e.target.value)}
                    placeholder="attendance_late"
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '13px' }}>⚠️ Absent Template</label>
                  <input
                    type="text"
                    value={settings.whatsapp?.whatsapp_template_absent || 'attendance_absent'}
                    onChange={(e) => handleSettingChange('whatsapp', 'whatsapp_template_absent', e.target.value)}
                    placeholder="attendance_absent"
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '13px' }}>✅ Present Template</label>
                  <input
                    type="text"
                    value={settings.whatsapp?.whatsapp_template_present || 'attendance_present'}
                    onChange={(e) => handleSettingChange('whatsapp', 'whatsapp_template_present', e.target.value)}
                    placeholder="attendance_present"
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '13px' }}>📋 Leave Template</label>
                  <input
                    type="text"
                    value={settings.whatsapp?.whatsapp_template_leave || 'attendance_leave'}
                    onChange={(e) => handleSettingChange('whatsapp', 'whatsapp_template_leave', e.target.value)}
                    placeholder="attendance_leave"
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>

            {/* Per-School API Keys Info Box */}
            <div style={{
              background: '#f0f9ff',
              border: '1px solid #0ea5e9',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#0369a1' }}>🔑 Per-School API Keys</h4>
              <p style={{ margin: 0, color: '#0c4a6e', fontSize: '14px' }}>
                If some schools want to use their own YCloud account, you can set their API key in the
                <strong> WhatsApp Credits</strong> page. Schools with their own key will use it instead of your master key.
              </p>
            </div>

            {/* WhatsApp Test Section */}
            <div className="test-section">
              <h3>Test WhatsApp Connection</h3>
              <div className="test-input-group">
                <input
                  type="tel"
                  placeholder="Enter test phone number (+919876543210)"
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
                />
                <button
                  className="btn-test"
                  onClick={testWhatsAppConnection}
                  disabled={testingWhatsApp}
                >
                  {testingWhatsApp ? (
                    <>
                      <FiRefreshCw className="spin" />
                      Testing...
                    </>
                  ) : (
                    'Send Test Message'
                  )}
                </button>
              </div>
              <p className="hint">A test message will be sent to verify your YCloud configuration</p>
            </div>
          </div>
        )}

        {/* EMAIL TAB */}
        {activeTab === 'email' && (
          <div className="settings-section">
            <h2>Email Configuration (SMTP)</h2>

            <div className="settings-grid">
              <div className="form-group full-width">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.email?.email_enabled === 'true'}
                    onChange={(e) => handleSettingChange('email', 'email_enabled', e.target.checked ? 'true' : 'false')}
                  />
                  Enable Email Notifications
                </label>
              </div>

              <div className="form-group">
                <label>SMTP Host</label>
                <input
                  type="text"
                  value={settings.email?.smtp_host || ''}
                  onChange={(e) => handleSettingChange('email', 'smtp_host', e.target.value)}
                  placeholder="smtp.gmail.com"
                />
              </div>

              <div className="form-group">
                <label>SMTP Port</label>
                <input
                  type="number"
                  value={settings.email?.smtp_port || '587'}
                  onChange={(e) => handleSettingChange('email', 'smtp_port', e.target.value)}
                  placeholder="587"
                />
              </div>

              <div className="form-group full-width">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.email?.smtp_secure === 'true'}
                    onChange={(e) => handleSettingChange('email', 'smtp_secure', e.target.checked ? 'true' : 'false')}
                  />
                  Use TLS/SSL
                </label>
              </div>

              <div className="form-group">
                <label>SMTP Username</label>
                <input
                  type="text"
                  value={settings.email?.smtp_username || ''}
                  onChange={(e) => handleSettingChange('email', 'smtp_username', e.target.value)}
                  placeholder="your@email.com"
                />
              </div>

              <div className="form-group">
                <label>SMTP Password</label>
                <input
                  type="password"
                  value={settings.email?.smtp_password || ''}
                  onChange={(e) => handleSettingChange('email', 'smtp_password', e.target.value)}
                  placeholder="Enter SMTP password"
                />
              </div>

              <div className="form-group">
                <label>From Email Address</label>
                <input
                  type="email"
                  value={settings.email?.email_from_address || ''}
                  onChange={(e) => handleSettingChange('email', 'email_from_address', e.target.value)}
                  placeholder="noreply@school.com"
                />
              </div>

              <div className="form-group">
                <label>From Name</label>
                <input
                  type="text"
                  value={settings.email?.email_from_name || ''}
                  onChange={(e) => handleSettingChange('email', 'email_from_name', e.target.value)}
                  placeholder="School Attendance System"
                />
              </div>
            </div>
          </div>
        )}

        {/* STORAGE TAB */}
        {activeTab === 'storage' && (
          <div className="settings-section">
            <h2>Storage Settings</h2>

            <div className="settings-grid">
              <div className="form-group">
                <label>Upload Directory</label>
                <input
                  type="text"
                  value={settings.storage?.upload_directory || './uploads'}
                  onChange={(e) => handleSettingChange('storage', 'upload_directory', e.target.value)}
                  placeholder="./uploads"
                />
              </div>

              <div className="form-group">
                <label>Max File Size (bytes)</label>
                <input
                  type="number"
                  value={settings.storage?.max_file_size || '5242880'}
                  onChange={(e) => handleSettingChange('storage', 'max_file_size', e.target.value)}
                />
                <small>{(parseInt(settings.storage?.max_file_size || 5242880) / 1024 / 1024).toFixed(2)} MB</small>
              </div>

              <div className="form-group full-width">
                <label>Allowed File Types (JSON Array)</label>
                <textarea
                  rows="3"
                  value={settings.storage?.allowed_file_types || '[]'}
                  onChange={(e) => handleSettingChange('storage', 'allowed_file_types', e.target.value)}
                  placeholder='["image/jpeg","image/jpg","image/png"]'
                />
              </div>
            </div>
          </div>
        )}

        {/* SECURITY TAB */}
        {activeTab === 'security' && (
          <div className="settings-section">
            <h2>Security Settings</h2>

            <div className="settings-grid">
              <div className="form-group">
                <label>JWT Access Token Expiry</label>
                <input
                  type="text"
                  value={settings.security?.jwt_access_expiry || '15m'}
                  onChange={(e) => handleSettingChange('security', 'jwt_access_expiry', e.target.value)}
                  placeholder="15m"
                />
                <small>Examples: 15m, 1h, 1d</small>
              </div>

              <div className="form-group">
                <label>JWT Refresh Token Expiry</label>
                <input
                  type="text"
                  value={settings.security?.jwt_refresh_expiry || '7d'}
                  onChange={(e) => handleSettingChange('security', 'jwt_refresh_expiry', e.target.value)}
                  placeholder="7d"
                />
              </div>

              <div className="form-group">
                <label>Max Login Attempts</label>
                <input
                  type="number"
                  value={settings.security?.max_login_attempts || '5'}
                  onChange={(e) => handleSettingChange('security', 'max_login_attempts', e.target.value)}
                  min="3"
                  max="10"
                />
              </div>

              <div className="form-group">
                <label>Lockout Duration (minutes)</label>
                <input
                  type="number"
                  value={settings.security?.lockout_duration || '15'}
                  onChange={(e) => handleSettingChange('security', 'lockout_duration', e.target.value)}
                  min="5"
                  max="60"
                />
              </div>

              <div className="form-group">
                <label>Session Timeout (minutes)</label>
                <input
                  type="number"
                  value={settings.security?.session_timeout || '60'}
                  onChange={(e) => handleSettingChange('security', 'session_timeout', e.target.value)}
                  min="15"
                  max="480"
                />
              </div>

              <div className="form-group">
                <label>Minimum Password Length</label>
                <input
                  type="number"
                  value={settings.security?.password_min_length || '8'}
                  onChange={(e) => handleSettingChange('security', 'password_min_length', e.target.value)}
                  min="6"
                  max="20"
                />
              </div>

              <div className="form-group full-width">
                <h3>Password Requirements</h3>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.security?.password_require_uppercase === 'true'}
                      onChange={(e) => handleSettingChange('security', 'password_require_uppercase', e.target.checked ? 'true' : 'false')}
                    />
                    Require Uppercase Letter
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.security?.password_require_lowercase === 'true'}
                      onChange={(e) => handleSettingChange('security', 'password_require_lowercase', e.target.checked ? 'true' : 'false')}
                    />
                    Require Lowercase Letter
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.security?.password_require_number === 'true'}
                      onChange={(e) => handleSettingChange('security', 'password_require_number', e.target.checked ? 'true' : 'false')}
                    />
                    Require Number
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.security?.password_require_special === 'true'}
                      onChange={(e) => handleSettingChange('security', 'password_require_special', e.target.checked ? 'true' : 'false')}
                    />
                    Require Special Character
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default SystemSettings;
