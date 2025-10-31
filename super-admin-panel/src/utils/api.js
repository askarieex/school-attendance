import axios from 'axios';

// Base API URL - change this to your backend URL
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

// Schools APIs
export const schoolsAPI = {
  getAll: (params) => api.get('/super/schools', { params }),
  getById: (id) => api.get(`/super/schools/${id}`),
  create: (data) => api.post('/super/schools', data),
  update: (id, data) => api.put(`/super/schools/${id}`, data),
  delete: (id) => api.delete(`/super/schools/${id}`),
};

// Devices APIs
export const devicesAPI = {
  getAll: (params) => api.get('/super/devices', { params }),
  create: (data) => api.post('/super/devices', data),
  delete: (id) => api.delete(`/super/devices/${id}`),
};

// Users APIs
export const usersAPI = {
  getAll: (params) => api.get('/super/users', { params }),
  getById: (id) => api.get(`/super/users/${id}`),
  create: (data) => api.post('/super/users', data),
  update: (id, data) => api.put(`/super/users/${id}`, data),
  delete: (id) => api.delete(`/super/users/${id}`),
};

// Platform Statistics
export const statsAPI = {
  getPlatformStats: () => api.get('/super/stats'),
};

export default api;
