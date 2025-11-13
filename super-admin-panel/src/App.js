import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Schools from './pages/Schools';
import Devices from './pages/Devices';
import Users from './pages/Users';
import SystemSettings from './pages/SystemSettings';
import PasswordManagement from './pages/PasswordManagement';
import AuditLogs from './pages/AuditLogs';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <Layout>
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/schools" element={<Schools />} />
                    <Route path="/devices" element={<Devices />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/settings" element={<SystemSettings />} />
                    <Route path="/password-management" element={<PasswordManagement />} />
                    <Route path="/audit-logs" element={<AuditLogs />} />
                    <Route path="/statistics" element={<div className="card"><h2>Statistics</h2><p>Coming soon...</p></div>} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Layout>
              </PrivateRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
