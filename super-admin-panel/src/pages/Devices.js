import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiCopy, FiCheck } from 'react-icons/fi';
import { devicesAPI, schoolsAPI } from '../utils/api';

const Devices = () => {
  const [devices, setDevices] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [formData, setFormData] = useState({
    schoolId: '',
    serialNumber: '',
    deviceName: '',
    location: '',
  });

  useEffect(() => {
    fetchDevices();
    fetchSchools();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await devicesAPI.getAll();
      if (response.success) {
        // Backend returns data as an array directly, not data.devices
        setDevices(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
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
      await devicesAPI.create(formData);
      alert('Device registered successfully! API Key has been generated.');
      setShowModal(false);
      resetForm();
      fetchDevices();
    } catch (error) {
      alert(error.message || 'Failed to register device');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure? This will revoke the device API key.')) {
      try {
        await devicesAPI.delete(id);
        alert('Device deactivated successfully');
        fetchDevices();
      } catch (error) {
        alert('Failed to deactivate device');
      }
    }
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      alert('Failed to copy');
    }
  };

  const resetForm = () => {
    setFormData({
      schoolId: '',
      serialNumber: '',
      deviceName: '',
      location: '',
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '8px' }}>Hardware Devices</h1>
          <p style={{ color: '#64748b' }}>Manage RFID scanners and generate API keys</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus /> Register Device
        </button>
      </div>

      <div className="alert alert-info" style={{ marginBottom: '24px' }}>
        <span>
          📌 Register your RFID device using its physical Serial Number (found on the device label).
        </span>
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
                <th>Device Name</th>
                <th>School</th>
                <th>Location</th>
                <th>Serial Number</th>
                <th>Status</th>
                <th>Last Seen</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    No devices registered yet. Add your first RFID device!
                  </td>
                </tr>
              ) : (
                devices.map((device) => (
                  <tr key={device.id}>
                    <td>
                      <div style={{ fontWeight: '600' }}>{device.device_name}</div>
                    </td>
                    <td>{device.school_name || 'Unknown'}</td>
                    <td>{device.location || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <code style={{
                          background: '#f1f5f9',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          fontWeight: '600',
                        }}>
                          {device.serial_number || device.api_key}
                        </code>
                        <button
                          onClick={() => copyToClipboard(device.serial_number || device.api_key, device.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: copiedId === device.id ? '#10b981' : '#64748b',
                          }}
                          title="Copy serial number"
                        >
                          {copiedId === device.id ? <FiCheck /> : <FiCopy />}
                        </button>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${device.is_active ? 'success' : 'danger'}`}>
                        {device.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px', color: '#64748b' }}>
                      {device.last_seen
                        ? new Date(device.last_seen).toLocaleString()
                        : 'Never'}
                    </td>
                    <td>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '6px 12px' }}
                        onClick={() => handleDelete(device.id)}
                      >
                        <FiTrash2 size={16} />
                      </button>
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
              Register New Device
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                    Select School *
                  </label>
                  <select
                    className="input"
                    value={formData.schoolId}
                    onChange={(e) => setFormData({ ...formData, schoolId: e.target.value })}
                    required
                  >
                    <option value="">Choose a school...</option>
                    {schools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                    Device Serial Number *
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g., ZK12345678"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value.trim() })}
                    required
                    style={{ fontFamily: 'monospace', letterSpacing: '0.5px' }}
                  />
                  <small style={{ color: '#64748b', fontSize: '13px' }}>
                    📍 Enter the Serial Number printed on the device label
                  </small>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                    Device Name *
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g., Main Entrance Scanner"
                    value={formData.deviceName}
                    onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })}
                    required
                  />
                  <small style={{ color: '#64748b', fontSize: '13px' }}>
                    Give this device a friendly, descriptive name
                  </small>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                    Location
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g., Building A - Ground Floor"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                  <small style={{ color: '#64748b', fontSize: '13px' }}>
                    Physical location of the device
                  </small>
                </div>

                <div className="alert alert-warning">
                  <span>
                    ⚠️ <strong>Important:</strong> Enter the Serial Number from the device label. This cannot be changed after registration.
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Register Device
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

export default Devices;
