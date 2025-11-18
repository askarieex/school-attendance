import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/EnhancedDashboard';
import Students from './pages/Students';
import StudentDetails from './pages/StudentDetails';
import Attendance from './pages/AttendanceDaily';
import Classes from './pages/Classes';
import Teachers from './pages/Teachers';
import Subjects from './pages/Subjects';
import Calendar from './pages/CalendarNew';
import Leaves from './pages/Leaves';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Devices from './pages/Devices';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ToastProvider>
          <AuthProvider>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <div className="app-layout">
                  <Navbar />
                  <div className="app-body">
                    <Sidebar />
                    <main className="app-content">
                      <Routes>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/students" element={<Students />} />
                        <Route path="/students/:id" element={<StudentDetails />} />
                        <Route path="/classes" element={<Classes />} />
                        <Route path="/teachers" element={<Teachers />} />
                        <Route path="/subjects" element={<Subjects />} />
                        <Route path="/attendance" element={<Attendance />} />
                        <Route path="/devices" element={<Devices />} />
                        <Route path="/calendar" element={<Calendar />} />
                        <Route path="/leaves" element={<Leaves />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                      </Routes>
                    </main>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
        </AuthProvider>
      </ToastProvider>
    </Router>
    </ErrorBoundary>
  );
}

// Placeholder component for pages not yet implemented
const ComingSoon = ({ title }) => {
  return (
    <div className="coming-soon">
      <h1>{title}</h1>
      <p>This page is coming soon...</p>
    </div>
  );
};

export default App;
