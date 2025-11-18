import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiUsers,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiAlertCircle,
  FiTrendingUp,
  FiCalendar,
  FiBarChart2,
  FiActivity,
  FiAward,
  FiZap,
  FiArrowUp,
  FiArrowDown
} from 'react-icons/fi';
import { statsAPI, attendanceAPI, classesAPI } from '../utils/api';
import './EnhancedDashboard.css';

const EnhancedDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    attendanceRate: 0
  });
  const [classStats, setClassStats] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState([]);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [topPerformers, setTopPerformers] = useState([]);

  // Fetch all dashboard data (stats, classes, activity) - called on initial load and manual refresh
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch main stats
      const statsResponse = await statsAPI.getDashboardStats();
      if (statsResponse.success) {
        const data = statsResponse.data;
        // Calculate attendance rate: Late students ARE present!
        const attendanceRate = data.totalStudents > 0
          ? Math.round(((data.presentToday + data.lateToday) / data.totalStudents) * 100)
          : 0;

        setStats({
          ...data,
          attendanceRate
        });
      }

      // Fetch class-wise stats
      const classesResponse = await classesAPI.getAll({ include: 'sections' });
      if (classesResponse.success) {
        const classesData = classesResponse.data.classes || [];
        // Mock class-wise attendance data (in real app, fetch from backend)
        const classStatsData = classesData.slice(0, 5).map((cls) => ({
          className: cls.class_name,
          totalStudents: cls.total_students || 0,
          present: Math.floor((cls.total_students || 0) * (0.85 + Math.random() * 0.15)),
          absent: 0,
          attendancePercentage: 0
        }));

        classStatsData.forEach(cls => {
          cls.absent = cls.totalStudents - cls.present;
          cls.attendancePercentage = cls.totalStudents > 0
            ? Math.round((cls.present / cls.totalStudents) * 100)
            : 0;
        });

        setClassStats(classStatsData);
        
        // Generate top performers from classStatsData
        generateTopPerformers(classStatsData);
      }

      // Fetch recent attendance activity
      const activityResponse = await attendanceAPI.getToday();
      if (activityResponse.success) {
        const logs = activityResponse.data.logs || [];
        setRecentActivity(logs.slice(0, 10));
      }

      // Generate alerts
      generateAlerts(statsResponse.data);

      // Generate weekly data for chart
      generateWeeklyData();
      
      // Generate monthly trend
      generateMonthlyTrend();
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ⚡ PERFORMANCE: Only refresh live activity feed, NOT all stats
  // This reduces load by 70% - activity feed updates frequently, stats don't change often
  const fetchActivityFeed = useCallback(async () => {
    try {
      const activityResponse = await attendanceAPI.getToday();
      if (activityResponse.success) {
        const logs = activityResponse.data.logs || [];
        setRecentActivity(logs.slice(0, 10));
      }
    } catch (err) {
      console.error('Error fetching activity feed:', err);
      // Don't show error to user for background refresh
    }
  }, []);

  useEffect(() => {
    // Load all data on initial mount
    fetchDashboardData();

    // ⚡ PERFORMANCE FIX: Only auto-refresh activity feed, not ALL stats
    // Stats/classes don't change frequently, but activity feed needs live updates
    // This reduces server load by ~70% (1 API call vs 3 API calls every 30s)
    const activityInterval = setInterval(fetchActivityFeed, 30000);

    return () => clearInterval(activityInterval);
  }, [fetchDashboardData, fetchActivityFeed]);

  const generateAlerts = (data) => {
    const alertsData = [];

    if (data.absentToday > 50) {
      alertsData.push({
        type: 'danger',
        message: `${data.absentToday} students absent today - Higher than normal`,
        icon: FiAlertCircle
      });
    }

    if (data.lateToday > 20) {
      alertsData.push({
        type: 'warning',
        message: `${data.lateToday} students late today`,
        icon: FiClock
      });
    }

    setAlerts(alertsData);
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const getCurrentGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const generateWeeklyData = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = days.map(day => ({
      day,
      present: Math.floor(Math.random() * 30) + 70,
      absent: Math.floor(Math.random() * 15) + 5,
      late: Math.floor(Math.random() * 10) + 3
    }));
    setWeeklyData(data);
  };

  const generateMonthlyTrend = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const data = months.map(month => ({
      month,
      rate: Math.floor(Math.random() * 10) + 85
    }));
    setMonthlyTrend(data);
  };

  const generateTopPerformers = (classData) => {
    const sorted = [...classData].sort((a, b) => b.attendancePercentage - a.attendancePercentage);
    setTopPerformers(sorted.slice(0, 3));
  };

  if (loading) {
    return (
      <div className="enhanced-dashboard">
        <div className="loading-container">
          <div className="skeleton stat-card" style={{ height: '120px' }}></div>
          <div className="skeleton stat-card" style={{ height: '120px' }}></div>
          <div className="skeleton stat-card" style={{ height: '120px' }}></div>
          <div className="skeleton stat-card" style={{ height: '120px' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="enhanced-dashboard">
      {/* Header Section */}
      <div className="dashboard-top-header">
        <div>
          <h1 className="dashboard-greeting">{getCurrentGreeting()}! 👋</h1>
          <p className="dashboard-date">
            <FiCalendar size={16} />
            {getCurrentDate()}
          </p>
        </div>
        <button className="btn btn-primary" onClick={fetchDashboardData}>
          <FiActivity />
          Refresh Data
        </button>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="alerts-section">
          {alerts.map((alert, index) => {
            const Icon = alert.icon;
            return (
              <div key={index} className={`alert-card alert-${alert.type}`}>
                <Icon className="alert-icon" />
                <p className="alert-message">{alert.message}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats Grid - Enhanced */}
      <div className="stats-grid-enhanced">
        <div className="stat-card-modern primary-gradient">
          <div className="stat-card-header">
            <div className="stat-icon-modern primary-icon">
              <FiUsers size={24} />
            </div>
            <FiTrendingUp className="trend-icon" size={16} />
          </div>
          <div className="stat-card-content">
            <p className="stat-label-modern">Total Students</p>
            <h2 className="stat-value-modern">{stats.totalStudents}</h2>
            <p className="stat-subtitle">Active enrollment</p>
          </div>
        </div>

        <div className="stat-card-modern success-gradient">
          <div className="stat-card-header">
            <div className="stat-icon-modern success-icon">
              <FiCheckCircle size={24} />
            </div>
            <div className="trend-badge positive">
              <FiArrowUp size={12} />
              {stats.attendanceRate}%
            </div>
          </div>
          <div className="stat-card-content">
            <p className="stat-label-modern">Present Today</p>
            <h2 className="stat-value-modern">{stats.presentToday + stats.lateToday}</h2>
            <p className="stat-subtitle">On-time: {stats.presentToday} | Late: {stats.lateToday}</p>
          </div>
        </div>

        <div className="stat-card-modern danger-gradient">
          <div className="stat-card-header">
            <div className="stat-icon-modern danger-icon">
              <FiXCircle size={24} />
            </div>
            <div className="trend-badge negative">
              <FiArrowDown size={12} />
              {stats.totalStudents > 0
                ? `${Math.round((stats.absentToday / stats.totalStudents) * 100)}%`
                : '0%'}
            </div>
          </div>
          <div className="stat-card-content">
            <p className="stat-label-modern">Absent Today</p>
            <h2 className="stat-value-modern">{stats.absentToday}</h2>
            <p className="stat-subtitle">Students missing</p>
          </div>
        </div>

        <div className="stat-card-modern warning-gradient">
          <div className="stat-card-header">
            <div className="stat-icon-modern warning-icon">
              <FiClock size={24} />
            </div>
            <div className="trend-badge warning-badge">
              <FiClock size={12} />
              {(stats.presentToday + stats.lateToday) > 0
                ? `${Math.round((stats.lateToday / (stats.presentToday + stats.lateToday)) * 100)}%`
                : '0%'}
            </div>
          </div>
          <div className="stat-card-content">
            <p className="stat-label-modern">Late Today</p>
            <h2 className="stat-value-modern">{stats.lateToday}</h2>
            <p className="stat-subtitle">Arrived after bell</p>
          </div>
        </div>
      </div>

      {/* Today's Attendance Rate */}
      <div className="dashboard-card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="card-title" style={{ marginBottom: '1rem' }}>
          📊 Today's Attendance Rate
        </h3>
        <div style={{ background: '#f3f4f6', borderRadius: '12px', padding: '8px', marginBottom: '12px' }}>
          <div
            style={{
              height: '40px',
              background: stats.attendanceRate >= 90 ? '#16a34a' : stats.attendanceRate >= 75 ? '#f59e0b' : '#dc2626',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: '700',
              fontSize: '1.25rem',
              width: `${stats.attendanceRate}%`,
              transition: 'all 0.3s ease',
              minWidth: '60px'
            }}
          >
            {stats.attendanceRate}%
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280' }}>
          <span>Present: {stats.presentToday}</span>
          <span>Late: {stats.lateToday}</span>
          <span>Absent: {stats.absentToday}</span>
          <span>Total: {stats.totalStudents}</span>
        </div>
      </div>

      {/* Attendance Overview Chart */}
      <div className="chart-section">
        <div className="dashboard-card chart-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">
                <FiBarChart2 className="inline-icon" />
                Weekly Attendance Overview
              </h3>
              <p className="text-sm text-gray-600">Last 6 days attendance breakdown</p>
            </div>
          </div>
          <div className="weekly-chart">
            {weeklyData.map((day, index) => (
              <div key={index} className="day-column">
                <div className="bars-container">
                  <div 
                    className="bar bar-present" 
                    style={{ height: `${day.present}%` }}
                    title={`Present: ${day.present}%`}
                  >
                    <span className="bar-label">{day.present}</span>
                  </div>
                  <div 
                    className="bar bar-late" 
                    style={{ height: `${day.late}%` }}
                    title={`Late: ${day.late}%`}
                  >
                    <span className="bar-label">{day.late}</span>
                  </div>
                  <div 
                    className="bar bar-absent" 
                    style={{ height: `${day.absent}%` }}
                    title={`Absent: ${day.absent}%`}
                  >
                    <span className="bar-label">{day.absent}</span>
                  </div>
                </div>
                <p className="day-label">{day.day}</p>
              </div>
            ))}
          </div>
          <div className="chart-legend">
            <div className="legend-item">
              <span className="legend-dot present-dot"></span>
              <span>Present</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot late-dot"></span>
              <span>Late</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot absent-dot"></span>
              <span>Absent</span>
            </div>
          </div>
        </div>

        {/* Monthly Trend Chart */}
        <div className="dashboard-card chart-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">
                <FiTrendingUp className="inline-icon" />
                6-Month Attendance Trend
              </h3>
              <p className="text-sm text-gray-600">Overall attendance rate</p>
            </div>
          </div>
          <div className="trend-chart">
            {monthlyTrend.map((month, index) => (
              <div key={index} className="trend-bar-wrapper">
                <div className="trend-bar-bg">
                  <div 
                    className="trend-bar-fill"
                    style={{ width: `${month.rate}%` }}
                  >
                    <span className="trend-value">{month.rate}%</span>
                  </div>
                </div>
                <p className="month-label">{month.month}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-content-grid">
        {/* Class-wise Breakdown */}
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">
                <FiBarChart2 className="inline-icon" />
                Class-wise Attendance
              </h3>
              <p className="text-sm text-gray-600">Today's attendance by class</p>
            </div>
          </div>
          <div className="class-stats-list">
            {classStats.length > 0 ? (
              classStats.map((cls, index) => (
                <div key={index} className="class-stat-item">
                  <div className="class-info">
                    <p className="class-name">{cls.className}</p>
                    <p className="class-detail text-sm text-gray-600">
                      {cls.totalStudents} students
                    </p>
                  </div>
                  <div className="class-attendance">
                    <div className="attendance-bar-container">
                      <div
                        className="attendance-bar"
                        style={{ width: `${cls.attendancePercentage}%` }}
                      />
                    </div>
                    <div className="attendance-numbers">
                      <span className="text-success">{cls.present} Present</span>
                      <span className="text-danger">{cls.absent} Absent</span>
                      <span className="text-bold">{cls.attendancePercentage}%</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center">No class data available</p>
            )}
          </div>
        </div>

        {/* Live Activity Feed - Enhanced */}
        <div className="dashboard-card activity-card-modern">
          <div className="card-header">
            <div>
              <h3 className="card-title">
                <FiActivity className="inline-icon" />
                Live Activity Feed
              </h3>
              <p className="text-sm text-gray-600">Recent attendance logs</p>
            </div>
            <span className="live-indicator-modern">
              <span className="pulse-dot"></span>
              Live
            </span>
          </div>
          <div className="activity-feed-modern">
            {recentActivity.length > 0 ? (
              recentActivity.map((log, index) => (
                <div key={index} className="activity-item-modern slide-in" style={{ animationDelay: `${index * 0.05}s` }}>
                  <div className="activity-avatar">
                    {log.student_name ? log.student_name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div className="activity-info">
                    <p className="activity-name">{log.student_name || 'Unknown Student'}</p>
                    <p className="activity-meta">
                      <span>{log.class_name} - {log.section_name}</span>
                      <span className="activity-time-dot">•</span>
                      <span>{formatTime(log.time)}</span>
                    </p>
                  </div>
                  <div className={`status-pill status-${log.status}`}>
                    {log.status === 'present' ? (
                      <><FiCheckCircle size={14} /> Present</>
                    ) : log.status === 'late' ? (
                      <><FiClock size={14} /> Late</>
                    ) : (
                      <><FiXCircle size={14} /> Absent</>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <FiActivity size={48} className="empty-icon" />
                <p>No activity yet today</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Performers Section */}
      <div className="dashboard-card performers-card">
        <div className="card-header">
          <div>
            <h3 className="card-title">
              <FiAward className="inline-icon" />
              Top Performing Classes
            </h3>
            <p className="text-sm text-gray-600">Best attendance rates today</p>
          </div>
        </div>
        <div className="performers-grid">
          {topPerformers.map((cls, index) => (
            <div key={index} className="performer-card">
              <div className="rank-badge rank-{index + 1}">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
              </div>
              <div className="performer-info">
                <h4>{cls.className}</h4>
                <p>{cls.totalStudents} students</p>
              </div>
              <div className="performer-rate">
                <div className="circular-progress" style={{
                  background: `conic-gradient(#16a34a ${cls.attendancePercentage * 3.6}deg, #e5e7eb 0deg)`
                }}>
                  <div className="circular-progress-inner">
                    <span>{cls.attendancePercentage}%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dashboard-card">
        <h3 className="card-title mb-md">Quick Actions</h3>
        <div className="quick-actions-grid">
          <button
            className="action-card"
            onClick={() => navigate('/students')}
          >
            <FiUsers size={24} />
            <span>Manage Students</span>
          </button>
          <button
            className="action-card"
            onClick={() => navigate('/attendance')}
          >
            <FiCheckCircle size={24} />
            <span>View Attendance</span>
          </button>
          <button
            className="action-card"
            onClick={() => navigate('/reports')}
          >
            <FiBarChart2 size={24} />
            <span>Generate Reports</span>
          </button>
          <button
            className="action-card"
            onClick={() => navigate('/classes')}
          >
            <FiTrendingUp size={24} />
            <span>Manage Classes</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedDashboard;
