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
const whatsappRoutes = require('./routes/whatsapp.routes');
const subjectRoutes = require('./routes/subject.routes');

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

// 🖼️ Serve static files (student photos)
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// 🔒 IMPROVED: Rate limiting - Protection against DOS attacks
// Separate limits for API endpoints vs device endpoints

// API rate limiting (for dashboard/admin)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 100 req/min in prod, 1000 in dev
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development'
});

// Strict rate limiting for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 failed login attempts per 15 minutes
  message: {
    success: false,
    error: 'Too many login attempts from this IP, please try again after 15 minutes.',
    retryAfter: 900
  },
  skipSuccessfulRequests: true, // Don't count successful logins
  standardHeaders: true
});

// Device rate limiting (more lenient for biometric devices)
const deviceLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500, // 500 req/min (for bulk attendance uploads)
  message: 'ERROR: Too many requests',
  standardHeaders: false, // Devices don't understand these headers
  skip: (req) => process.env.NODE_ENV === 'development'
});

// Apply rate limiters
app.use('/api/', apiLimiter);
app.use('/api/*/auth/login', authLimiter);
app.use('/api/*/auth/refresh', authLimiter);
app.use('/iclock/', deviceLimiter);

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
app.use(`/api/${API_VERSION}/school/subjects`, subjectRoutes);
app.use(`/api/${API_VERSION}/school`, schoolRoutes);
app.use(`/api/${API_VERSION}/attendance`, attendanceRoutes);
app.use(`/api/${API_VERSION}/device/sync`, deviceSyncRoutes);
app.use(`/api/${API_VERSION}/whatsapp`, whatsappRoutes);

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

    // Create HTTP server
    const http = require('http');
    const server = http.createServer(app);

    // Initialize Socket.io
    const { Server } = require('socket.io');
    const io = new Server(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      path: '/socket.io/'
    });

    // Store io instance globally for use in other modules
    app.set('io', io);

    // Socket.io connection handling
    io.on('connection', (socket) => {
      console.log('🔌 Client connected:', socket.id);

      // Join school-specific room (for multi-tenancy)
      socket.on('join-school', (schoolId) => {
        if (schoolId) {
          socket.join(`school-${schoolId}`);
          console.log(`📚 Socket ${socket.id} joined school-${schoolId}`);
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
      });
    });

    // Start server
    server.listen(PORT, () => {
      console.log(`\n🚀 Server is running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📡 API Base URL: http://localhost:${PORT}/api/${API_VERSION}`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
      console.log(`\n📚 Available Endpoints:`);
      console.log(`   Authentication:    /api/${API_VERSION}/auth`);
      console.log(`   Super Admin:       /api/${API_VERSION}/super`);
      console.log(`   School Admin:      /api/${API_VERSION}/school`);
      console.log(`   Holidays:          /api/${API_VERSION}/school/holidays`);
      console.log(`   Hardware Devices:  /api/${API_VERSION}/attendance`);
      console.log(`   Device Sync:       /api/${API_VERSION}/device/sync`);
      console.log(`   WhatsApp API:      /api/${API_VERSION}/whatsapp`);
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
