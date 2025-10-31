const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();


// Import routes
const authRoutes = require('./routes/auth.routes');
const superAdminRoutes = require('./routes/superAdmin.routes');
const schoolRoutes = require('./routes/school.routes');
const teacherRoutes = require('./routes/teacher.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const deviceSyncRoutes = require('./routes/deviceSync.routes');
const holidayRoutes = require('./routes/holiday.routes');
const leaveRoutes = require('./routes/leave.routes');
const iclockRoutes = require('./routes/iclock');

// Import middleware
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Import database connection
const { pool } = require('./config/database');

// Initialize express app
const app = express();

/**
 * MIDDLEWARE
 */

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
};
app.use(cors(corsOptions));

// Body parsing middleware with size limits to prevent DOS attacks
app.use(express.json({ limit: '1mb' })); // Limit JSON payload to 1MB
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Special middleware for ZKTeco device endpoints (they send plain text)
app.use('/iclock', express.text({ type: 'text/plain' }));
app.use('/iclock', express.text({ type: '*/*' })); // Also accept any content type for device compatibility

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting - Production-ready for 1000+ schools
// Very high limit to handle development re-renders and production load
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 1 * 60 * 1000, // 1 minute window
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // 1000 requests per minute (very high for development + production)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => process.env.NODE_ENV === 'development', // Skip rate limiting in development
});
app.use('/api/', limiter);

/**
 * ROUTES
 */

const API_VERSION = process.env.API_VERSION || 'v1';

// Health check endpoint
app.get('/', (req, res) => {
  console.log('Health check endpoint hit');
  res.json({
    success: true,
    message: 'School Attendance API is running',
    version: API_VERSION,
    timestamp: new Date().toISOString(),
  });
});
app.post('/', (req, res) => {
  console.log('POST endpoint hit /');
  res.json({
    success: true,
    message: 'POST endpoint hit',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/super`, superAdminRoutes);
app.use(`/api/${API_VERSION}/teacher`, teacherRoutes);
// IMPORTANT: Mount specific /school/* routes BEFORE /school to prevent route conflicts
app.use(`/api/${API_VERSION}/school/holidays`, holidayRoutes);
app.use(`/api/${API_VERSION}/school/leaves`, leaveRoutes);
app.use(`/api/${API_VERSION}/school`, schoolRoutes);
app.use(`/api/${API_VERSION}/attendance`, attendanceRoutes);
app.use(`/api/${API_VERSION}/device/sync`, deviceSyncRoutes);

// ZKTeco device endpoints (hardcoded, no /api prefix or version)
app.use('/iclock', iclockRoutes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

/**
 * SERVER INITIALIZATION
 */

const PORT = process.env.PORT || 3001;

// Validate required environment variables
const requiredEnvVars = ['DB_PASSWORD', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please set these variables in your .env file');
  process.exit(1);
}

// Test database connection before starting server
const startServer = async () => {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Start server
    app.listen(PORT, () => {
      console.log(`\n🚀 Server is running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📡 API Base URL: http://localhost:${PORT}/api/${API_VERSION}`);
      console.log(`\n📚 Available Endpoints:`);
      console.log(`   Authentication:    /api/${API_VERSION}/auth`);
      console.log(`   Super Admin:       /api/${API_VERSION}/super`);
      console.log(`   School Admin:      /api/${API_VERSION}/school`);
      console.log(`   Holidays:          /api/${API_VERSION}/school/holidays`);
      console.log(`   Hardware Devices:  /api/${API_VERSION}/attendance`);
      console.log(`   Device Sync:       /api/${API_VERSION}/device/sync`);
      console.log(`\n🔧 ZKTeco Device Endpoints:`);
      console.log(`   Receive Attendance: POST /iclock/cdata`);
      console.log(`   Send Commands:      GET  /iclock/getrequest`);
      console.log(`   Command Confirm:    POST /iclock/devicecmd`);
      console.log('\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, closing server gracefully...');
  pool.end(() => {
    console.log('✅ Database connection closed');
    process.exit(0);
  });
});

// Start the server
startServer();

module.exports = app;
