import React, { useState, useEffect } from 'react';
import {
  FiCalendar,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiDownload,
  FiUpload,
  FiX
} from 'react-icons/fi';
import { holidaysAPI, academicYearAPI } from '../utils/api';
import './Calendar.css';

const Calendar = () => {
  const [holidays, setHolidays] = useState([]);
  const [academicYear, setAcademicYear] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [formData, setFormData] = useState({
    holidayName: '',
    holidayDate: '',
    holidayType: 'national',
    description: ''
  });

  const holidayTypes = [
    { value: 'national', label: 'National Holiday', color: 'primary' },
    { value: 'festival', label: 'Festival', color: 'success' },
    { value: 'school_event', label: 'School Event', color: 'warning' },
    { value: 'vacation', label: 'Vacation', color: 'danger' }
  ];

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch holidays for selected year
      const holidaysResponse = await holidaysAPI.getAll({ year: selectedYear });
      if (holidaysResponse.success) {
        setHolidays(holidaysResponse.data || []);
      }

      // Fetch current academic year
      const academicYearResponse = await academicYearAPI.getCurrent();
      if (academicYearResponse.success) {
        setAcademicYear(academicYearResponse.data);
      }
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingHoliday) {
        await holidaysAPI.update(editingHoliday.id, formData);
      } else {
        await holidaysAPI.create(formData);
      }

      fetchData();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving holiday:', error);
      alert('Failed to save holiday');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) {
      return;
    }

    try {
      await holidaysAPI.delete(id);
      fetchData();
    } catch (error) {
      console.error('Error deleting holiday:', error);
      alert('Failed to delete holiday');
    }
  };

  const handleEdit = (holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      holidayName: holiday.holiday_name,
      holidayDate: holiday.holiday_date,
      holidayType: holiday.holiday_type,
      description: holiday.description || ''
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingHoliday(null);
    setFormData({
      holidayName: '',
      holidayDate: '',
      holidayType: 'national',
      description: ''
    });
  };

  const importIndianHolidays = async () => {
    const indianHolidays = [
      { holiday_name: 'Republic Day', holiday_date: `${selectedYear}-01-26`, holiday_type: 'national' },
      { holiday_name: 'Holi', holiday_date: `${selectedYear}-03-25`, holiday_type: 'festival' },
      { holiday_name: 'Good Friday', holiday_date: `${selectedYear}-03-29`, holiday_type: 'festival' },
      { holiday_name: 'Eid ul-Fitr', holiday_date: `${selectedYear}-04-11`, holiday_type: 'festival' },
      { holiday_name: 'Independence Day', holiday_date: `${selectedYear}-08-15`, holiday_type: 'national' },
      { holiday_name: 'Janmashtami', holiday_date: `${selectedYear}-08-26`, holiday_type: 'festival' },
      { holiday_name: 'Gandhi Jayanti', holiday_date: `${selectedYear}-10-02`, holiday_type: 'national' },
      { holiday_name: 'Dussehra', holiday_date: `${selectedYear}-10-12`, holiday_type: 'festival' },
      { holiday_name: 'Diwali', holiday_date: `${selectedYear}-10-31`, holiday_type: 'festival' },
      { holiday_name: 'Christmas', holiday_date: `${selectedYear}-12-25`, holiday_type: 'festival' }
    ];

    try {
      await holidaysAPI.bulkImport(indianHolidays);
      fetchData();
      alert('Indian holidays imported successfully!');
    } catch (error) {
      console.error('Error importing holidays:', error);
      alert('Failed to import holidays');
    }
  };

  const getHolidaysByMonth = () => {
    const months = {};
    holidays.forEach(holiday => {
      const date = new Date(holiday.holiday_date);
      const monthKey = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

      if (!months[monthKey]) {
        months[monthKey] = [];
      }
      months[monthKey].push(holiday);
    });

    return months;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getTypeColor = (type) => {
    const typeObj = holidayTypes.find(t => t.value === type);
    return typeObj ? typeObj.color : 'gray';
  };

  const holidaysByMonth = getHolidaysByMonth();

  return (
    <div className="calendar-container">
      {/* Header */}
      <div className="calendar-header">
        <div>
          <h1 className="page-title">
            <FiCalendar className="inline-icon" />
            Academic Calendar & Holidays
          </h1>
          <p className="page-subtitle">Manage school holidays and academic calendar</p>
        </div>
        <div className="header-actions">
          <select
            className="input year-selector"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {[2024, 2025, 2026, 2027].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button className="btn btn-outline" onClick={importIndianHolidays}>
            <FiDownload />
            Import Indian Holidays
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <FiPlus />
            Add Holiday
          </button>
        </div>
      </div>

      {/* Academic Year Info */}
      {academicYear && (
        <div className="academic-year-card card">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold mb-sm">Current Academic Year</h3>
              <p className="text-gray-600">{academicYear.year_name}</p>
            </div>
            <div className="flex gap-lg">
              <div>
                <p className="text-sm text-gray-600">Start Date</p>
                <p className="font-semibold">{formatDate(academicYear.start_date)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">End Date</p>
                <p className="font-semibold">{formatDate(academicYear.end_date)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Working Days</p>
                <p className="font-semibold">{academicYear.working_days}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Weekly Holiday</p>
                <p className="font-semibold">{academicYear.weekly_holiday}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Holidays Summary */}
      <div className="holidays-summary grid grid-cols-4 mb-lg">
        {holidayTypes.map(type => {
          const count = holidays.filter(h => h.holiday_type === type.value).length;
          return (
            <div key={type.value} className={`stat-card ${type.color}`}>
              <p className="stat-label">{type.label}s</p>
              <p className="stat-value">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Holidays List by Month */}
      {loading ? (
        <div className="text-center">Loading holidays...</div>
      ) : (
        <div className="holidays-months">
          {Object.keys(holidaysByMonth).length > 0 ? (
            Object.entries(holidaysByMonth).map(([month, monthHolidays]) => (
              <div key={month} className="month-section card mb-lg">
                <h3 className="month-title">{month}</h3>
                <div className="holidays-list">
                  {monthHolidays
                    .sort((a, b) => new Date(a.holiday_date) - new Date(b.holiday_date))
                    .map(holiday => (
                      <div key={holiday.id} className="holiday-item">
                        <div className="holiday-date-badge">
                          <span className="day">
                            {new Date(holiday.holiday_date).getDate()}
                          </span>
                          <span className="month">
                            {new Date(holiday.holiday_date).toLocaleDateString('en-IN', { month: 'short' })}
                          </span>
                        </div>
                        <div className="holiday-details">
                          <h4 className="holiday-name">{holiday.holiday_name}</h4>
                          <p className="holiday-date-full">{formatDate(holiday.holiday_date)}</p>
                          {holiday.description && (
                            <p className="holiday-description">{holiday.description}</p>
                          )}
                        </div>
                        <div className="holiday-actions">
                          <span className={`badge badge-${getTypeColor(holiday.holiday_type)}`}>
                            {holiday.holiday_type.replace('_', ' ')}
                          </span>
                          <button
                            className="btn-icon"
                            onClick={() => handleEdit(holiday)}
                            title="Edit"
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            className="btn-icon btn-icon-danger"
                            onClick={() => handleDelete(holiday.id)}
                            title="Delete"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state card">
              <FiCalendar size={48} />
              <h3>No holidays added yet</h3>
              <p>Add holidays to see them here</p>
              <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                <FiPlus />
                Add First Holiday
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Holiday Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}</h2>
              <button className="btn-icon" onClick={handleCloseModal}>
                <FiX />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label>Holiday Name *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.holidayName}
                  onChange={(e) => setFormData({ ...formData, holidayName: e.target.value })}
                  required
                  placeholder="e.g., Independence Day"
                />
              </div>

              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  className="input"
                  value={formData.holidayDate}
                  onChange={(e) => setFormData({ ...formData, holidayDate: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Holiday Type *</label>
                <select
                  className="input"
                  value={formData.holidayType}
                  onChange={(e) => setFormData({ ...formData, holidayType: e.target.value })}
                  required
                >
                  {holidayTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  className="input"
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add any additional details..."
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingHoliday ? 'Update Holiday' : 'Add Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
