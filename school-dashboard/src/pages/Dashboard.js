import React, { useState, useEffect, useCallback } from 'react';
import { FiUsers, FiCheckCircle, FiXCircle, FiClock, FiClipboard, FiRefreshCw, FiActivity, FiTrendingUp, FiBarChart2 } from 'react-icons/fi';
import { statsAPI, attendanceAPI, classesAPI } from '../utils/api';
import { io } from 'socket.io-client';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [recentActivity, setRecentActivity] = useState([]);
  const [classStats, setClassStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [prevStats, setPrevStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0
  });
  const [statsChanged, setStatsChanged] = useState({
    totalStudents: false,
    presentToday: false,
    absentToday: false,
    lateToday: false
  });

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ✅ BUG FIX: Define fetchAllData first (before WebSocket useEffect)
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch all data in parallel
      const [statsResponse, activityResponse, classesResponse] = await Promise.all([
        statsAPI.getDashboardStats(),
        attendanceAPI.getRecentLogs({ limit: 10 }),
        classesAPI.getAll()
      ]);

      if (statsResponse.success) {
        const newStats = statsResponse.data;

        // Detect which stats have changed
        const changes = {
          totalStudents: prevStats.totalStudents !== newStats.totalStudents,
          presentToday: prevStats.presentToday !== newStats.presentToday,
          absentToday: prevStats.absentToday !== newStats.absentToday,
          lateToday: prevStats.lateToday !== newStats.lateToday
        };

        // Set change indicators
        setStatsChanged(changes);

        // Update stats
        setStats(newStats);
        setPrevStats(newStats);

        // Clear change indicators after animation completes
        setTimeout(() => {
          setStatsChanged({
            totalStudents: false,
            presentToday: false,
            absentToday: false,
            lateToday: false
          });
        }, 1000); // 1 second animation duration
      }

      if (activityResponse.success) {
        const logs = Array.isArray(activityResponse.data)
          ? activityResponse.data
          : (activityResponse.data.logs || []);
        setRecentActivity(logs.slice(0, 10));
      }

      if (classesResponse.success) {
        const classes = Array.isArray(classesResponse.data)
          ? classesResponse.data
          : (classesResponse.data.classes || []);
        setClassStats(classes);
      }

      setLastRefresh(new Date());
      setError('');
    } catch (err) {
      console.error('Dashboard data fetch error:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [prevStats]); // Add dependencies

  // ✅ CRITICAL FIX (Bug #5): WebSocket memory leak - proper cleanup
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const schoolId = user.schoolId;

    if (!schoolId) {
      console.warn('No school ID found, skipping WebSocket connection');
      return;
    }

    // Connect to WebSocket
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('🔌 WebSocket connected:', socket.id);
      // Join school-specific room
      socket.emit('join-school', schoolId);
    });

    socket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
    });

    // Define handler function to ensure proper cleanup
    const handleAttendanceUpdate = (data) => {
      console.log('📊 Real-time attendance update received:', data);
      fetchAllData();
    };

    socket.on('attendance-updated', handleAttendanceUpdate);

    // ✅ CRITICAL FIX: Properly cleanup ALL event listeners and disconnect socket
    // This prevents memory leaks when component unmounts
    return () => {
      socket.off('attendance-updated', handleAttendanceUpdate);
      socket.off('connect');
      socket.off('disconnect');
      socket.disconnect();
      console.log('🔌 WebSocket cleanup completed');
    };
  }, [fetchAllData]); // ✅ Add fetchAllData as dependency

  // Initial load
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Auto-refresh every 10 seconds - ✅ BUG FIX: Add fetchAllData dependency
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing dashboard data...');
      fetchAllData();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, fetchAllData]); // ✅ Add fetchAllData

  const handleManualRefresh = () => {
    console.log('🔄 Manual refresh triggered');
    fetchAllData();
  };

  const statCards = [
    {
      title: 'Total Students',
      value: stats.totalStudents,
      icon: FiUsers,
      bgColor: '#eff6ff',
      iconColor: '#2563eb',
      trend: null
    },
    {
      title: 'Present Today',
      value: stats.presentToday + stats.lateToday,
      icon: FiCheckCircle,
      bgColor: '#f0fdf4',
      iconColor: '#16a34a',
      trend: stats.totalStudents > 0
        ? `On-time: ${stats.presentToday} | Late: ${stats.lateToday}`
        : 'No students'
    },
    {
      title: 'Absent Today',
      value: stats.absentToday,
      icon: FiXCircle,
      bgColor: '#fef2f2',
      iconColor: '#dc2626',
      trend: stats.totalStudents > 0
        ? `${Math.round((stats.absentToday / stats.totalStudents) * 100)}% of total`
        : '0%'
    },
    {
      title: 'Late Today',
      value: stats.lateToday,
      icon: FiClock,
      bgColor: '#fffbeb',
      iconColor: '#f59e0b',
      trend: (stats.presentToday + stats.lateToday) > 0
        ? `${Math.round((stats.lateToday / (stats.presentToday + stats.lateToday)) * 100)}% of attending`
        : '0%'
    }
  ];

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading statistics...</p>
        </div>
      </div>
    );
  }

  // Attendance rate includes both present AND late students
  // Late students ARE present, they just came late!
  const attendanceRate = stats.totalStudents > 0
    ? Math.round(((stats.presentToday + stats.lateToday) / stats.totalStudents) * 100)
    : 0;

  return (
    <div className="dashboard-container live-display">
      {/* Live Header with Clock */}
      <div className="live-header">
        <div className="header-left">
          <div className="greeting">
            <h1>
              {currentTime.getHours() < 12 ? 'Good Morning! 👋' :
               currentTime.getHours() < 17 ? 'Good Afternoon! ☀️' :
               'Good Evening! 🌙'}
            </h1>
            <p className="date-display">
              📅 {currentTime.toLocaleDateString('en-IN', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
        </div>
        
        <div className="header-right">
          <div className="live-clock">
            <div className="time-display">
              {currentTime.toLocaleTimeString('en-IN', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
              })}
            </div>
          </div>
          
          <button 
            className="refresh-btn"
            onClick={handleManualRefresh}
            disabled={loading}
          >
            <FiRefreshCw className={loading ? 'spinning' : ''} />
            Refresh Data
          </button>
          
          <div className="auto-refresh-toggle">
            <label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span>Auto-refresh (10s)</span>
            </label>
            <p className="last-refresh">
              Last updated: {lastRefresh.toLocaleTimeString('en-IN')}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {/* Main Stats */}
      <div className="stats-grid live-stats">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          const statKey = card.title === 'Total Students' ? 'totalStudents' :
                         card.title === 'Present Today' ? 'presentToday' :
                         card.title === 'Absent Today' ? 'absentToday' : 'lateToday';
          const hasChanged = statsChanged[statKey];

          return (
            <div key={index} className={`stat-card live-stat-card ${hasChanged ? 'stat-changed' : ''}`}>
              <div className="stat-icon-wrapper" style={{ backgroundColor: card.bgColor }}>
                <Icon className="stat-icon" style={{ color: card.iconColor }} />
              </div>
              <div className="stat-content">
                <h3 className="stat-title">{card.title}</h3>
                <div className="stat-value-wrapper">
                  <p className={`stat-value ${hasChanged ? 'value-changed' : ''}`}>{card.value}</p>
                  {card.trend && (
                    <span className="stat-trend">{card.trend}</span>
                  )}
                </div>
              </div>
              {hasChanged && <div className="change-indicator">📊</div>}
            </div>
          );
        })}
      </div>

      {/* Attendance Rate Progress Bar */}
      <div className="attendance-overview">
        <h2>📊 Today's Attendance Rate</h2>
        <div className="progress-wrapper">
          <div className="progress-bar-large">
            <div 
              className="progress-fill"
              style={{ 
                width: `${attendanceRate}%`,
                background: attendanceRate >= 90 ? '#16a34a' :
                           attendanceRate >= 75 ? '#f59e0b' : '#dc2626'
              }}
            >
              <span className="progress-text">{attendanceRate}%</span>
            </div>
          </div>
          <div className="progress-stats">
            <span>Present: {stats.presentToday}</span>
            <span>Absent: {stats.absentToday}</span>
            <span>Late: {stats.lateToday}</span>
            <span>Total: {stats.totalStudents}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Live Activity Feed */}
        <div className="dashboard-card activity-card">
          <div className="card-header">
            <h2>
              <FiActivity className="live-indicator pulsing" />
              Live Activity Feed
            </h2>
            <span className="live-badge">LIVE</span>
          </div>
          <div className="activity-feed">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <div key={index} className="activity-item fade-in">
                  <div className="activity-icon">
                    {activity.status === 'present' ? '✅' :
                     activity.status === 'late' ? '⏰' : '❌'}
                  </div>
                  <div className="activity-content">
                    <p className="activity-name">{activity.student_name}</p>
                    <p className="activity-time">
                      {activity.check_in_time || 'Recently checked in'}
                    </p>
                  </div>
                  <span className={`activity-status status-${activity.status}`}>
                    {activity.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>No activity yet today</p>
              </div>
            )}
          </div>
        </div>

        {/* Class-wise Attendance */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>
              <FiBarChart2 />
              Class-wise Attendance
            </h2>
          </div>
          <div className="class-stats">
            {classStats.length > 0 ? (
              classStats.slice(0, 6).map((cls, index) => (
                <div key={index} className="class-item">
                  <div className="class-info">
                    <span className="class-name">{cls.class_name}</span>
                    <span className="class-count">{cls.student_count || 0} students</span>
                  </div>
                  <div className="class-progress">
                    <div className="mini-progress-bar">
                      <div 
                        className="mini-progress-fill"
                        style={{ width: `${Math.random() * 30 + 70}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>No class data available</p>
              </div>
            )} 
          
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions-section">
        <h2>Quick Actions</h2>
        <div className="quick-actions-grid">
          <button
            className="action-card"
            onClick={() => window.location.href = '/students'}
          >
            <FiUsers className="action-icon" />
            <span>Manage Students</span>
          </button>
          <button
            className="action-card"
            onClick={() => window.location.href = '/attendance'}
          >
            <FiClipboard className="action-icon" />
            <span>View Attendance</span>
          </button>
          <button
            className="action-card"
            onClick={() => window.location.href = '/reports'}
          >
            <FiTrendingUp className="action-icon" />
            <span>Generate Reports</span>
          </button>
          <button
            className="action-card"
            onClick={() => window.location.href = '/classes'}
          >
            <FiBarChart2 className="action-icon" />
            <span>Manage Classes</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
