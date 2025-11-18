import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  FiHome,
  FiUsers,
  FiBook,
  FiUserCheck,
  FiClipboard,
  FiCalendar,
  FiUserX,
  FiBarChart2,
  FiSettings,
  FiMenu,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiBookOpen,
  FiCpu
} from 'react-icons/fi';
import './Sidebar.css';

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);

  const menuItems = [
    { path: '/dashboard', icon: FiHome, label: 'Dashboard', badge: null },
    { path: '/students', icon: FiUsers, label: 'Students', badge: null },
    { path: '/classes', icon: FiBook, label: 'Classes', badge: null },
    { path: '/teachers', icon: FiUserCheck, label: 'Teachers', badge: null },
    { path: '/subjects', icon: FiBookOpen, label: 'Subjects', badge: null },
    { path: '/attendance', icon: FiClipboard, label: 'Attendance', badge: 'New' },
    { path: '/devices', icon: FiCpu, label: 'Devices', badge: 'New' },
    { path: '/calendar', icon: FiCalendar, label: 'Calendar', badge: null },
    { path: '/leaves', icon: FiUserX, label: 'Leaves', badge: null },
    { path: '/reports', icon: FiBarChart2, label: 'Reports', badge: null },
    { path: '/settings', icon: FiSettings, label: 'Settings', badge: null },
  ];

  // Close mobile menu on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button 
        className="mobile-menu-btn" 
        onClick={toggleMobileSidebar}
        aria-label="Toggle menu"
      >
        {isMobileOpen ? <FiX size={24} /> : <FiMenu size={24} />}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={toggleMobileSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${
        isCollapsed ? 'collapsed' : ''
      } ${
        isMobileOpen ? 'mobile-open' : ''
      }`}>
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon">
              <FiBook size={24} />
            </div>
            {!isCollapsed && (
              <div className="brand-text">
                <h3>School</h3>
                <span>Dashboard</span>
              </div>
            )}
          </div>
          
          {/* Desktop Toggle Button */}
          <button 
            className="sidebar-toggle desktop-only" 
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          >
            {isCollapsed ? <FiChevronRight size={20} /> : <FiChevronLeft size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  isActive ? 'sidebar-link active' : 'sidebar-link'
                }
                onMouseEnter={() => setHoveredItem(item.path)}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={() => setIsMobileOpen(false)}
              >
                <div className="link-icon-wrapper">
                  <Icon className="sidebar-icon" />
                  {item.badge && !isCollapsed && (
                    <span className="link-badge">{item.badge}</span>
                  )}
                </div>
                {!isCollapsed && (
                  <span className="sidebar-label">{item.label}</span>
                )}
                
                {/* Tooltip for collapsed state */}
                {isCollapsed && hoveredItem === item.path && (
                  <div className="sidebar-tooltip">
                    {item.label}
                    {item.badge && <span className="tooltip-badge">{item.badge}</span>}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        {!isCollapsed && (
          <div className="sidebar-footer">
            <div className="footer-card">
              <div className="footer-icon">
                <FiSettings size={20} />
              </div>
              <div className="footer-content">
                <p className="footer-title">Need Help?</p>
                <p className="footer-text">Check our documentation</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
