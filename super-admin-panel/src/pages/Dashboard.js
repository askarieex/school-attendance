import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiUsers, FiHardDrive, FiTrendingUp, FiDollarSign } from 'react-icons/fi';
import { statsAPI } from '../utils/api';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await statsAPI.getPlatformStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Schools',
      value: stats?.totalSchools || 0,
      icon: <FiUsers />,
      color: '#3b82f6',
      bg: '#dbeafe',
      link: '/schools',
    },
    {
      title: 'Total Students',
      value: stats?.totalStudents?.toLocaleString() || 0,
      icon: <FiTrendingUp />,
      color: '#10b981',
      bg: '#d1fae5',
    },
    {
      title: 'Active Devices',
      value: stats?.totalDevices || 0,
      icon: <FiHardDrive />,
      color: '#f59e0b',
      bg: '#fef3c7',
      link: '/devices',
    },
    {
      title: 'Monthly Revenue',
      value: `$${((stats?.totalSchools || 0) * 100).toLocaleString()}`,
      icon: <FiDollarSign />,
      color: '#ef4444',
      bg: '#fee2e2',
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '8px' }}>
          Dashboard
        </h1>
        <p style={{ color: '#64748b' }}>Platform overview and statistics</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '24px',
        marginBottom: '40px',
      }}>
        {statCards.map((card, index) => (
          <div key={index} className="card" style={{
            background: card.bg,
            borderLeft: `5px solid ${card.color}`,
            position: 'relative',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '8px' }}>
                  {card.title}
                </div>
                <div style={{ fontSize: '2.5rem', fontWeight: '700', color: card.color }}>
                  {card.value}
                </div>
              </div>
              <div style={{
                width: '56px',
                height: '56px',
                background: card.color,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '24px',
              }}>
                {card.icon}
              </div>
            </div>
            {card.link && (
              <Link
                to={card.link}
                style={{
                  marginTop: '16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: card.color,
                  fontSize: '14px',
                  fontWeight: '600',
                  textDecoration: 'none',
                }}
              >
                View all →
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '16px' }}>
          Quick Actions
        </h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link to="/schools" className="btn btn-primary">
            <FiUsers /> Add New School
          </Link>
          <Link to="/devices" className="btn btn-secondary">
            <FiHardDrive /> Register Device
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
