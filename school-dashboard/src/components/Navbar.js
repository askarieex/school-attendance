import React from 'react';
import { FiLogOut, FiUser } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h2>School Dashboard</h2>
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
