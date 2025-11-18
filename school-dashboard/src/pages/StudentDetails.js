import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft,
  FiEdit2,
  FiTrash2,
  FiCheckCircle,
  FiXCircle,
  FiUser,
  FiPhone,
  FiMail,
  FiCalendar,
  FiMapPin,
  FiCreditCard,
  FiBook
} from 'react-icons/fi';
import { studentsAPI } from '../utils/api';
import './StudentDetails.css';

const StudentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStudentDetails();
  }, [id]);

  const fetchStudentDetails = async () => {
    try {
      setLoading(true);
      const response = await studentsAPI.getById(id);
      setStudent(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching student:', err);
      setError('Failed to load student details');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/students?edit=${id}`);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this student?')) {
      return;
    }

    try {
      await studentsAPI.delete(id);
      navigate('/students');
    } catch (err) {
      console.error('Error deleting student:', err);
      alert('Failed to delete student');
    }
  };

  if (loading) {
    return (
      <div className="student-details-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading student details...</p>
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="student-details-container">
        <div className="error-state">
          <p>{error || 'Student not found'}</p>
          <button className="btn btn-primary" onClick={() => navigate('/students')}>
            <FiArrowLeft /> Back to Students
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="student-details-container">
      {/* Header */}
      <div className="details-header">
        <button className="btn-back" onClick={() => navigate('/students')}>
          <FiArrowLeft /> Back to Students
        </button>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleEdit}>
            <FiEdit2 /> Edit Student
          </button>
          <button className="btn btn-danger" onClick={handleDelete}>
            <FiTrash2 /> Delete
          </button>
        </div>
      </div>

      {/* Student Profile Card */}
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-photo">
            {student.photo_url ? (
              <img
                src={`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}${student.photo_url}`}
                alt={student.full_name}
              />
            ) : (
              <div className="photo-placeholder">
                <FiUser size={60} />
              </div>
            )}
          </div>
          <div className="profile-info">
            <h1>{student.full_name}</h1>
            <div className="profile-meta">
              <span className="meta-item">
                <FiBook /> {student.class_name || 'No Class'} - {student.section_name || 'No Section'}
              </span>
              {student.roll_number && (
                <span className="meta-item">
                  Roll No: {student.roll_number}
                </span>
              )}
            </div>
            <div className="rfid-status-large">
              {student.rfid_card_id && student.rfid_card_id.trim() !== '' ? (
                <span className="badge badge-success-large">
                  <FiCheckCircle /> RFID Assigned
                </span>
              ) : (
                <span className="badge badge-danger-large">
                  <FiXCircle /> RFID Not Assigned
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="details-grid">
        {/* Personal Information */}
        <div className="detail-section">
          <div className="section-header">
            <FiUser />
            <h2>Personal Information</h2>
          </div>
          <div className="detail-items">
            <div className="detail-item">
              <label>Full Name</label>
              <p>{student.full_name}</p>
            </div>
            <div className="detail-item">
              <label>Gender</label>
              <p>{student.gender || '-'}</p>
            </div>
            <div className="detail-item">
              <label>Date of Birth</label>
              <p>
                <FiCalendar className="item-icon" />
                {student.dob || '-'}
              </p>
            </div>
            <div className="detail-item">
              <label>Blood Group</label>
              <p>{student.blood_group || '-'}</p>
            </div>
            <div className="detail-item full-width">
              <label>Address</label>
              <p>
                <FiMapPin className="item-icon" />
                {student.address || '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Academic Information */}
        <div className="detail-section">
          <div className="section-header">
            <FiBook />
            <h2>Academic Information</h2>
          </div>
          <div className="detail-items">
            <div className="detail-item">
              <label>Class</label>
              <p>{student.class_name || '-'}</p>
            </div>
            <div className="detail-item">
              <label>Section</label>
              <p>{student.section_name || '-'}</p>
            </div>
            <div className="detail-item">
              <label>Roll Number</label>
              <p>{student.roll_number || '-'}</p>
            </div>
            <div className="detail-item">
              <label>RFID Card ID</label>
              <p>
                <FiCreditCard className="item-icon" />
                {student.rfid_card_id ? (
                  <span className="rfid-badge">{student.rfid_card_id}</span>
                ) : (
                  '-'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Guardian Information */}
        <div className="detail-section full-width">
          <div className="section-header">
            <FiUser />
            <h2>Guardian Information</h2>
          </div>
          <div className="detail-items guardian-grid">
            <div className="detail-item">
              <label>Father/Guardian Name</label>
              <p>{student.guardian_name || '-'}</p>
            </div>
            <div className="detail-item">
              <label>Guardian Phone</label>
              <p>
                <FiPhone className="item-icon" />
                {student.guardian_phone || '-'}
              </p>
            </div>
            <div className="detail-item">
              <label>Guardian Email</label>
              <p>
                <FiMail className="item-icon" />
                {student.guardian_email || '-'}
              </p>
            </div>
            <div className="detail-item">
              <label>Mother Name</label>
              <p>{student.mother_name || '-'}</p>
            </div>
            <div className="detail-item">
              <label>Mother Phone</label>
              <p>
                <FiPhone className="item-icon" />
                {student.mother_phone || '-'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDetails;
