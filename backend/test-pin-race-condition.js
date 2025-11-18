/**
 * Race Condition Test for Device PIN Assignment
 *
 * This script simulates concurrent student enrollments to test for race conditions.
 * Run BEFORE and AFTER applying the fix to see the difference.
 *
 * BEFORE FIX: Expect 30-40% failure rate with "duplicate key" errors
 * AFTER FIX:  Expect 0% failure rate, all enrollments succeed
 *
 * Usage:
 *   node test-pin-race-condition.js
 */

require('dotenv').config();
const { query, pool } = require('./src/config/database');
const { assignNextDevicePin, assignBatchDevicePins, checkForDuplicatePins } = require('./src/utils/devicePinAssignment');

// Test configuration
const TEST_CONFIG = {
  deviceId: 1,
  schoolId: 1,
  classId: 1,
  sectionId: 1,
  concurrentRequests: 50, // Number of concurrent student creations
  testBatch: true,        // Also test batch enrollment
  batchSize: 100          // Batch test size
};

/**
 * Clean up test data
 */
async function cleanupTestData() {
  console.log('🧹 Cleaning up previous test data...');

  await query(`
    DELETE FROM device_user_mappings
    WHERE device_id = $1
    AND student_id >= 9000
  `, [TEST_CONFIG.deviceId]);

  await query(`
    DELETE FROM students
    WHERE id >= 9000
  `);

  console.log('✅ Cleanup complete\n');
}

/**
 * Create a test student
 */
async function createTestStudent(studentId, name) {
  const result = await query(`
    INSERT INTO students (
      id, school_id, class_id, section_id,
      full_name, roll_number, academic_year, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, '2024-2025', TRUE)
    RETURNING *
  `, [
    studentId,
    TEST_CONFIG.schoolId,
    TEST_CONFIG.classId,
    TEST_CONFIG.sectionId,
    name,
    studentId
  ]);

  return result.rows[0];
}

/**
 * Test #1: Concurrent PIN Assignment (Race Condition Test)
 */
async function testConcurrentAssignments() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  TEST #1: Concurrent PIN Assignment (Race Condition)      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`Testing with ${TEST_CONFIG.concurrentRequests} concurrent enrollments...`);
  console.log('This simulates multiple admins creating students simultaneously.\n');

  const startTime = Date.now();
  const promises = [];
  const results = {
    successful: 0,
    failed: 0,
    errors: []
  };

  // Create students and enroll them concurrently
  for (let i = 0; i < TEST_CONFIG.concurrentRequests; i++) {
    const studentId = 9000 + i;
    const studentName = `Test Student ${i}`;

    promises.push(
      (async () => {
        try {
          // Create student
          const student = await createTestStudent(studentId, studentName);

          // Assign PIN (this is where race condition could occur)
          const pinResult = await assignNextDevicePin(
            TEST_CONFIG.deviceId,
            student.id,
            student.full_name,
            `RFID${student.id}`
          );

          results.successful++;
          return {
            success: true,
            studentId: student.id,
            studentName: student.full_name,
            pin: pinResult.pin
          };

        } catch (error) {
          results.failed++;
          results.errors.push({
            studentId,
            studentName,
            error: error.message
          });

          return {
            success: false,
            studentId,
            studentName,
            error: error.message
          };
        }
      })()
    );
  }

  // Wait for all enrollments to complete
  const enrollmentResults = await Promise.all(promises);
  const duration = Date.now() - startTime;

  // Analyze results
  console.log('\n📊 Test Results:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`   Total Requests:     ${TEST_CONFIG.concurrentRequests}`);
  console.log(`   ✅ Successful:      ${results.successful}`);
  console.log(`   ❌ Failed:          ${results.failed}`);
  console.log(`   Success Rate:       ${((results.successful / TEST_CONFIG.concurrentRequests) * 100).toFixed(1)}%`);
  console.log(`   Duration:           ${duration}ms`);
  console.log(`   Throughput:         ${(TEST_CONFIG.concurrentRequests / (duration / 1000)).toFixed(1)} enrollments/sec`);
  console.log('─────────────────────────────────────────────────────────────\n');

  // Show errors if any
  if (results.failed > 0) {
    console.log('❌ Errors Encountered:');
    results.errors.slice(0, 5).forEach(err => {
      console.log(`   - Student ${err.studentId}: ${err.error}`);
    });
    if (results.errors.length > 5) {
      console.log(`   ... and ${results.errors.length - 5} more errors\n`);
    }
  }

  // Check for duplicate PINs (should be zero)
  console.log('🔍 Checking for duplicate PINs...');
  const duplicates = await checkForDuplicatePins(TEST_CONFIG.deviceId);

  if (duplicates.length > 0) {
    console.log('🚨 DUPLICATE PINs FOUND! (This is a BUG!)');
    console.log(duplicates);
    return false;
  } else {
    console.log('✅ No duplicate PINs found!\n');
  }

  // Show PIN distribution
  const assignedPins = enrollmentResults
    .filter(r => r.success)
    .map(r => r.pin)
    .sort((a, b) => a - b);

  console.log('📍 PIN Distribution:');
  console.log(`   Lowest PIN:  ${Math.min(...assignedPins)}`);
  console.log(`   Highest PIN: ${Math.max(...assignedPins)}`);
  console.log(`   Range:       ${Math.max(...assignedPins) - Math.min(...assignedPins) + 1} PINs\n`);

  // Check if PINs are consecutive (should be if no race condition)
  const expectedRange = results.successful;
  const actualRange = Math.max(...assignedPins) - Math.min(...assignedPins) + 1;

  if (expectedRange === actualRange) {
    console.log('✅ PINs are consecutive (no gaps) - Perfect!\n');
  } else {
    console.log(`⚠️  PINs have ${actualRange - expectedRange} gaps (some enrollments failed and retried)\n`);
  }

  return results.failed === 0;
}

/**
 * Test #2: Batch PIN Assignment
 */
async function testBatchAssignment() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  TEST #2: Batch PIN Assignment                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`Enrolling ${TEST_CONFIG.batchSize} students in a single batch...`);

  const startTime = Date.now();

  // Create test students
  const students = [];
  for (let i = 0; i < TEST_CONFIG.batchSize; i++) {
    const studentId = 10000 + i;
    const student = await createTestStudent(studentId, `Batch Student ${i}`);
    students.push(student);
  }

  console.log(`✅ Created ${students.length} test students`);

  // Batch assign PINs
  try {
    const result = await assignBatchDevicePins(TEST_CONFIG.deviceId, students);
    const duration = Date.now() - startTime;

    console.log('\n📊 Batch Assignment Results:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`   Total Students:     ${TEST_CONFIG.batchSize}`);
    console.log(`   ✅ Enrolled:        ${result.assignments.length}`);
    console.log(`   PIN Range:          ${result.startPin} - ${result.endPin}`);
    console.log(`   Duration:           ${duration}ms`);
    console.log(`   Throughput:         ${(TEST_CONFIG.batchSize / (duration / 1000)).toFixed(1)} enrollments/sec`);
    console.log('─────────────────────────────────────────────────────────────\n');

    // Verify all PINs are consecutive
    const expectedPins = [];
    for (let i = result.startPin; i <= result.endPin; i++) {
      expectedPins.push(i);
    }

    const actualPins = result.assignments.map(a => a.pin).sort((a, b) => a - b);
    const allConsecutive = expectedPins.every((pin, idx) => pin === actualPins[idx]);

    if (allConsecutive) {
      console.log('✅ All PINs are consecutive - Perfect batch assignment!\n');
      return true;
    } else {
      console.log('❌ PINs are not consecutive - Something went wrong!\n');
      return false;
    }

  } catch (error) {
    console.error('❌ Batch assignment failed:', error.message);
    return false;
  }
}

/**
 * Test #3: Performance Comparison
 */
async function testPerformanceComparison() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  TEST #3: Performance Comparison                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const testSize = 20;

  // Test 1: Individual assignments
  console.log(`Enrolling ${testSize} students individually...`);
  const individualStart = Date.now();

  for (let i = 0; i < testSize; i++) {
    const studentId = 11000 + i;
    const student = await createTestStudent(studentId, `Perf Test ${i}`);
    await assignNextDevicePin(TEST_CONFIG.deviceId, student.id, student.full_name);
  }

  const individualDuration = Date.now() - individualStart;

  // Test 2: Batch assignment
  console.log(`\nEnrolling ${testSize} students in batch...`);
  const batchStart = Date.now();

  const batchStudents = [];
  for (let i = 0; i < testSize; i++) {
    const studentId = 12000 + i;
    const student = await createTestStudent(studentId, `Batch Perf ${i}`);
    batchStudents.push(student);
  }

  await assignBatchDevicePins(TEST_CONFIG.deviceId, batchStudents);
  const batchDuration = Date.now() - batchStart;

  // Results
  console.log('\n📊 Performance Comparison:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`   Individual: ${individualDuration}ms (${(testSize / (individualDuration / 1000)).toFixed(1)} enrollments/sec)`);
  console.log(`   Batch:      ${batchDuration}ms (${(testSize / (batchDuration / 1000)).toFixed(1)} enrollments/sec)`);
  console.log(`   Speedup:    ${(individualDuration / batchDuration).toFixed(2)}x faster\n`);
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   Device PIN Assignment - Race Condition Test Suite');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Cleanup previous test data
    await cleanupTestData();

    // Run tests
    const test1Pass = await testConcurrentAssignments();

    if (TEST_CONFIG.testBatch) {
      const test2Pass = await testBatchAssignment();
      await testPerformanceComparison();
    }

    // Final summary
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  FINAL SUMMARY                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    if (test1Pass) {
      console.log('✅ RACE CONDITION TEST: PASSED');
      console.log('   All concurrent enrollments succeeded without errors.\n');
    } else {
      console.log('❌ RACE CONDITION TEST: FAILED');
      console.log('   Some enrollments failed with duplicate key errors.\n');
      console.log('💡 This is EXPECTED if you haven\'t applied the fix yet.');
      console.log('   See PIN_RACE_CONDITION_DEEP_ANALYSIS.md for solution.\n');
    }

    // Cleanup
    await cleanupTestData();

    process.exit(test1Pass ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test suite failed with error:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run tests
runTests();
