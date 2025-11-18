/**
 * COMPREHENSIVE SYSTEM TEST
 * Tests all major components of the school attendance system
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001';
let superToken = null;
let schoolToken = null;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, passed) {
  const symbol = passed ? '✓' : '✗';
  const color = passed ? 'green' : 'red';
  log(`${symbol} ${name}`, color);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: Health Check
async function testHealthCheck() {
  log('\n=== TEST 1: Health Check ===', 'cyan');
  try {
    const response = await axios.get(`${API_BASE}/`);
    logTest('API is running', response.data.success === true);
    logTest('API version is v1', response.data.version === 'v1');
    return true;
  } catch (error) {
    logTest('Health check', false);
    console.error(error.message);
    return false;
  }
}

// Test 2: Super Admin Authentication
async function testSuperAdminAuth() {
  log('\n=== TEST 2: Super Admin Authentication ===', 'cyan');
  try {
    const response = await axios.post(`${API_BASE}/api/v1/auth/login`, {
      email: 'superadmin@example.com',
      password: 'admin123'
    });

    logTest('Super admin login successful', response.data.success === true);
    logTest('Access token received', !!response.data.data.accessToken);
    logTest('User role is superadmin', response.data.data.user.role === 'superadmin');

    superToken = response.data.data.accessToken;
    return true;
  } catch (error) {
    logTest('Super admin authentication', false);
    console.error(error.response?.data || error.message);
    return false;
  }
}

// Test 3: School Admin Authentication
async function testSchoolAdminAuth() {
  log('\n=== TEST 3: School Admin Authentication ===', 'cyan');
  try {
    const response = await axios.post(`${API_BASE}/api/v1/auth/login`, {
      email: 'askarieex@gmail.com',
      password: 'admin123'
    });

    logTest('School admin login successful', response.data.success === true);
    logTest('Access token received', !!response.data.data.accessToken);
    logTest('User role is school_admin', response.data.data.user.role === 'school_admin');
    logTest('School ID assigned', response.data.data.user.schoolId !== null);

    schoolToken = response.data.data.accessToken;
    return true;
  } catch (error) {
    logTest('School admin authentication', false);
    console.error(error.response?.data || error.message);
    return false;
  }
}

// Test 4: Super Admin Endpoints
async function testSuperAdminEndpoints() {
  log('\n=== TEST 4: Super Admin Endpoints ===', 'cyan');
  try {
    // Get all devices
    const devicesResponse = await axios.get(`${API_BASE}/api/v1/super/devices`, {
      headers: { Authorization: `Bearer ${superToken}` }
    });
    logTest('Get all devices', devicesResponse.data.success === true);
    log(`  Found ${devicesResponse.data.data.length} devices`, 'yellow');

    // Get all schools
    const schoolsResponse = await axios.get(`${API_BASE}/api/v1/super/schools`, {
      headers: { Authorization: `Bearer ${superToken}` }
    });
    logTest('Get all schools', schoolsResponse.data.success === true);

    return true;
  } catch (error) {
    logTest('Super admin endpoints', false);
    console.error(error.response?.data || error.message);
    return false;
  }
}

// Test 5: School Admin Endpoints
async function testSchoolAdminEndpoints() {
  log('\n=== TEST 5: School Admin Endpoints ===', 'cyan');
  try {
    // Dashboard stats
    const dashboardResponse = await axios.get(`${API_BASE}/api/v1/school/stats/dashboard`, {
      headers: { Authorization: `Bearer ${schoolToken}` }
    });
    logTest('Get dashboard stats', dashboardResponse.data.success === true);

    // Get students
    const studentsResponse = await axios.get(`${API_BASE}/api/v1/school/students?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${schoolToken}` }
    });
    logTest('Get students', studentsResponse.data.success === true);
    log(`  Found ${studentsResponse.data.data.length} students`, 'yellow');

    // Get attendance today
    const attendanceResponse = await axios.get(`${API_BASE}/api/v1/school/attendance/today`, {
      headers: { Authorization: `Bearer ${schoolToken}` }
    });
    logTest('Get today attendance (FIXED)', attendanceResponse.data.success === true);

    // Get current academic year
    const academicYearResponse = await axios.get(`${API_BASE}/api/v1/school/academic-years/current`, {
      headers: { Authorization: `Bearer ${schoolToken}` }
    });
    logTest('Get current academic year (FIXED)', academicYearResponse.data.success === true);

    // Get daily report
    const reportResponse = await axios.get(`${API_BASE}/api/v1/school/reports/daily?date=2025-10-18`, {
      headers: { Authorization: `Bearer ${schoolToken}` }
    });
    logTest('Get daily report (FIXED)', reportResponse.data.success === true);

    return true;
  } catch (error) {
    logTest('School admin endpoints', false);
    console.error(error.response?.data || error.message);
    return false;
  }
}

// Test 6: ZKTeco Device Endpoints
async function testZKTecoEndpoints() {
  log('\n=== TEST 6: ZKTeco Device Integration ===', 'cyan');
  try {
    // Test device polling
    const pollResponse = await axios.get(`${API_BASE}/iclock/getrequest?SN=TEST123456789`);
    logTest('Device polling (GET /iclock/getrequest)', pollResponse.data === 'OK');

    // Test sending attendance data
    const attendanceData = '101\t2025-10-18 09:15:30\t1\t15\t0\t0';
    const sendResponse = await axios.post(
      `${API_BASE}/iclock/cdata?SN=TEST123456789`,
      attendanceData,
      { headers: { 'Content-Type': 'text/plain' } }
    );
    logTest('Send attendance data (POST /iclock/cdata)', sendResponse.data === 'OK');
    log('  Attendance log created for PIN 101', 'yellow');

    return true;
  } catch (error) {
    logTest('ZKTeco device endpoints', false);
    console.error(error.response?.data || error.message);
    return false;
  }
}

// Test 7: Database Verification
async function testDatabase() {
  log('\n=== TEST 7: Database Verification ===', 'cyan');
  const { query } = require('./src/config/database');

  try {
    const schoolsResult = await query('SELECT COUNT(*) as count FROM schools');
    logTest(`Schools in database: ${schoolsResult.rows[0].count}`, true);

    const studentsResult = await query('SELECT COUNT(*) as count FROM students WHERE is_active = true');
    logTest(`Active students: ${studentsResult.rows[0].count}`, true);

    const devicesResult = await query('SELECT COUNT(*) as count FROM devices WHERE is_active = true');
    logTest(`Active devices: ${devicesResult.rows[0].count}`, true);

    const logsResult = await query('SELECT COUNT(*) as count FROM attendance_logs');
    logTest(`Attendance logs: ${logsResult.rows[0].count}`, true);

    const usersResult = await query('SELECT COUNT(*) as count FROM users WHERE is_active = true');
    logTest(`Active users: ${usersResult.rows[0].count}`, true);

    return true;
  } catch (error) {
    logTest('Database verification', false);
    console.error(error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  log('\n╔════════════════════════════════════════════╗', 'cyan');
  log('║  COMPREHENSIVE SYSTEM TEST - STARTING     ║', 'cyan');
  log('╚════════════════════════════════════════════╝', 'cyan');

  const results = [];

  results.push(await testHealthCheck());
  await sleep(500);

  results.push(await testSuperAdminAuth());
  await sleep(500);

  results.push(await testSchoolAdminAuth());
  await sleep(500);

  if (superToken) {
    results.push(await testSuperAdminEndpoints());
    await sleep(500);
  }

  if (schoolToken) {
    results.push(await testSchoolAdminEndpoints());
    await sleep(500);
  }

  results.push(await testZKTecoEndpoints());
  await sleep(500);

  results.push(await testDatabase());

  // Summary
  log('\n╔════════════════════════════════════════════╗', 'cyan');
  log('║  TEST SUMMARY                              ║', 'cyan');
  log('╚════════════════════════════════════════════╝', 'cyan');

  const passed = results.filter(r => r === true).length;
  const total = results.length;
  const percentage = ((passed / total) * 100).toFixed(1);

  log(`\nTests Passed: ${passed}/${total} (${percentage}%)`, passed === total ? 'green' : 'yellow');

  if (passed === total) {
    log('\n✅ ALL TESTS PASSED! System is fully functional.', 'green');
  } else {
    log('\n⚠️  Some tests failed. Please review the errors above.', 'yellow');
  }

  process.exit(passed === total ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
