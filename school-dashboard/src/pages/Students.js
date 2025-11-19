import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiFilter,
  FiCreditCard,
  FiCheckCircle,
  FiXCircle,
  FiUsers,
  FiAlertCircle,
  FiEye,
  FiUpload,
  FiDownload
} from 'react-icons/fi';
import { studentsAPI, sectionsAPI, classesAPI, academicYearAPI } from '../utils/api';
import './Students.css';

const Students = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterRfidStatus, setFilterRfidStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    rfidUid: '',
    classId: '',
    sectionId: '',
    rollNumber: '',
    gender: '',
    dob: '',
    bloodGroup: '',
    photoUrl: '',
    address: '',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
    motherName: '',
    motherPhone: ''
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  
  // Webcam states
  const [showWebcam, setShowWebcam] = useState(false);
  const [webcamStream, setWebcamStream] = useState(null);
  const videoRef = React.useRef(null);
  const [viewingStudent, setViewingStudent] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Bulk import states
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportFile, setBulkImportFile] = useState(null);
  const [bulkImportClass, setBulkImportClass] = useState('');
  const [bulkImportSection, setBulkImportSection] = useState('');
  const [bulkImportAcademicYear, setBulkImportAcademicYear] = useState('');
  const [academicYears, setAcademicYears] = useState([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState(null);

  useEffect(() => {
    fetchSections();
    fetchClasses();
    fetchAcademicYears();
  }, []);

  // Toast notification function
  const showToast = (message, type = 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);

    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // Real-time field validation
  const validateField = (name, value) => {
    let error = '';

    switch (name) {
      case 'fullName':
        if (!value || value.trim().length < 2) {
          error = 'Full name must be at least 2 characters';
        } else if (value.trim().length > 100) {
          error = 'Full name must be less than 100 characters';
        } else if (!/^[a-zA-Z\s.'-]+$/.test(value)) {
          error = 'Full name can only contain letters, spaces, dots, hyphens, and apostrophes';
        }
        break;

      case 'rfidUid':
        if (!value || value.trim().length === 0) {
          error = 'RFID card ID is required';
        } else if (value.trim().length > 50) {
          error = 'RFID card ID must be less than 50 characters';
        }
        break;

      case 'gender':
        if (!value) {
          error = 'Gender is required';
        }
        break;

      case 'dob':
        if (!value) {
          error = 'Date of birth is required';
        } else {
          const date = new Date(value);
          const today = new Date();
          const minDate = new Date();
          minDate.setFullYear(minDate.getFullYear() - 25);
          const maxDate = new Date();
          maxDate.setFullYear(maxDate.getFullYear() - 3);

          if (date > today) {
            error = 'Date of birth cannot be in the future';
          } else if (date < minDate) {
            error = 'Student must be younger than 25 years';
          } else if (date > maxDate) {
            error = 'Student must be at least 3 years old';
          }
        }
        break;

      case 'guardianPhone':
      case 'motherPhone':
        if (value && !/^[+]?[\d\s()-]{10,20}$/.test(value)) {
          error = 'Invalid phone number format (10-20 digits)';
        }
        break;

      case 'guardianEmail':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = 'Invalid email format';
        }
        break;

      case 'rollNumber':
        if (value && value.trim().length > 50) {
          error = 'Roll number must be less than 50 characters';
        }
        break;

      case 'address':
        if (value && value.trim().length > 500) {
          error = 'Address must be less than 500 characters';
        }
        break;

      case 'sectionId':
        if (!value) {
          error = 'Class & Section is required';
        }
        break;

      default:
        break;
    }

    setFieldErrors(prev => ({
      ...prev,
      [name]: error
    }));

    return error === '';
  };

  // Handle field blur - mark as touched
  const handleFieldBlur = (name) => {
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
    validateField(name, formData[name]);
  };

  // Handle field change with validation
  const handleFieldChange = (name, value) => {
    // Remove leading zeros from RFID card ID
    if (name === 'rfidUid' && value) {
      // Remove all leading zeros, but keep at least one digit if the value is all zeros
      value = value.replace(/^0+/, '') || '0';
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Only validate if field has been touched
    if (touched[name]) {
      validateField(name, value);
    }
  };

  // Check if form is valid
  const isFormValid = () => {
    const requiredFields = ['fullName', 'rfidUid', 'gender', 'dob', 'sectionId'];

    // Check required fields
    for (const field of requiredFields) {
      const value = formData[field];
      // Handle both string and non-string values
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return false;
      }
    }

    // Check for field errors
    const hasErrors = Object.values(fieldErrors).some(error => error !== '');
    if (hasErrors) {
      return false;
    }

    // Photo is now optional for both new and existing students
    // Removed photo requirement check

    return true;
  };

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filter students whenever filters or students change
  useEffect(() => {
    let filtered = [...students];

    // Filter by class
    if (filterClass) {
      filtered = filtered.filter(student => student.class_id === parseInt(filterClass));
    }

    // Filter by section
    if (filterSection) {
      filtered = filtered.filter(student => student.section_id === parseInt(filterSection));
    }

    // Filter by RFID status
    if (filterRfidStatus !== 'all') {
      if (filterRfidStatus === 'assigned') {
        filtered = filtered.filter(student => student.rfid_card_id && student.rfid_card_id.trim() !== '');
      } else if (filterRfidStatus === 'not-assigned') {
        filtered = filtered.filter(student => !student.rfid_card_id || student.rfid_card_id.trim() === '');
      }
    }

    setFilteredStudents(filtered);
    
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [students, filterClass, filterSection, filterRfidStatus]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await studentsAPI.getAll({ 
        search: searchTerm,
        limit: 1000  // Increase limit to show all students
      });

      if (response.success) {
        setStudents(response.data || []);
      } else {
        setError('Failed to load students');
      }
    } catch (err) {
      console.error('Error fetching students:', err);
      setError('An error occurred while loading students');
    } finally {
      setLoading(false);
    }
  };

  const fetchSections = async () => {
    try {
      const response = await sectionsAPI.getAll();
      if (response.success) {
        setSections(response.data || []);
      }
    } catch (err) {
      console.error('Error fetching sections:', err);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await classesAPI.getAll();
      if (response.success) {
        setClasses(response.data.classes || []);
      }
    } catch (err) {
      console.error('Error fetching classes:', err);
    }
  };

  const fetchAcademicYears = async () => {
    try {
      const response = await academicYearAPI.getAll();
      if (response.success) {
        setAcademicYears(response.data || []);
        // Set current academic year as default
        const currentYear = response.data.find(y => y.is_current);
        if (currentYear) {
          setBulkImportAcademicYear(currentYear.year_name);
        }
      }
    } catch (err) {
      console.error('Error fetching academic years:', err);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      showToast('❌ Only JPG, JPEG, and PNG files are allowed', 'error');
      return;
    }

    // Validate file size (2MB limit)
    if (file.size > 2 * 1024 * 1024) {
      showToast('❌ Photo must be less than 2MB', 'error');
      return;
    }

    setPhotoFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    setFormData({ ...formData, photoUrl: '' });
  };

  // Webcam functions
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        } 
      });
      setWebcamStream(stream);
      setShowWebcam(true);
      
      // Wait for video element to be available
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error('Error accessing webcam:', err);
      showToast('❌ Could not access webcam. Please check permissions.', 'error');
    }
  };

  const stopWebcam = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      setWebcamStream(null);
    }
    setShowWebcam(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      
      // Draw video frame to canvas (centered and cropped)
      const video = videoRef.current;
      const aspectRatio = video.videoWidth / video.videoHeight;
      let sx, sy, sWidth, sHeight;
      
      if (aspectRatio > 1) {
        // Landscape - crop sides
        sHeight = video.videoHeight;
        sWidth = sHeight;
        sx = (video.videoWidth - sWidth) / 2;
        sy = 0;
      } else {
        // Portrait or square - crop top/bottom
        sWidth = video.videoWidth;
        sHeight = sWidth;
        sx = 0;
        sy = (video.videoHeight - sHeight) / 2;
      }
      
      ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, 300, 300);
      
      // Convert canvas to blob
      canvas.toBlob((blob) => {
        const file = new File([blob], 'webcam-photo.jpg', { type: 'image/jpeg' });
        setPhotoFile(file);
        setPhotoPreview(canvas.toDataURL('image/jpeg'));
        stopWebcam();
        showToast('✅ Photo captured successfully!', 'success');
      }, 'image/jpeg', 0.9);
    }
  };

  // Cleanup webcam on unmount
  React.useEffect(() => {
    return () => {
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [webcamStream]);

  const handleOpenModal = (student = null) => {
    if (student) {
      setEditingStudent(student);

      // Format date properly for input field (YYYY-MM-DD)
      let formattedDob = '';
      if (student.dob) {
        // Handle both "YYYY-MM-DD" and full date-time formats
        const dobDate = new Date(student.dob);
        if (!isNaN(dobDate.getTime())) {
          formattedDob = dobDate.toISOString().split('T')[0];
        }
      }

      setFormData({
        fullName: student.full_name || '',
        rfidUid: student.rfid_card_id || '',
        classId: student.class_id || '',
        sectionId: student.section_id || '',
        rollNumber: student.roll_number || '',
        gender: student.gender || '',
        dob: formattedDob,
        bloodGroup: student.blood_group || '',
        photoUrl: student.photo_url || '',
        address: student.address || '',
        guardianName: student.guardian_name || '',
        guardianPhone: student.guardian_phone || '',
        guardianEmail: student.guardian_email || '',
        motherName: student.mother_name || '',
        motherPhone: student.mother_phone || ''
      });
      // Set photo preview if exists
      if (student.photo_url) {
        setPhotoPreview(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}${student.photo_url}`);
      }
    } else {
      setEditingStudent(null);
      setFormData({
        fullName: '',
        rfidUid: '',
        classId: '',
        sectionId: '',
        rollNumber: '',
        gender: '',
        dob: '',
        bloodGroup: '',
        photoUrl: '',
        address: '',
        guardianName: '',
        guardianPhone: '',
        guardianEmail: '',
        motherName: '',
        motherPhone: ''
      });
    }
    setFormError('');
    setPhotoFile(null);
    setPhotoPreview('');
    setFieldErrors({});
    setTouched({});
    setShowModal(true);

    // Scroll to form after a short delay to ensure it's rendered
    setTimeout(() => {
      const formElement = document.querySelector('.student-form-card');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingStudent(null);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.fullName || !formData.rfidUid || !formData.gender || !formData.dob || !formData.sectionId) {
      setFormError('❌ Required fields: Full name, RFID UID, Gender, Date of Birth, and Class & Section');
      return;
    }

    // Photo validation: optional for both new and existing students
    // Removed photo requirement to make it optional
    // if (!editingStudent && !photoFile && !formData.photoUrl && !photoPreview) {
    //   setFormError('❌ Student photo is required for new students. Please upload a photo.');
    //   showToast('❌ Student photo is required', 'error');
    //   return;
    // }

    setSubmitting(true);

    try {
      const studentData = {
        fullName: formData.fullName,
        rfidCardId: formData.rfidUid,
        classId: formData.classId ? parseInt(formData.classId) : null,
        sectionId: formData.sectionId ? parseInt(formData.sectionId) : null,
        rollNumber: formData.rollNumber,
        gender: formData.gender,
        dob: formData.dob,
        bloodGroup: formData.bloodGroup,
        photoUrl: formData.photoUrl,
        address: formData.address,
        guardianName: formData.guardianName,
        guardianPhone: formData.guardianPhone,
        guardianEmail: formData.guardianEmail,
        motherName: formData.motherName,
        motherPhone: formData.motherPhone
      };

      console.log('📤 Sending student data:', studentData);

      let response;
      if (editingStudent) {
        console.log('✏️ Updating student:', editingStudent.id);
        response = await studentsAPI.update(editingStudent.id, studentData);
      } else {
        console.log('➕ Creating new student');
        response = await studentsAPI.create(studentData);
      }

      console.log('📥 API Response:', response);

      if (response.success) {
        // If photo file is selected, upload it
        if (photoFile && response.data && response.data.id) {
          try {
            setUploadingPhoto(true);
            const photoFormData = new FormData();
            photoFormData.append('photo', photoFile);

            const photoResponse = await studentsAPI.uploadPhoto(response.data.id, photoFormData);

            if (photoResponse.success) {
              showToast('✅ Student and photo saved successfully!', 'success');
            } else {
              showToast('⚠️ Student saved but photo upload failed', 'warning');
            }
          } catch (photoError) {
            console.error('Photo upload error:', photoError);
            showToast('⚠️ Student saved but photo upload failed', 'warning');
          } finally {
            setUploadingPhoto(false);
          }
        } else {
          showToast('✅ Student saved successfully!', 'success');
        }
        handleCloseModal();
        fetchStudents();
      } else {
        const errorMsg = response.message || response.error || 'Operation failed';
        console.error('Save student error:', errorMsg);
        setFormError(errorMsg);
        showToast(errorMsg, 'error');
      }
    } catch (err) {
      console.error('❌ Error saving student:', err.response?.data || err);
      
      // Extract validation errors
      const responseData = err.response?.data;
      let errorMsg = 'An error occurred while saving student';
      
      if (responseData) {
        console.log('📋 Full Response data:', responseData);
        console.log('📋 Errors in response:', responseData.errors);
        
        if (responseData.errors && Array.isArray(responseData.errors) && responseData.errors.length > 0) {
          // Show all validation errors
          console.log('📝 Number of validation errors:', responseData.errors.length);
          
          // Show each error as a separate toast
          responseData.errors.forEach((e, index) => {
            console.log(`📝 Error ${index + 1}:`, e);
            console.log(`   - msg: ${e.msg}`);
            console.log(`   - param: ${e.param}`);
            console.log(`   - value: ${e.value}`);
            
            // Build readable error message
            const field = e.param || e.path || e.field || 'Field';
            const message = e.msg || e.message || e.error || 'Validation error';
            
            showToast(`❌ ${field}: ${message}`, 'error');
          });
          
          const errorMessages = responseData.errors.map(e => {
            const field = e.param || e.path || e.field || 'Unknown field';
            const message = e.msg || e.message || e.error || 'Validation error';
            return `${field}: ${message}`;
          });
          
          errorMsg = errorMessages.join('\n');
          console.log('✅ Formatted error messages:', errorMessages);
        } else if (responseData.message) {
          errorMsg = responseData.message;
          showToast(errorMsg, 'error');
          if (responseData.errors) {
            errorMsg += '\n(Check console for details)';
          }
        } else if (responseData.error) {
          errorMsg = responseData.error;
          showToast(errorMsg, 'error');
        }
      } else if (err.message) {
        errorMsg = err.message;
        showToast(errorMsg, 'error');
      }
      
      console.log('🔴 Final error message to display:', errorMsg);
      setFormError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (studentId) => {
    if (!window.confirm('⚠️ Are you sure you want to delete this student?\n\nThis action cannot be undone!')) {
      return;
    }

    try {
      console.log('🗑️ Deleting student ID:', studentId);
      const response = await studentsAPI.delete(studentId);
      console.log('📥 Delete response:', response);

      if (response.success) {
        showToast('✅ Student deleted successfully!', 'success');
        fetchStudents();
      } else {
        const errorMsg = response.message || response.error || 'Failed to delete student';
        showToast(`❌ ${errorMsg}`, 'error');
        console.error('Delete failed:', errorMsg);
      }
    } catch (err) {
      console.error('❌ Error deleting student:', err);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'An error occurred while deleting student';
      showToast(`❌ ${errorMsg}`, 'error');
    }
  };

  const handleBulkImportFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.oasis.opendocument.spreadsheet'
    ];

    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|ods)$/)) {
      showToast('❌ Only Excel files (.xlsx, .xls, .ods) are allowed', 'error');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      showToast('❌ File must be less than 10MB', 'error');
      return;
    }

    setBulkImportFile(file);
  };

  const handleBulkImport = async (e) => {
    e.preventDefault();

    if (!bulkImportFile) {
      showToast('❌ Please select an Excel file', 'error');
      return;
    }

    if (!bulkImportClass) {
      showToast('❌ Please select a class', 'error');
      return;
    }

    if (!bulkImportAcademicYear) {
      showToast('❌ Please select an academic year', 'error');
      return;
    }

    setBulkImporting(true);
    setBulkImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', bulkImportFile);
      formData.append('className', bulkImportClass);
      if (bulkImportSection) {
        formData.append('sectionName', bulkImportSection);
      }
      formData.append('academicYear', bulkImportAcademicYear);

      console.log('📤 Uploading bulk import file:', bulkImportFile.name);
      console.log('📤 Class:', bulkImportClass);
      console.log('📤 Section:', bulkImportSection || 'None');
      console.log('📤 Academic Year:', bulkImportAcademicYear);

      const response = await studentsAPI.bulkImport(formData);

      console.log('📥 Bulk import response:', response);

      if (response.success) {
        setBulkImportResult(response.data);
        showToast(`✅ Successfully imported ${response.data.summary.imported} students!`, 'success');
        fetchStudents();

        // Show warnings if some failed
        if (response.data.summary.failed > 0) {
          showToast(`⚠️ ${response.data.summary.failed} students failed to import. Check the results below.`, 'warning');
        }
      } else {
        const errorMsg = response.message || response.error || 'Bulk import failed';
        showToast(`❌ ${errorMsg}`, 'error');
      }
    } catch (err) {
      console.error('❌ Error during bulk import:', err);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'An error occurred during bulk import';
      showToast(`❌ ${errorMsg}`, 'error');
    } finally {
      setBulkImporting(false);
    }
  };

  const handleCloseBulkImportModal = () => {
    setShowBulkImportModal(false);
    setBulkImportFile(null);
    setBulkImportClass('');
    setBulkImportSection('');
    setBulkImportResult(null);
  };

  // Calculate statistics
  const totalStudents = students.length;
  const rfidAssigned = students.filter(s => s.rfid_card_id && s.rfid_card_id.trim() !== '').length;
  const rfidNotAssigned = totalStudents - rfidAssigned;
  const rfidPercentage = totalStudents > 0 ? Math.round((rfidAssigned / totalStudents) * 100) : 0;

  // Pagination calculations
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredStudents.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);

  // Pagination handlers
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Navigate to student details page
  const handleViewStudent = (student) => {
    navigate(`/students/${student.id}`);
  };

  return (
    <div className="students-container">
      <div className="students-header">
        <div>
          <h1><FiUsers className="inline-icon" />Students Management</h1>
          <p>Manage your school students and RFID assignments</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => setShowBulkImportModal(true)}>
            <FiUpload /> Bulk Import
          </button>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <FiPlus /> Add Student
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="students-stats">
        <div className="stat-card primary">
          <div className="stat-icon-wrapper">
            <FiUsers size={28} />
          </div>
          <div>
            <p className="stat-label">Total Students</p>
            <p className="stat-value">{totalStudents}</p>
          </div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon-wrapper">
            <FiCheckCircle size={28} />
          </div>
          <div>
            <p className="stat-label">RFID Assigned</p>
            <p className="stat-value">{rfidAssigned}</p>
            <p className="stat-percentage">{rfidPercentage}%</p>
          </div>
        </div>
        <div className="stat-card danger">
          <div className="stat-icon-wrapper">
            <FiXCircle size={28} />
          </div>
          <div>
            <p className="stat-label">RFID Not Assigned</p>
            <p className="stat-value">{rfidNotAssigned}</p>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon-wrapper">
            <FiCreditCard size={28} />
          </div>
          <div>
            <p className="stat-label">Filtered Results</p>
            <p className="stat-value">{filteredStudents.length}</p>
          </div>
        </div>
      </div>

      <div className="students-toolbar">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filters-row">
          <FiFilter className="filter-icon" />
          <select
            className="filter-select"
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
          >
            <option value="">All Classes</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.class_name}</option>
            ))}
          </select>

          <select
            className="filter-select"
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
          >
            <option value="">All Sections</option>
            {sections.map(section => (
              <option key={section.id} value={section.id}>
                {section.class_name} - {section.section_name}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={filterRfidStatus}
            onChange={(e) => setFilterRfidStatus(e.target.value)}
          >
            <option value="all">All RFID Status</option>
            <option value="assigned">RFID Assigned</option>
            <option value="not-assigned">RFID Not Assigned</option>
          </select>

          {(filterClass || filterSection || filterRfidStatus !== 'all') && (
            <button
              className="btn btn-sm btn-outline"
              onClick={() => {
                setFilterClass('');
                setFilterSection('');
                setFilterRfidStatus('all');
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {showModal && (
        <div className="student-form-card">
          <div className="modal-header">
            <h2>{editingStudent ? '✏️ Edit Student' : '➕ Add New Student'}</h2>
            <button className="modal-close" onClick={handleCloseModal}>&times;</button>
          </div>

            {formError && (
              <div className="alert alert-error">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Personal Information Section */}
              <div className="form-section">
                <h3 className="form-section-title">📋 Personal Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Full Name <span className="required">*</span></label>
                    <input
                      type="text"
                      className={`input ${touched.fullName && fieldErrors.fullName ? 'input-error' : ''} ${touched.fullName && !fieldErrors.fullName && formData.fullName ? 'input-success' : ''}`}
                      placeholder="Enter student's full name"
                      value={formData.fullName}
                      onChange={(e) => handleFieldChange('fullName', e.target.value)}
                      onBlur={() => handleFieldBlur('fullName')}
                      required
                    />
                    {touched.fullName && fieldErrors.fullName && (
                      <span className="field-error">{fieldErrors.fullName}</span>
                    )}
                    {touched.fullName && !fieldErrors.fullName && formData.fullName && (
                      <span className="field-success">✓ Looks good!</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Gender <span className="required">*</span></label>
                    <select
                      className={`input ${touched.gender && fieldErrors.gender ? 'input-error' : ''} ${touched.gender && !fieldErrors.gender && formData.gender ? 'input-success' : ''}`}
                      value={formData.gender}
                      onChange={(e) => handleFieldChange('gender', e.target.value)}
                      onBlur={() => handleFieldBlur('gender')}
                      required
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    {touched.gender && fieldErrors.gender && (
                      <span className="field-error">{fieldErrors.gender}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Date of Birth <span className="required">*</span></label>
                    <input
                      type="date"
                      className={`input ${touched.dob && fieldErrors.dob ? 'input-error' : ''} ${touched.dob && !fieldErrors.dob && formData.dob ? 'input-success' : ''}`}
                      value={formData.dob}
                      onChange={(e) => handleFieldChange('dob', e.target.value)}
                      onBlur={() => handleFieldBlur('dob')}
                      required
                    />
                    {touched.dob && fieldErrors.dob && (
                      <span className="field-error">{fieldErrors.dob}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Blood Group <span className="optional">(Optional)</span></label>
                    <select
                      className="input"
                      value={formData.bloodGroup}
                      onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                    >
                      <option value="">Select Blood Group</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>

                  <div className="form-group form-group-full">
                    <label>Student Address <span className="optional">(Optional)</span></label>
                    <textarea
                      className="input textarea"
                      placeholder="Enter student's residential address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows="3"
                    />
                  </div>

                  <div className="form-group form-group-full">
                    <label>
                      Student Photo <span className="optional">(Optional)</span>
                    </label>

                    {/* Photo Preview */}
                    {photoPreview && (
                      <div className="photo-preview-container">
                        <img
                          src={photoPreview}
                          alt="Student preview"
                          className="photo-preview"
                        />
                        <button
                          type="button"
                          className="btn-remove-photo"
                          onClick={clearPhoto}
                          title="Remove photo"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {/* Photo Upload Input */}
                    {!photoPreview && (
                      <div className="photo-upload-options">
                        <div className="photo-upload-area">
                          <input
                            type="file"
                            id="photoUpload"
                            accept="image/jpeg,image/jpg,image/png"
                            onChange={handlePhotoChange}
                            style={{ display: 'none' }}
                          />
                          <label htmlFor="photoUpload" className="photo-upload-label">
                            <div className="upload-icon">📁</div>
                            <div className="upload-text">
                              <strong>Upload from device</strong>
                              <small>JPG, JPEG, or PNG (Max 2MB)</small>
                            </div>
                          </label>
                        </div>

                        <div className="upload-divider">
                          <span>OR</span>
                        </div>

                        <button
                          type="button"
                          className="btn-webcam"
                          onClick={startWebcam}
                        >
                          <div className="upload-icon">📷</div>
                          <div className="upload-text">
                            <strong>Take photo with webcam</strong>
                            <small>Capture photo instantly</small>
                          </div>
                        </button>
                      </div>
                    )}

                    <small className="input-hint">
                      Optional. Upload a clear and recent photo for student identification.
                    </small>
                  </div>
                </div>
              </div>

              {/* Webcam Modal */}
              {showWebcam && (
                <div className="webcam-overlay" onClick={stopWebcam}>
                  <div className="webcam-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="webcam-header">
                      <h3>📷 Capture Student Photo</h3>
                      <button className="webcam-close" onClick={stopWebcam}>×</button>
                    </div>
                    <div className="webcam-body">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="webcam-video"
                      />
                      <div className="webcam-guide">
                        <div className="guide-circle"></div>
                        <div className="webcam-guide-text">Position face in the circle</div>
                      </div>
                    </div>
                    <div className="webcam-footer">
                      <button type="button" className="btn btn-secondary" onClick={stopWebcam}>
                        Cancel
                      </button>
                      <button type="button" className="btn btn-primary btn-capture" onClick={capturePhoto}>
                        📸 Capture Photo
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Academic Information Section */}
              <div className="form-section">
                <h3 className="form-section-title">🎓 Academic Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>RFID Card ID <span className="required">*</span></label>
                    <input
                      type="text"
                      className={`input ${touched.rfidUid && fieldErrors.rfidUid ? 'input-error' : ''} ${touched.rfidUid && !fieldErrors.rfidUid && formData.rfidUid ? 'input-success' : ''}`}
                      placeholder="Enter RFID card number"
                      value={formData.rfidUid}
                      onChange={(e) => handleFieldChange('rfidUid', e.target.value)}
                      onBlur={() => handleFieldBlur('rfidUid')}
                      required
                    />
                    {touched.rfidUid && fieldErrors.rfidUid && (
                      <span className="field-error">{fieldErrors.rfidUid}</span>
                    )}
                    {touched.rfidUid && !fieldErrors.rfidUid && formData.rfidUid && (
                      <span className="field-success">✓ Valid</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Roll Number <span className="optional">(Optional)</span></label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Enter roll number"
                      value={formData.rollNumber}
                      onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                    />
                  </div>

                  <div className="form-group form-group-full">
                    <label>Class & Section <span className="required">*</span></label>
                    <select
                      className={`input ${touched.sectionId && fieldErrors.sectionId ? 'input-error' : ''} ${touched.sectionId && !fieldErrors.sectionId && formData.sectionId ? 'input-success' : ''}`}
                      value={formData.sectionId}
                      onChange={(e) => {
                        const selectedSection = sections.find(s => s.id === parseInt(e.target.value));
                        handleFieldChange('sectionId', e.target.value);
                        setFormData({
                          ...formData,
                          sectionId: e.target.value,
                          classId: selectedSection ? selectedSection.class_id : ''
                        });
                      }}
                      onBlur={() => handleFieldBlur('sectionId')}
                      required
                    >
                      <option value="">Select Class & Section</option>
                      {sections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.class_name} - {section.section_name}
                        </option>
                      ))}
                    </select>
                    {touched.sectionId && fieldErrors.sectionId && (
                      <span className="field-error">{fieldErrors.sectionId}</span>
                    )}
                    {touched.sectionId && !fieldErrors.sectionId && formData.sectionId && (
                      <span className="field-success">✓ Valid</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Guardian/Parent Information Section */}
              <div className="form-section">
                <h3 className="form-section-title">👨‍👩‍👦 Guardian & Parent Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Father/Guardian Name <span className="optional">(Optional)</span></label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Enter father/guardian name"
                      value={formData.guardianName}
                      onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Guardian Phone <span className="optional">(Optional)</span></label>
                    <input
                      type="tel"
                      className={`input ${touched.guardianPhone && fieldErrors.guardianPhone ? 'input-error' : ''} ${touched.guardianPhone && !fieldErrors.guardianPhone && formData.guardianPhone ? 'input-success' : ''}`}
                      placeholder="Enter phone number"
                      value={formData.guardianPhone}
                      onChange={(e) => handleFieldChange('guardianPhone', e.target.value)}
                      onBlur={() => handleFieldBlur('guardianPhone')}
                    />
                    {touched.guardianPhone && fieldErrors.guardianPhone && (
                      <span className="field-error">{fieldErrors.guardianPhone}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Mother Name <span className="optional">(Optional)</span></label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Enter mother's name"
                      value={formData.motherName}
                      onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Mother Phone <span className="optional">(Optional)</span></label>
                    <input
                      type="tel"
                      className={`input ${touched.motherPhone && fieldErrors.motherPhone ? 'input-error' : ''} ${touched.motherPhone && !fieldErrors.motherPhone && formData.motherPhone ? 'input-success' : ''}`}
                      placeholder="Enter phone number"
                      value={formData.motherPhone}
                      onChange={(e) => handleFieldChange('motherPhone', e.target.value)}
                      onBlur={() => handleFieldBlur('motherPhone')}
                    />
                    {touched.motherPhone && fieldErrors.motherPhone && (
                      <span className="field-error">{fieldErrors.motherPhone}</span>
                    )}
                  </div>

                  <div className="form-group form-group-full">
                    <label>Guardian Email <span className="optional">(Optional)</span></label>
                    <input
                      type="email"
                      className={`input ${touched.guardianEmail && fieldErrors.guardianEmail ? 'input-error' : ''} ${touched.guardianEmail && !fieldErrors.guardianEmail && formData.guardianEmail ? 'input-success' : ''}`}
                      placeholder="Enter email address"
                      value={formData.guardianEmail}
                      onChange={(e) => handleFieldChange('guardianEmail', e.target.value)}
                      onBlur={() => handleFieldBlur('guardianEmail')}
                    />
                    {touched.guardianEmail && fieldErrors.guardianEmail && (
                      <span className="field-error">{fieldErrors.guardianEmail}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || uploadingPhoto || !isFormValid()}
                >
                  {uploadingPhoto ? 'Uploading Photo...' : submitting ? 'Saving...' : editingStudent ? 'Update Student' : 'Add Student'}
                </button>
              </div>
            </form>
        </div>
      )}

      {loading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading students...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="empty-state">
          <FiUsers size={48} />
          <p>{students.length === 0 ? 'No students found' : 'No students match your filters'}</p>
          {students.length === 0 ? (
            <button className="btn btn-primary" onClick={() => handleOpenModal()}>
              <FiPlus /> Add First Student
            </button>
          ) : (
            <button className="btn btn-outline" onClick={() => {
              setFilterClass('');
              setFilterSection('');
              setFilterRfidStatus('all');
            }}>
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="table-container">
          <table className="students-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>RFID Status</th>
                <th>RFID UID</th>
                <th>Class</th>
                <th>Section</th>
                <th>Roll Number</th>
                <th>Guardian</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((student) => (
                <tr key={student.id}>
                  <td>
                    <div className="student-name">{student.full_name}</div>
                  </td>
                  <td>
                    {student.rfid_card_id && student.rfid_card_id.trim() !== '' ? (
                      <span className="badge badge-success">
                        <FiCheckCircle /> Assigned
                      </span>
                    ) : (
                      <span className="badge badge-danger">
                        <FiXCircle /> Not Assigned
                      </span>
                    )}
                  </td>
                  <td>
                    {student.rfid_card_id && student.rfid_card_id.trim() !== '' ? (
                      <span className="badge badge-blue">{student.rfid_card_id}</span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td>{student.class_name || '-'}</td>
                  <td>{student.section_name || '-'}</td>
                  <td>{student.roll_number || '-'}</td>
                  <td>
                    <div className="guardian-info">
                      <div>{student.guardian_name || '-'}</div>
                      {student.guardian_phone && (
                        <small>{student.guardian_phone}</small>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon btn-view"
                        onClick={() => handleViewStudent(student)}
                        title="View Details"
                      >
                        <FiEye />
                      </button>
                      <button
                        className="btn-icon btn-edit"
                        onClick={() => handleOpenModal(student)}
                        title="Edit"
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(student.id)}
                        title="Delete"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && filteredStudents.length > 0 && (
        <div className="pagination-container">
          <div className="pagination-info">
            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredStudents.length)} of {filteredStudents.length} students
          </div>
          <div className="pagination">
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            
            {[...Array(totalPages)].map((_, index) => {
              const pageNumber = index + 1;
              // Show first, last, current, and adjacent pages
              if (
                pageNumber === 1 ||
                pageNumber === totalPages ||
                (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
              ) {
                return (
                  <button
                    key={pageNumber}
                    className={`pagination-btn ${currentPage === pageNumber ? 'active' : ''}`}
                    onClick={() => handlePageChange(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                );
              } else if (
                pageNumber === currentPage - 2 ||
                pageNumber === currentPage + 2
              ) {
                return <span key={pageNumber} className="pagination-dots">...</span>;
              }
              return null;
            })}
            
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Floating Add Button */}
      <button className="floating-add-btn" onClick={() => handleOpenModal()} title="Add Student">
        <FiPlus size={24} />
      </button>

      {/* View Student Modal */}
      {showViewModal && viewingStudent && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal-content view-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>👤 Student Details</h2>
              <button className="modal-close" onClick={() => setShowViewModal(false)}>&times;</button>
            </div>
            <div className="view-student-content">
              {/* Photo */}
              {viewingStudent.photo_url && (
                <div className="student-photo-large">
                  <img
                    src={`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}${viewingStudent.photo_url}`}
                    alt={viewingStudent.full_name}
                  />
                </div>
              )}

              {/* Personal Info */}
              <div className="info-section">
                <h3>📋 Personal Information</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Full Name</label>
                    <p>{viewingStudent.full_name}</p>
                  </div>
                  <div className="info-item">
                    <label>Gender</label>
                    <p>{viewingStudent.gender || '-'}</p>
                  </div>
                  <div className="info-item">
                    <label>Date of Birth</label>
                    <p>{viewingStudent.dob || '-'}</p>
                  </div>
                  <div className="info-item">
                    <label>Blood Group</label>
                    <p>{viewingStudent.blood_group || '-'}</p>
                  </div>
                  <div className="info-item full-width">
                    <label>Address</label>
                    <p>{viewingStudent.address || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Academic Info */}
              <div className="info-section">
                <h3>🎓 Academic Information</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>RFID Card ID</label>
                    <p className="badge badge-blue">{viewingStudent.rfid_card_id || '-'}</p>
                  </div>
                  <div className="info-item">
                    <label>Roll Number</label>
                    <p>{viewingStudent.roll_number || '-'}</p>
                  </div>
                  <div className="info-item">
                    <label>Class</label>
                    <p>{viewingStudent.class_name || '-'}</p>
                  </div>
                  <div className="info-item">
                    <label>Section</label>
                    <p>{viewingStudent.section_name || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Guardian Info */}
              <div className="info-section">
                <h3>👨‍👩‍👦 Guardian Information</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Guardian Name</label>
                    <p>{viewingStudent.guardian_name || '-'}</p>
                  </div>
                  <div className="info-item">
                    <label>Guardian Phone</label>
                    <p>{viewingStudent.guardian_phone || '-'}</p>
                  </div>
                  <div className="info-item">
                    <label>Guardian Email</label>
                    <p>{viewingStudent.guardian_email || '-'}</p>
                  </div>
                  <div className="info-item">
                    <label>Mother Name</label>
                    <p>{viewingStudent.mother_name || '-'}</p>
                  </div>
                  <div className="info-item">
                    <label>Mother Phone</label>
                    <p>{viewingStudent.mother_phone || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <div className="modal-overlay" onClick={handleCloseBulkImportModal}>
          <div className="modal-content bulk-import-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FiUpload /> Bulk Import Students</h2>
              <button className="modal-close" onClick={handleCloseBulkImportModal}>&times;</button>
            </div>

            <div className="modal-body">
              {!bulkImportResult ? (
                <form onSubmit={handleBulkImport}>
                  <div className="info-box">
                    <FiAlertCircle />
                    <div>
                      <strong>Instructions:</strong>
                      <ul>
                        <li>Upload an Excel file (.xlsx, .xls, .ods) with student data</li>
                        <li>Required columns: Student Name, Gender</li>
                        <li>Optional columns: Roll Number, DOB, Father's Name, Mother's Name, Guardian Name, Phone Number, WhatsApp Number, Address, Blood Group</li>
                        <li>Maximum file size: 10MB</li>
                      </ul>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Academic Year <span className="required">*</span></label>
                    <select
                      className="input"
                      value={bulkImportAcademicYear}
                      onChange={(e) => setBulkImportAcademicYear(e.target.value)}
                      required
                    >
                      <option value="">Select Academic Year</option>
                      {academicYears.map(year => (
                        <option key={year.id} value={year.year_name}>
                          {year.year_name} {year.is_current ? '(Current)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Class <span className="required">*</span></label>
                    <select
                      className="input"
                      value={bulkImportClass}
                      onChange={(e) => setBulkImportClass(e.target.value)}
                      required
                    >
                      <option value="">Select Class</option>
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.class_name}>
                          {cls.class_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Section <span className="optional">(Optional)</span></label>
                    <select
                      className="input"
                      value={bulkImportSection}
                      onChange={(e) => setBulkImportSection(e.target.value)}
                    >
                      <option value="">Select Section (Optional)</option>
                      {sections
                        .filter(s => !bulkImportClass || s.class_name === bulkImportClass)
                        .map(section => (
                          <option key={section.id} value={section.section_name}>
                            {section.section_name}
                          </option>
                        ))
                      }
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Excel File <span className="required">*</span></label>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.ods,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={handleBulkImportFileChange}
                      className="input"
                      required
                    />
                    {bulkImportFile && (
                      <div className="file-info">
                        <FiCheckCircle color="green" />
                        <span>{bulkImportFile.name} ({(bulkImportFile.size / 1024).toFixed(2)} KB)</span>
                      </div>
                    )}
                  </div>

                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCloseBulkImportModal}
                      disabled={bulkImporting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={bulkImporting}
                    >
                      {bulkImporting ? 'Importing...' : 'Import Students'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="import-results">
                  <div className="results-summary">
                    <h3>Import Results</h3>
                    <div className="summary-stats">
                      <div className="stat-item success">
                        <FiCheckCircle size={24} />
                        <div>
                          <strong>{bulkImportResult.summary.imported}</strong>
                          <span>Imported Successfully</span>
                        </div>
                      </div>
                      <div className="stat-item danger">
                        <FiXCircle size={24} />
                        <div>
                          <strong>{bulkImportResult.summary.failed}</strong>
                          <span>Failed</span>
                        </div>
                      </div>
                      <div className="stat-item warning">
                        <FiAlertCircle size={24} />
                        <div>
                          <strong>{bulkImportResult.summary.validationErrors}</strong>
                          <span>Validation Errors</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {bulkImportResult.failed && bulkImportResult.failed.length > 0 && (
                    <div className="failed-students">
                      <h4>Failed Students ({bulkImportResult.failed.length})</h4>
                      <div className="failed-list">
                        {bulkImportResult.failed.slice(0, 10).map((student, index) => (
                          <div key={index} className="failed-item">
                            <div>
                              <strong>{student.fullName || 'Unknown'}</strong>
                              {student._rowNumber && <span className="row-number">Row {student._rowNumber}</span>}
                            </div>
                            <div className="error-messages">
                              {student.errors && student.errors.map((err, i) => (
                                <span key={i} className="error-badge">{err}</span>
                              ))}
                              {student.error && <span className="error-badge">{student.error}</span>}
                            </div>
                          </div>
                        ))}
                        {bulkImportResult.failed.length > 10 && (
                          <p className="more-errors">... and {bulkImportResult.failed.length - 10} more</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleCloseBulkImportModal}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <FiAlertCircle className="toast-icon" />
            <span className="toast-message">{toast.message}</span>
            <button
              className="toast-close"
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Students;
