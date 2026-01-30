const { Pool } = require('pg');
require('dotenv').config();

/**
 * PostgreSQL Database Connection Pool
 * Using connection pooling for better performance
 */
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'school_attendance',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,

  // FIXED: Increased pool size for scale (was 20, now 100)
  // Supports 1000+ concurrent users instead of 20
  
  max: parseInt(process.env.DB_POOL_MAX) || 100,
  min: parseInt(process.env.DB_POOL_MIN) || 10,

  // FIXED: Increased timeout (was 2000ms, now 10000ms)
  // Prevents "connection timeout" errors during peak hours
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // 10 seconds instead of 2

  // Advanced settings for stability
  maxUses: 7500, // Close connection after 7500 queries (prevent memory leaks)
  allowExitOnIdle: false,

  // Statement timeout (kill queries that take too long)
  statement_timeout: 30000, // 30 seconds
  query_timeout: 15000, // 15 seconds

  // Application name for monitoring
  application_name: 'school-attendance-api'

});

/**
 * Test database connection
 */

pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  // Don't exit in production - just log the error
  if (process.env.NODE_ENV !== 'production') {
    process.exit(-1);
  }
});

/**
 * Connection Pool Monitoring
 * FIXED: Added monitoring to detect pool exhaustion
 */
setInterval(() => {
  const stats = {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  };

  // Log pool stats in development
  if (process.env.NODE_ENV === 'development') {
    console.log('📊 Connection Pool:', stats);
  }

  // Alert if pool is exhausted (critical in production)
  if (stats.waiting > 50) {
    console.error('⚠️ CONNECTION POOL EXHAUSTED!', stats);
    console.error('⚠️ Consider increasing DB_POOL_MAX or optimizing queries');
    // TODO: Send alert to monitoring system (PagerDuty, Slack, etc.)
  }

  // Alert if too many idle connections (memory waste)
  if (stats.idle > stats.total * 0.8 && stats.total > 20) {
    console.warn('ℹ️ Too many idle connections, consider reducing DB_POOL_MAX', stats);
  }
}, 60000); // Check every 60 seconds

/**
 * Execute a query with automatic error handling
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    // Only log queries in development mode to prevent log file overflow in production
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Executed query', { text: text.substring(0, 100) + '...', duration, rows: result.rowCount });
    }

    // Log slow queries in production (over 1 second)
    if (duration > 1000) {
      console.warn(`⚠️ SLOW QUERY (${duration}ms):`, text.substring(0, 100));
    }

    return result;
  } catch (error) {
    console.error('❌ Database query error:', error);
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 */
const getClient = async () => {
  const client = await pool.connect();
  return client;
};

module.exports = {
  pool,
  query,
  getClient,
};
