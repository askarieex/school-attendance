const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// ✅ SECURITY FIX: Validate JWT_SECRET strength at startup
console.log('🔐 Validating JWT_SECRET configuration...');

if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL SECURITY ERROR: JWT_SECRET is not set!');
  console.error('   Set JWT_SECRET in your .env file');
  console.error('   Generate strong secret: openssl rand -base64 32');
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
  console.error('❌ FATAL SECURITY ERROR: JWT_SECRET is too weak!');
  console.error(`   Current length: ${process.env.JWT_SECRET.length} characters`);
  console.error('   Required: At least 32 characters');
  console.error('   Generate strong secret: openssl rand -base64 32');
  process.exit(1);
}

// Check against common weak secrets
const weakSecrets = [
  'secret', 'jwt_secret', 'your_secret_here', 'change_me',
  'your_jwt_secret', 'jwt', 'token', 'password', 'secret123',
  'mysecret', 'jwtsecret', 'secretkey', 'key', 'mykey'
];

if (weakSecrets.includes(process.env.JWT_SECRET.toLowerCase())) {
  console.error('❌ FATAL SECURITY ERROR: JWT_SECRET is too common!');
  console.error(`   Current: [REDACTED - common weak secret detected]`);
  console.error('   This is a well-known weak secret that can be easily guessed');
  console.error('   Generate strong secret: openssl rand -base64 32');
  process.exit(1);
}

// Validate JWT_REFRESH_SECRET if provided (optional)
if (process.env.JWT_REFRESH_SECRET) {
  if (process.env.JWT_REFRESH_SECRET === process.env.JWT_SECRET) {
    console.warn('⚠️  WARNING: JWT_REFRESH_SECRET is same as JWT_SECRET');
    console.warn('   Best practice: Use different secrets for access and refresh tokens');
  }

  if (process.env.JWT_REFRESH_SECRET.length < 32) {
    console.error('❌ FATAL SECURITY ERROR: JWT_REFRESH_SECRET is too weak!');
    process.exit(1);
  }
}

console.log('✅ JWT_SECRET validated successfully');
console.log(`   Length: ${process.env.JWT_SECRET.length} characters ✅`);
console.log(`   Strength: Strong 🔒`);


// Import routes
const authRoutes = require('./routes/auth.routes');
const superAdminRoutes = require('./routes/superAdmin.routes');
const schoolRoutes = require('./routes/school.routes');
const teacherRoutes = require('./routes/teacher.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const deviceSyncRoutes = require('./routes/deviceSync.routes');
const deviceManagementRoutes = require('./routes/deviceManagement.routes');
const holidayRoutes = require('./routes/holiday.routes');
const leaveRoutes = require('./routes/leave.routes');
const iclockRoutes = require('./routes/iclock');
const whatsappRoutes = require('./routes/whatsapp.routes');
const subjectRoutes = require('./routes/subject.routes');
const autoAbsenceRoutes = require('./routes/autoAbsence.routes');
const databaseRoutes = require('./routes/database.routes');


// Import middleware
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Import database connection
const { pool } = require('./config/database');

// Initialize express app
const app = express();

/**
 * MIDDLEWARE
 */

// ✅ FIX: Trust proxy for Nginx reverse proxy (fixes rate limiting errors)
// When behind Nginx, Express needs to trust the X-Forwarded-* headers
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust first proxy (Nginx)
  console.log('✅ Trust proxy enabled for production (Nginx)');
}

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'];

    if (allowedOrigins.indexOf(origin) !== -1) {
      // Origin is in whitelist
      callback(null, true);
    } else {
      // Origin not in whitelist - reject
      console.warn(`⚠️  CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
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
  // ✅ SECURITY FIX: Don't skip rate limiting, use higher limit in dev
  max: process.env.NODE_ENV === 'production' ? 100 : 10000
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
  max: process.env.NODE_ENV === 'production' ? 500 : 5000, // ✅ SECURITY FIX: Higher in dev, always enabled
  message: 'ERROR: Too many requests',
  standardHeaders: false // Devices don't understand these headers
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
app.use(`/api/${API_VERSION}/super/database`, databaseRoutes);

app.use(`/api/${API_VERSION}/teacher`, teacherRoutes);
// IMPORTANT: Mount specific /school/* routes BEFORE /school to prevent route conflicts
app.use(`/api/${API_VERSION}/school/holidays`, holidayRoutes);
app.use(`/api/${API_VERSION}/school/leaves`, leaveRoutes);
app.use(`/api/${API_VERSION}/school/subjects`, subjectRoutes);
app.use(`/api/${API_VERSION}/school/auto-absence`, autoAbsenceRoutes);
app.use(`/api/${API_VERSION}/school`, schoolRoutes);
app.use(`/api/${API_VERSION}/attendance`, attendanceRoutes);
app.use(`/api/${API_VERSION}/device/sync`, deviceSyncRoutes);
app.use(`/api/${API_VERSION}/device-management`, deviceManagementRoutes);
app.use(`/api/${API_VERSION}/whatsapp`, whatsappRoutes);

// 🧪 TEST COMMANDS - Manual device command testing
const testCommandsRoutes = require('./routes/testCommands');
app.use(`/api/${API_VERSION}/test`, testCommandsRoutes);

// ❌ DISABLED: Automatic time synchronization service
// REASON: ZKTeco PUSH protocol time sync does not work reliably with this device firmware
// SOLUTION: Set time manually on device using physical menu or web interface
// Device will maintain accurate time once set correctly
/*
console.log('⏰ Starting Automatic Time Sync Service...');
const AutoTimeSyncService = require('./services/autoTimeSync');
AutoTimeSyncService.start();
*/

// ✅ ENABLED: Automatic Absence Detection Service
// PURPOSE: Auto-mark students absent if they don't scan RFID within grace period
// SCHEDULE: Runs daily at 11:00 AM (configurable per school)
// HOW IT WORKS:
//   1. School opens at 9:00 AM (configurable)
//   2. Grace period: 2 hours (configurable)
//   3. At 11:00 AM, system checks all students
//   4. Students with no attendance record → marked absent
//   5. WhatsApp notification sent to parents
console.log('🔍 Starting Automatic Absence Detection Service...');
const autoAbsenceService = require('./services/autoAbsenceDetection');
autoAbsenceService.start();

// ✅ ENABLED: Student Sync Verification Service
// PURPOSE: Ensure device user list matches database
// SCHEDULE: Runs every 2 hours
// HOW IT WORKS:
//   1. Get students from database (should be in device)
//   2. Get students from sync_status table (are in device)
//   3. Find missing students → Queue add commands
//   4. Find extra students → Queue delete commands
//   5. Retry failed syncs (up to 3 attempts)
console.log('🔄 Starting Student Sync Verification Service...');
const studentSyncService = require('./services/studentSyncVerification');
studentSyncService.start();

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

    // ✅ SECURITY FIX: Add WebSocket authentication middleware
    const { verifyToken } = require('./utils/auth');

    io.use((socket, next) => {
      try {
        // Get token from handshake
        const token = socket.handshake.auth.token;

        if (!token) {
          console.warn('⚠️  WebSocket connection attempt without token');
          return next(new Error('Authentication required'));
        }

        // Verify JWT token
        const decoded = verifyToken(token);

        // Attach user info to socket
        socket.userId = decoded.userId;
        socket.userRole = decoded.role;
        socket.schoolId = decoded.schoolId;
        socket.userEmail = decoded.email;

        console.log(`✅ WebSocket authenticated: ${socket.userEmail} (${socket.userRole})`);
        next();
      } catch (err) {
        console.error('❌ WebSocket authentication failed:', err.message);
        next(new Error('Invalid or expired token'));
      }
    });

    // Socket.io connection handling
    io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id} (User: ${socket.userEmail})`);

      // Join school-specific room (for multi-tenancy)
      // ✅ SECURITY FIX: Verify user has access to the school
      socket.on('join-school', (requestedSchoolId) => {
        if (!requestedSchoolId) {
          socket.emit('error', 'School ID is required');
          return;
        }

        const parsedSchoolId = parseInt(requestedSchoolId);

        // ✅ Superadmins can join any school room
        if (socket.userRole === 'superadmin') {
          socket.join(`school-${parsedSchoolId}`);
          console.log(`📚 Superadmin ${socket.userEmail} joined school-${parsedSchoolId}`);
          socket.emit('joined-school', { schoolId: parsedSchoolId, role: 'superadmin' });
          return;
        }

        // ✅ Regular users can only join their own school
        if (socket.schoolId === parsedSchoolId) {
          socket.join(`school-${parsedSchoolId}`);
          console.log(`📚 ${socket.userRole} ${socket.userEmail} joined school-${parsedSchoolId}`);
          socket.emit('joined-school', { schoolId: parsedSchoolId, role: socket.userRole });
        } else {
          console.warn(`🚨 Security: ${socket.userEmail} tried to join school-${parsedSchoolId} (their school: ${socket.schoolId})`);
          socket.emit('error', 'Access denied: You can only join your own school');
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
      console.log(`   Time Sync (Stage 2): GET  /iclock/rtdata`);
      console.log('\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// ✅ CRITICAL FIX (Bug #10): Enhanced error handling for unhandled rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ CRITICAL: Unhandled Promise Rejection detected!');
  console.error('   Reason:', reason);
  console.error('   Promise:', promise);
  console.error('   Stack:', reason instanceof Error ? reason.stack : 'No stack trace available');
  console.error('   Time:', new Date().toISOString());

  // Log to file or external service in production
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to error tracking service (Sentry, Rollbar, etc.)
    console.error('   Shutting down gracefully due to unhandled rejection...');

    // Give time for cleanup
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  } else {
    // In development, log but don't exit immediately
    console.warn('   ⚠️  Development mode: Server continues running. Fix this promise rejection!');
  }
});

// ✅ CRITICAL FIX (Bug #10): Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ CRITICAL: Uncaught Exception detected!');
  console.error('   Error:', err.message);
  console.error('   Stack:', err.stack);
  console.error('   Time:', new Date().toISOString());

  // Log to file or external service
  if (process.env.NODE_ENV === 'production') {
    console.error('   Shutting down immediately due to uncaught exception...');
  }

  // Uncaught exceptions are serious - always exit
  process.exit(1);
});

// Handle SIGTERM (graceful shutdown)
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, closing server gracefully...');
  pool.end(() => {
    console.log('✅ Database connection closed');
    process.exit(0);
  });
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\n👋 SIGINT received (Ctrl+C), closing server gracefully...');
  pool.end(() => {
    console.log('✅ Database connection closed');
    process.exit(0);
  });
});

// Start the server
startServer();

module.exports = app;
