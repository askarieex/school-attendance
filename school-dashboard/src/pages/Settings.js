import React, { useState, useEffect } from 'react';
import {
  FiSettings,
  FiSave,
  FiRefreshCw,
  FiClock,
  FiCalendar,
  FiMail,
  FiPhone,
  FiMapPin,
  FiHome,
  FiMessageSquare,
  FiDollarSign,
  FiToggleLeft,
  FiToggleRight,
  FiInfo
} from 'react-icons/fi';
import { settingsAPI, academicYearAPI } from '../utils/api';
import './Settings.css';

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('profile');

  // School Profile
  const [schoolProfile, setSchoolProfile] = useState({
    schoolName: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    website: '',
    logoUrl: ''
  });

  // School Timings
  const [schoolTimings, setSchoolTimings] = useState({
    schoolOpenTime: '08:00',
    schoolCloseTime: '14:00',
    lateThresholdMinutes: 15,
    workingDays: 'Mon-Sat',
    weeklyHoliday: 'Sunday',
    absenceCheckTime: '11:00'
  });

  // Academic Year
  const [academicYears, setAcademicYears] = useState([]);
  const [currentAcademicYear, setCurrentAcademicYear] = useState(null);
  const [showYearModal, setShowYearModal] = useState(false);
  const [yearFormData, setYearFormData] = useState({
    yearName: '',
    startDate: '',
    endDate: '',
    workingDays: 'Mon-Sat',
    weeklyHoliday: 'Sunday'
  });

  // SMS Settings
  const [smsSettings, setSmsSettings] = useState({
    smsEnabled: false,
    smsProvider: 'twilio',
    smsApiKey: '',
    smsBalance: 0,
    sendOnAbsent: true,
    sendOnLate: true,
    sendDailySummary: false
  });

  useEffect(() => {
    fetchSettings();
    fetchAcademicYears();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.get();

      if (response.success) {
        const settings = response.data;

        // Parse school profile
        setSchoolProfile({
          schoolName: settings.school_name || '',
          address: settings.address || '',
          city: settings.city || '',
          state: settings.state || '',
          pincode: settings.pincode || '',
          phone: settings.phone || '',
          email: settings.email || '',
          website: settings.website || '',
          logoUrl: settings.logo_url || ''
        });

        // Parse school timings
        setSchoolTimings({
          schoolOpenTime: settings.school_open_time || '08:00',
          schoolCloseTime: settings.school_close_time || '14:00',
          lateThresholdMinutes: settings.late_threshold_minutes || 15,
          workingDays: settings.working_days || 'Mon-Sat',
          weeklyHoliday: settings.weekly_holiday || 'Sunday',
          absenceCheckTime: settings.absence_check_time || '11:00'
        });

        // Parse SMS settings
        setSmsSettings({
          smsEnabled: settings.sms_enabled || false,
          smsProvider: settings.sms_provider || 'twilio',
          smsApiKey: settings.sms_api_key || '',
          smsBalance: settings.sms_balance || 0,
          sendOnAbsent: settings.send_on_absent ?? true,
          sendOnLate: settings.send_on_late ?? true,
          sendDailySummary: settings.send_daily_summary ?? false
        });
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchAcademicYears = async () => {
    try {
      const response = await academicYearAPI.getAll();
      if (response.success) {
        setAcademicYears(response.data || []);
        const current = response.data.find(y => y.is_current);
        setCurrentAcademicYear(current);
      }
    } catch (err) {
      console.error('Error fetching academic years:', err);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setError('Invalid file type. Please upload a JPG or PNG image.');
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('Image size too large. Maximum size is 2MB.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const formData = new FormData();
      formData.append('logo', file);

      const response = await settingsAPI.uploadLogo(formData);

      if (response.success) {
        setSchoolProfile(prev => ({ ...prev, logoUrl: response.data.logoUrl }));
        setSuccessMessage('School logo uploaded successfully! ✅');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError('Failed to upload logo');
      }
    } catch (err) {
      console.error('Error uploading logo:', err);
      setError('An error occurred while uploading logo');
    } finally {
      setSaving(false);
      // Reset input
      e.target.value = null;
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const data = {
        school_name: schoolProfile.schoolName,
        address: schoolProfile.address,
        city: schoolProfile.city,
        state: schoolProfile.state,
        pincode: schoolProfile.pincode,
        phone: schoolProfile.phone,
        email: schoolProfile.email,
        website: schoolProfile.website,
        logo_url: schoolProfile.logoUrl
      };

      const response = await settingsAPI.update(data);

      if (response.success) {
        setSuccessMessage('School profile updated successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError('Failed to update school profile');
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      setError('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTimings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      // VALIDATION: School open time must be in morning
      const openHours = parseInt(schoolTimings.schoolOpenTime.split(':')[0]);
      if (openHours >= 12) {
        setError('School start time must be in the morning (before 12:00 PM). Did you mean 09:00 instead of 21:00?');
        setSaving(false);
        return;
      }
      if (openHours < 6) {
        setError('School start time should be after 6:00 AM');
        setSaving(false);
        return;
      }

      // VALIDATION: School close time must be in afternoon/evening
      const closeHours = parseInt(schoolTimings.schoolCloseTime.split(':')[0]);
      if (closeHours < 12) {
        setError('School close time should be in afternoon/evening (after 12:00 PM)');
        setSaving(false);
        return;
      }

      // VALIDATION: Open time must be before close time
      const openMinutes = openHours * 60 + parseInt(schoolTimings.schoolOpenTime.split(':')[1]);
      const closeMinutes = closeHours * 60 + parseInt(schoolTimings.schoolCloseTime.split(':')[1]);
      if (openMinutes >= closeMinutes) {
        setError('School open time must be before close time');
        setSaving(false);
        return;
      }

      // VALIDATION: Late threshold must be reasonable
      const threshold = parseInt(schoolTimings.lateThresholdMinutes);
      if (threshold < 0 || threshold > 60) {
        setError('Late threshold must be between 0 and 60 minutes');
        setSaving(false);
        return;
      }

      const data = {
        school_open_time: schoolTimings.schoolOpenTime,
        school_close_time: schoolTimings.schoolCloseTime,
        late_threshold_minutes: threshold,
        working_days: schoolTimings.workingDays,
        weekly_holiday: schoolTimings.weeklyHoliday,
        absence_check_time: schoolTimings.absenceCheckTime
      };

      const response = await settingsAPI.update(data);

      if (response.success) {
        setSuccessMessage('School timings updated successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError('Failed to update school timings');
      }
    } catch (err) {
      console.error('Error saving timings:', err);
      setError('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSMS = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const data = {
        sms_enabled: smsSettings.smsEnabled,
        sms_provider: smsSettings.smsProvider,
        sms_api_key: smsSettings.smsApiKey,
        send_on_absent: smsSettings.sendOnAbsent,
        send_on_late: smsSettings.sendOnLate,
        send_daily_summary: smsSettings.sendDailySummary
      };

      const response = await settingsAPI.update(data);

      if (response.success) {
        setSuccessMessage('SMS settings updated successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError('Failed to update SMS settings');
      }
    } catch (err) {
      console.error('Error saving SMS settings:', err);
      setError('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAcademicYear = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      // ✅ FIX BUG #8: Validate year name format
      const yearNamePattern = /^(\d{4})-(\d{4})$/;
      const match = yearFormData.yearName.match(yearNamePattern);

      if (!match) {
        setError('Invalid year name format. Must be YYYY-YYYY (e.g., 2025-2026)');
        setSaving(false);
        return;
      }

      const [, startYear, endYear] = match;
      if (parseInt(endYear) !== parseInt(startYear) + 1) {
        setError('Invalid year name. Second year must be exactly one year after first (e.g., 2025-2026, not 2025-2027)');
        setSaving(false);
        return;
      }

      // Validate dates
      const startDate = new Date(yearFormData.startDate);
      const endDate = new Date(yearFormData.endDate);

      if (endDate <= startDate) {
        setError('End date must be after start date');
        setSaving(false);
        return;
      }

      const data = {
        year_name: yearFormData.yearName,
        start_date: yearFormData.startDate,
        end_date: yearFormData.endDate,
        working_days: yearFormData.workingDays,
        weekly_holiday: yearFormData.weeklyHoliday
      };

      const response = await academicYearAPI.create(data);

      if (response.success) {
        setShowYearModal(false);
        await fetchAcademicYears();
        setYearFormData({
          yearName: '',
          startDate: '',
          endDate: '',
          workingDays: 'Mon-Sat',
          weeklyHoliday: 'Sunday'
        });
        setSuccessMessage(`Academic year ${yearFormData.yearName} created successfully ✅`);
        setTimeout(() => setSuccessMessage(''), 3000);
        console.log(`✅ Created academic year: ${yearFormData.yearName}`);
      }
    } catch (err) {
      console.error('Error creating academic year:', err);
      setError(err.message || 'Failed to create academic year. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ✅ FIX BUG #9: Auto-generate year name from dates
  const handleDateChange = (field, value) => {
    const newFormData = { ...yearFormData, [field]: value };

    // Auto-generate year name if both dates are set
    if (newFormData.startDate && newFormData.endDate) {
      const startYear = new Date(newFormData.startDate).getFullYear();
      const endYear = new Date(newFormData.endDate).getFullYear();
      newFormData.yearName = `${startYear}-${endYear}`;
    }

    setYearFormData(newFormData);
  };

  const handleSetCurrentYear = async (yearId) => {
    const year = academicYears.find(y => y.id === yearId);

    if (!year) {
      setError('Academic year not found');
      return;
    }

    // ✅ FIX BUG #10: Show confirmation dialog with detailed warning
    const confirmed = window.confirm(
      `⚠️ SET CURRENT ACADEMIC YEAR\n\n` +
      `Are you sure you want to set "${year.year_name}" as the current academic year?\n\n` +
      `This will affect:\n` +
      `• Student Filtering - Only students in ${year.year_name} will be visible\n` +
      `• Attendance Records - New attendance will use ${year.year_name}\n` +
      `• Teacher Assignments - Assignments for ${year.year_name} will be active\n` +
      `• Reports & Analytics - All reports will show ${year.year_name} data\n\n` +
      (currentAcademicYear
        ? `Current year will change: "${currentAcademicYear.year_name}" → "${year.year_name}"\n\n`
        : ``) +
      `This action cannot be undone. Continue?`
    );

    if (!confirmed) {
      console.log('User cancelled setting current academic year');
      return;
    }

    try {
      setSaving(true);
      setError('');

      console.log(`Setting academic year ${year.year_name} as current...`);
      const response = await academicYearAPI.setCurrent(yearId);

      if (response.success) {
        await fetchAcademicYears();
        setSuccessMessage(`Academic year ${year.year_name} is now the current year ✅`);
        setTimeout(() => setSuccessMessage(''), 5000);
        console.log(`✅ Successfully set ${year.year_name} as current academic year`);
      }
    } catch (err) {
      console.error('Error setting current year:', err);
      setError(err.message || 'Failed to set current academic year. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'School Profile', icon: FiHome },
    { id: 'timings', label: 'School Timings', icon: FiClock },
    { id: 'academic', label: 'Academic Year', icon: FiCalendar },
    { id: 'sms', label: 'SMS Settings', icon: FiMessageSquare }
  ];

  return (
    <div className="settings-container">
      {/* Header */}
      <div className="settings-header">
        <div>
          <h1 className="page-title">
            <FiSettings className="inline-icon" />
            School Settings
          </h1>
          <p className="page-subtitle">Manage your school configuration and preferences</p>
        </div>
        <button className="btn btn-outline" onClick={fetchSettings}>
          <FiRefreshCw /> Refresh
        </button>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="alert alert-success">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="settings-tabs">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="settings-content card">
        {loading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading settings...</p>
          </div>
        ) : (
          <>
            {/* School Profile Tab */}
            {activeTab === 'profile' && (
              <form onSubmit={handleSaveProfile}>

                {/* Floating Toast Notification */}
                {successMessage && (
                  <div className="toast-notification success">
                    <FiSave />
                    {successMessage}
                  </div>
                )}

                {/* School Logo Section */}
                <div className="settings-section">
                  <h3 className="section-title">School Logo</h3>
                  <div className="logo-upload-wrapper">
                    <div className="logo-preview-container">
                      {schoolProfile.logoUrl ? (
                        <img
                          src={`${process.env.REACT_APP_API_URL.replace(/\/api\/v1\/?$/, '')}${schoolProfile.logoUrl.startsWith('/') ? '' : '/'}${schoolProfile.logoUrl}?v=${new Date().getTime()}`}
                          alt="School Logo"
                          className="logo-img-preview"
                          key={schoolProfile.logoUrl} /* Force re-render on url change */
                          onError={(e) => {
                            console.error('Image load failed:', e.target.src);
                            // Only hide if it really fails after retries
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      {/* Fallback placed adjacent for manual toggle or if no url */}
                      <div className="logo-placeholder" style={{ display: schoolProfile.logoUrl ? 'none' : 'flex' }}>
                        <FiHome size={32} />
                      </div>
                    </div>

                    <div className="logo-upload-info">
                      <div className="logo-actions">
                        <label className="btn btn-secondary btn-sm">
                          Change Logo
                          <input
                            type="file"
                            accept="image/png, image/jpeg"
                            onChange={handleLogoUpload}
                            hidden
                          />
                        </label>
                        {schoolProfile.logoUrl && (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm text-danger"
                            onClick={() => setSchoolProfile({ ...schoolProfile, logoUrl: '' })}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-muted">
                        Recommended size: 200x200px. Max size: 2MB.<br />
                        Formats: JPG, PNG
                      </p>
                    </div>
                  </div>
                </div>

                <div className="settings-section">
                  <h3 className="section-title">School Information</h3>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>
                        <FiHome className="inline-icon" />
                        School Name *
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={schoolProfile.schoolName}
                        onChange={(e) => setSchoolProfile({ ...schoolProfile, schoolName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>
                        <FiPhone className="inline-icon" />
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        className="input"
                        value={schoolProfile.phone}
                        onChange={(e) => setSchoolProfile({ ...schoolProfile, phone: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>
                        <FiMail className="inline-icon" />
                        Email Address
                      </label>
                      <input
                        type="email"
                        className="input"
                        value={schoolProfile.email}
                        onChange={(e) => setSchoolProfile({ ...schoolProfile, email: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Website</label>
                      <input
                        type="url"
                        className="input"
                        value={schoolProfile.website}
                        onChange={(e) => setSchoolProfile({ ...schoolProfile, website: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>
                      <FiMapPin className="inline-icon" />
                      Address
                    </label>
                    <textarea
                      className="input"
                      rows="3"
                      value={schoolProfile.address}
                      onChange={(e) => setSchoolProfile({ ...schoolProfile, address: e.target.value })}
                    />
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>City</label>
                      <input
                        type="text"
                        className="input"
                        value={schoolProfile.city}
                        onChange={(e) => setSchoolProfile({ ...schoolProfile, city: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>State</label>
                      <input
                        type="text"
                        className="input"
                        value={schoolProfile.state}
                        onChange={(e) => setSchoolProfile({ ...schoolProfile, state: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Pincode</label>
                      <input
                        type="text"
                        className="input"
                        value={schoolProfile.pincode}
                        onChange={(e) => setSchoolProfile({ ...schoolProfile, pincode: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    <FiSave />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {/* School Timings Tab */}
            {activeTab === 'timings' && (
              <form onSubmit={handleSaveTimings}>
                <div className="settings-section">
                  <h3 className="section-title">School Hours</h3>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>
                        <FiClock className="inline-icon" />
                        School Open Time *
                      </label>
                      <input
                        type="time"
                        className="input"
                        value={schoolTimings.schoolOpenTime}
                        onChange={(e) => setSchoolTimings({ ...schoolTimings, schoolOpenTime: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>
                        <FiClock className="inline-icon" />
                        School Close Time *
                      </label>
                      <input
                        type="time"
                        className="input"
                        value={schoolTimings.schoolCloseTime}
                        onChange={(e) => setSchoolTimings({ ...schoolTimings, schoolCloseTime: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>
                        <FiClock className="inline-icon" />
                        Auto Absence Check Time
                      </label>
                      <input
                        type="time"
                        className="input"
                        value={schoolTimings.absenceCheckTime}
                        onChange={(e) => setSchoolTimings({ ...schoolTimings, absenceCheckTime: e.target.value })}
                        required
                      />
                      <small className="form-hint">
                        <FiInfo size={12} /> Time when the system checks for absences and sends alerts
                      </small>
                    </div>
                    <div className="form-group">
                      <label>Late Threshold (minutes)</label>
                      <input
                        type="number"
                        className="input"
                        value={schoolTimings.lateThresholdMinutes}
                        onChange={(e) => setSchoolTimings({ ...schoolTimings, lateThresholdMinutes: e.target.value })}
                        min="0"
                        max="60"
                      />
                      <small className="form-hint">
                        <FiInfo size={12} /> Students arriving after this many minutes will be marked as late
                      </small>
                    </div>
                  </div>

                  <h3 className="section-title">Working Days</h3>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Working Days Pattern</label>
                      <select
                        className="input"
                        value={schoolTimings.workingDays}
                        onChange={(e) => setSchoolTimings({ ...schoolTimings, workingDays: e.target.value })}
                      >
                        <option value="Mon-Fri">Monday to Friday</option>
                        <option value="Mon-Sat">Monday to Saturday</option>
                        <option value="Sun-Thu">Sunday to Thursday</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Weekly Holiday</label>
                      <select
                        className="input"
                        value={schoolTimings.weeklyHoliday}
                        onChange={(e) => setSchoolTimings({ ...schoolTimings, weeklyHoliday: e.target.value })}
                      >
                        <option value="Sunday">Sunday</option>
                        <option value="Saturday">Saturday</option>
                        <option value="Friday">Friday</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    <FiSave />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {/* Academic Year Tab */}
            {activeTab === 'academic' && (
              <div className="settings-section">
                <div className="section-header">
                  <h3 className="section-title">Academic Years</h3>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowYearModal(true)}>
                    + Add Academic Year
                  </button>
                </div>

                {currentAcademicYear && (
                  <div className="current-year-card">
                    <div className="current-year-badge">Current</div>
                    <h4>{currentAcademicYear.year_name}</h4>
                    <p>
                      {new Date(currentAcademicYear.start_date).toLocaleDateString()} - {' '}
                      {new Date(currentAcademicYear.end_date).toLocaleDateString()}
                    </p>
                  </div>
                )}

                <div className="academic-years-list">
                  {/* ✅ FIX BUG #1: Filter out current year to avoid duplicate display */}
                  {academicYears.filter(year => !year.is_current).map(year => (
                    <div key={year.id} className="year-item">
                      <div className="year-info">
                        <h4>{year.year_name}</h4>
                        <p>
                          {new Date(year.start_date).toLocaleDateString()} - {' '}
                          {new Date(year.end_date).toLocaleDateString()}
                        </p>
                        <small>Working: {year.working_days} | Holiday: {year.weekly_holiday}</small>
                      </div>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => handleSetCurrentYear(year.id)}
                        disabled={saving}
                      >
                        Set as Current
                      </button>
                    </div>
                  ))}
                  {/* Show message if no other years exist */}
                  {academicYears.filter(year => !year.is_current).length === 0 && (
                    <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                      No other academic years. Click "+ Add Academic Year" to create a new one.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* SMS Settings Tab */}
            {activeTab === 'sms' && (
              <form onSubmit={handleSaveSMS}>
                <div className="settings-section">
                  <h3 className="section-title">SMS Configuration</h3>

                  <div className="form-group">
                    <div className="toggle-group">
                      <label>Enable SMS Notifications</label>
                      <button
                        type="button"
                        className={`toggle-btn ${smsSettings.smsEnabled ? 'active' : ''}`}
                        onClick={() => setSmsSettings({ ...smsSettings, smsEnabled: !smsSettings.smsEnabled })}
                      >
                        {smsSettings.smsEnabled ? <FiToggleRight size={24} /> : <FiToggleLeft size={24} />}
                      </button>
                    </div>
                  </div>

                  {smsSettings.smsEnabled && (
                    <>
                      <div className="form-grid">
                        <div className="form-group">
                          <label>SMS Provider</label>
                          <select
                            className="input"
                            value={smsSettings.smsProvider}
                            onChange={(e) => setSmsSettings({ ...smsSettings, smsProvider: e.target.value })}
                          >
                            <option value="twilio">Twilio</option>
                            <option value="msg91">MSG91</option>
                            <option value="2factor">2Factor</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>API Key</label>
                          <input
                            type="password"
                            className="input"
                            value={smsSettings.smsApiKey}
                            onChange={(e) => setSmsSettings({ ...smsSettings, smsApiKey: e.target.value })}
                            placeholder="Enter your SMS API key"
                          />
                        </div>
                      </div>

                      <div className="sms-balance-card">
                        <FiDollarSign size={24} />
                        <div>
                          <h4>SMS Balance</h4>
                          <p className="balance-value">{smsSettings.smsBalance} credits remaining</p>
                        </div>
                      </div>

                      <h3 className="section-title">Notification Triggers</h3>
                      <div className="checkbox-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={smsSettings.sendOnAbsent}
                            onChange={(e) => setSmsSettings({ ...smsSettings, sendOnAbsent: e.target.checked })}
                          />
                          Send SMS when student is absent
                        </label>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={smsSettings.sendOnLate}
                            onChange={(e) => setSmsSettings({ ...smsSettings, sendOnLate: e.target.checked })}
                          />
                          Send SMS when student is late
                        </label>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={smsSettings.sendDailySummary}
                            onChange={(e) => setSmsSettings({ ...smsSettings, sendDailySummary: e.target.checked })}
                          />
                          Send daily attendance summary to parents
                        </label>
                      </div>
                    </>
                  )}
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    <FiSave />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>

      {/* Academic Year Modal */}
      {showYearModal && (
        <div className="modal-overlay" onClick={() => setShowYearModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Academic Year</h2>
              <button className="modal-close" onClick={() => setShowYearModal(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateAcademicYear}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Start Date *</label>
                    <input
                      type="date"
                      className="input"
                      value={yearFormData.startDate}
                      onChange={(e) => handleDateChange('startDate', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>End Date *</label>
                    <input
                      type="date"
                      className="input"
                      value={yearFormData.endDate}
                      onChange={(e) => handleDateChange('endDate', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Year Name *</label>
                  <input
                    type="text"
                    className="input"
                    value={yearFormData.yearName}
                    onChange={(e) => setYearFormData({ ...yearFormData, yearName: e.target.value })}
                    placeholder="e.g., 2025-2026 (auto-filled from dates)"
                    pattern="\d{4}-\d{4}"
                    title="Format must be YYYY-YYYY (e.g., 2025-2026)"
                    required
                    readOnly={yearFormData.startDate && yearFormData.endDate}
                    style={{ backgroundColor: yearFormData.yearName ? '#f0f0f0' : 'white' }}
                  />
                  <small style={{ color: '#666', fontSize: '12px' }}>
                    {yearFormData.yearName
                      ? '✅ Auto-generated from dates'
                      : 'Select start and end dates first'}
                  </small>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Working Days</label>
                    <select
                      className="input"
                      value={yearFormData.workingDays}
                      onChange={(e) => setYearFormData({ ...yearFormData, workingDays: e.target.value })}
                    >
                      <option value="Mon-Fri">Monday to Friday</option>
                      <option value="Mon-Sat">Monday to Saturday</option>
                      <option value="Sun-Thu">Sunday to Thursday</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Weekly Holiday</label>
                    <select
                      className="input"
                      value={yearFormData.weeklyHoliday}
                      onChange={(e) => setYearFormData({ ...yearFormData, weeklyHoliday: e.target.value })}
                    >
                      <option value="Sunday">Sunday</option>
                      <option value="Saturday">Saturday</option>
                      <option value="Friday">Friday</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowYearModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Academic Year'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
