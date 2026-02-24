import React, { useState, useEffect, useCallback } from 'react';
import {
  FiBarChart2,
  FiDownload,
  FiCalendar,
  FiTrendingUp,
  FiFileText,
  FiUsers,
  FiBook,
  FiAward,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiMessageSquare,
  FiActivity,
  FiSearch
} from 'react-icons/fi';
import { FaUsers, FaChartLine, FaClock, FaUserTimes } from 'react-icons/fa';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
  LineChart, Line,
  AreaChart, Area,
  ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart, Scatter
} from 'recharts';
import { reportsAPI, sectionsAPI, studentsAPI } from '../utils/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import './Reports.css';

// Chart Colors
const COLORS = {
  present: '#10B981',
  absent: '#EF4444',
  late: '#F59E0B',
  primary: '#4F46E5',
  secondary: '#7C3AED',
  info: '#0EA5E9',
  purple: '#8B5CF6',
  orange: '#F97316',
  gray: '#6B7280',
  gradient: ['#4F46E5', '#7C3AED', '#EC4899']
};

const PIE_COLORS = [COLORS.present, COLORS.absent, COLORS.late];

const Reports = () => {
  const [reportType, setReportType] = useState('daily');

  // Dynamic State for Filters
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // Bulk export loading state
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  month: new Date().getMonth() + 1
});
const [selectedClass, setSelectedClass] = useState('');
const [selectedStudent, setSelectedStudent] = useState('');

// Data State
const [sections, setSections] = useState([]);
const [students, setStudents] = useState([]);
const [reportData, setReportData] = useState(null);
const [loading, setLoading] = useState(false);

// Enhanced Report Types List
const reportTypes = [
  { value: 'daily', label: 'Daily Report', icon: FiCalendar, description: 'Single day breakdown', color: '#4F46E5', filters: ['date'] },
  { value: 'monthly', label: 'Monthly Report', icon: FiTrendingUp, description: 'Month-wise trends', color: '#7C3AED', filters: ['month'] },
  { value: 'student', label: 'Student Report', icon: FiUsers, description: 'Individual history', color: '#0EA5E9', filters: ['student', 'range'] },
  { value: 'class', label: 'Class Report', icon: FiBook, description: 'Class-wise analytics', color: '#10B981', filters: ['class', 'range'] },
  { value: 'weekly', label: 'Weekly Summary', icon: FiCalendar, description: '4-Week trend', color: '#F59E0B', filters: ['startDate'] },
  { value: 'lowAttendance', label: 'Low Attendance', icon: FiAlertTriangle, description: 'At-risk students', color: '#EF4444', filters: ['threshold'] },
  { value: 'perfect', label: 'Perfect Attendance', icon: FiAward, description: '100% records', color: '#10B981', filters: [] },
  { value: 'dayPattern', label: 'Day Pattern', icon: FiActivity, description: 'Weekly trends', color: '#8B5CF6', filters: ['range'] },
  { value: 'teacherPerf', label: 'Teacher Report', icon: FiUsers, description: 'Form teacher stats', color: '#EC4899', filters: [] },
  { value: 'lateArrival', label: 'Late Analysis', icon: FiClock, description: 'Punctuality check', color: '#F97316', filters: ['range'] },
  { value: 'smsStats', label: 'SMS Analytics', icon: FiMessageSquare, description: 'Delivery reports', color: '#6366F1', filters: [] },
  { value: 'comparison', label: 'Class Comparison', icon: FiBarChart2, description: 'Cross-class metrics', color: '#14B8A6', filters: [] }
];

const fetchSections = useCallback(async () => {
  try {
    const response = await sectionsAPI.getAll();
    if (response.success) {
      const sectionList = Array.isArray(response.data) ? response.data : (response.data.sections || []);
      setSections(sectionList);
    }
  } catch (error) {
    console.error('Error fetching sections:', error);
  }
}, []);

const fetchStudents = useCallback(async () => {
  if (!selectedClass) return; // Note: selectedClass actually holds the section ID now
  try {
    const response = await studentsAPI.getAll({ sectionId: selectedClass });
    if (response.success) {
      const studentsList = Array.isArray(response.data) ? response.data : (response.data.students || []);
      setStudents(studentsList);
    }
  } catch (error) {
    console.error('Error fetching students:', error);
    setStudents([]);
  }
}, [selectedClass]);

useEffect(() => { fetchSections(); }, [fetchSections]);
useEffect(() => { if (selectedClass) fetchStudents(); }, [selectedClass, fetchStudents]);

const generateReport = async () => {
  try {
    setLoading(true);
    let response;
    const rangeParams = { startDate: dateRange.startDate, endDate: dateRange.endDate };

    switch (reportType) {
      case 'daily':
        response = await reportsAPI.getDailyReport({ date: selectedDate });
        break;
      case 'monthly':
        response = await reportsAPI.getMonthlyReport({
          year: selectedMonth.year,
          month: selectedMonth.month
        });
        break;
      case 'student':
        if (!selectedStudent) { alert('Please select a student'); setLoading(false); return; }
        response = await reportsAPI.getStudentReport(selectedStudent, rangeParams);
        break;
      case 'class':
        if (!selectedClass) { alert('Please select a class'); setLoading(false); return; }
        response = await reportsAPI.getClassReport(selectedClass, rangeParams);
        break;
      case 'weekly':
        // For weekly, we pick a start date, defaulting to today or selected Range start
        response = await reportsAPI.getWeeklySummary({ startDate: dateRange.startDate });
        break;
      case 'lowAttendance':
        response = await reportsAPI.getLowAttendance({ threshold: 75 });
        break;
      case 'perfect':
        response = await reportsAPI.getPerfectAttendance();
        break;
      case 'dayPattern':
        response = await reportsAPI.getDayPatternAnalysis(rangeParams);
        break;
      case 'teacherPerf':
        response = await reportsAPI.getTeacherPerformance();
        break;
      case 'lateArrival':
        response = await reportsAPI.getLateArrivalsAnalysis(rangeParams);
        break;
      case 'smsStats':
        response = await reportsAPI.getSmsAnalytics();
        break;
      case 'comparison':
        // Mock data for now as placeholder
        response = { success: true, data: { classes: sections.map(c => ({ className: c.class_name, avgAttendance: Math.floor(Math.random() * 30 + 70) })) } };
        break;
      default:
        break;
    }

    if (response && (response.success || response.data)) {
      setReportData(response.data);
    } else {
      throw new Error('Failed to generate report');
    }
  } catch (error) {
    console.error('Error generating report:', error);
    alert('Error generating report: ' + (error.response?.data?.message || error.message));
  } finally {
    setLoading(false);
  }
};

// --- RENDER HELPERS ---

const StatCard = ({ icon: Icon, label, value, subValue, color }) => (
  <div className="stat-card" style={{ '--accent-color': color }}>
    <div className="stat-icon-wrapper" style={{ background: `${color}15` }}>
      <Icon size={24} color={color} />
    </div>
    <div className="stat-content">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {subValue && <span className="stat-sub">{subValue}</span>}
    </div>
  </div>
);

// --- REPORT COMPONENTS ---

const renderDailyReport = () => {
  if (!reportData) return null;

  // Calculate Class-wise Stats
  const classStats = {};
  const processStudent = (s, status) => {
    const cls = s.class_name || 'Unassigned';
    if (!classStats[cls]) classStats[cls] = { total: 0, present: 0, absent: 0, late: 0 };
    classStats[cls].total++;
    if (status === 'present') classStats[cls].present++;
    if (status === 'absent') classStats[cls].absent++;
    if (status === 'late') { classStats[cls].present++; classStats[cls].late++; }
  };

  reportData.present?.forEach(s => processStudent(s, s.status === 'late' ? 'late' : 'present'));
  reportData.absent?.forEach(s => processStudent(s, 'absent'));

  const classBreakdown = Object.entries(classStats).map(([name, stats]) => ({
    name,
    ...stats,
    rate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
  })).sort((a, b) => b.rate - a.rate);

  // Use non-overlapping segments: On-Time, Late, Absent
  const onTimeCount = reportData.onTimeCount || reportData.present?.filter(s => s.status === 'present').length || 0;
  const lateCount = reportData.lateCount || reportData.present?.filter(s => s.status === 'late').length || 0;
  const pieData = [
    { name: 'On-Time', value: onTimeCount },
    { name: 'Late', value: lateCount },
    { name: 'Absent', value: reportData.absentCount || 0 }
  ];

  return (
    <div className="report-content animated-in">
      <div className="report-header-card gradient-primary">
        <div className="header-flex">
          <div>
            <h2>Daily Attendance Report</h2>
            <p>{new Date(reportData.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            {reportData.isNonWorkingDay && <p style={{ marginTop: '4px', fontSize: '14px', opacity: 0.9 }}>📅 {reportData.dayName} — {reportData.dayType}</p>}
          </div>
          <div className="header-score">
            <span>{reportData.attendanceRate === 'N/A' ? 'N/A' : `${reportData.attendanceRate}%`}</span>
            <small>{reportData.isNonWorkingDay ? reportData.dayType : 'Overall'}</small>
          </div>
        </div>
      </div>

      <div className="report-grid-stats">
        <StatCard icon={FiUsers} label="Total Students" value={reportData.totalStudents} color={COLORS.primary} />
        <StatCard
          icon={FiCheckCircle}
          label="On-Time"
          value={onTimeCount}
          subValue={reportData.isNonWorkingDay ? 'N/A' : (reportData.totalStudents > 0 ? `${Math.round((onTimeCount / reportData.totalStudents) * 100)}%` : '0%')}
          color={COLORS.present}
        />
        <StatCard
          icon={FiClock}
          label="Late"
          value={lateCount}
          subValue={reportData.isNonWorkingDay ? 'N/A' : (reportData.totalStudents > 0 ? `${Math.round((lateCount / reportData.totalStudents) * 100)}%` : '0%')}
          color={COLORS.late}
        />
        <StatCard
          icon={FiAlertTriangle}
          label="Absent"
          value={reportData.absentCount}
          subValue={reportData.isNonWorkingDay ? 'N/A' : (reportData.totalStudents > 0 ? `${Math.round((reportData.absentCount / reportData.totalStudents) * 100)}%` : '0%')}
          color={COLORS.absent}
        />
      </div>

      {/* Breakdown Section */}
      <div className="chart-section two-columns-wide">
        <div className="chart-card">
          <h3 className="chart-title">🏆 Class Performance</h3>
          <div className="logs-table-wrapper">
            <table className="logs-table compact">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Total</th>
                  <th>Present</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {classBreakdown.map((cls, idx) => (
                  <tr key={idx}>
                    <td><strong>{cls.name}</strong></td>
                    <td>{cls.total}</td>
                    <td>
                      <span className="text-success">{cls.present}</span>
                      {cls.late > 0 && <span className="text-warning text-xs ml-1">({cls.late} L)</span>}
                    </td>
                    <td>
                      <div className="flex-align-center">
                        <div className="progress-bar-mini">
                          <div className="progress-fill" style={{ width: `${cls.rate}%`, background: cls.rate >= 90 ? COLORS.present : cls.rate >= 75 ? COLORS.warning : COLORS.absent }}></div>
                        </div>
                        <span className="ml-2 font-bold">{cls.rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="chart-card">
          <h3 className="chart-title">Status Distribution</h3>
          <div className="chart-flex-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label>
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Lists */}
      <div className="columns-grid-2">
        {/* Absent List */}
        <div className="table-section">
          <h3 className="section-title text-danger"><FiAlertTriangle /> Absent Students ({reportData.absentCount})</h3>
          <div className="logs-table-wrapper scrollable-h-400">
            <table className="logs-table">
              <thead><tr><th>Name</th><th>Class</th><th>Roll No</th></tr></thead>
              <tbody>
                {reportData.absent?.map((s, i) => (
                  <tr key={s.id || i}>
                    <td>
                      <div className="student-cell">
                        <div className="avatar-sm danger">{s.full_name?.charAt(0)}</div>
                        <span>{s.full_name}</span>
                      </div>
                    </td>
                    <td>{s.class_name || s.grade}</td>
                    <td>{s.roll_number || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Late List */}
        <div className="table-section">
          <h3 className="section-title text-warning"><FiClock /> Late Arrivals ({lateCount})</h3>
          <div className="logs-table-wrapper scrollable-h-400">
            <table className="logs-table">
              <thead><tr><th>Name</th><th>Class</th><th>Time</th></tr></thead>
              <tbody>
                {reportData.present?.filter(s => s.status === 'late').map((s, i) => (
                  <tr key={s.id || i}>
                    <td>
                      <div className="student-cell">
                        <div className="avatar-sm warning">{s.full_name?.charAt(0)}</div>
                        <span>{s.full_name}</span>
                      </div>
                    </td>
                    <td>{s.class_name || s.grade}</td>
                    <td>{s.checkInTime ? new Date(s.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const renderStudentReport = () => {
  if (!reportData || !reportData.student) return null;
  const { student, statistics, logs } = reportData;
  const pieData = [
    { name: 'Present', value: statistics.presentDays },
    { name: 'Absent', value: statistics.absentDays },
    { name: 'Late', value: statistics.lateDays }
  ];

  // Calendar for Student
  const renderStudentCalendar = () => {
    if (!logs) return null;
    // Group logs by month
    // Simplifying to just show a grid of the requested range logs as blocks
    return (
      <div className="student-attendance-grid">
        {logs.map((log, i) => {
          const statusClass = log.status === 'present' ? 'present' : log.status === 'late' ? 'late' : log.status === 'absent' ? 'absent' : 'holiday';
          return (
            <div key={i} className={`att-block ${statusClass}`} title={`${new Date(log.date).toDateString()}: ${log.status}`}>
              <span className="att-date">{new Date(log.date).getDate()}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="report-content animated-in">
      <div className="student-profile-header">
        <div className="profile-avatar-lg">{student.full_name?.charAt(0)}</div>
        <div className="profile-details">
          <h2>{student.full_name}</h2>
          <p>{student.class_name} • Roll No: {student.roll_number || 'N/A'}</p>
        </div>
        <div className="profile-stats-row">
          <div className="p-stat">
            <span className="p-val">{statistics.attendanceRate}%</span>
            <span className="p-lbl">Attendance</span>
          </div>
          <div className="p-stat">
            <span className="p-val">{statistics.presentDays}</span>
            <span className="p-lbl">Present</span>
          </div>
          <div className="p-stat">
            <span className="p-val text-danger">{statistics.absentDays}</span>
            <span className="p-lbl">Absent</span>
          </div>
        </div>
      </div>

      <div className="chart-section two-columns-wide">
        <div className="chart-card">
          <h3 className="chart-title">Attendance Overview</h3>
          <div className="chart-flex-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                  <Cell fill={COLORS.present} />
                  <Cell fill={COLORS.absent} />
                  <Cell fill={COLORS.late} />
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Attendance Timeline</h3>
          <div className="timeline-container">
            {renderStudentCalendar()}
            <div className="cal-legend mt-2">
              <span className="dot" style={{ background: COLORS.present }}></span> Present
              <span className="dot" style={{ background: COLORS.late }}></span> Late
              <span className="dot" style={{ background: COLORS.absent }}></span> Absent
            </div>
          </div>
        </div>
      </div>

      <div className="logs-table-section">
        <h3 className="section-title">📅 Detailed Attendance History</h3>
        <div className="logs-table-wrapper">
          <table className="logs-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Status</th>
                <th>Arrival Time</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => {
                const time = log.check_in_time ? new Date(log.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
                let remarks = '-';
                if (log.status === 'late') remarks = 'Late Arrival';
                if (log.status === 'absent') remarks = 'Did not punch in';
                if (log.status === 'holiday') remarks = 'Holiday';

                return (
                  <tr key={idx} className={`row-${log.status}`}>
                    <td>{new Date(log.date).toLocaleDateString()}</td>
                    <td>{log.day}</td>
                    <td><span className={`status-badge ${log.status}`}>{log.status}</span></td>
                    <td className="font-mono">{time}</td>
                    <td className="text-sm text-gray">{remarks}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- ADDITIONAL REPORT COMPONENTS ---

const renderMonthlyReport = () => {
  if (!reportData || !reportData.summary) return null;
  const dailyChartData = reportData.dailyData?.slice(-15).map(day => ({ date: new Date(day.date).getDate(), attendance: day.percentage })) || [];
  const weeklyData = reportData.weeklyBreakdown?.map(week => ({ name: `W${week.weekNumber}`, attendance: week.avgAttendance })) || [];
  const classData = reportData.classWisePerformance?.slice(0, 10) || [];

  // Helper for Calendar Grid
  const renderCalendarGrid = () => {
    if (!reportData.dailyData) return null;
    const days = reportData.dailyData;
    return (
      <div className="calendar-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="cal-head">{d}</div>)}
        {days.map((day, i) => {
          const date = new Date(day.date);
          // 🛑 USE BACKEND FLAGS (Source of Truth)
          const isWeekend = day.isWeekend;
          const isHoliday = day.isHoliday;

          // Determine status class
          let statusClass = day.percentage >= 90 ? 'high' : day.percentage >= 75 ? 'med' : 'low';
          if (isHoliday) statusClass = 'holiday-bg'; // Ensure you have CSS for this or reuse something appropriate

          return (
            <div key={i} className={`cal-day ${statusClass} ${isWeekend ? 'weekend' : ''} ${isHoliday ? 'holiday' : ''}`} title={`${day.date}: ${day.percentage}% ${isHoliday ? '(Holiday)' : ''}`}>
              <span className="cal-date">{date.getDate()}</span>
              {/* Don't show percentage for Weekends OR Holidays unless there's data? usually 0% */}
              {!isWeekend && !isHoliday && <span className="cal-val">{day.percentage}%</span>}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="report-content animated-in">
      <div className="report-header-card gradient-primary">
        <div className="header-flex">
          <div>
            <h2>{reportData.monthName || 'Monthly Analysis'}</h2>
            <p>Comprehensive Report for {new Date(reportData.reportGeneratedAt).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="header-score">
            <span>{reportData.summary?.averageAttendance}%</span>
            <small>Month Avg</small>
          </div>
        </div>
      </div>

      {/* 1. Key Statistics */}
      <div className="report-grid-stats">
        <StatCard icon={FiUsers} label="Total Students" value={reportData.summary?.totalStudents} color={COLORS.primary} />
        <StatCard icon={FiClock} label="Working Days" value={reportData.summary?.totalWorkingDays} color={COLORS.info} />
        <StatCard
          icon={FiCheckCircle}
          label="On-Time Arrivals"
          value={reportData.summary?.totalOnTime || 0}
          subValue={reportData.summary?.punctualityRate ? `${reportData.summary.punctualityRate}%` : '0%'}
          color={COLORS.present}
        />
        <StatCard
          icon={FiClock}
          label="Late Arrivals"
          value={reportData.summary?.totalLate || 0}
          subValue={`${reportData.summary?.attendanceRate}% Overall`}
          color={COLORS.late}
        />
      </div>

      {/* 2. Charts Row: Trend + Gender */}
      <div className="chart-section two-columns">
        <div className="chart-card">
          <h3 className="chart-title">📈 Daily Attendance Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dailyChartData}>
              <defs><linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8} /><stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.1} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="attendance" stroke={COLORS.primary} fill="url(#colorAttendance)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3 className="chart-title">Gender Distribution</h3>
          <div className="chart-flex-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Male', value: reportData.genderBreakdown?.male?.attendanceRate || 0 },
                    { name: 'Female', value: reportData.genderBreakdown?.female?.attendanceRate || 0 }
                  ]}
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill={COLORS.info} />
                  <Cell fill={COLORS.purple} />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="gender-stats">
              <small>Male Avg: <strong>{reportData.genderBreakdown?.male?.attendanceRate}%</strong></small>
              <small>Female Avg: <strong>{reportData.genderBreakdown?.female?.attendanceRate}%</strong></small>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Class Performance & Calendar */}
      <div className="chart-section two-columns-wide">
        <div className="chart-card">
          <h3 className="chart-title">🏆 Class Performance Ranking</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={classData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis dataKey="className" type="category" width={80} tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ fill: 'transparent' }} />
              <Bar dataKey="attendanceRate" fill={COLORS.present} barSize={20} radius={[0, 10, 10, 0]}>
                {classData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.attendanceRate >= 90 ? COLORS.present : entry.attendanceRate >= 75 ? COLORS.info : COLORS.warning} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3 className="chart-title">📅 Month at a Glance</h3>
          {renderCalendarGrid()}
          <div className="cal-legend">
            <span className="dot high"></span> 90%+
            <span className="dot med"></span> 75-89%
            <span className="dot low"></span> &lt;75%
          </div>
        </div>
      </div>

      {/* 4. Critical Alerts */}
      {reportData.alerts?.studentsNeedingAttention?.length > 0 && (
        <div className="section-alert margin-top">
          <h3 className="section-title text-danger"><FiAlertTriangle /> Critical Attention Required ({reportData.alerts.studentsNeedingAttention.length})</h3>
          <div className="student-alert-list">
            {reportData.alerts.studentsNeedingAttention.slice(0, 8).map(s => (
              <div key={s.id} className="student-alert-card">
                <div className="student-alert-avatar">{s.full_name.charAt(0)}</div>
                <div className="student-alert-info">
                  <span className="student-alert-name">{s.full_name}</span>
                  <span className="student-alert-class">{s.class_name || s.grade}</span>
                </div>
                <div className="student-alert-stats">
                  <span className="alert-percentage">{s.attendanceRate}%</span>
                  <span className="alert-days">{s.absentDays} days absent</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const renderDayPattern = () => {
  if (!reportData || !reportData.dayWiseData) return null;
  const radarData = reportData.dayWiseData;

  return (
    <div className="report-content animated-in">
      <div className="report-grid-stats">
        <StatCard icon={FiCheckCircle} label="Best Day" value={reportData.bestDay} color={COLORS.present} />
        <StatCard icon={FiAlertTriangle} label="Hardest Day" value={reportData.worstDay} color={COLORS.absent} />
      </div>
      <div className="chart-section two-columns">
        <div className="chart-card">
          <h3 className="chart-title">Day-wise Attendance Pattern</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="day" />
              <PolarRadiusAxis angle={30} domain={[0, 100]} />
              <Radar name="Attendance %" dataKey="avgAttendance" stroke={COLORS.purple} fill={COLORS.purple} fillOpacity={0.6} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Average by Day</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={radarData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="avgAttendance" fill={COLORS.info} radius={[8, 8, 0, 0]}>
                {radarData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.day === reportData.bestDay ? COLORS.present : entry.day === reportData.worstDay ? COLORS.absent : COLORS.info} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const renderLowAttendance = () => {
  if (!reportData) return null;
  return (
    <div className="report-content animated-in">
      <div className="report-header-card gradient-danger">
        <h2>⚠️ Low Attendance Alert</h2>
        <p>{reportData.studentsCount} Students below {reportData.threshold}% Threshold</p>
      </div>
      <div className="table-section">
        <div className="logs-table-wrapper">
          <table className="logs-table">
            <thead><tr><th>ID</th><th>Student Name</th><th>Present</th><th>Absent</th><th>Rate</th></tr></thead>
            <tbody>
              {reportData.students?.map(s => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td><strong>{s.full_name}</strong><br /><small>{s.class_name || s.grade}</small></td>
                  <td className="text-success">{s.present}</td>
                  <td className="text-danger">{s.absentDays}</td>
                  <td><span className="status-badge absent">{s.attendanceRate}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const renderPerfectAttendance = () => {
  if (!reportData) return null;
  return (
    <div className="report-content animated-in">
      <div className="report-header-card gradient-success">
        <h2>🏆 Perfect Attendance</h2>
        <p>{reportData.studentsCount} Students with 100% Attendance</p>
      </div>
      <div className="student-grid mt-4">
        {reportData.students?.map(s => (
          <div key={s.id} className="student-card perfect-card">
            <div className="student-avatar" style={{ background: COLORS.present }}>{s.full_name?.charAt(0)}</div>
            <div className="student-info">
              <span className="student-name">{s.full_name}</span>
              <span className="student-class">{s.class_name || s.grade}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const renderTeacherPerformance = () => {
  if (!reportData || !reportData.teachers) return null;
  return (
    <div className="report-content animated-in">
      <div className="chart-section">
        <h3 className="section-title">👨‍🏫 Teacher Class Performance</h3>
        <div className="class-ranking-list">
          {reportData.teachers.map((t, idx) => (
            <div key={idx} className="ranking-item">
              <span className="rank-badge">{idx + 1}</span>
              <div style={{ flex: 1 }}>
                <span className="rank-name" style={{ display: 'block' }}>{t.teacherName}</span>
                <span style={{ fontSize: '12px', color: '#666' }}>Class: {t.className}</span>
              </div>
              <div className="rank-bar-wrapper" style={{ maxWidth: '200px' }}>
                <div className="rank-bar" style={{ width: `${t.attendanceRate}%`, background: parseFloat(t.attendanceRate) > 90 ? COLORS.present : COLORS.primary }}></div>
              </div>
              <span className="rank-value">{t.attendanceRate}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const renderLateArrivalAnalysis = () => {
  if (!reportData) return null;
  const timeData = Object.entries(reportData.timeDistribution || {}).map(([key, val]) => ({ time: key, count: val }));
  return (
    <div className="report-content animated-in">
      <div className="report-grid-stats">
        <StatCard icon={FiClock} label="Total Late" value={reportData.totalLate} color={COLORS.orange} />
        <StatCard icon={FiAlertTriangle} label="Peak Time" value={reportData.peakTime} color={COLORS.absent} />
      </div>
      <div className="chart-section">
        <div className="chart-card full-width">
          <h3 className="chart-title">⏰ Late Arrival Time Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timeData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="time" /><YAxis /><Tooltip /><Bar dataKey="count" fill={COLORS.orange} radius={[8, 8, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const renderSmsAnalytics = () => {
  if (!reportData) return null;
  const data = [{ name: 'Delivered', value: reportData.delivered }, { name: 'Failed', value: reportData.failed }];
  return (
    <div className="report-content animated-in">
      <div className="report-grid-stats">
        <StatCard icon={FiMessageSquare} label="Total Sent" value={reportData.totalSent} color={COLORS.purple} />
        <StatCard icon={FiCheckCircle} label="Delivered" value={reportData.delivered} subValue="98%" color={COLORS.present} />
        <StatCard icon={FiAlertTriangle} label="Failed" value={reportData.failed} color={COLORS.absent} />
      </div>
      <div className="chart-section two-columns">
        <div className="chart-card">
          <h3 className="chart-title">Delivery Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart><Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="value" label><Cell fill={COLORS.present} /><Cell fill={COLORS.absent} /></Pie><Tooltip /><Legend /></PieChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card centered-content">
          <h3 className="chart-title">💰 Estimated Cost</h3>
          <div style={{ fontSize: '48px', fontWeight: 'bold', color: COLORS.purple }}>${reportData.costEstimate}</div>
          <p>Based on current usage</p>
        </div>
      </div>
    </div>
  );
};

const renderGeneralReport = () => (
  <div className="report-content">
    <div className="json-dump">
      <pre>{JSON.stringify(reportData, null, 2)}</pre>
    </div>
  </div>
);

/* --- CLASS REPORT --- */
// ---- EXPORT FUNCTIONS ----

const getSelectedSectionName = () => {
  const sec = sections.find(s => String(s.id) === String(selectedClass));
  return sec ? `${sec.class_name} - ${sec.section_name}` : 'Class Report';
};

const getFilenameBase = () => {
  const sec = sections.find(s => String(s.id) === String(selectedClass));
  const name = sec ? `${sec.class_name}_${sec.section_name}`.replace(/\s+/g, '') : 'ClassReport';
  const range = `${dateRange.startDate}_to_${dateRange.endDate}`;
  return `${name}_${range}`;
};

const exportClassReportPDF = () => {
  if (!reportData) return;
  const { classInfo, attendanceStats, students } = reportData;
  const stats = attendanceStats || {};
  const studentList = students || [];
  const sectionName = getSelectedSectionName();

  const doc = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Class Attendance Report', pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text(sectionName, pageWidth / 2, 26, { align: 'center' });

  doc.setFontSize(10);
  doc.text(`Date Range: ${dateRange.startDate} to ${dateRange.endDate}`, pageWidth / 2, 33, { align: 'center' });

  // Summary stats
  const summaryY = 42;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Students: ${classInfo?.totalStudents || studentList.length}`, 14, summaryY);
  doc.text(`Attendance Rate: ${stats.attendanceRate || 0}%`, 80, summaryY);
  doc.text(`Working Days: ${stats.totalWorkingDays || '-'}`, 155, summaryY);
  doc.text(`Present: ${stats.present || 0}  |  Absent: ${stats.absent || 0}  |  Late: ${stats.late || 0}  |  Leave: ${stats.onLeave || 0}`, 14, summaryY + 7);

  // Student table
  const tableData = studentList.map(s => [
    s.rollNumber || '-',
    s.name,
    s.present || 0,
    s.absent || 0,
    s.late || 0,
    s.onLeave || 0,
    `${s.attendanceRate || 0}%`
  ]);

  autoTable(doc, {
    head: [['Roll No', 'Name', 'Present', 'Absent', 'Late', 'Leave', 'Rate']],
    body: tableData,
    startY: summaryY + 14,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 60 },
      6: { fontStyle: 'bold' }
    }
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on ${new Date().toLocaleString('en-IN')}  |  Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
  }

  doc.save(`${getFilenameBase()}.pdf`);
};

const exportClassReportExcel = () => {
  if (!reportData) return;
  const { classInfo, attendanceStats, students } = reportData;
  const stats = attendanceStats || {};
  const studentList = students || [];
  const sectionName = getSelectedSectionName();

  // Summary rows
  const summaryData = [
    ['Class Attendance Report'],
    [sectionName],
    [`Date Range: ${dateRange.startDate} to ${dateRange.endDate}`],
    [],
    ['Total Students', classInfo?.totalStudents || studentList.length, '', 'Attendance Rate', `${stats.attendanceRate || 0}%`, '', 'Working Days', stats.totalWorkingDays || '-'],
    ['Present', stats.present || 0, '', 'Absent', stats.absent || 0, '', 'Late', stats.late || 0, '', 'Leave', stats.onLeave || 0],
    [],
    ['Roll No', 'Name', 'Present', 'Absent', 'Late', 'Leave', 'Rate (%)']
  ];

  // Student rows
  const studentRows = studentList.map(s => [
    s.rollNumber || '-',
    s.name,
    s.present || 0,
    s.absent || 0,
    s.late || 0,
    s.onLeave || 0,
    s.attendanceRate || 0
  ]);

  const wsData = [...summaryData, ...studentRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 10 }, // Roll No
    { wch: 30 }, // Name
    { wch: 10 }, // Present
    { wch: 10 }, // Absent
    { wch: 10 }, // Late
    { wch: 10 }, // Leave
    { wch: 12 }, // Rate
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');
  XLSX.writeFile(wb, `${getFilenameBase()}.xlsx`);
};

const generateAllSectionsReports = async () => {
  try {
    if (!sections || sections.length === 0) {
      alert("No sections available to generate reports for.");
      return;
    }

    setIsGeneratingAll(true);
    setGenerateProgress(0);
    const zip = new JSZip();
    const folderName = `School_Reports_${dateRange.startDate}_to_${dateRange.endDate}`;
    const reportsFolder = zip.folder(folderName);

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      // 1. Fetch data for this specific section
      const response = await reportsAPI.getClassReport(section.id, {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });

      if (response.success && response.data) {
        const { classInfo, attendanceStats, students } = response.data;
        const stats = attendanceStats || {};
        const studentList = students || [];
        const sectionName = `${section.class_name || ''} - ${section.section_name || section.name}`.trim();

        // 2. Generate PDF
        const doc = new jsPDF('landscape', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Class Attendance Report', pageWidth / 2, 18, { align: 'center' });

        doc.setFontSize(13);
        doc.setFont('helvetica', 'normal');
        doc.text(sectionName, pageWidth / 2, 26, { align: 'center' });

        doc.setFontSize(10);
        doc.text(`Date Range: ${dateRange.startDate} to ${dateRange.endDate}`, pageWidth / 2, 33, { align: 'center' });

        // Summary stats
        const summaryY = 42;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total Students: ${classInfo?.totalStudents || studentList.length}`, 14, summaryY);
        doc.text(`Attendance Rate: ${stats.attendanceRate || 0}%`, 80, summaryY);
        doc.text(`Working Days: ${stats.totalWorkingDays || '-'}`, 155, summaryY);
        doc.text(`Present: ${stats.present || 0}  |  Absent: ${stats.absent || 0}  |  Late: ${stats.late || 0}  |  Leave: ${stats.onLeave || 0}`, 14, summaryY + 7);

        // Student table
        const tableData = studentList.map(s => [
          s.rollNumber || '-',
          s.name,
          s.present || 0,
          s.absent || 0,
          s.late || 0,
          s.onLeave || 0,
          `${s.attendanceRate || 0}%`
        ]);

        autoTable(doc, {
          head: [['Roll No', 'Name', 'Present', 'Absent', 'Late', 'Leave', 'Rate']],
          body: tableData,
          startY: summaryY + 14,
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 60 },
            6: { fontStyle: 'bold' }
          }
        });

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let p = 1; p <= pageCount; p++) {
          doc.setPage(p);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(`Generated on ${new Date().toLocaleString('en-IN')}  |  Page ${p} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
        }

        // 3. Add to ZIP
        const pdfBlob = doc.output('blob');
        const safeFilename = `${sectionName.replace(/[^a-z0-9]/gi, '_')}_Report.pdf`;
        reportsFolder.file(safeFilename, pdfBlob);
      }

      // Update progress
      setGenerateProgress(Math.round(((i + 1) / sections.length) * 100));
    }

    // 4. Generate and download ZIP
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `${folderName}.zip`);

  } catch (error) {
    console.error('Error generating bulk reports:', error);
    alert('An error occurred while generating reports. Please try again.');
  } finally {
    setIsGeneratingAll(false);
    setGenerateProgress(0);
  }
};

const renderClassReport = () => {
  if (!reportData) return null;
  const { classInfo, attendanceStats, students } = reportData;

  // Use safe defaults if data is missing
  const stats = attendanceStats || {};
  const studentList = students || [];

  // Prepare data for Chart
  const chartData = [
    { name: 'Present', value: parseInt(stats.present || 0), fill: '#10B981' },
    { name: 'Absent', value: parseInt(stats.absent || 0), fill: '#EF4444' },
    { name: 'Late', value: parseInt(stats.late || 0), fill: '#F59E0B' },
    { name: 'Leave', value: parseInt(stats.onLeave || 0), fill: '#6366F1' },
  ];

  return (
    <div className="report-content">
      {/* Header Stats */}
      <div className="stats-grid">
        <StatCard
          label="Total Students"
          value={classInfo?.totalStudents || studentList.length || 0}
          icon={FaUsers}
          color="blue"
        />
        <StatCard
          label="Attendance Rate"
          value={`${stats.attendanceRate || 0}%`}
          icon={FaChartLine}
          color="green"
        />
        <StatCard
          label="Usually Late"
          value={stats.late || 0}
          icon={FaClock}
          color="orange"
        />
        <StatCard
          label="Chronic Absent"
          value={stats.absent || 0}
          icon={FaUserTimes}
          color="red"
        />
      </div>

      {/* Daily Attendance Bar Chart - Full Width */}
      {reportData.dailyBreakdown && reportData.dailyBreakdown.length > 0 && (
        <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
          <h3>📊 Daily Attendance Breakdown</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={reportData.dailyBreakdown} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                />
                <Legend />
                <Bar dataKey="present" name="Present" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="late" name="Late" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" name="Absent" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="charts-row three-cols">
        {/* Attendance Rate Trend */}
        {reportData.dailyBreakdown && reportData.dailyBreakdown.length > 0 && (
          <div className="chart-card col-span-2">
            <h3>📈 Attendance Rate Trend</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={reportData.dailyBreakdown}>
                  <defs>
                    <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} unit="%" />
                  <Tooltip
                    formatter={(value) => [`${value}%`, 'Rate']}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fill="url(#colorRate)"
                    dot={{ fill: '#6366f1', r: 4, strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{
                      r: 6
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Pie Chart */}
        <div className="chart-card">
          <h3>Attendance Distribution</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Student List */}
      <div className="chart-card col-span-2">
        <div className="report-table-header">
          <h3>Student Performance ({studentList.length})</h3>
          <div className="export-actions">
            <button
              className="btn-export btn-primary"
              onClick={generateAllSectionsReports}
              disabled={isGeneratingAll}
              title="Download a ZIP of all sections"
              style={{ marginRight: '10px' }}
            >
              {isGeneratingAll ? `Generating ZIP (${generateProgress}%)...` : <><FiDownload size={16} /> Generate All Sections (ZIP)</>}
            </button>
            <button className="btn-export btn-pdf" onClick={exportClassReportPDF} title="Export this section to PDF" disabled={isGeneratingAll}>
              <FiFileText size={16} /> PDF
            </button>
            <button className="btn-export btn-excel" onClick={exportClassReportExcel} title="Export this section to Excel" disabled={isGeneratingAll}>
              <FiDownload size={16} /> Excel
            </button>
          </div>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Roll No</th>
                <th>Name</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Late</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {studentList.map((student, idx) => (
                <tr key={idx}>
                  <td>{student.rollNumber}</td>
                  <td className="font-medium">{student.name}</td>
                  <td className="text-green">{student.present || 0}</td>
                  <td className="text-red">{student.absent || 0}</td>
                  <td className="text-orange">{student.late || 0}</td>
                  <td>
                    <span className={`status-badge ${(student.attendanceRate || 0) >= 75 ? 'success' : 'danger'}`}>
                      {student.attendanceRate || 0}%
                    </span>
                  </td>
                </tr>
              ))}
              {studentList.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center">No student data available for this range.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* --- WEEKLY SUMMARY REPORT --- */
const renderWeeklySummary = () => {
  if (!reportData) return null;
  const { weeklyStats, classData } = reportData;

  // weeklyStats should be array of { date, present, absent, late }
  // classData should be array of { className, attendanceRate }

  return (
    <div className="report-content">
      {/* Weekly Trend Chart */}
      <div className="chart-card full-width">
        <h3>Weekly Attendance Trend</h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyStats || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Legend />
              <Bar dataKey="present" name="Present" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="late" name="Late" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="absent" name="Absent" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Class Performance Table */}
      <div className="chart-card">
        <h3>Class Performance This Week</h3>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Attendance Rate</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>
              {(classData || []).map((cls, idx) => (
                <tr key={idx}>
                  <td className="font-medium">{cls.className}</td>
                  <td>{cls.attendanceRate}%</td>
                  <td style={{ width: '40%' }}>
                    <div className="mini-progress-bar">
                      <div
                        className={`progress-fill ${cls.attendanceRate >= 80 ? 'good' : cls.attendanceRate >= 60 ? 'average' : 'poor'}`}
                        style={{ width: `${cls.attendanceRate}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {(!classData || classData.length === 0) && (
                <tr><td colSpan="3" className="text-center">No class data available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Main Render Switch
const renderReportContent = () => {
  switch (reportType) {
    case 'daily': return renderDailyReport();
    case 'monthly': return renderMonthlyReport();
    case 'student': return renderStudentReport();
    case 'class': return renderClassReport();
    case 'weekly': return renderWeeklySummary();
    case 'lowAttendance': return renderLowAttendance();
    case 'perfect': return renderPerfectAttendance();
    case 'dayPattern': return renderDayPattern();
    case 'teacherPerf': return renderTeacherPerformance();
    case 'lateArrival': return renderLateArrivalAnalysis();
    case 'smsStats': return renderSmsAnalytics();
    case 'comparison': return renderGeneralReport(); // Keeping as placeholder
    default: return renderGeneralReport();
  }
};

const currentReportDef = reportTypes.find(r => r.value === reportType);

return (
  <div className="reports-page">
    <div className="reports-hero">
      <div className="hero-content">
        <h1>📊 Advanced Analytics</h1>
        <p>Generate detailed insights and track performance metrics</p>
      </div>
    </div>

    <div className="report-types-scroll">
      {reportTypes.map(type => (
        <button
          key={type.value}
          className={`type-pill ${reportType === type.value ? 'active' : ''}`}
          onClick={() => { setReportType(type.value); setReportData(null); }}
          style={{ borderColor: reportType === type.value ? type.color : 'transparent', color: reportType === type.value ? type.color : 'inherit' }}
        >
          <type.icon size={16} /> {type.label}
        </button>
      ))}
    </div>

    <div className="filters-section">
      <div className="filters-card">
        <div className="filters-grid">
          {/* DYNAMIC FILTERS BASED ON REPORT TYPE */}

          {currentReportDef?.filters.includes('date') && (
            <div className="filter-group">
              <label>Select Date</label>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
            </div>
          )}

          {currentReportDef?.filters.includes('month') && (
            <div className="filter-group double-input">
              <div>
                <label>Year</label>
                <select value={selectedMonth.year} onChange={e => setSelectedMonth({ ...selectedMonth, year: e.target.value })}>
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label>Month</label>
                <select value={selectedMonth.month} onChange={e => setSelectedMonth({ ...selectedMonth, month: e.target.value })}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>)}
                </select>
              </div>
            </div>
          )}

          {(currentReportDef?.filters.includes('startDate') || currentReportDef?.filters.includes('range')) && (
            <div className="filter-group">
              <label>Start Date</label>
              <input type="date" value={dateRange.startDate} onChange={e => setDateRange({ ...dateRange, startDate: e.target.value })} />
            </div>
          )}

          {currentReportDef?.filters.includes('range') && (
            <div className="filter-group">
              <label>End Date</label>
              <input type="date" value={dateRange.endDate} onChange={e => setDateRange({ ...dateRange, endDate: e.target.value })} />
            </div>
          )}

          {(currentReportDef?.filters.includes('class') || currentReportDef?.filters.includes('student')) && (
            <div className="filter-group">
              <label>Select Class</label>
              <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedStudent(''); }}>
                <option value="">-- Choose Class --</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.class_name} - {s.section_name}</option>)}
              </select>
            </div>
          )}

          {currentReportDef?.filters.includes('student') && (
            <div className="filter-group">
              <label>Select Student</label>
              <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} disabled={!selectedClass}>
                <option value="">-- Choose Student --</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
          )}

          <div className="filter-actions">
            <button className="btn-primary" onClick={generateReport} disabled={loading}>
              {loading ? <span className="loader"></span> : <><FiSearch /> Generate Report</>}
            </button>
          </div>
        </div>
      </div>
    </div>

    {reportData && <div className="results-container">{renderReportContent()}</div>}

    {!reportData && !loading && (
      <div className="empty-state">
        <FiBarChart2 size={48} color="#cbd5e1" />
        <p>Select filters and click Generate to view advanced analytics</p>
      </div>
    )}
  </div>
);
};

export default Reports;
