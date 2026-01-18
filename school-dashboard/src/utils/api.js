import axios from 'axios';

// Base API URL from environment variable
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// Response interceptor - Handle errors globally
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response);
    return response.data;
  },
  async (error) => {
    console.error('API Error:', error);
    console.error('Error response:', error.response);

    const originalRequest = error.config;

    // Don't redirect on login page 401 errors
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      // If we haven't tried to refresh yet
      if (!originalRequest._retry) {
        if (isRefreshing) {
          // If already refreshing, queue this request
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then(token => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token;
            return api(originalRequest);
          }).catch(err => {
            return Promise.reject(err);
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = localStorage.getItem('refreshToken');

        if (!refreshToken) {
          // No refresh token available, logout
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return Promise.reject(error);
        }

        try {
          // Call refresh endpoint
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken: refreshToken
          });

          if (response.data.success) {
            const { accessToken } = response.data.data;

            // Update token in localStorage
            localStorage.setItem('token', accessToken);

            // Update default header
            api.defaults.headers.common['Authorization'] = 'Bearer ' + accessToken;
            originalRequest.headers['Authorization'] = 'Bearer ' + accessToken;

            // Process queued requests
            processQueue(null, accessToken);

            isRefreshing = false;

            // Retry original request
            return api(originalRequest);
          }
        } catch (refreshError) {
          processQueue(refreshError, null);
          isRefreshing = false;

          // Token refresh failed, logout
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          window.location.href = '/login';

          return Promise.reject(refreshError);
        }
      } else {
        // Already retried, logout
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }

    const errorData = error.response?.data || { message: error.message };
    return Promise.reject(errorData);
  }
);

// Authentication APIs
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  getMe: () => api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    api.put('/auth/change-password', { currentPassword, newPassword }),
};

// Students APIs (School Admin)
export const studentsAPI = {
  getAll: (params) => api.get('/school/students', { params }),
  getById: (id) => api.get(`/school/students/${id}`),
  create: (data) => api.post('/school/students', data),
  update: (id, data) => api.put(`/school/students/${id}`, data),
  delete: (id) => api.delete(`/school/students/${id}`),
  uploadPhoto: (id, formData) => {
    const token = localStorage.getItem('token');
    return axios.post(`${API_BASE_URL}/school/students/${id}/photo`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${token}`
      }
    }).then(response => response.data);
  },
  bulkImport: (formData) => {
    const token = localStorage.getItem('token');
    return axios.post(`${API_BASE_URL}/school/students/bulk-import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${token}`
      }
    }).then(response => response.data);
  },
};

// Attendance APIs (School Admin)
export const attendanceAPI = {
  getLogs: (params) => api.get('/school/attendance', { params }),
  getRecentLogs: (params) => api.get('/school/attendance', { params }),
  getToday: () => api.get('/school/attendance/today'),
  getTodayStats: () => api.get('/school/attendance/today/stats'),
  getRange: (params) => api.get('/school/attendance/range', { params }), // BATCH API for monthly calendar
  manual: (data) => api.post('/school/attendance/manual', data),
  markManual: (data) => api.post('/school/attendance/manual', data),
  bulkMarkPresent: (params) => api.post('/school/attendance/bulk-mark', params),
  export: (params) => api.get('/school/attendance/export', { params, responseType: 'blob' }),
};

// Stats APIs (School Admin Dashboard)
export const statsAPI = {
  getDashboardStats: () => api.get('/school/stats/dashboard'),
};

// Settings APIs
export const settingsAPI = {
  get: () => api.get('/school/settings'),
  update: (data) => api.put('/school/settings', data),
};

// Classes APIs
export const classesAPI = {
  getAll: (params) => api.get('/school/classes', { params }),
  getById: (id) => api.get(`/school/classes/${id}`),
  create: (data) => api.post('/school/classes', data),
  update: (id, data) => api.put(`/school/classes/${id}`, data),
  delete: (id) => api.delete(`/school/classes/${id}`),
  getStatistics: (academicYear) => api.get('/school/classes/statistics', { params: { academicYear } }),
};

// Sections APIs
export const sectionsAPI = {
  getAll: () => api.get('/school/sections'),
  getByClass: (classId) => api.get(`/school/classes/${classId}/sections`),
  getById: (sectionId) => api.get(`/school/sections/${sectionId}`),
  getWithStudents: (sectionId) => api.get(`/school/sections/${sectionId}/students`),
  create: (classId, data) => api.post(`/school/classes/${classId}/sections`, data),
  update: (sectionId, data) => api.put(`/school/sections/${sectionId}`, data),
  delete: (sectionId) => api.delete(`/school/sections/${sectionId}`),
  assignFormTeacher: (sectionId, teacherId) =>
    api.put(`/school/sections/${sectionId}/form-teacher`, { teacherId }),
  removeFormTeacher: (sectionId) =>
    api.delete(`/school/sections/${sectionId}/form-teacher`),
};

// Teachers APIs
export const teachersAPI = {
  getAll: (params) => api.get('/school/teachers', { params }),
  getById: (id) => api.get(`/school/teachers/${id}`),
  create: (data) => api.post('/school/teachers', data),
  update: (id, data) => api.put(`/school/teachers/${id}`, data),
  delete: (id) => api.delete(`/school/teachers/${id}`),
  getAssignments: (id, academicYear) =>
    api.get(`/school/teachers/${id}/assignments`, { params: { academicYear } }),
  assignToSection: (id, data) => api.post(`/school/teachers/${id}/assignments`, data),
  removeAssignment: (id, assignmentId) =>
    api.delete(`/school/teachers/${id}/assignments/${assignmentId}`),
  resetPassword: (id, newPassword) =>
    api.post(`/school/teachers/${id}/reset-password`, { newPassword }),
};

// Holidays APIs
export const holidaysAPI = {
  getAll: (params) => api.get('/school/holidays', { params }),
  getById: (id) => api.get(`/school/holidays/${id}`),
  create: (data) => api.post('/school/holidays', data),
  update: (id, data) => api.put(`/school/holidays/${id}`, data),
  delete: (id) => api.delete(`/school/holidays/${id}`),
  bulkImport: (holidays) => api.post('/school/holidays/bulk', { holidays }),
};

// Leaves APIs
export const leavesAPI = {
  getAll: (params) => api.get('/school/leaves', { params }),
  getMonthly: (params) => api.get('/school/leaves/monthly', { params }),
  getById: (id) => api.get(`/school/leaves/${id}`),
  create: (data) => api.post('/school/leaves', data),
  update: (id, data) => api.put(`/school/leaves/${id}`, data),
  delete: (id) => api.delete(`/school/leaves/${id}`),
  updateStatus: (id, status) => api.put(`/school/leaves/${id}/status`, { status }),
};

// Academic Year APIs
export const academicYearAPI = {
  getAll: () => api.get('/school/academic-years'),
  getCurrent: () => api.get('/school/academic-years/current'),
  getById: (id) => api.get(`/school/academic-years/${id}`),
  create: (data) => api.post('/school/academic-years', data),
  update: (id, data) => api.put(`/school/academic-years/${id}`, data),
  setCurrent: (id) => api.put(`/school/academic-years/${id}/set-current`),
  delete: (id) => api.delete(`/school/academic-years/${id}`),
  getVacations: (id) => api.get(`/school/academic-years/${id}/vacations`),
  addVacation: (id, data) => api.post(`/school/academic-years/${id}/vacations`, data),
  deleteVacation: (vacationId) => api.delete(`/school/vacations/${vacationId}`),
};

// Reports APIs
export const reportsAPI = {
  getDailyReport: (params) => api.get('/school/reports/daily', { params }),
  getMonthlyReport: (params) => api.get('/school/reports/monthly', { params }),
  getStudentReport: (studentId, params) => api.get(`/school/reports/student/${studentId}`, { params }),
  getClassReport: (classId, params) => api.get(`/school/reports/class/${classId}`, { params }),
  getWeeklySummary: (params) => api.get('/school/reports/weekly', { params }),
  getLowAttendance: (params) => api.get('/school/reports/low-attendance', { params }),
  getPerfectAttendance: (params) => api.get('/school/reports/perfect-attendance', { params }),
  getDayPatternAnalysis: (params) => api.get('/school/reports/day-pattern', { params }),
  getTeacherPerformance: (params) => api.get('/school/reports/teacher-performance', { params }),
  getLateArrivalsAnalysis: (params) => api.get('/school/reports/late-analysis', { params }),
  getSmsAnalytics: (params) => api.get('/school/reports/sms-analytics', { params }),
  exportReport: (type, params) => api.get(`/school/reports/export/${type}`, { params, responseType: 'blob' }),
};

// Subjects APIs
export const subjectsAPI = {
  getAll: (params) => api.get('/school/subjects', { params }),
  getById: (id) => api.get(`/school/subjects/${id}`),
  create: (data) => api.post('/school/subjects', data),
  update: (id, data) => api.put(`/school/subjects/${id}`, data),
  delete: (id, hard = false) => api.delete(`/school/subjects/${id}${hard ? '?hard=true' : ''}`),
  createDefaults: () => api.post('/school/subjects/create-defaults', {}),
  getStatistics: () => api.get('/school/subjects/statistics'),
  getBySection: (sectionId) => api.get(`/school/subjects/section/${sectionId}`),
};

// Devices APIs (Device Management)
export const devicesAPI = {
  // Get all devices for this school
  getAll: () => api.get('/school/devices'),

  // Get sync status for a specific device
  getSyncStatus: (deviceId) => api.get(`/device-management/${deviceId}/sync-status`),

  // Trigger full sync for a device (sync all students)
  syncStudents: (deviceId) => api.post(`/device-management/${deviceId}/sync-students`),

  // Verify sync status (check for missing/extra students)
  verifySync: (deviceId) => api.post(`/device-management/${deviceId}/verify-sync`),
};

export default api;
