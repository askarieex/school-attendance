import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiMenu, FiX, FiHome, FiUsers, FiHardDrive, FiSettings, FiLogOut, FiBarChart2, FiShield } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import './Layout.css';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const menuItems = [
    { path: '/dashboard', icon: <FiHome />, label: 'Dashboard' },
    { path: '/schools', icon: <FiUsers />, label: 'Schools' },
    { path: '/devices', icon: <FiHardDrive />, label: 'Devices' },
    { path: '/users', icon: <FiShield />, label: 'Admins' },
    { path: '/statistics', icon: <FiBarChart2 />, label: 'Statistics' },
    { path: '/settings', icon: <FiSettings />, label: 'Settings' },
  ];

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
    }
  };

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="logo">
            <FiShield size={32} />
            {sidebarOpen && <span>Super Admin</span>}
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="nav-label">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="nav-item logout-btn">
            <span className="nav-icon"><FiLogOut /></span>
            {sidebarOpen && <span className="nav-label">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        {/* Top Bar */}
        <header className="topbar">
          <button
            className="toggle-sidebar-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>

          <div className="topbar-right">
            <div className="user-info">
              <div className="user-avatar">
                {user?.fullName?.charAt(0) || 'A'}
              </div>
              <div className="user-details">
                <div className="user-name">{user?.fullName || 'Admin'}</div>
                <div className="user-role">Super Administrator</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
