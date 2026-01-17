import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiMapPin, FiMail, FiPhone, FiAlertTriangle } from 'react-icons/fi';
import { schoolsAPI } from '../utils/api';

const Schools = () => {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    plan: 'trial',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [schoolToDelete, setSchoolToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState(null); // 'deactivate' or 'permanent'
  const [confirmName, setConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    try {
      const response = await schoolsAPI.getAll({ search: searchTerm });
      if (response.success) {
        // Backend returns data as an array directly, not data.schools
        setSchools(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch schools:', error);
      alert('Failed to load schools');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSchool) {
        await schoolsAPI.update(editingSchool.id, formData);
        alert('School updated successfully!');
      } else {
        await schoolsAPI.create(formData);
        alert('School created successfully!');
      }
      setShowModal(false);
      resetForm();
      fetchSchools();
    } catch (error) {
      alert(error.message || 'Operation failed');
    }
  };

  // Open delete options modal
  const openDeleteModal = (school) => {
    setSchoolToDelete(school);
    setDeleteType(null);
    setConfirmName('');
    setShowDeleteModal(true);
  };

  // Close delete modal
  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setSchoolToDelete(null);
    setDeleteType(null);
    setConfirmName('');
    setIsDeleting(false);
  };

  // Perform the delete action
  const performDelete = async () => {
    if (!schoolToDelete) return;

    setIsDeleting(true);
    try {
      if (deleteType === 'deactivate') {
        await schoolsAPI.delete(schoolToDelete.id);
        alert('School deactivated successfully! It can be reactivated later.');
      } else if (deleteType === 'permanent') {
        const result = await schoolsAPI.permanentDelete(schoolToDelete.id, confirmName);
        alert(`School "${schoolToDelete.name}" permanently deleted!\n\nDeleted: ${result.data?.deletedCounts?.students || 0} students, ${result.data?.deletedCounts?.attendanceLogs || 0} attendance logs, ${result.data?.deletedCounts?.devices || 0} devices`);
      }
      closeDeleteModal();
      fetchSchools();
    } catch (error) {
      alert(error.message || 'Failed to delete school');
      setIsDeleting(false);
    }
  };

  const openModal = (school = null) => {
    if (school) {
      setEditingSchool(school);
      setFormData({
        name: school.name,
        email: school.email,
        phone: school.phone || '',
        address: school.address || '',
        plan: school.plan || 'trial',
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingSchool(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      plan: 'trial',
      adminName: '',
      adminEmail: '',
      adminPassword: '',
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '8px' }}>Schools Management</h1>
          <p style={{ color: '#64748b' }}>Manage all client schools in the platform</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <FiPlus /> Add School
        </button>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ position: 'relative' }}>
          <FiSearch style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            className="input"
            placeholder="Search schools by name or email..."
            style={{ paddingLeft: '48px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && fetchSchools()}
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
                <th>School Name</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schools.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    No schools found. Add your first school to get started!
                  </td>
                </tr>
              ) : (
                schools.map((school) => (
                  <tr key={school.id}>
                    <td>
                      <div style={{ fontWeight: '600' }}>{school.name}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FiMail size={14} />
                          {school.email}
                        </div>
                        {school.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FiPhone size={14} />
                            {school.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      {school.address ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                          <FiMapPin size={14} />
                          {school.address}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-${school.plan === 'trial' ? 'warning' : 'primary'}`}>
                        {school.plan || 'Trial'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${school.is_active ? 'success' : 'danger'}`}>
                        {school.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '6px 12px' }}
                          onClick={() => openModal(school)}
                        >
                          <FiEdit size={16} />
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '6px 12px' }}
                          onClick={() => openDeleteModal(school)}
                        >
                          <FiTrash2 size={16} />
                        </button>
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
              {editingSchool ? 'Edit School' : 'Add New School'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>School Name *</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Email *</label>
                  <input
                    type="email"
                    className="input"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Phone</label>
                  <input
                    type="tel"
                    className="input"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Address</label>
                  <textarea
                    className="input"
                    rows="2"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Plan</label>
                  <select
                    className="input"
                    value={formData.plan}
                    onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                  >
                    <option value="trial">Trial</option>
                    <option value="basic">Basic</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                {!editingSchool && (
                  <>
                    <hr />
                    <h3 style={{ fontWeight: '600' }}>School Admin Account (Optional)</h3>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Admin Name</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.adminName}
                        onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Admin Email</label>
                      <input
                        type="email"
                        className="input"
                        value={formData.adminEmail}
                        onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Admin Password</label>
                      <input
                        type="password"
                        className="input"
                        value={formData.adminPassword}
                        onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {editingSchool ? 'Update School' : 'Create School'}
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
      {showDeleteModal && schoolToDelete && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            {!deleteType ? (
              // Step 1: Choose delete type
              <>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FiAlertTriangle color="#f59e0b" size={28} />
                  Delete School
                </h2>
                <p style={{ color: '#64748b', marginBottom: '24px' }}>
                  Choose how to delete <strong>"{schoolToDelete.name}"</strong>
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
                      School will be marked inactive. All data is preserved and can be reactivated later.
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
                    }}
                    onClick={() => setDeleteType('permanent')}
                  >
                    <span style={{ fontWeight: '600', color: '#dc2626' }}>⛔ Permanently Delete</span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>
                      School and ALL data will be permanently removed. This action CANNOT be undone!
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
                  Are you sure you want to deactivate <strong>"{schoolToDelete.name}"</strong>?
                  <br /><br />
                  The school will be marked as inactive but all data will be preserved.
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
                    {isDeleting ? 'Deactivating...' : 'Deactivate School'}
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

                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                  <p style={{ color: '#991b1b', fontWeight: '600', marginBottom: '8px' }}>
                    This will permanently delete:
                  </p>
                  <ul style={{ color: '#b91c1c', fontSize: '14px', paddingLeft: '20px', margin: 0 }}>
                    <li>All students and their records</li>
                    <li>All attendance logs</li>
                    <li>All teachers and class assignments</li>
                    <li>All devices linked to this school</li>
                    <li>School settings and configuration</li>
                  </ul>
                </div>

                <p style={{ color: '#64748b', marginBottom: '12px' }}>
                  Type <strong style={{ color: '#dc2626' }}>"{schoolToDelete.name}"</strong> to confirm:
                </p>
                <input
                  type="text"
                  className="input"
                  placeholder="Type school name here..."
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  style={{ marginBottom: '20px' }}
                />

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    className="btn btn-outline"
                    onClick={() => { setDeleteType(null); setConfirmName(''); }}
                    style={{ flex: 1 }}
                    disabled={isDeleting}
                  >
                    Back
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ flex: 1 }}
                    onClick={performDelete}
                    disabled={isDeleting || confirmName.trim().toLowerCase() !== schoolToDelete.name.trim().toLowerCase()}
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

export default Schools;
