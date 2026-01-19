import React, { useState, useEffect } from 'react';
import {
  FiChevronLeft, FiChevronRight, FiDownload, FiFilter,
  FiCheckCircle, FiClock, FiXCircle, FiHelpCircle, FiUsers
} from 'react-icons/fi';
import { studentsAPI, attendanceAPI, classesAPI, holidaysAPI } from '../utils/api';
import './AttendanceCalendar.css';

const AttendanceCalendar = () => {
  const [students, setStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]); // Store all students
  const [displayedStudents, setDisplayedStudents] = useState([]); // Students currently shown
  const [studentsToShow, setStudentsToShow] = useState(20); // Initial: show 20 students
  const [attendanceData, setAttendanceData] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [classFilter, setClassFilter] = useState('all');
  const [classes, setClasses] = useState([]);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalDays: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0
  });

  // Get days in current month
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => i + 1);
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchMonthlyAttendance();
  }, [currentMonth, classFilter]);

  // ✅ PERFORMANCE FIX: Update displayed students when studentsToShow changes
  useEffect(() => {
    setDisplayedStudents(allStudents.slice(0, studentsToShow));
  }, [allStudents, studentsToShow]);

  const fetchClasses = async () => {
    try {
      const response = await classesAPI.getAll();
      if (response.success) {
        setClasses(response.data || []);
      }
    } catch (err) {
      console.error('Error fetching classes:', err);
    }
  };

  const fetchMonthlyAttendance = async () => {
    try {
      setLoading(true);
      setStudentsToShow(20); // Reset to show 20 students when filter changes

      // 1. Fetch all students
      const studentsResponse = await studentsAPI.getAll({
        class: classFilter !== 'all' ? classFilter : undefined
      });

      if (!studentsResponse.success) {
        throw new Error('Failed to fetch students');
      }

      const fetchedStudents = studentsResponse.data || [];
      setAllStudents(fetchedStudents); // Store all students
      setStudents(fetchedStudents); // Keep for backward compatibility
      setDisplayedStudents(fetchedStudents.slice(0, 20)); // Initially show 20

      // 2. Fetch holidays for current month/year
      const year = currentMonth.getFullYear();
      const month = String(currentMonth.getMonth() + 1).padStart(2, '0');

      try {
        const holidaysResponse = await holidaysAPI.getAll({ year });
        console.log('🎉 Holidays API Response:', holidaysResponse);
        if (holidaysResponse.success) {
          const holidayData = holidaysResponse.data || [];
          console.log('🎉 Holidays Data:', holidayData);
          setHolidays(holidayData);
        }
      } catch (err) {
        console.error('Error fetching holidays:', err);
        setHolidays([]);
      }

      // 3. Fetch attendance for the entire month (✅ OPTIMIZED: Single batch API call)
      const startDate = `${year}-${month}-01`;
      const endDate = `${year}-${month}-${String(days.length).padStart(2, '0')}`;

      // Build attendance data structure: { studentId: { day: status } }
      const attendanceMap = {};
      fetchedStudents.forEach(student => {
        attendanceMap[student.id] = {};
      });

      // ✅ PERFORMANCE FIX: Use batch API instead of 30 sequential calls
      // Before: 30 sequential API calls = 6+ seconds
      // After: 1 batch API call = <1 second (10x faster!)
      try {
        const logsResponse = await attendanceAPI.getRange({
          startDate,
          endDate
        });

        if (logsResponse.success && logsResponse.data) {
          // Process all logs at once
          logsResponse.data.forEach(log => {
            if (attendanceMap[log.student_id]) {
              // Extract day from log date (YYYY-MM-DD format)
              const logDate = new Date(log.check_in_time || log.created_at);
              const day = logDate.getDate();

              attendanceMap[log.student_id][day] = log.status || 'present';
            }
          });
        }
      } catch (err) {
        console.error('Error fetching attendance range:', err);
      }

      setAttendanceData(attendanceMap);

      // 4. Calculate statistics
      let totalPresent = 0;
      let totalLate = 0;
      let totalAbsent = 0;

      Object.values(attendanceMap).forEach(studentDays => {
        Object.values(studentDays).forEach(status => {
          if (status === 'present') totalPresent++;
          else if (status === 'late') totalLate++;
          else if (status === 'absent') totalAbsent++;
        });
      });

      setStats({
        totalStudents: fetchedStudents.length,
        totalDays: days.length,
        presentCount: totalPresent,
        lateCount: totalLate,
        absentCount: totalAbsent
      });

    } catch (err) {
      console.error('Error fetching monthly attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ PERFORMANCE FIX: Load more students
  const loadMoreStudents = () => {
    const newCount = studentsToShow + 20; // Load 20 more students
    setStudentsToShow(newCount);
  };

  // Check if there are more students to load
  const hasMoreStudents = displayedStudents.length < allStudents.length;

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  // Check if a specific date is a holiday
  const isHoliday = (day) => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`;

    const result = holidays.some(holiday => holiday.holiday_date === dateStr);
    if (result) {
      console.log(`🎉 Holiday found for day ${day}: ${dateStr}`, holidays.filter(h => h.holiday_date === dateStr));
    }
    return result;
  };

  const getStatusIcon = (status, day) => {
    // Check if this day is a holiday
    if (isHoliday(day)) {
      return "H";
    }

    // Check if this day is Sunday
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const date = new Date(year, month, day);
    if (date.getDay() === 0) {
      return <span className="icon-sunday" title="Sunday">S</span>;
    }

    if (!status) return <FiHelpCircle className="icon-unknown" title="No data" />;

    const icons = {
      present: <FiCheckCircle className="icon-present" title="Present" />,
      late: <FiClock className="icon-late" title="Late" />,
      absent: <FiXCircle className="icon-absent" title="Absent" />
    };
    return icons[status] || <FiHelpCircle className="icon-unknown" />;
  };

  const calculateStudentStats = (studentId) => {
    const studentDays = attendanceData[studentId] || {};
    const daysArray = Object.values(studentDays);

    const total = daysArray.length;
    const present = daysArray.filter(s => s === 'present').length;
    const late = daysArray.filter(s => s === 'late').length;
    const absent = daysArray.filter(s => s === 'absent').length;
    const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return { total, present, late, absent, percentage };
  };

  const handleExport = async () => {
    try {
      const year = currentMonth.getFullYear();
      const month = String(currentMonth.getMonth() + 1).padStart(2, '0');

      const response = await attendanceAPI.export({
        startDate: `${year}-${month}-01`,
        endDate: `${year}-${month}-${days.length}`,
        format: 'csv'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance-${monthName}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exporting:', err);
      alert('Failed to export attendance report');
    }
  };

  return (
    <div className="attendance-calendar-container">
      {/* Header */}
      <div className="calendar-header">
        <div className="header-left">
          <div className="header-icon-cal">
            <FiUsers />
          </div>
          <div>
            <h1 className="calendar-title">Attendance report</h1>
            <p className="calendar-subtitle">Monthly attendance overview</p>
          </div>
        </div>
        <div className="header-right">
          <button className="btn-download" onClick={handleExport}>
            <FiDownload /> Download reports
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="controls-bar">
        <div className="month-navigation">
          <button className="nav-btn" onClick={previousMonth}>
            <FiChevronLeft />
          </button>
          <h2 className="month-display">{monthName}</h2>
          <button className="nav-btn" onClick={nextMonth}>
            <FiChevronRight />
          </button>
        </div>

        <div className="filter-dropdown-group">
          <FiFilter className="filter-icon-cal" />
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="class-filter-select">
            <option value="all">All Classes</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.name}>{cls.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="summary-stats">
        <div className="stat-item">
          <span className="stat-label">{days.length} days</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">{allStudents.length} students total</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Showing {displayedStudents.length} of {allStudents.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">{holidays.length} holidays this year</span>
        </div>
      </div>

      {/* Calendar Table */}
      {loading ? (
        <div className="loading-calendar">
          <div className="spinner-cal"></div>
          <p>Loading attendance data...</p>
        </div>
      ) : students.length === 0 ? (
        <div className="empty-state-calendar">
          <FiUsers className="empty-icon-cal" />
          <h3>No Students Found</h3>
          <p>Add students to your school to start tracking attendance</p>
        </div>
      ) : (
        <div className="calendar-table-wrapper">
          <table className="calendar-table">
            <thead>
              <tr>
                <th className="sticky-col header-cell">
                  <div className="header-content">
                    <span>PLAYER NAME</span>
                  </div>
                </th>
                <th className="stats-col" title="Total attendance days">
                  <FiCheckCircle className="header-icon-check" />
                </th>
                <th className="stats-col" title="Present days">
                  <FiCheckCircle className="header-icon-check" />
                </th>
                <th className="stats-col">%</th>
                <th className="stats-col" title="Late days">
                  <FiClock className="header-icon-clock" />
                </th>
                <th className="stats-col" title="Absent days">
                  <FiXCircle className="header-icon-cross" />
                </th>
                <th className="stats-col" title="Unknown/No data">
                  <FiHelpCircle className="header-icon-unknown" />
                </th>
                {days.map(day => (
                  <th key={day} className="day-col">
                    {day.toString().padStart(2, '0')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedStudents.map((student) => {
                const studentStats = calculateStudentStats(student.id);

                return (
                  <tr key={student.id} className="student-row">
                    <td className="sticky-col student-name-cell">
                      <div className="student-name-wrapper">
                        <span className="student-name-text">{student.full_name}</span>
                      </div>
                    </td>
                    <td className="stats-col">{studentStats.total}</td>
                    <td className="stats-col">{studentStats.present}</td>
                    <td className="stats-col stats-percentage">{studentStats.percentage}</td>
                    <td className="stats-col">{studentStats.late}</td>
                    <td className="stats-col">{studentStats.absent}</td>
                    <td className="stats-col">
                      {days.length - studentStats.total}
                    </td>
                    {days.map(day => (
                      <td
                        key={day}
                        className={`day-cell ${isHoliday(day) ? 'holiday-cell' : ''}`}
                        title={isHoliday(day) ? 'Holiday' : ''}
                      >
                        {getStatusIcon(attendanceData[student.id]?.[day], day)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ✅ PERFORMANCE FIX: Load More Button */}
          {hasMoreStudents && (
            <div style={{
              textAlign: 'center',
              padding: '20px',
              borderTop: '1px solid #e0e0e0',
              backgroundColor: '#f9f9f9'
            }}>
              <button
                onClick={loadMoreStudents}
                style={{
                  padding: '12px 30px',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#fff',
                  backgroundColor: '#6366f1',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 4px rgba(99, 102, 241, 0.2)'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#4f46e5'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#6366f1'}
              >
                Load More Students ({allStudents.length - displayedStudents.length} remaining)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="legend-bar">
        <div className="legend-item">
          <FiCheckCircle className="legend-icon icon-present" />
          <span>Present</span>
        </div>
        <div className="legend-item">
          <FiClock className="legend-icon icon-late" />
          <span>Late</span>
        </div>
        <div className="legend-item">
          <FiHelpCircle className="legend-icon icon-unknown" />
          <span>Unknown absence</span>
        </div>
        <div className="legend-item">
          <FiXCircle className="legend-icon icon-absent" />
          <span>Excused absence</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon icon-sunday">S</span>
          <span>Sunday</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon icon-holiday">H</span>
          <span>Holiday</span>
        </div>
      </div>
    </div>
  );
};

export default AttendanceCalendar;
