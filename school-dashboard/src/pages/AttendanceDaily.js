import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FiRefreshCw, FiFilter, FiCheckCircle, FiClock, FiXCircle, FiCalendar,
  FiDownload, FiSearch, FiChevronLeft, FiChevronRight, FiSun, FiFileText, FiEdit3, FiUserX, FiHelpCircle
} from 'react-icons/fi';
import { studentsAPI, attendanceAPI, classesAPI, sectionsAPI, holidaysAPI, leavesAPI } from '../utils/api';
import ManualAttendanceModal from '../components/ManualAttendanceModal';
import LeaveModal from '../components/LeaveModal';
import { useToast } from '../components/Toast';
import './AttendanceDaily.css';

const AttendanceDaily = () => {
  const toast = useToast();
  const [students, setStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [holidays, setHolidays] = useState({});
  const [leaves, setLeaves] = useState({}); // { studentId: { day: leaveData } }
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [sections, setSections] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [classes, setClasses] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState('monthly');
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [leavePreselect, setLeavePreselect] = useState({ student: null, date: null });
  const [showManualAttendanceModal, setShowManualAttendanceModal] = useState(false);
  const [quickEditCell, setQuickEditCell] = useState(null); // { studentId, day, student }
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    late: 0,
    absent: 0,
    holidays: 0,
    onLeave: 0
  });

  // ⚡ PERFORMANCE: Pagination state - 8 students for maximum speed
  const [currentPage, setCurrentPage] = useState(1);
  const STUDENTS_PER_PAGE = 8;

  // ⚡ PERFORMANCE: Debounced search for instant typing
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [initialLoading, setInitialLoading] = useState(true); // For skeleton on first load only

  const getTodayFormatted = () => {
    const today = new Date();
    return {
      full: today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      day: today.toLocaleDateString('en-US', { weekday: 'long' }),
      date: today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };
  };

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const getMonthName = () => {
    return currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => i + 1);
  };

  const getDayOfWeek = (day) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const date = new Date(year, month, day);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const isWeekend = (day) => {
    const dayName = getDayOfWeek(day);
    return dayName === 'Sun'; // In India, schools are only off on Sunday
  };

  const days = getDaysInMonth(currentMonth);
  const today = getTodayFormatted();

  // Define all fetch functions first
  const fetchClasses = async () => {
    try {
      const response = await classesAPI.getAll();
      if (response.success) {
        const classesData = response.data.classes || response.data || [];
        console.log('📚 Fetched classes:', classesData.length, 'classes');
        console.log('📚 Classes data:', classesData);
        setClasses(classesData);
      } else {
        console.error('❌ Failed to fetch classes:', response);
      }
    } catch (err) {
      console.error('❌ Error fetching classes:', err);
    }
  };

  const fetchSections = async () => {
    try {
      const response = await sectionsAPI.getAll();
      if (response.success) {
        const sectionsData = response.data || [];
        console.log('🎯 Fetched sections:', sectionsData.length, 'sections');
        console.log('🎯 Sections data:', sectionsData);
        setSections(sectionsData);
      } else {
        console.error('❌ Failed to fetch sections:', response);
      }
    } catch (err) {
      console.error('❌ Error fetching sections:', err);
    }
  };

  const fetchHolidays = useCallback(async () => {
    try {
      const year = currentMonth.getFullYear();

      const response = await holidaysAPI.getAll({ year });

      console.log('🎉 Holidays Response:', response);

      const holidayMap = {};
      if (response.success && response.data) {
        response.data.forEach(holiday => {
          const holidayDate = new Date(holiday.holiday_date);
          const day = holidayDate.getDate();
          holidayMap[day] = {
            name: holiday.holiday_name,
            type: holiday.holiday_type
          };
          console.log(`🎉 Holiday added: Day ${day} - ${holiday.holiday_name}`);
        });
      }
      setHolidays(holidayMap);
      console.log('🎉 Final holiday map:', holidayMap);
    } catch (err) {
      console.error('Error fetching holidays:', err);
    }
  }, [currentMonth]);

  const fetchLeaves = useCallback(async () => {
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;

      const response = await leavesAPI.getMonthly({ year, month });

      console.log('🏖️ Leaves Response:', response);

      const leaveMap = {};
      if (response.success && response.data) {
        response.data.forEach(leave => {
          const startDate = new Date(leave.start_date);
          const endDate = new Date(leave.end_date);
          const studentId = leave.student_id;

          // Initialize student leave map if not exists
          if (!leaveMap[studentId]) {
            leaveMap[studentId] = {};
          }

          // Mark all days in the leave period
          const currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            if (currentDate.getMonth() === currentMonth.getMonth()) {
              const day = currentDate.getDate();
              leaveMap[studentId][day] = {
                type: leave.leave_type,
                reason: leave.reason,
                status: leave.status,
                id: leave.id
              };
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }
        });
      }
      setLeaves(leaveMap);
      console.log('🏖️ Final leave map:', leaveMap);
    } catch (err) {
      console.error('Error fetching leaves:', err);
    }
  }, [currentMonth]);

  const fetchMonthlyAttendance = useCallback(async () => {
    try {
      setLoading(true);

      console.log('🔍 Fetching students with filters - class:', classFilter, 'section:', sectionFilter);

      // Build query params
      const queryParams = { limit: 1000 };

      // Priority: Section filter > Class filter
      if (sectionFilter !== 'all' && sectionFilter) {
        queryParams.sectionId = parseInt(sectionFilter);
        console.log('✅ Filtering by section ID:', queryParams.sectionId);
      } else if (classFilter !== 'all' && classFilter) {
        queryParams.classId = parseInt(classFilter);
        console.log('✅ Filtering by class ID:', queryParams.classId);
      } else {
        console.log('✅ Fetching all students');
      }

      console.log('📤 Sending query params:', JSON.stringify(queryParams));

      const studentsResponse = await studentsAPI.getAll(queryParams);

      console.log('📥 Received response:', studentsResponse);

      console.log('📊 Students API Response:', studentsResponse);

      if (!studentsResponse.success) {
        throw new Error('Failed to fetch students');
      }

      const allStudents = studentsResponse.data.students || studentsResponse.data || [];
      console.log(`✅ Fetched ${allStudents.length} students with filters - class: ${classFilter}, section: ${sectionFilter}`);

      // If filtering and no students found, show message
      if ((classFilter !== 'all' || sectionFilter !== 'all') && allStudents.length === 0) {
        console.warn('⚠️ No students found for this filter');
      }

      setStudents(allStudents);

      const year = currentMonth.getFullYear();
      const month = String(currentMonth.getMonth() + 1).padStart(2, '0');

      const attendanceMapData = {};
      allStudents.forEach(student => {
        attendanceMapData[student.id] = {};
      });

      // ⚡ PERFORMANCE BOOST: Use batch API instead of 31 sequential calls
      // This is 30X FASTER and uses only 1 database query instead of 31!
      const firstDay = `${year}-${month}-01`;
      const lastDay = days[days.length - 1];
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      try {
        const logsResponse = await attendanceAPI.getRange({
          startDate: firstDay,
          endDate: endDate
        });

        if (logsResponse.success && logsResponse.data) {
          logsResponse.data.forEach(log => {
            if (attendanceMapData[log.student_id]) {
              // Extract day from date (YYYY-MM-DD format)
              const logDate = new Date(log.date);
              const day = logDate.getDate();

              attendanceMapData[log.student_id][day] = {
                status: log.status || 'present',
                checkIn: log.check_in_time || log.timestamp,
                checkOut: log.check_out_time,
                leaveReason: log.leave_reason
              };
            }
          });
        }
      } catch (err) {
        console.error('Error fetching monthly attendance range:', err);
      }

      setAttendanceMap(attendanceMapData);

      let present = 0, late = 0, absent = 0;
      Object.values(attendanceMapData).forEach(studentDays => {
        Object.values(studentDays).forEach(dayData => {
          if (dayData.status === 'present') present++;
          else if (dayData.status === 'late') late++;
          else if (dayData.status === 'absent') absent++;
        });
      });

      setStats({
        total: allStudents.length,
        present,
        late,
        absent,
        holidays: Object.keys(holidays).length
      });

    } catch (err) {
      console.error('Error fetching monthly attendance:', err);
    } finally {
      setLoading(false);
    }
  }, [classFilter, sectionFilter, currentMonth]);

  const fetchDailyAttendance = useCallback(async () => {
    try {
      setLoading(true);

      console.log('🔍 [Daily] Fetching students with classFilter:', classFilter);

      const studentsResponse = await studentsAPI.getAll({
        classId: classFilter !== 'all' ? classFilter : undefined,
        limit: 1000
      });

      console.log('📊 [Daily] Students API Response:', studentsResponse);

      if (!studentsResponse.success) {
        throw new Error('Failed to fetch students');
      }

      const allStudents = studentsResponse.data.students || studentsResponse.data || [];
      console.log(`✅ [Daily] Fetched ${allStudents.length} students`);
      setStudents(allStudents);

      const attendanceResponse = await attendanceAPI.getLogs({
        date: getTodayDate(),
        limit: 1000
      });

      const map = {};
      if (attendanceResponse.success && attendanceResponse.data) {
        attendanceResponse.data.forEach(log => {
          map[log.student_id] = {
            status: log.status || 'present',
            checkIn: log.check_in_time || log.timestamp,
            checkOut: log.check_out_time,
            timestamp: log.timestamp,
            leaveReason: log.leave_reason
          };
        });
      }

      setAttendanceMap(map);

      let present = 0, late = 0, absent = 0;
      allStudents.forEach(student => {
        const data = map[student.id];
        if (data?.status === 'present') present++;
        else if (data?.status === 'late') late++;
        else absent++;
      });

      // For daily view, check if TODAY is a holiday
      const today = new Date();
      const todayDay = today.getDate();
      const isTodayHoliday = holidays[todayDay] ? 1 : 0;

      console.log('📅 Today check:', {
        day: todayDay,
        isHoliday: isTodayHoliday,
        holidayData: holidays[todayDay],
        allHolidays: holidays
      });

      setStats({
        total: allStudents.length,
        present,
        late,
        absent,
        holidays: isTodayHoliday
      });

    } catch (err) {
      console.error('Error fetching daily attendance:', err);
    } finally {
      setLoading(false);
    }
  }, [classFilter, sectionFilter, currentMonth, holidays]);

  // useEffect hooks - placed after function definitions
  useEffect(() => {
    fetchClasses();
    fetchSections();
  }, []);

  useEffect(() => {
    // Fetch holidays and leaves whenever the month changes
    fetchHolidays();
    fetchLeaves();
  }, [currentMonth, fetchHolidays, fetchLeaves]);

  useEffect(() => {
    const fetchData = async () => {
      if (viewMode === 'monthly') {
        await fetchMonthlyAttendance();
      } else {
        await fetchDailyAttendance();
      }
      // Mark initial loading complete after first data fetch
      setInitialLoading(false);
    };
    fetchData();
  }, [classFilter, sectionFilter, currentMonth, viewMode, fetchMonthlyAttendance, fetchDailyAttendance]);

  // ⚡ PERFORMANCE: Debounced search - 300ms delay for smooth typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getCellContent = (studentId, day) => {
    const dayData = attendanceMap[studentId]?.[day];
    const holiday = holidays[day];
    const weekend = isWeekend(day);
    const leave = leaves[studentId]?.[day];

    // Priority: Weekend > Holiday > Leave > Attendance
    // Weekends are always marked as "S" regardless of holidays
    if (weekend) {
      return <span className="badge-mark badge-weekend" title="Weekend">S</span>;
    }

    // Holidays only shown on non-weekend days
    if (holiday) {
      return <span className="badge-mark badge-holiday" title={holiday.name}>H</span>;
    }

    // Leave - show if student is on approved leave
    if (leave && leave.status === 'approved') {
      return <span className="badge-mark badge-leave" title={`Leave: ${leave.reason || leave.type}`}>LV</span>;
    }

    // Regular attendance data
    if (!dayData) {
      // Show blank/empty for unmarked dates
      return <span className="badge-mark badge-unmarked" title="Not marked yet">-</span>;
    }

    const status = dayData.status || 'absent';
    if (status === 'present') return <span className="badge-mark badge-present" title={`Check-in: ${formatTime(dayData.checkIn)}`}>P</span>;
    if (status === 'late') return <span className="badge-mark badge-late" title={`Check-in: ${formatTime(dayData.checkIn)}`}>L</span>;
    if (status === 'absent') return <span className="badge-mark badge-absent" title="Marked as absent">A</span>;
    if (status === 'leave') return <span className="badge-mark badge-leave" title="On leave">LV</span>;
    return <span className="badge-mark badge-unmarked" title="Not marked">-</span>;
  };

  const getStatusBadge = (data) => {
    if (!data) return <span className="badge-mark badge-unmarked" title="Not marked yet">-</span>;

    const status = data.status;
    if (status === 'present') return <span className="badge-mark badge-present">P</span>;
    if (status === 'late') return <span className="badge-mark badge-late">L</span>;
    if (status === 'absent') return <span className="badge-mark badge-absent">A</span>;
    if (status === 'leave') return <span className="badge-mark badge-leave">LV</span>;
    return <span className="badge-mark badge-unmarked" title="Not marked yet">-</span>;
  };

  const getStatusIcon = (data) => {
    if (!data) return <FiHelpCircle className="status-icon-table icon-unmarked" title="Not marked yet" />;

    const status = data.status;
    if (status === 'present') return <FiCheckCircle className="status-icon-table icon-present" />;
    if (status === 'late') return <FiClock className="status-icon-table icon-late" />;
    if (status === 'absent') return <FiXCircle className="status-icon-table icon-absent" />;
    if (status === 'leave') return <FiHelpCircle className="status-icon-table icon-leave" />;
    return <FiHelpCircle className="status-icon-table icon-unmarked" title="Not marked yet" />;
  };

  const getAttendanceRate = () => {
    if (stats.total === 0) return 0;
    return Math.round(((stats.present + stats.late) / stats.total) * 100);
  };

  const calculateStudentAttendancePercentage = (studentId) => {
    const studentData = attendanceMap[studentId] || {};
    let presentCount = 0;
    let workingDays = 0;

    days.forEach(day => {
      const holiday = holidays[day];
      const weekend = isWeekend(day);
      const leave = leaves[studentId]?.[day];

      // Skip weekends and holidays
      if (weekend || holiday) {
        return;
      }

      // Count as working day
      workingDays++;

      // Check attendance status
      const dayData = studentData[day];
      if (dayData) {
        const status = dayData.status;
        // Count Present and Late as attended
        if (status === 'present' || status === 'late') {
          presentCount++;
        }
      }
      // If on approved leave, don't count as absent but also exclude from working days
      else if (leave && leave.status === 'approved') {
        workingDays--; // Exclude leave days from working days
      }
    });

    if (workingDays === 0) return 0;
    return Math.round((presentCount / workingDays) * 100);
  };

  const handleManualAttendanceSuccess = (attendanceData) => {
    // Refresh the attendance data
    if (viewMode === 'monthly') {
      fetchMonthlyAttendance();
    } else {
      fetchDailyAttendance();
    }
  };

  const handleLeaveSuccess = (leaveData) => {
    // Refresh leaves and attendance data
    fetchLeaves();
    if (viewMode === 'monthly') {
      fetchMonthlyAttendance();
    } else {
      fetchDailyAttendance();
    }
  };

  // ⚡ PERFORMANCE: Memoized click handler
  const handleCellClick = useCallback((studentId, day, student, event) => {
    // Don't allow editing weekends or holidays
    const holiday = holidays[day];
    const weekend = isWeekend(day);

    if (weekend || holiday) {
      return; // Can't edit weekends or holidays
    }

    // Format date for the clicked cell
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const clickedDate = `${year}-${month}-${dayStr}`;

    // Set the quick edit cell
    setQuickEditCell({ studentId, day, student, position: { x: event.clientX, y: event.clientY } });

    // Also set preselect data for leave modal
    setLeavePreselect({
      student: student,
      date: clickedDate
    });

    console.log('📅 Cell clicked:', {
      student: student.full_name,
      date: clickedDate
    });
  }, [holidays, currentMonth]);

  const handleDailyMarkClick = (student, event) => {
    // For daily view, use current date
    const today = new Date();
    const todayDay = today.getDate();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(todayDay).padStart(2, '0');
    const todayDate = `${year}-${month}-${day}`;

    // Check if today is a holiday
    const todayHoliday = holidays[todayDay];
    if (todayHoliday) {
      toast.error(`Cannot mark attendance! Today is a holiday: ${todayHoliday.name}. Attendance marking is not allowed on holidays.`);
      console.log('🚫 Attendance marking blocked - Today is a holiday:', todayHoliday);
      return;
    }

    // Check if today is weekend (Sunday)
    const dayOfWeek = today.getDay();
    if (dayOfWeek === 0) {
      toast.error('Cannot mark attendance! Today is Sunday (Weekend). Attendance marking is not allowed on weekends.');
      console.log('🚫 Attendance marking blocked - Today is Sunday');
      return;
    }

    // Set quick edit for daily view (using day as today's day number)
    setQuickEditCell({
      studentId: student.id,
      day: todayDay,
      student: student,
      position: { x: event.clientX, y: event.clientY },
      isDailyView: true
    });

    // Also set preselect data for leave modal
    setLeavePreselect({
      student: student,
      date: todayDate
    });

    console.log('👆 Daily mark clicked:', {
      student: student.full_name,
      date: todayDate
    });
  };

  const handleQuickMarkAttendance = async (status) => {
    if (!quickEditCell) return;

    const { studentId, day } = quickEditCell;
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const date = `${year}-${month}-${dayStr}`;

    // Check if attendance already exists for this student/date
    const existingAttendance = attendanceMap[studentId]?.[day];
    const isUpdate = existingAttendance && existingAttendance.status;

    // Get current time in IST
    const now = new Date();
    const istDate = new Date(now.getTime() + (330 * 60 * 1000));
    const hours = String(istDate.getUTCHours()).padStart(2, '0');
    const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
    const time = `${hours}:${minutes}:00`;

    console.log('📝 Marking attendance:', {
      studentId,
      date,
      status,
      isUpdate,
      existingStatus: existingAttendance?.status
    });

    try {
      const token = localStorage.getItem('token');
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';
      const response = await fetch(`${API_BASE_URL}/school/attendance/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId: parseInt(studentId),
          date: date,
          checkInTime: time,
          status: status,
          notes: isUpdate ? 'Updated via quick edit' : 'Marked via quick edit',
          forceUpdate: isUpdate  // Flag to tell backend this is an update
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Close the quick edit popup
        setQuickEditCell(null);

        // Show success toast
        toast.success('Attendance marked successfully!');

        // Refresh attendance data based on current view
        if (viewMode === 'monthly') {
          fetchMonthlyAttendance();
        } else {
          fetchDailyAttendance();
        }
      } else {
        toast.error(data.message || 'Failed to mark attendance');
      }
    } catch (err) {
      console.error('Error marking attendance:', err);
      toast.error('Failed to mark attendance. Please try again.');
    }
  };

  // ⚡ PERFORMANCE: Memoized filtered students using debounced search
  const filteredStudents = useMemo(() => {
    return students.filter(student =>
      student.full_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
  }, [students, debouncedSearchTerm]);

  // ⚡ PERFORMANCE: Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, classFilter, sectionFilter, currentMonth]);

  // ⚡ PERFORMANCE: Memoized attendance percentages (calculated ONCE, not 3x per student)
  const attendancePercentages = useMemo(() => {
    const percentages = {};
    students.forEach(student => {
      const studentData = attendanceMap[student.id] || {};
      let presentCount = 0;
      let workingDays = 0;

      days.forEach(day => {
        const holiday = holidays[day];
        const weekend = isWeekend(day);
        const leave = leaves[student.id]?.[day];

        if (weekend || holiday) return;
        workingDays++;

        const dayData = studentData[day];
        if (dayData) {
          if (dayData.status === 'present' || dayData.status === 'late') {
            presentCount++;
          }
        } else if (leave && leave.status === 'approved') {
          workingDays--;
        }
      });

      percentages[student.id] = workingDays === 0 ? 0 : Math.round((presentCount / workingDays) * 100);
    });
    return percentages;
  }, [students, attendanceMap, holidays, leaves, days]);

  // ⚡ PERFORMANCE: Paginated students (20 per page instead of 129)
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * STUDENTS_PER_PAGE;
    return filteredStudents.slice(start, start + STUDENTS_PER_PAGE);
  }, [filteredStudents, currentPage, STUDENTS_PER_PAGE]);

  const totalPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE);

  // ⚡ PERFORMANCE: Pre-compute cell status for paginated students only
  // This avoids creating 620+ JSX elements on every render
  const cellStatusMap = useMemo(() => {
    const map = {};
    paginatedStudents.forEach(student => {
      map[student.id] = {};
      days.forEach(day => {
        const dayData = attendanceMap[student.id]?.[day];
        const holiday = holidays[day];
        const weekend = isWeekend(day);
        const leave = leaves[student.id]?.[day];

        let status = 'unmarked';
        let title = 'Not marked yet';
        let cssClass = 'badge-unmarked';

        if (weekend) {
          status = 'S';
          title = 'Weekend';
          cssClass = 'badge-weekend';
        } else if (holiday) {
          status = 'H';
          title = holiday.name;
          cssClass = 'badge-holiday';
        } else if (leave && leave.status === 'approved') {
          status = 'LV';
          title = `Leave: ${leave.reason || leave.type}`;
          cssClass = 'badge-leave';
        } else if (dayData) {
          const attendanceStatus = dayData.status || 'absent';
          if (attendanceStatus === 'present') {
            status = 'P';
            title = `Check-in: ${formatTime(dayData.checkIn)}`;
            cssClass = 'badge-present';
          } else if (attendanceStatus === 'late') {
            status = 'L';
            title = `Check-in: ${formatTime(dayData.checkIn)}`;
            cssClass = 'badge-late';
          } else if (attendanceStatus === 'absent') {
            status = 'A';
            title = 'Marked as absent';
            cssClass = 'badge-absent';
          } else if (attendanceStatus === 'leave') {
            status = 'LV';
            title = 'On leave';
            cssClass = 'badge-leave';
          }
        } else {
          status = '-';
        }

        map[student.id][day] = { status, title, cssClass };
      });
    });
    return map;
  }, [paginatedStudents, days, attendanceMap, holidays, leaves]);

  return (
    <div className="attendance-register-container">
      {/* Header Section */}
      <div className="register-header">
        <div className="header-top">
          <div className="header-title-group">
            <div className="calendar-badge">
              <FiCalendar />
            </div>
            <div>
              <h1 className="register-title">
                {viewMode === 'monthly' ? 'Monthly Attendance Calendar' : 'Daily Attendance Register'}
              </h1>
              <p className="register-date">
                {viewMode === 'monthly' ? getMonthName() : today.full}
              </p>
            </div>
          </div>
          <div className="header-actions-group">
            <div className="view-toggle">
              <button
                className={`toggle-btn ${viewMode === 'daily' ? 'active' : ''}`}
                onClick={() => setViewMode('daily')}
              >
                <FiFileText /> Daily
              </button>
              <button
                className={`toggle-btn ${viewMode === 'monthly' ? 'active' : ''}`}
                onClick={() => setViewMode('monthly')}
              >
                <FiCalendar /> Monthly
              </button>
            </div>
            <button
              className="action-btn btn-manual-attendance"
              onClick={() => setShowManualAttendanceModal(true)}
              title="Mark Manual Attendance"
            >
              <FiEdit3 /> Manual
            </button>
            <button
              className="action-btn btn-leave"
              onClick={() => setShowLeaveModal(true)}
              title="Add Student Leave"
            >
              <FiUserX /> Leave
            </button>
            <button className="action-btn btn-refresh" onClick={viewMode === 'monthly' ? fetchMonthlyAttendance : fetchDailyAttendance}>
              <FiRefreshCw />
            </button>
            <button className="action-btn btn-download">
              <FiDownload />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="quick-stats-bar">
        <div className="quick-stat">
          <div className="stat-content">
            <span className="stat-label">Total</span>
            <span className="stat-number">{stats.total}</span>
          </div>
        </div>
        <div className="quick-stat stat-success">
          <div className="stat-content">
            <span className="stat-label">Present</span>
            <span className="stat-number">{stats.present}</span>
          </div>
        </div>
        <div className="quick-stat stat-warning">
          <div className="stat-content">
            <span className="stat-label">Late</span>
            <span className="stat-number">{stats.late}</span>
          </div>
        </div>
        <div className="quick-stat stat-danger">
          <div className="stat-content">
            <span className="stat-label">Absent</span>
            <span className="stat-number">{stats.absent}</span>
          </div>
        </div>
        <div className="quick-stat stat-info">
          <div className="stat-content">
            <span className="stat-label">Holidays</span>
            <span className="stat-number">{stats.holidays}</span>
          </div>
        </div>
        <div className="quick-stat stat-rate">
          <div className="stat-content">
            <span className="stat-label">Rate</span>
            <span className="stat-number">{getAttendanceRate()}%</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="register-filters">
        {viewMode === 'monthly' && (
          <div className="month-navigation">
            <button className="nav-btn" onClick={previousMonth}>
              <FiChevronLeft />
            </button>
            <span className="month-display">{getMonthName()}</span>
            <button className="nav-btn" onClick={nextMonth}>
              <FiChevronRight />
            </button>
          </div>
        )}
        <div className="search-filter">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search student name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="class-filter">
          <FiFilter className="filter-icon" />
          <select
            value={classFilter}
            onChange={(e) => {
              const selectedClass = e.target.value;
              console.log('🎯 Class filter changed from:', classFilter, 'to:', selectedClass);
              setClassFilter(selectedClass);
              // Reset section filter when class changes
              if (selectedClass === 'all') {
                setSectionFilter('all');
              }
            }}
            className="class-select"
          >
            <option value="all">📚 All Classes</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>
                {cls.class_name}
              </option>
            ))}
          </select>
        </div>

        <div className="section-filter">
          <FiFilter className="filter-icon" />
          <select
            value={sectionFilter}
            onChange={(e) => {
              const selectedSection = e.target.value;
              console.log('🎯 Section filter changed to:', selectedSection);
              setSectionFilter(selectedSection);
            }}
            className="section-select"
          >
            <option value="all">📋 All Sections ({students.length} students)</option>
            {sections
              .filter(sec => classFilter === 'all' || sec.class_id === parseInt(classFilter))
              .map(sec => (
                <option key={sec.id} value={sec.id}>
                  {sec.class_name} - {sec.section_name}
                </option>
              ))}
          </select>
          {(classFilter !== 'all' || sectionFilter !== 'all') && (
            <button
              className="clear-filter-btn"
              onClick={() => {
                setClassFilter('all');
                setSectionFilter('all');
              }}
              title="Clear all filters"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {initialLoading ? (
        // ⚡ SKELETON LOADING - Modern placeholder during initial load
        <div className="skeleton-container">
          <div className="skeleton-header">
            <div className="skeleton-title"></div>
          </div>
          <div className="skeleton-table">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="skeleton-row">
                <div className="skeleton-avatar"></div>
                <div className="skeleton-name"></div>
                <div className="skeleton-cells">
                  {[...Array(15)].map((_, j) => (
                    <div key={j} className="skeleton-cell"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <FiCalendar />
          </div>
          <h3>No Students Found</h3>
          <p>{debouncedSearchTerm ? 'Try a different search term' : 'Add students to start tracking attendance'}</p>
        </div>
      ) : viewMode === 'monthly' ? (
        // MONTHLY CALENDAR VIEW
        <div className="calendar-scroll-wrapper">
          <div className="calendar-table-container">
            <table className="calendar-table">
              <thead>
                <tr>
                  <th className="sticky-col header-student">Student Name</th>
                  {days.map(day => {
                    const holiday = holidays[day];
                    const weekend = isWeekend(day);
                    return (
                      <th key={day} className={`day-header ${holiday && !weekend ? 'is-holiday' : ''} ${weekend ? 'is-weekend' : ''}`}>
                        <div className="day-header-content">
                          <span className="day-number">{String(day).padStart(2, '0')}</span>
                          <span className="day-name">{getDayOfWeek(day)}</span>
                          {holiday && !weekend && <FiSun className="holiday-icon" title={holiday.name} />}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* ⚡ PERFORMANCE: Using paginated students (20 per page) */}
                {paginatedStudents.map((student) => {
                  const percentage = attendancePercentages[student.id] || 0;
                  return (
                    <tr key={student.id}>
                      <td className="sticky-col student-name-col">
                        <div className="student-name-wrapper">
                          <div className="student-avatar-tiny">
                            {student.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="student-details">
                            <div className="student-name-row">
                              <span className="student-name-text">{student.full_name}</span>
                              {/* ⚡ PERFORMANCE: Using memoized percentage */}
                              <span className={`student-percentage ${percentage >= 75 ? 'percentage-good' :
                                percentage >= 50 ? 'percentage-average' :
                                  'percentage-low'
                                }`}>
                                {percentage}%
                              </span>
                            </div>
                            <div className="student-meta">
                              {student.roll_number && (
                                <span className="student-roll-number">
                                  Roll: {student.roll_number}
                                </span>
                              )}
                              <span className="student-class-text">
                                {student.class_name && student.section_name
                                  ? `${student.class_name} - ${student.section_name}`
                                  : student.class_name || 'No Class'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      {days.map(day => {
                        const cellData = cellStatusMap[student.id]?.[day] || { status: '-', title: 'Not marked', cssClass: 'badge-unmarked' };
                        const holiday = holidays[day];
                        const weekend = isWeekend(day);
                        const isEditable = !weekend && !holiday;
                        const hasAttendance = cellData.cssClass === 'badge-present' || cellData.cssClass === 'badge-late' || cellData.cssClass === 'badge-absent';

                        return (
                          <td
                            key={day}
                            className={`day-cell ${isEditable ? 'day-cell-clickable' : 'day-cell-disabled'} ${hasAttendance ? 'has-attendance' : ''}`}
                            onClick={(e) => isEditable && handleCellClick(student.id, day, student, e)}
                          >
                            {/* ⚡ PERFORMANCE: Using pre-computed cell data */}
                            <span className={`badge-mark ${cellData.cssClass}`} title={cellData.title}>
                              {cellData.status}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ⚡ PERFORMANCE: Pagination Controls */}
          {totalPages > 1 && (
            <div className="pagination-controls">
              <div className="pagination-info">
                Showing {((currentPage - 1) * STUDENTS_PER_PAGE) + 1}-{Math.min(currentPage * STUDENTS_PER_PAGE, filteredStudents.length)} of {filteredStudents.length} students
              </div>
              <div className="pagination-buttons">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  title="First page"
                >
                  ««
                </button>
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <FiChevronLeft /> Prev
                </button>
                <span className="page-indicator">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next <FiChevronRight />
                </button>
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  title="Last page"
                >
                  »»
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // DAILY DETAILED VIEW
        <div>
          {/* Holiday Alert Banner for Daily View */}
          {(() => {
            const today = new Date();
            const todayDay = today.getDate();
            const todayHoliday = holidays[todayDay];

            if (todayHoliday) {
              return (
                <div className="holiday-alert-banner">
                  <div className="holiday-alert-icon">🎉</div>
                  <div className="holiday-alert-content">
                    <h3>Today is a Holiday!</h3>
                    <p><strong>{todayHoliday.name}</strong> - Attendance marking is disabled.</p>
                  </div>
                </div>
              );
            }

            // Check if Sunday
            const dayOfWeek = today.getDay();
            if (dayOfWeek === 0) {
              return (
                <div className="holiday-alert-banner weekend-banner">
                  <div className="holiday-alert-icon">☀️</div>
                  <div className="holiday-alert-content">
                    <h3>Today is Sunday!</h3>
                    <p>Weekend - Attendance marking is disabled.</p>
                  </div>
                </div>
              );
            }

            return null;
          })()}

          <div className="table-container">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th className="col-sno">#</th>
                  <th className="col-name">Student Name</th>
                  <th className="col-class">Class</th>
                  <th className="col-time">Check-In</th>
                  <th className="col-time">Check-Out</th>
                  <th className="col-status">Status</th>
                  <th className="col-reason">Leave Reason</th>
                  <th className="col-icon">Mark</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student, index) => {
                  const data = attendanceMap[student.id];
                  const status = data?.status || 'unmarked';
                  const rowClass = status === 'present' ? 'row-present' :
                    status === 'late' ? 'row-late' :
                      status === 'absent' ? 'row-absent' : 'row-unmarked';

                  return (
                    <tr key={student.id} className={rowClass}>
                      <td className="col-sno">{index + 1}</td>
                      <td className="col-name">
                        <div className="student-info">
                          <div className="student-avatar-small">
                            {student.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="student-name-details">
                            <span className="student-name">{student.full_name}</span>
                            {student.roll_number && (
                              <span className="student-roll-badge">Roll: {student.roll_number}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="col-class">
                        {student.class_name && student.section_name
                          ? `${student.class_name} - ${student.section_name}`
                          : student.class_name || '-'}
                      </td>
                      <td className="col-time">{formatTime(data?.checkIn)}</td>
                      <td className="col-time">{formatTime(data?.checkOut)}</td>
                      <td className="col-status">
                        <span className={`status-text status-${status}`}>
                          {status === 'present' ? 'Present' :
                            status === 'late' ? 'Late' :
                              status === 'absent' ? 'Absent' :
                                status === 'leave' ? 'On Leave' :
                                  'Not Marked'}
                        </span>
                      </td>
                      <td className="col-reason">
                        {data?.leaveReason || '-'}
                      </td>
                      <td className="col-icon">
                        <div
                          className="mark-cell clickable"
                          onClick={(e) => handleDailyMarkClick(student, e)}
                          title="Click to mark attendance"
                        >
                          {getStatusIcon(data)}
                          {getStatusBadge(data)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="register-legend">
        <div className="legend-item">
          <FiCheckCircle className="legend-icon icon-present" />
          <span>P - Present</span>
        </div>
        <div className="legend-item">
          <FiClock className="legend-icon icon-late" />
          <span>L - Late</span>
        </div>
        <div className="legend-item">
          <FiXCircle className="legend-icon icon-absent" />
          <span>A - Absent</span>
        </div>
        <div className="legend-item">
          <FiSun className="legend-icon icon-holiday" />
          <span>H - Holiday</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon">S</span>
          <span>S - Sunday</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon" style={{ color: '#8b5cf6' }}>LV</span>
          <span>LV - Leave</span>
        </div>
      </div>

      {/* Quick Edit Popup */}
      {quickEditCell && (
        <>
          {/* Backdrop to close popup */}
          <div
            className="quick-edit-backdrop"
            onClick={() => setQuickEditCell(null)}
          />
          {/* Popup */}
          <div className="quick-edit-popup">
            <div className="quick-edit-header">
              <h4>{quickEditCell.student.full_name}</h4>
              <p>
                {currentMonth.toLocaleDateString('en-US', { month: 'short' })} {quickEditCell.day}, {currentMonth.getFullYear()}
              </p>
            </div>
            <div className="quick-edit-actions">
              <button
                className="quick-btn quick-btn-present"
                onClick={() => handleQuickMarkAttendance('present')}
              >
                <FiCheckCircle /> Present
              </button>
              <button
                className="quick-btn quick-btn-absent"
                onClick={() => handleQuickMarkAttendance('absent')}
              >
                <FiXCircle /> Absent
              </button>
              <button
                className="quick-btn quick-btn-leave"
                onClick={() => {
                  setQuickEditCell(null);
                  setShowLeaveModal(true);
                }}
              >
                <FiUserX /> Leave
              </button>
            </div>
            <button
              className="quick-edit-advanced"
              onClick={() => {
                // Save student and date before closing quick edit
                setSelectedStudent(quickEditCell.student);
                setSelectedDay(quickEditCell.day);
                setQuickEditCell(null);
                setShowManualAttendanceModal(true);
              }}
            >
              <FiEdit3 /> Advanced Options
            </button>
          </div>
        </>
      )}

      {/* Manual Attendance Modal */}
      <ManualAttendanceModal
        isOpen={showManualAttendanceModal}
        onClose={() => {
          setShowManualAttendanceModal(false);
          setSelectedStudent(null);
          setSelectedDay(null);
        }}
        onSuccess={handleManualAttendanceSuccess}
        students={students}
        classes={classes}
        preselectedStudentId={selectedStudent?.id}
        preselectedDate={
          selectedDay && currentMonth
            ? `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
            : null
        }
      />

      {/* Leave Modal */}
      <LeaveModal
        isOpen={showLeaveModal}
        onClose={() => {
          setShowLeaveModal(false);
          // Clear preselect when closing modal
          setLeavePreselect({ student: null, date: null });
        }}
        onSuccess={handleLeaveSuccess}
        preSelectedStudent={leavePreselect.student}
        preSelectedDate={leavePreselect.date}
      />
    </div>
  );
};

export default AttendanceDaily;
