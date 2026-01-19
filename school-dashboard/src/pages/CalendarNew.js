import React, { useState, useEffect } from 'react';
import {
  FiCalendar,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiDownload,
  FiChevronLeft,
  FiChevronRight,
  FiGrid,
  FiList,
  FiStar,
  FiClock
} from 'react-icons/fi';
import { holidaysAPI } from '../utils/api';
import './CalendarNew.css';

const CalendarNew = () => {
  const [holidays, setHolidays] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [formData, setFormData] = useState({
    holidayName: '',
    holidayDate: '',
    endDate: '', // For date range
    holidayType: 'national',
    description: '',
    isRecurring: false,
    isDateRange: false // Toggle for single day vs date range
  });

  const holidayTypes = [
    { value: 'national', label: 'National Holiday', color: '#6366f1', icon: '🇮🇳' },
    { value: 'festival', label: 'Festival', color: '#ec4899', icon: '🎉' },
    { value: 'school_event', label: 'School Event', color: '#f59e0b', icon: '🏫' },
    { value: 'vacation', label: 'Vacation', color: '#10b981', icon: '🌴' }
  ];

  useEffect(() => {
    fetchHolidays();
  }, [currentDate]);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const response = await holidaysAPI.getAll({ year: currentDate.getFullYear() });
      if (response.success) {
        setHolidays(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching holidays:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calendar grid generation
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getHolidaysForDate = (date) => {
    // ✅ FIX: Use local date format (en-CA gives YYYY-MM-DD) instead of toISOString()
    // toISOString() converts to UTC which causes timezone shift issues in IST
    const dateStr = date.toLocaleDateString('en-CA'); // Returns 'YYYY-MM-DD' in local time
    const monthDay = dateStr.slice(5); // 'MM-DD' for recurring match

    return holidays.filter(h => {
      if (h.is_recurring) {
        // For recurring holidays, match only month and day
        return h.holiday_date.slice(5) === monthDay;
      }
      // For non-recurring, exact date match
      return h.holiday_date === dateStr;
    });
  };

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    // ✅ FIX: Use local date format for form data
    setFormData({ ...formData, holidayDate: date.toLocaleDateString('en-CA') });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingHoliday) {
        await holidaysAPI.update(editingHoliday.id, formData);
      } else if (formData.isDateRange && formData.endDate) {
        // Bulk create for date range
        const startDate = new Date(formData.holidayDate);
        const endDate = new Date(formData.endDate);
        const holidays = [];

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          // ✅ FIX: Use local date to avoid timezone shifts
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;

          holidays.push({
            holidayName: formData.holidayName,
            holidayDate: dateStr,
            holidayType: formData.holidayType,
            description: formData.description,
            isRecurring: formData.isRecurring
          });
        }

        // Use bulk import API
        await holidaysAPI.bulkImport(holidays);
      } else {
        await holidaysAPI.create(formData);
      }
      fetchHolidays();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving holiday:', error);
      alert('Failed to save holiday');
    }
  };

  const handleCleanupDuplicates = async () => {
    if (!window.confirm('🧹 This will find and remove duplicate holidays (same name & date). Are you sure?')) return;

    setLoading(true);
    let deletedCount = 0;

    try {
      const seen = new Set();
      const duplicates = [];

      // Identify duplicates
      holidays.forEach(h => {
        const key = `${h.holiday_date}-${h.holiday_name}`;
        if (seen.has(key)) {
          duplicates.push(h.id);
        } else {
          seen.add(key);
        }
      });

      if (duplicates.length === 0) {
        alert('✨ No duplicates found!');
        setLoading(false);
        return;
      }

      // Delete duplicates
      // Note: We execute sequentially to avoid overwhelming the server
      for (const id of duplicates) {
        await holidaysAPI.delete(id);
        deletedCount++;
      }

      alert(`✅ Cleaned up ${deletedCount} duplicate holidays!`);
      fetchHolidays();

    } catch (error) {
      console.error('Error cleaning duplicates:', error);
      alert('Error cleaning duplicates. Check console.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('⚠️ Delete this holiday?')) return;
    try {
      await holidaysAPI.delete(id);
      fetchHolidays();
    } catch (error) {
      console.error('Error deleting holiday:', error);
    }
  };

  const handleEdit = (holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      holidayName: holiday.holiday_name,
      holidayDate: holiday.holiday_date,
      holidayType: holiday.holiday_type,
      description: holiday.description || '',
      isRecurring: holiday.is_recurring || false
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingHoliday(null);
    setSelectedDate(null);
    setFormData({
      holidayName: '',
      holidayDate: '',
      endDate: '',
      holidayType: 'national',
      description: '',
      isRecurring: false,
      isDateRange: false
    });
  };

  const getUpcomingHolidays = () => {
    const today = new Date();
    return holidays
      .filter(h => new Date(h.holiday_date) >= today)
      .sort((a, b) => new Date(a.holiday_date) - new Date(b.holiday_date))
      .slice(0, 5);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getTypeInfo = (type) => holidayTypes.find(t => t.value === type) || holidayTypes[0];

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const upcomingHolidays = getUpcomingHolidays();

  // Stats
  const stats = holidayTypes.map(type => ({
    ...type,
    count: holidays.filter(h => h.holiday_type === type.value).length
  }));

  return (
    <div className="calendar-new-container">
      {/* Header */}
      <div className="calendar-new-header">
        <div>
          <h1>📅 Academic Calendar</h1>
          <p>Manage school holidays and events</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={handleCleanupDuplicates} title="Remove duplicate holidays" style={{ marginRight: '8px' }}>
            🧹 Cleanup Duplicates
          </button>
          <button className="btn-view" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
            {viewMode === 'grid' ? <FiList /> : <FiGrid />}
            {viewMode === 'grid' ? 'List View' : 'Calendar View'}
          </button>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <FiPlus /> Add Holiday
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        {stats.map(stat => (
          <div key={stat.value} className="stat-card" style={{ borderLeftColor: stat.color }}>
            <div className="stat-icon" style={{ backgroundColor: `${stat.color}20` }}>
              <span style={{ fontSize: '1.5rem' }}>{stat.icon}</span>
            </div>
            <div className="stat-content">
              <p className="stat-label">{stat.label}</p>
              <p className="stat-value">{stat.count}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="calendar-main-layout">
        {/* Calendar Grid View */}
        {viewMode === 'grid' ? (
          <div className="calendar-grid-section">
            {/* Calendar Controls */}
            <div className="calendar-controls">
              <button className="btn-icon" onClick={handlePrevMonth}>
                <FiChevronLeft />
              </button>
              <h2 className="current-month">{monthName}</h2>
              <button className="btn-icon" onClick={handleNextMonth}>
                <FiChevronRight />
              </button>
              <button className="btn-today" onClick={handleToday}>Today</button>
            </div>

            {/* Calendar Grid */}
            <div className="calendar-grid">
              {/* Day headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="day-header">{day}</div>
              ))}

              {/* Empty cells for days before month starts */}
              {[...Array(startingDayOfWeek)].map((_, i) => (
                <div key={`empty-${i}`} className="calendar-day empty"></div>
              ))}

              {/* Calendar days */}
              {[...Array(daysInMonth)].map((_, i) => {
                const day = i + 1;
                const date = new Date(year, month, day);
                const dayHolidays = getHolidaysForDate(date);
                const isTodayDate = isToday(date);

                return (
                  <div
                    key={day}
                    className={`calendar-day ${isTodayDate ? 'today' : ''} ${dayHolidays.length > 0 ? 'has-holiday' : ''}`}
                    onClick={() => handleDateClick(date)}
                  >
                    <div className="day-number">{day}</div>
                    {dayHolidays.length > 0 && (
                      <div className="day-holidays">
                        {dayHolidays.slice(0, 2).map(holiday => {
                          const typeInfo = getTypeInfo(holiday.holiday_type);
                          return (
                            <div
                              key={holiday.id}
                              className="holiday-chip"
                              style={{
                                backgroundColor: `${typeInfo.color}15`,
                                color: typeInfo.color
                              }}
                              title={holiday.holiday_name}
                            >
                              <span className="holiday-chip-dot" style={{ backgroundColor: typeInfo.color }}></span>
                              <span className="holiday-chip-text">{holiday.holiday_name}</span>
                            </div>
                          );
                        })}
                        {dayHolidays.length > 2 && (
                          <span className="more-events">+{dayHolidays.length - 2} more</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* List View */
          <div className="calendar-list-section">
            {holidays.length > 0 ? (
              holidays
                .sort((a, b) => new Date(a.holiday_date) - new Date(b.holiday_date))
                .map(holiday => {
                  const typeInfo = getTypeInfo(holiday.holiday_type);
                  return (
                    <div key={holiday.id} className="holiday-card" style={{ borderLeftColor: typeInfo.color }}>
                      <div className="holiday-icon" style={{ backgroundColor: `${typeInfo.color}20` }}>
                        <span style={{ fontSize: '1.5rem' }}>{typeInfo.icon}</span>
                      </div>
                      <div className="holiday-info">
                        <h3>{holiday.holiday_name}</h3>
                        <p className="holiday-date">📅 {formatDate(holiday.holiday_date)}</p>
                        {holiday.description && <p className="holiday-desc">{holiday.description}</p>}
                        <span className="holiday-type-badge" style={{ backgroundColor: `${typeInfo.color}20`, color: typeInfo.color }}>
                          {typeInfo.label}
                        </span>
                      </div>
                      <div className="holiday-actions">
                        <button className="btn-icon-sm" onClick={() => handleEdit(holiday)} title="Edit">
                          <FiEdit2 />
                        </button>
                        <button className="btn-icon-sm btn-danger" onClick={() => handleDelete(holiday.id)} title="Delete">
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="empty-state">
                <FiCalendar size={48} />
                <h3>No holidays yet</h3>
                <p>Add holidays to see them here</p>
              </div>
            )}
          </div>
        )}

        {/* Sidebar - Upcoming Holidays */}
        <div className="calendar-sidebar">
          <div className="sidebar-section">
            <h3><FiStar /> Upcoming Holidays</h3>
            {upcomingHolidays.length > 0 ? (
              <div className="upcoming-list">
                {upcomingHolidays.map(holiday => {
                  const typeInfo = getTypeInfo(holiday.holiday_type);
                  return (
                    <div key={holiday.id} className="upcoming-item">
                      <div className="upcoming-date">
                        <span className="upcoming-day">{new Date(holiday.holiday_date).getDate()}</span>
                        <span className="upcoming-month">{new Date(holiday.holiday_date).toLocaleDateString('en-IN', { month: 'short' })}</span>
                      </div>
                      <div className="upcoming-info">
                        <p className="upcoming-name">{holiday.holiday_name}</p>
                        <span className="upcoming-type" style={{ color: typeInfo.color }}>
                          {typeInfo.icon} {typeInfo.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted">No upcoming holidays</p>
            )}
          </div>

          <div className="sidebar-section">
            <h3><FiClock /> Quick Actions</h3>
            <button className="sidebar-btn" onClick={handleToday}>
              <FiCalendar /> Go to Today
            </button>
            <button className="sidebar-btn" onClick={() => setShowModal(true)}>
              <FiPlus /> Add Holiday
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content-new" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-new">
              <h2>{editingHoliday ? '✏️ Edit Holiday' : '➕ Add Holiday'}</h2>
              <button className="modal-close-new" onClick={handleCloseModal}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Holiday Name *</label>
                <input
                  type="text"
                  className="input-new"
                  value={formData.holidayName}
                  onChange={(e) => setFormData({ ...formData, holidayName: e.target.value })}
                  required
                  placeholder="e.g., Independence Day"
                />
              </div>

              {/* Date Range Toggle - only for new holidays */}
              {!editingHoliday && (
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input
                    type="checkbox"
                    id="isDateRange"
                    checked={formData.isDateRange}
                    onChange={(e) => setFormData({ ...formData, isDateRange: e.target.checked, endDate: '' })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="isDateRange" style={{ cursor: 'pointer', fontWeight: '500' }}>
                    📅 Date Range (for vacations like Winter/Summer Break)
                  </label>
                </div>
              )}

              <div className="form-group">
                <label>{formData.isDateRange ? 'Start Date *' : 'Date *'}</label>
                <input
                  type="date"
                  className="input-new"
                  value={formData.holidayDate}
                  onChange={(e) => setFormData({ ...formData, holidayDate: e.target.value })}
                  required
                />
              </div>

              {/* End Date - only shown when Date Range is enabled */}
              {formData.isDateRange && (
                <div className="form-group">
                  <label>End Date *</label>
                  <input
                    type="date"
                    className="input-new"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                    min={formData.holidayDate}
                  />
                </div>
              )}

              <div className="form-group">
                <label>Holiday Type *</label>
                <div className="type-selector">
                  {holidayTypes.map(type => (
                    <label
                      key={type.value}
                      className={`type-option ${formData.holidayType === type.value ? 'selected' : ''}`}
                      style={{
                        borderColor: formData.holidayType === type.value ? type.color : '#e2e8f0',
                        backgroundColor: formData.holidayType === type.value ? `${type.color}10` : 'white'
                      }}
                    >
                      <input
                        type="radio"
                        name="holidayType"
                        value={type.value}
                        checked={formData.holidayType === type.value}
                        onChange={(e) => setFormData({ ...formData, holidayType: e.target.value })}
                      />
                      <span className="type-icon">{type.icon}</span>
                      <span className="type-label">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  className="input-new"
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add any details..."
                />
              </div>

              {/* Recurring Checkbox */}
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="isRecurring"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="isRecurring" style={{ cursor: 'pointer', fontWeight: '500' }}>
                  🔄 Repeat Yearly (e.g., Republic Day, Independence Day)
                </label>
              </div>

              <div className="modal-footer-new">
                <button type="button" className="btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingHoliday ? 'Update' : 'Add'} Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarNew;
