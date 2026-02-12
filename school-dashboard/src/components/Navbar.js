import React, { useState, useEffect } from 'react';
import { FiLogOut, FiUser } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { settingsAPI } from '../utils/api';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const [schoolSettings, setSchoolSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSchoolSettings = async () => {
      try {
        const response = await settingsAPI.get();
        console.log('🏫 School settings response:', response);
        if (response.success && response.data) {
          console.log('🏫 School logo path:', response.data.school_logo);
          setSchoolSettings(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch school settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSchoolSettings();
  }, []);

  // Generate logo URL from backend (matching Flutter app implementation)
  const getLogoUrl = (logoPath) => {
    if (!logoPath) return null;

    // If already absolute URL, return as is
    if (logoPath.startsWith('http')) {
      return logoPath;
    }

    // Get API URL and remove /api/v1 to get root domain (like Flutter app)
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    const rootDomain = API_URL.replace('/api/v1', '');

    // Ensure path starts with /
    const path = logoPath.startsWith('/') ? logoPath : `/${logoPath}`;

    return `${rootDomain}${path}`;
  };

  const logoUrl = schoolSettings?.logo_url ? getLogoUrl(schoolSettings.logo_url) : null;
  const schoolName = schoolSettings?.school_name || 'School Dashboard';

  console.log('🖼️ Final logo URL:', logoUrl);
  console.log('🏫 School name:', schoolName);

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        {!loading && schoolSettings ? (
          <div className="school-branding">
            {logoUrl ? (
              <>
                <img
                  src={logoUrl}
                  alt={schoolName}
                  className="school-logo"
                  onError={(e) => {
                    console.error('❌ Logo failed to load:', logoUrl);
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                  onLoad={() => {
                    console.log('✅ Logo loaded successfully:', logoUrl);
                  }}
                />
                <div className="school-logo-fallback" style={{ display: 'none' }}>
                  <div className="logo-placeholder">
                    {schoolName.charAt(0).toUpperCase()}
                  </div>
                </div>
              </>
            ) : (
              <div className="logo-placeholder">
                {schoolName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="school-info">
              <h2>{schoolName}</h2>
              <span className="dashboard-subtitle">School Dashboard</span>
            </div>
          </div>
        ) : (
          <h2>{schoolName}</h2>
        )}
      </div>

      <div className="navbar-user">
        <div className="user-info">
          <FiUser className="user-icon" />
          <div className="user-details">
            <span className="user-name">{user?.full_name || user?.email}</span>
            <span className="user-role">School Admin</span>
          </div>
        </div>

        <button onClick={logout} className="btn-logout" title="Logout">
          <FiLogOut /> Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
