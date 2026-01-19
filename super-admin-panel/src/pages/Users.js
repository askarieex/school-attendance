import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiMail, FiShield, FiBriefcase, FiAlertTriangle } from 'react-icons/fi';
import Pagination from '../components/Pagination';
import { usersAPI, schoolsAPI } from '../utils/api';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit] = useState(10); // Show 10 users per page
  const [hasMore, setHasMore] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    schoolId: '',
    role: 'school_admin',
  });

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState(null); // 'deactivate' or 'permanent'
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchSchools();
  }, [page]); // Reload when page changes

  // Reset to page 1 when searching
  useEffect(() => {
    setPage(1);
    fetchUsers();
  }, [searchTerm]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getAll({
        search: searchTerm,
        page: page,
        limit: limit
      });
      if (response.success) {
        // Backend returns data as an array directly, not data.users
        const fetchedUsers = response.data || [];
        setUsers(fetchedUsers);

        // Simple client-side check for "next page" availability
        // If we got 'limit' number of items, there's likely more
        setHasMore(fetchedUsers.length === limit);
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

  // Open delete options modal
  const openDeleteModal = (user) => {
    setUserToDelete(user);
    setDeleteType(null);
    setShowDeleteModal(true);
  };

  // Close delete modal
  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setUserToDelete(null);
    setDeleteType(null);
    setIsDeleting(false);
  };

  // Perform the delete action
  const performDelete = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      if (deleteType === 'deactivate') {
        await usersAPI.delete(userToDelete.id);
        alert('User deactivated successfully');
      } else if (deleteType === 'permanent') {
        await usersAPI.permanentDelete(userToDelete.id);
        alert(`User "${userToDelete.full_name}" permanently deleted!`);
      }
      closeDeleteModal();
      fetchUsers();
    } catch (error) {
      alert(error.message || 'Failed to delete user');
      setIsDeleting(false);
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
                            onClick={() => openDeleteModal(user)}
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

      {/* Pagination */}
      {!loading && (users.length > 0 || page > 1) && (
        <Pagination
          currentPage={page}
          onPageChange={setPage}
          hasPrevPage={page > 1}
          hasNextPage={hasMore}
          loading={loading}
        />
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
      {/* Delete Options Modal */}
      {showDeleteModal && userToDelete && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            {!deleteType ? (
              // Step 1: Choose delete type
              <>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FiAlertTriangle color="#f59e0b" size={28} />
                  Delete User
                </h2>
                <p style={{ color: '#64748b', marginBottom: '24px' }}>
                  Choose how to delete <strong>"{userToDelete.full_name}"</strong>
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Deactivate Option */}
                  <button
                    className="btn btn-outline"
                    style={{
                      padding: '16px',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '12px',
                    }}
                    onClick={() => setDeleteType('deactivate')}
                  >
                    <span style={{ fontWeight: '600', color: '#f59e0b' }}>🔴 Deactivate (Recommended)</span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>
                      User will be marked inactive. Data is preserved.
                    </span>
                  </button>

                  {/* Permanent Delete Option */}
                  <button
                    className="btn btn-outline"
                    style={{
                      padding: '16px',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      border: '2px solid #fee2e2',
                      borderRadius: '12px',
                      background: '#fef2f2',
                      color: '#dc2626'
                    }}
                    onClick={() => setDeleteType('permanent')}
                  >
                    <span style={{ fontWeight: '600', color: '#dc2626' }}>⛔ Permanently Delete</span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>
                      User and ALL data will be permanently removed. CANNOT be undone!
                    </span>
                  </button>
                </div>

                <div style={{ marginTop: '24px' }}>
                  <button className="btn btn-outline" onClick={closeDeleteModal} style={{ width: '100%' }}>
                    Cancel
                  </button>
                </div>
              </>
            ) : deleteType === 'deactivate' ? (
              // Step 2a: Confirm deactivation
              <>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '16px' }}>
                  Confirm Deactivation
                </h2>
                <p style={{ color: '#64748b', marginBottom: '24px' }}>
                  Are you sure you want to deactivate <strong>"{userToDelete.full_name}"</strong>?
                </p>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    className="btn btn-outline"
                    onClick={() => setDeleteType(null)}
                    style={{ flex: 1 }}
                    disabled={isDeleting}
                  >
                    Back
                  </button>
                  <button
                    className="btn"
                    style={{ flex: 1, background: '#f59e0b', color: 'white' }}
                    onClick={performDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deactivating...' : 'Deactivate'}
                  </button>
                </div>
              </>
            ) : (
              // Step 2b: Confirm permanent deletion
              <>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '16px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FiAlertTriangle size={28} />
                  DANGER: Permanent Deletion
                </h2>
                <p style={{ color: '#64748b', marginBottom: '24px' }}>
                  Are you sure you want to <strong>permanently delete</strong> the user <strong>"{userToDelete.full_name}"</strong>?
                  <br /><br />
                  <span style={{ color: '#dc2626', fontWeight: '600' }}>This action cannot be undone.</span>
                </p>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    className="btn btn-outline"
                    onClick={() => setDeleteType(null)}
                    style={{ flex: 1 }}
                    disabled={isDeleting}
                  >
                    Back
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ flex: 1 }}
                    onClick={performDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
