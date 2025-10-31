# 🔧 **CRITICAL FIXES - IMPLEMENTATION GUIDE**

## Ready-to-Use Code Fixes for Top 10 Issues

---

## 🚨 **FIX #1: Add Rate Limiting**

### **Install Package:**
```bash
npm install express-rate-limit
```

### **Implementation:**
```javascript
// backend/src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

// Login rate limiter - Prevent brute force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// API rate limiter - Prevent abuse
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: {
    success: false,
    message: 'Too many requests. Please slow down.'
  }
});

// Strict rate limiter for sensitive operations
const strictLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // 10 requests
  message: {
    success: false,
    message: 'Too many requests. Try again later.'
  }
});

module.exports = { loginLimiter, apiLimiter, strictLimiter };
```

### **Usage:**
```javascript
// backend/src/routes/auth.routes.js
const { loginLimiter } = require('../middleware/rateLimiter');

router.post('/login', loginLimiter, authController.login);

// backend/src/server.js
const { apiLimiter } = require('./middleware/rateLimiter');

app.use('/api/v1/', apiLimiter); // Apply to all API routes
```

---

## 🚨 **FIX #2: Add JWT Expiration & Refresh Tokens**

### **Update Token Generation:**
```javascript
// backend/src/controllers/authController.js

const generateTokens = (user) => {
  // Access token - Short lived (1 hour)
  const accessToken = jwt.sign(
    { 
      userId: user.id, 
      role: user.role,
      schoolId: user.school_id 
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' } // ✅ Expires in 1 hour
  );

  // Refresh token - Long lived (7 days)
  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// Login function
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ... verify credentials ...

    const { accessToken, refreshToken } = generateTokens(user);

    // Store refresh token in database
    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
    );

    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, role: user.role },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error.message); // ✅ Don't log password
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

// Refresh token endpoint
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Check if token exists in database
    const result = await query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2 AND expires_at > NOW()',
      [refreshToken, decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    // Get user
    const user = await User.findById(decoded.userId);

    // Generate new tokens
    const tokens = generateTokens(user);

    // Delete old refresh token
    await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);

    // Store new refresh token
    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokens.refreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
    );

    res.json({ success: true, data: tokens });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Token refresh failed' });
  }
};

module.exports = { login, refreshToken };
```

### **Database Migration:**
```sql
-- Create refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_token (user_id, token)
);

-- Auto-delete expired tokens
CREATE OR REPLACE FUNCTION delete_expired_tokens()
RETURNS trigger AS $$
BEGIN
  DELETE FROM refresh_tokens WHERE expires_at < NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_delete_expired_tokens
AFTER INSERT ON refresh_tokens
EXECUTE FUNCTION delete_expired_tokens();
```

---

## 🚨 **FIX #3: Add Input Validation & Sanitization**

### **Install Packages:**
```bash
npm install express-validator sanitize-html
```

### **Create Validation Middleware:**
```javascript
// backend/src/middleware/inputValidation.js
const { body, param, query, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }
  next();
};

// Sanitize HTML
const sanitize = (value) => {
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {}
  });
};

// Custom validators
const validators = {
  // Student validation
  createStudent: [
    body('full_name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters')
      .customSanitizer(sanitize),
    
    body('email')
      .optional()
      .trim()
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    
    body('roll_number')
      .trim()
      .notEmpty().withMessage('Roll number is required')
      .matches(/^[A-Z0-9-]+$/i).withMessage('Roll number must be alphanumeric'),
    
    body('class_id')
      .notEmpty().withMessage('Class ID is required')
      .isInt({ min: 1 }).withMessage('Invalid class ID'),
    
    handleValidationErrors
  ],

  // Attendance validation
  markAttendance: [
    body('studentId')
      .notEmpty().withMessage('Student ID is required')
      .isInt({ min: 1 }).withMessage('Invalid student ID'),
    
    body('date')
      .notEmpty().withMessage('Date is required')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be YYYY-MM-DD format')
      .custom((value) => {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date');
        }
        if (date > new Date()) {
          throw new Error('Date cannot be in the future');
        }
        return true;
      }),
    
    body('status')
      .notEmpty().withMessage('Status is required')
      .isIn(['present', 'absent', 'late', 'leave']).withMessage('Invalid status'),
    
    body('checkInTime')
      .optional()
      .matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('Time must be HH:MM or HH:MM:SS format'),
    
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Notes must be max 500 characters')
      .customSanitizer(sanitize),
    
    handleValidationErrors
  ],

  // Date range validation
  dateRange: [
    query('startDate')
      .notEmpty().withMessage('Start date is required')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Invalid date format'),
    
    query('endDate')
      .notEmpty().withMessage('End date is required')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Invalid date format')
      .custom((endDate, { req }) => {
        if (new Date(endDate) < new Date(req.query.startDate)) {
          throw new Error('End date must be after start date');
        }
        const daysDiff = (new Date(endDate) - new Date(req.query.startDate)) / (1000 * 60 * 60 * 24);
        if (daysDiff > 365) {
          throw new Error('Date range cannot exceed 365 days');
        }
        return true;
      }),
    
    handleValidationErrors
  ]
};

module.exports = validators;
```

### **Usage:**
```javascript
// backend/src/routes/school.routes.js
const validators = require('../middleware/inputValidation');

router.post('/students', validators.createStudent, schoolController.addStudent);
router.post('/attendance/manual', validators.markAttendance, schoolController.markManualAttendance);
router.get('/attendance/range', validators.dateRange, schoolController.getAttendanceRange);
```

---

## 🚨 **FIX #4: Fix Race Condition with Database Locking**

### **Implementation:**
```javascript
// backend/src/controllers/schoolController.js

const markManualAttendance = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { studentId, date, status, forceUpdate } = req.body;
    const schoolId = req.tenantSchoolId;

    // Start transaction
    await client.query('BEGIN');

    // Lock the row to prevent race conditions
    const lockResult = await client.query(
      `SELECT * FROM attendance_logs 
       WHERE student_id = $1 AND date = $2 AND school_id = $3
       FOR UPDATE`, // ✅ Row-level lock
      [studentId, date, schoolId]
    );

    const existing = lockResult.rows[0];

    if (existing && !forceUpdate) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Attendance already marked'
      });
    }

    let result;
    
    if (existing && forceUpdate) {
      // UPDATE existing record
      result = await client.query(
        `UPDATE attendance_logs 
         SET status = $1, check_in_time = $2
         WHERE student_id = $3 AND date = $4 AND school_id = $5
         RETURNING *`,
        [status, checkInTime, studentId, date, schoolId]
      );
    } else {
      // INSERT new record
      result = await client.query(
        `INSERT INTO attendance_logs 
         (student_id, school_id, date, status, check_in_time)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [studentId, schoolId, date, status, checkInTime]
      );
    }

    // Commit transaction
    await client.query('COMMIT');

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark attendance' });
  } finally {
    client.release(); // ✅ Always release connection
  }
};
```

---

## 🚨 **FIX #5: Add Database Indexes**

### **Migration Script:**
```sql
-- backend/src/config/add-indexes.sql

-- Attendance logs indexes (CRITICAL for performance)
CREATE INDEX IF NOT EXISTS idx_attendance_student_date 
ON attendance_logs(student_id, date);

CREATE INDEX IF NOT EXISTS idx_attendance_school_date 
ON attendance_logs(school_id, date);

CREATE INDEX IF NOT EXISTS idx_attendance_date 
ON attendance_logs(date);

-- Students indexes
CREATE INDEX IF NOT EXISTS idx_students_class 
ON students(class_id);

CREATE INDEX IF NOT EXISTS idx_students_school 
ON students(school_id);

CREATE INDEX IF NOT EXISTS idx_students_roll 
ON students(school_id, roll_number);

CREATE INDEX IF NOT EXISTS idx_students_name 
ON students(full_name);

-- Add full-text search on student names
CREATE INDEX IF NOT EXISTS idx_students_name_search 
ON students USING gin(to_tsvector('english', full_name));

-- Leaves indexes
CREATE INDEX IF NOT EXISTS idx_leaves_student 
ON leaves(student_id);

CREATE INDEX IF NOT EXISTS idx_leaves_dates 
ON leaves(start_date, end_date);

-- Classes indexes
CREATE INDEX IF NOT EXISTS idx_classes_school 
ON classes(school_id);

-- Holidays indexes
CREATE INDEX IF NOT EXISTS idx_holidays_date 
ON holidays(holiday_date, school_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_attendance_composite 
ON attendance_logs(school_id, date, student_id, status);

-- Analyze tables to update statistics
ANALYZE attendance_logs;
ANALYZE students;
ANALYZE leaves;
ANALYZE classes;
```

### **Run Migration:**
```javascript
// backend/src/config/runIndexMigration.js
const { query } = require('./database');
const fs = require('fs');

async function addIndexes() {
  try {
    const sql = fs.readFileSync(__dirname + '/add-indexes.sql', 'utf8');
    await query(sql);
    console.log('✅ Indexes created successfully');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  }
}

addIndexes();
```

---

## 🚨 **FIX #6: Fix N+1 Query Problem**

### **Before (Slow):**
```javascript
// ❌ N+1 queries
const students = await Student.findAll(schoolId); // 1 query

for (let student of students) {
  const attendance = await AttendanceLog.find(student.id); // N queries
  student.attendance = attendance;
}
```

### **After (Fast):**
```javascript
// ✅ Single JOIN query
const studentsWithAttendance = await query(`
  SELECT 
    s.*,
    c.class_name,
    sec.section_name,
    json_agg(
      json_build_object(
        'date', a.date,
        'status', a.status,
        'check_in_time', a.check_in_time
      )
    ) FILTER (WHERE a.id IS NOT NULL) as attendance_records
  FROM students s
  LEFT JOIN classes c ON s.class_id = c.id
  LEFT JOIN sections sec ON s.section_id = sec.id
  LEFT JOIN attendance_logs a ON s.id = a.student_id 
    AND a.date >= $1 
    AND a.date <= $2
  WHERE s.school_id = $3
  GROUP BY s.id, c.class_name, sec.section_name
  ORDER BY s.roll_number
`, [startDate, endDate, schoolId]);

// Total: 1 query instead of N+1!
```

---

## 🚨 **FIX #7: Add Request Size Limit & Security Headers**

### **Implementation:**
```javascript
// backend/src/server.js
const express = require('express');
const helmet = require('helmet'); // Install: npm install helmet
const cors = require('cors');

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:']
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com', 'https://admin.yourdomain.com']
    : ['http://localhost:3000', 'http://localhost:3002'],
  credentials: true,
  maxAge: 86400,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Log large requests
    if (buf.length > 1024 * 1024) { // > 1MB
      console.warn(`Large request: ${buf.length} bytes from ${req.ip}`);
    }
  }
}));

app.use(express.urlencoded({ 
  limit: '10mb',
  extended: true 
}));

// Prevent parameter pollution
const hpp = require('hpp'); // Install: npm install hpp
app.use(hpp());

// XSS protection
const xss = require('xss-clean'); // Install: npm install xss-clean
app.use(xss());

// No cache for API responses
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});
```

---

## 🚨 **FIX #8: Add Error Boundary (Frontend)**

### **Implementation:**
```javascript
// school-dashboard/src/components/ErrorBoundary.js
import React from 'react';
import { FiAlertTriangle } from 'react-icons/fi';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Log to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Send to Sentry or similar
      // Sentry.captureException(error);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          backgroundColor: '#f8fafc'
        }}>
          <FiAlertTriangle size={64} color="#ef4444" />
          <h1 style={{ marginTop: '1rem', color: '#1f2937' }}>
            Oops! Something went wrong
          </h1>
          <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>
            The application encountered an unexpected error
          </p>
          
          {process.env.NODE_ENV === 'development' && (
            <details style={{ 
              marginTop: '2rem', 
              padding: '1rem', 
              backgroundColor: '#fee2e2',
              borderRadius: '8px',
              maxWidth: '600px'
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                Error Details (Dev Only)
              </summary>
              <pre style={{ marginTop: '1rem', fontSize: '12px', overflow: 'auto' }}>
                {this.state.error && this.state.error.toString()}
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}

          <button
            onClick={this.handleReset}
            style={{
              marginTop: '2rem',
              padding: '0.75rem 2rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Return to Dashboard
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

### **Usage:**
```javascript
// school-dashboard/src/App.js
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ToastProvider>
          <AuthProvider>
            {/* Your app */}
          </AuthProvider>
        </ToastProvider>
      </Router>
    </ErrorBoundary>
  );
}
```

---

## 🚨 **FIX #9: Fix Memory Leaks (Frontend)**

### **Check All useEffect Cleanup:**
```javascript
// school-dashboard/src/pages/AttendanceDaily.js

// ❌ WRONG - Memory leak
useEffect(() => {
  const interval = setInterval(() => {
    fetchData();
  }, 30000);
}, []);

// ✅ CORRECT - Cleanup
useEffect(() => {
  const interval = setInterval(() => {
    fetchData();
  }, 30000);
  
  return () => {
    clearInterval(interval);
    console.log('🧹 Cleaned up interval');
  };
}, []);

// ❌ WRONG - Event listener leak
useEffect(() => {
  window.addEventListener('resize', handleResize);
}, []);

// ✅ CORRECT - Cleanup
useEffect(() => {
  window.addEventListener('resize', handleResize);
  
  return () => {
    window.removeEventListener('resize', handleResize);
    console.log('🧹 Cleaned up event listener');
  };
}, []);

// ❌ WRONG - Fetch after unmount
useEffect(() => {
  fetchData().then(data => {
    setState(data); // Component might be unmounted!
  });
}, []);

// ✅ CORRECT - Check if mounted
useEffect(() => {
  let isMounted = true;
  
  fetchData().then(data => {
    if (isMounted) {
      setState(data);
    }
  });
  
  return () => {
    isMounted = false;
    console.log('🧹 Cancelled pending updates');
  };
}, []);
```

---

## 🚨 **FIX #10: Add Proper Timezone Handling**

### **Implementation:**
```javascript
// backend/src/utils/dateUtils.js
const moment = require('moment-timezone'); // Install: npm install moment-timezone

// School timezone (configured per school)
const SCHOOL_TIMEZONE = 'Asia/Kolkata'; // IST

/**
 * Get current date in school timezone
 */
function getCurrentDate() {
  return moment.tz(SCHOOL_TIMEZONE).format('YYYY-MM-DD');
}

/**
 * Get current time in school timezone
 */
function getCurrentTime() {
  return moment.tz(SCHOOL_TIMEZONE).format('HH:mm:ss');
}

/**
 * Convert date to school timezone
 */
function toSchoolTimezone(date) {
  return moment(date).tz(SCHOOL_TIMEZONE);
}

/**
 * Parse date safely
 */
function parseDate(dateString) {
  const date = moment.tz(dateString, SCHOOL_TIMEZONE);
  if (!date.isValid()) {
    throw new Error('Invalid date');
  }
  return date.format('YYYY-MM-DD');
}

/**
 * Check if date is valid and not in future
 */
function validateAttendanceDate(dateString) {
  const date = moment.tz(dateString, SCHOOL_TIMEZONE);
  const now = moment.tz(SCHOOL_TIMEZONE);
  
  if (!date.isValid()) {
    throw new Error('Invalid date format');
  }
  
  if (date.isAfter(now, 'day')) {
    throw new Error('Cannot mark attendance for future dates');
  }
  
  // Optional: Limit to last 30 days
  const thirtyDaysAgo = now.clone().subtract(30, 'days');
  if (date.isBefore(thirtyDaysAgo, 'day')) {
    throw new Error('Cannot mark attendance for dates older than 30 days');
  }
  
  return date.format('YYYY-MM-DD');
}

module.exports = {
  getCurrentDate,
  getCurrentTime,
  toSchoolTimezone,
  parseDate,
  validateAttendanceDate,
  SCHOOL_TIMEZONE
};
```

### **Usage:**
```javascript
// backend/src/controllers/schoolController.js
const { getCurrentDate, validateAttendanceDate } = require('../utils/dateUtils');

const markManualAttendance = async (req, res) => {
  try {
    let { date } = req.body;
    
    // If no date provided, use current date in school timezone
    if (!date) {
      date = getCurrentDate();
    } else {
      // Validate and normalize date
      date = validateAttendanceDate(date);
    }
    
    // Rest of the logic...
  } catch (error) {
    if (error.message.includes('date')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    throw error;
  }
};
```

---

## 📋 **TESTING THE FIXES**

### **Test Rate Limiting:**
```bash
# Try 10 login attempts rapidly
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
# Should get rate limit error after 5 attempts
```

### **Test Input Validation:**
```bash
# Try XSS attack
curl -X POST http://localhost:3001/api/v1/school/students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"full_name":"<script>alert(1)</script>","roll_number":"123"}'
# Should sanitize the name
```

### **Test Database Performance:**
```sql
-- Check query performance
EXPLAIN ANALYZE
SELECT * FROM attendance_logs 
WHERE student_id = 123 AND date >= '2025-01-01';

-- Should show "Index Scan" not "Seq Scan"
```

---

## 🎯 **IMPLEMENTATION CHECKLIST**

### **Week 1:**
- [ ] Add rate limiting middleware
- [ ] Fix JWT expiration
- [ ] Add input validation
- [ ] Remove sensitive data from logs
- [ ] Add request size limits

### **Week 2:**
- [ ] Add database indexes
- [ ] Fix race conditions with locking
- [ ] Fix N+1 queries
- [ ] Add error boundaries
- [ ] Fix memory leaks

### **Week 3:**
- [ ] Add timezone handling
- [ ] Add security headers
- [ ] Test all fixes
- [ ] Update documentation
- [ ] Deploy to staging

---

## 🚀 **NEXT STEPS**

1. **Run** npm install for new packages
2. **Apply** database migrations
3. **Test** each fix individually
4. **Monitor** for issues
5. **Document** changes
6. **Deploy** to production

**Good luck!** 🎉
