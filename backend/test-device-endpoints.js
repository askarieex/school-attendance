/**
 * Device Endpoints Test Script
 * This script demonstrates how to test the ZKTeco endpoints
 * Run with: node test-device-endpoints.js
 */

const API_URL = 'http://localhost:3001';

// Test configuration
const TEST_DEVICE_SN = 'TEST123456789'; // You'll need to register this device first
const TEST_DATA = {
  attendance: '101\t2025-10-18 08:45:30\t1\t15\t0\t0\n102\t2025-10-18 08:47:15\t1\t15\t0\t0',
};

async function testGetRequest() {
  console.log('\n🔵 Testing GET /iclock/getrequest...\n');

  try {
    const response = await fetch(`${API_URL}/iclock/getrequest?SN=${TEST_DEVICE_SN}`);
    const text = await response.text();

    console.log('Status:', response.status);
    console.log('Response:', text);
    console.log('✅ GET request test completed\n');

    return text;
  } catch (error) {
    console.error('❌ GET request test failed:', error.message);
  }
}

async function testPostAttendance() {
  console.log('\n🔵 Testing POST /iclock/cdata...\n');

  try {
    const response = await fetch(`${API_URL}/iclock/cdata?SN=${TEST_DEVICE_SN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: TEST_DATA.attendance,
    });

    const text = await response.text();

    console.log('Status:', response.status);
    console.log('Response:', text);
    console.log('✅ POST attendance test completed\n');

    return text;
  } catch (error) {
    console.error('❌ POST attendance test failed:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting ZKTeco Device Endpoint Tests...');
  console.log('📍 API URL:', API_URL);
  console.log('🔑 Test Device SN:', TEST_DEVICE_SN);

  console.log('\n' + '='.repeat(60));

  // Test 1: GET request (device polling for commands)
  await testGetRequest();

  console.log('='.repeat(60));

  // Test 2: POST attendance data
  await testPostAttendance();

  console.log('='.repeat(60));

  // Test 3: GET request again to see if there's a command
  await testGetRequest();

  console.log('\n✅ All tests completed!');
  console.log('\n📝 Note: If you get 401 errors, you need to:');
  console.log('   1. Add a device with serial_number = "TEST123456789" in your database');
  console.log('   2. Make sure the device is linked to a school');
  console.log('   3. Make sure is_active = TRUE');
}

// Run the tests
runTests();
