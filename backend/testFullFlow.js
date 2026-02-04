/**
 * Full API Flow Test Script
 * Tests the complete teacher dashboard flow including:
 * 1. Teacher Login
 * 2. Fetch assigned classes
 * 3. Fetch students in a section
 * 4. Fetch attendance status
 * 5. Mark attendance
 * 6. Verify stats update
 */

const axios = require('axios');

// ✅ Using PRODUCTION API
const BASE_URL = 'https://adtenz.site/api/v1';

// Test credentials - update these with actual test teacher credentials
const TEST_TEACHER = {
    email: 'teacher@test.com',
    password: 'Teacher@123'
};

let accessToken = null;
let refreshToken = null;
let testSectionId = null;
let testStudentId = null;

// Helper to colorize output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(type, message, data = null) {
    const icons = {
        success: `${colors.green}✅`,
        error: `${colors.red}❌`,
        info: `${colors.blue}ℹ️`,
        warn: `${colors.yellow}⚠️`,
        test: `${colors.cyan}🧪`
    };
    console.log(`${icons[type] || ''} ${message}${colors.reset}`);
    if (data) {
        console.log(`   ${JSON.stringify(data, null, 2).split('\n').join('\n   ')}`);
    }
}

function logStep(step, description) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`${colors.cyan}STEP ${step}: ${description}${colors.reset}`);
    console.log(`${'═'.repeat(60)}`);
}

async function testHealthCheck() {
    logStep(0, 'Health Check');
    try {
        const start = Date.now();
        const response = await axios.get(`${BASE_URL}/health`);
        const duration = Date.now() - start;
        log('success', `Backend is healthy (${duration}ms)`);
        return true;
    } catch (error) {
        log('error', 'Backend health check failed', error.message);
        return false;
    }
}

async function testTeacherLogin() {
    logStep(1, 'Teacher Login');
    try {
        const start = Date.now();
        const response = await axios.post(`${BASE_URL}/auth/teacher/login`, TEST_TEACHER);
        const duration = Date.now() - start;

        if (response.data.success) {
            accessToken = response.data.data.accessToken;
            refreshToken = response.data.data.refreshToken;
            log('success', `Login successful (${duration}ms)`);
            log('info', 'Teacher info:', {
                id: response.data.data.teacher.id,
                name: response.data.data.teacher.name,
                email: response.data.data.teacher.email,
                school: response.data.data.teacher.school_name
            });
            return true;
        } else {
            log('error', 'Login failed', response.data.message);
            return false;
        }
    } catch (error) {
        log('error', 'Login request failed', error.response?.data || error.message);
        return false;
    }
}

async function testFetchAssignedClasses() {
    logStep(2, 'Fetch Assigned Classes/Sections');
    try {
        const start = Date.now();
        const response = await axios.get(`${BASE_URL}/teacher/my-sections`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const duration = Date.now() - start;

        if (response.data.success) {
            const sections = response.data.data;
            log('success', `Fetched ${sections.length} assigned sections (${duration}ms)`);

            if (sections.length > 0) {
                testSectionId = sections[0].section_id;
                log('info', 'Assigned sections:', sections.map(s => ({
                    section_id: s.section_id,
                    class: `${s.class_name}-${s.section_name}`,
                    students: s.student_count,
                    role: s.role
                })));
                return true;
            } else {
                log('warn', 'No sections assigned to this teacher');
                return false;
            }
        } else {
            log('error', 'Failed to fetch sections', response.data.message);
            return false;
        }
    } catch (error) {
        log('error', 'Fetch sections failed', error.response?.data || error.message);
        return false;
    }
}

async function testFetchStudentsInSection() {
    if (!testSectionId) {
        log('warn', 'Skipping - no section available');
        return false;
    }

    logStep(3, `Fetch Students in Section ${testSectionId}`);
    try {
        const start = Date.now();
        const response = await axios.get(`${BASE_URL}/teacher/sections/${testSectionId}/students`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const duration = Date.now() - start;

        if (response.data.success) {
            const students = response.data.data;
            log('success', `Fetched ${students.length} students (${duration}ms)`);

            if (students.length > 0) {
                testStudentId = students[0].id;
                log('info', 'First 5 students:', students.slice(0, 5).map(s => ({
                    id: s.id,
                    name: s.name,
                    roll_no: s.roll_no,
                    gender: s.gender
                })));
                return true;
            } else {
                log('warn', 'No students in this section');
                return false;
            }
        } else {
            log('error', 'Failed to fetch students', response.data.message);
            return false;
        }
    } catch (error) {
        log('error', 'Fetch students failed', error.response?.data || error.message);
        return false;
    }
}

async function testFetchTodayAttendance() {
    if (!testSectionId) {
        log('warn', 'Skipping - no section available');
        return false;
    }

    logStep(4, "Fetch Today's Attendance");
    const today = new Date().toISOString().split('T')[0];

    try {
        const start = Date.now();
        const response = await axios.get(`${BASE_URL}/teacher/sections/${testSectionId}/attendance`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { date: today }
        });
        const duration = Date.now() - start;

        if (response.data.success) {
            const logs = response.data.data;
            log('success', `Fetched ${logs.length} attendance records for ${today} (${duration}ms)`);

            // Count by status
            const stats = logs.reduce((acc, log) => {
                acc[log.status] = (acc[log.status] || 0) + 1;
                return acc;
            }, {});

            log('info', 'Attendance breakdown:', stats);
            return true;
        } else {
            log('error', 'Failed to fetch attendance', response.data.message);
            return false;
        }
    } catch (error) {
        log('error', 'Fetch attendance failed', error.response?.data || error.message);
        return false;
    }
}

async function testFetchDashboardStats() {
    logStep(5, 'Fetch Dashboard Statistics');
    try {
        const start = Date.now();
        const response = await axios.get(`${BASE_URL}/teacher/dashboard/stats`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const duration = Date.now() - start;

        if (response.data.success) {
            const stats = response.data.data;
            log('success', `Fetched dashboard stats (${duration}ms)`);
            log('info', 'Dashboard stats:', {
                totalStudents: stats.totalStudents,
                presentToday: stats.presentToday,
                lateToday: stats.lateToday,
                absentToday: stats.absentToday,
                leaveToday: stats.leaveToday,
                notMarkedToday: stats.notMarkedToday,
                attendancePercentage: stats.attendancePercentage
            });
            return true;
        } else {
            log('error', 'Failed to fetch stats', response.data.message);
            return false;
        }
    } catch (error) {
        log('error', 'Fetch stats failed', error.response?.data || error.message);
        return false;
    }
}

async function testBatchAttendanceStats() {
    if (!testSectionId) {
        log('warn', 'Skipping - no section available');
        return false;
    }

    logStep(6, 'Fetch Batch Attendance Stats');
    const today = new Date().toISOString().split('T')[0];

    try {
        const start = Date.now();
        const response = await axios.get(`${BASE_URL}/teacher/dashboard/batch-attendance-stats`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: {
                sectionIds: testSectionId.toString(),
                date: today
            }
        });
        const duration = Date.now() - start;

        if (response.data.success) {
            log('success', `Fetched batch stats (${duration}ms)`);
            log('info', 'Batch stats:', response.data.data);
            return true;
        } else {
            log('error', 'Failed to fetch batch stats', response.data.message);
            return false;
        }
    } catch (error) {
        log('error', 'Fetch batch stats failed', error.response?.data || error.message);
        return false;
    }
}

async function testMarkAttendance() {
    if (!testSectionId || !testStudentId) {
        log('warn', 'Skipping - no section/student available');
        return false;
    }

    logStep(7, 'Mark Attendance (Test)');
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const checkInTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    try {
        const start = Date.now();
        const response = await axios.post(
            `${BASE_URL}/teacher/sections/${testSectionId}/attendance`,
            {
                studentId: testStudentId,
                date: today,
                status: 'present',
                checkInTime: checkInTime
            },
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const duration = Date.now() - start;

        if (response.data.success) {
            log('success', `Attendance marked successfully (${duration}ms)`);
            log('info', 'Marked:', {
                studentId: testStudentId,
                status: 'present',
                date: today,
                time: checkInTime
            });
            return true;
        } else {
            log('error', 'Failed to mark attendance', response.data.message);
            return false;
        }
    } catch (error) {
        // Check if it's a duplicate (already marked) - that's OK
        if (error.response?.status === 400 && error.response?.data?.message?.includes('already')) {
            log('info', 'Attendance already marked for this student today');
            return true;
        }
        log('error', 'Mark attendance failed', error.response?.data || error.message);
        return false;
    }
}

async function testFetchHolidays() {
    logStep(8, 'Fetch Holidays');
    try {
        const start = Date.now();
        const response = await axios.get(`${BASE_URL}/teacher/holidays`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const duration = Date.now() - start;

        if (response.data.success) {
            const holidays = response.data.data;
            log('success', `Fetched ${holidays.length} holidays (${duration}ms)`);
            if (holidays.length > 0) {
                log('info', 'Sample holidays:', holidays.slice(0, 3));
            }
            return true;
        } else {
            log('error', 'Failed to fetch holidays', response.data.message);
            return false;
        }
    } catch (error) {
        log('error', 'Fetch holidays failed', error.response?.data || error.message);
        return false;
    }
}

async function testTokenRefresh() {
    logStep(9, 'Token Refresh');
    try {
        const start = Date.now();
        const response = await axios.post(`${BASE_URL}/auth/refresh`, {
            refreshToken: refreshToken
        });
        const duration = Date.now() - start;

        if (response.data.success) {
            log('success', `Token refreshed successfully (${duration}ms)`);
            accessToken = response.data.data.accessToken;
            return true;
        } else {
            log('error', 'Token refresh failed', response.data.message);
            return false;
        }
    } catch (error) {
        log('error', 'Token refresh request failed', error.response?.data || error.message);
        return false;
    }
}

// Main test runner
async function runAllTests() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║         SCHOOL ATTENDANCE APP - FULL API FLOW TEST            ║');
    console.log('║                    Testing All Endpoints                       ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\nTest started at: ${new Date().toLocaleString()}`);
    console.log(`Base URL: ${BASE_URL}\n`);

    const results = {};
    const startTime = Date.now();

    // Run tests in sequence
    results.health = await testHealthCheck();
    if (!results.health) {
        log('error', 'Backend not running. Please start the backend first.');
        return;
    }

    results.login = await testTeacherLogin();
    if (!results.login) {
        log('error', 'Cannot proceed without login. Check credentials.');
        return;
    }

    results.sections = await testFetchAssignedClasses();
    results.students = await testFetchStudentsInSection();
    results.attendance = await testFetchTodayAttendance();
    results.dashboardStats = await testFetchDashboardStats();
    results.batchStats = await testBatchAttendanceStats();
    results.markAttendance = await testMarkAttendance();
    results.holidays = await testFetchHolidays();
    results.tokenRefresh = await testTokenRefresh();

    // Summary
    const totalTime = Date.now() - startTime;
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                         TEST SUMMARY                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    let passed = 0;
    let failed = 0;

    Object.entries(results).forEach(([test, result]) => {
        const status = result ? `${colors.green}PASS ✅${colors.reset}` : `${colors.red}FAIL ❌${colors.reset}`;
        console.log(`  ${test.padEnd(20)} ${status}`);
        result ? passed++ : failed++;
    });

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  Total: ${passed + failed} | Passed: ${colors.green}${passed}${colors.reset} | Failed: ${colors.red}${failed}${colors.reset}`);
    console.log(`  Total time: ${totalTime}ms`);
    console.log(`${'─'.repeat(60)}\n`);

    if (failed === 0) {
        console.log(`${colors.green}🎉 ALL TESTS PASSED! The API is working correctly.${colors.reset}\n`);
    } else {
        console.log(`${colors.yellow}⚠️ Some tests failed. Please check the issues above.${colors.reset}\n`);
    }
}

// Run
runAllTests().catch(console.error);
