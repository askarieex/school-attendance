import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiMail, FiShield, FiBriefcase } from 'react-icons/fi';
import { usersAPI, schoolsAPI } from '../utils/api';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    schoolId: '',
    role: 'school_admin',
  });

  useEffect(() => {
    fetchUsers();
    fetchSchools();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await usersAPI.getAll({ search: searchTerm });
      if (response.success) {
        // Backend returns data as an array directly, not data.users
        setUsers(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchools = async () => {
    try {
      const response = await schoolsAPI.getAll();
      if (response.success) {
        // Backend returns data as an array directly, not data.schools
        setSchools(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch schools:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // When editing, don't send password if it's empty
        const updateData = { ...formData };
        if (!updateData.password) {
          delete updateData.password;
        }
        await usersAPI.update(editingUser.id, updateData);
        alert('User updated successfully!');
      } else {
        await usersAPI.create(formData);
        alert('User created successfully!');
      }
      setShowModal(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      alert(error.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to deactivate this user?')) {
      try {
        await usersAPI.delete(id);
        alert('User deactivated successfully');
        fetchUsers();
      } catch (error) {
        alert('Failed to deactivate user');
      }
    }
  };

  const openModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        fullName: user.full_name,
        email: user.email,
        password: '',
        schoolId: user.school_id || '',
        role: user.role || 'school_admin',
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({
      fullName: '',
      email: '',
      password: '',
      schoolId: '',
      role: 'school_admin',
    });
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'superadmin':
        return 'danger';
      case 'school_admin':
        return 'primary';
      default:
        return 'secondary';
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '8px' }}>Users Management</h1>
          <p style={{ color: '#64748b' }}>Manage school administrators and their permissions</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <FiPlus /> Add Admin User
        </button>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ position: 'relative' }}>
          <FiSearch style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            className="input"
            placeholder="Search users by name or email..."
            style={{ paddingLeft: '48px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && fetchUsers()}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Assigned School</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    No users found. Add your first school administrator!
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ fontWeight: '600' }}>{user.full_name}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <FiMail size={14} />
                        {user.email}
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${getRoleBadgeColor(user.role)}`}>
                        <FiShield size={12} style={{ marginRight: '4px' }} />
                        {user.role === 'superadmin' ? 'Super Admin' : 'School Admin'}
                      </span>
                    </td>
                    <td>
                      {user.school_name ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                          <FiBriefcase size={14} />
                          {user.school_name}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-${user.is_active ? 'success' : 'danger'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px', color: '#64748b' }}>
                      {user.last_login
                        ? new Date(user.last_login).toLocaleString()
                        : 'Never'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '6px 12px' }}
                          onClick={() => openModal(user)}
                        >
                          <FiEdit size={16} />
                        </button>
                        {user.role !== 'superadmin' && (
                          <button
                            className="btn btn-danger"
                            style={{ padding: '6px 12px' }}
                            onClick={() => handleDelete(user.id)}
                          >
                            <FiTrash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '24px' }}>
              {editingUser ? 'Edit User' : 'Add New Admin User'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                    Email *
                  </label>
                  <input
                    type="email"
                    className="input"
                    placeholder="admin@school.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                    Password {editingUser ? '(leave blank to keep current)' : '*'}
                  </label>
                  <input
                    type="password"
                    className="input"
                    placeholder={editingUser ? 'Leave blank to keep current password' : 'Enter secure password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingUser}
                  />
                  <small style={{ color: '#64748b', fontSize: '13px' }}>
                    Minimum 6 characters recommended
                  </small>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                    Role *
                  </label>
                  <select
                    className="input"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    required
                  >
                    <option value="school_admin">School Admin</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                  <small style={{ color: '#64748b', fontSize: '13px' }}>
                    School Admins can only access their assigned school
                  </small>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                    Assign to School {formData.role === 'school_admin' ? '*' : '(Optional)'}
                  </label>
                  <select
                    className="input"
                    value={formData.schoolId}
                    onChange={(e) => setFormData({ ...formData, schoolId: e.target.value })}
                    required={formData.role === 'school_admin'}
                  >
                    <option value="">Select a school...</option>
                    {schools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                  </select>
                  <small style={{ color: '#64748b', fontSize: '13px' }}>
                    {formData.role === 'school_admin'
                      ? 'School admins must be assigned to a school'
                      : 'Super admins have access to all schools'}
                  </small>
                </div>

                <div className="alert alert-info">
                  <span>
                    This user will receive login credentials via email (feature coming soon).
                    For now, share the credentials securely.
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowModal(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
