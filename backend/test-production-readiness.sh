#!/bin/bash

# =====================================================
# PRODUCTION READINESS TESTING SCRIPT
# Run this script to test all critical endpoints
# =====================================================

BASE_URL="http://localhost:3001/api/v1"
SUPER_TOKEN="" # Will be filled after login

echo "🚀 ========== PRODUCTION READINESS TESTING =========="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print test result
test_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}: $2"
  else
    echo -e "${RED}❌ FAIL${NC}: $2"
  fi
}

# =====================================================
# 1. AUTHENTICATION TESTS
# =====================================================
echo "📋 1. AUTHENTICATION TESTS"
echo "----------------------------------------------------"

# Test 1: Login with valid credentials
echo "Test 1.1: Login with valid Super Admin credentials"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"hadi@gmail.com","password":"123456"}')

SUPER_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -n "$SUPER_TOKEN" ]; then
  test_result 0 "Super Admin login successful"
  echo "   Token: ${SUPER_TOKEN:0:20}..."
else
  test_result 1 "Super Admin login failed"
  echo "   Response: $LOGIN_RESPONSE"
fi

echo ""

# Test 2: Login with invalid credentials
echo "Test 1.2: Login with invalid credentials (should fail)"
INVALID_LOGIN=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"wrong@example.com","password":"wrongpass"}')

if echo "$INVALID_LOGIN" | grep -q "401"; then
  test_result 0 "Invalid login correctly rejected"
else
  test_result 1 "Invalid login not properly rejected"
fi

echo ""

# =====================================================
# 2. SUPER ADMIN ENDPOINTS TESTS
# =====================================================
echo "📋 2. SUPER ADMIN ENDPOINTS TESTS"
echo "----------------------------------------------------"

if [ -z "$SUPER_TOKEN" ]; then
  echo -e "${RED}⚠️  Cannot test Super Admin endpoints - login failed${NC}"
else
  # Test 2.1: Get schools list
  echo "Test 2.1: Get schools list"
  SCHOOLS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/super/schools" \
    -H "Authorization: Bearer $SUPER_TOKEN")

  HTTP_CODE=$(echo "$SCHOOLS_RESPONSE" | tail -n1)
  if [ "$HTTP_CODE" = "200" ]; then
    test_result 0 "Schools list retrieved"
    SCHOOL_COUNT=$(echo "$SCHOOLS_RESPONSE" | grep -o '"id"' | wc -l)
    echo "   Found $SCHOOL_COUNT schools"
  else
    test_result 1 "Failed to get schools list (HTTP $HTTP_CODE)"
  fi

  echo ""

  # Test 2.2: Get devices list
  echo "Test 2.2: Get devices list"
  DEVICES_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/super/devices" \
    -H "Authorization: Bearer $SUPER_TOKEN")

  HTTP_CODE=$(echo "$DEVICES_RESPONSE" | tail -n1)
  if [ "$HTTP_CODE" = "200" ]; then
    test_result 0 "Devices list retrieved"
    DEVICE_COUNT=$(echo "$DEVICES_RESPONSE" | grep -o '"id"' | wc -l)
    echo "   Found $DEVICE_COUNT devices"
  else
    test_result 1 "Failed to get devices list (HTTP $HTTP_CODE)"
  fi

  echo ""

  # Test 2.3: Get users list
  echo "Test 2.3: Get users list"
  USERS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/super/users" \
    -H "Authorization: Bearer $SUPER_TOKEN")

  HTTP_CODE=$(echo "$USERS_RESPONSE" | tail -n1)
  if [ "$HTTP_CODE" = "200" ]; then
    test_result 0 "Users list retrieved"
    USER_COUNT=$(echo "$USERS_RESPONSE" | grep -o '"id"' | wc -l)
    echo "   Found $USER_COUNT users"
  else
    test_result 1 "Failed to get users list (HTTP $HTTP_CODE)"
  fi

  echo ""

  # Test 2.4: Get platform stats
  echo "Test 2.4: Get platform statistics"
  STATS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/super/stats" \
    -H "Authorization: Bearer $SUPER_TOKEN")

  HTTP_CODE=$(echo "$STATS_RESPONSE" | tail -n1)
  if [ "$HTTP_CODE" = "200" ]; then
    test_result 0 "Platform stats retrieved"
  else
    test_result 1 "Failed to get platform stats (HTTP $HTTP_CODE)"
  fi

  echo ""
fi

# =====================================================
# 3. AUTHORIZATION TESTS
# =====================================================
echo "📋 3. AUTHORIZATION TESTS"
echo "----------------------------------------------------"

# Test 3.1: Access Super Admin route without token
echo "Test 3.1: Access protected route without token (should fail)"
NO_TOKEN_RESPONSE=$(curl -s -w "%{http_code}" -X GET "$BASE_URL/super/schools")

if echo "$NO_TOKEN_RESPONSE" | grep -q "401"; then
  test_result 0 "Unauthorized access correctly blocked"
else
  test_result 1 "Unauthorized access not properly blocked"
fi

echo ""

# Test 3.2: Access Super Admin route with invalid token
echo "Test 3.2: Access protected route with invalid token (should fail)"
INVALID_TOKEN_RESPONSE=$(curl -s -w "%{http_code}" -X GET "$BASE_URL/super/schools" \
  -H "Authorization: Bearer invalid_token_here")

if echo "$INVALID_TOKEN_RESPONSE" | grep -q "401"; then
  test_result 0 "Invalid token correctly rejected"
else
  test_result 1 "Invalid token not properly rejected"
fi

echo ""

# =====================================================
# 4. INPUT VALIDATION TESTS
# =====================================================
echo "📋 4. INPUT VALIDATION TESTS"
echo "----------------------------------------------------"

if [ -n "$SUPER_TOKEN" ]; then
  # Test 4.1: Create school with missing required fields
  echo "Test 4.1: Create school with missing required fields (should fail)"
  INVALID_SCHOOL=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/super/schools" \
    -H "Authorization: Bearer $SUPER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":""}')

  if echo "$INVALID_SCHOOL" | grep -q "400"; then
    test_result 0 "Invalid school creation correctly rejected"
  else
    test_result 1 "Invalid school creation not properly validated"
  fi

  echo ""

  # Test 4.2: Create device with invalid serial number
  echo "Test 4.2: Create device with short serial number (should fail)"
  INVALID_DEVICE=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/super/devices" \
    -H "Authorization: Bearer $SUPER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"schoolId":1,"serialNumber":"123","deviceName":"Test"}')

  if echo "$INVALID_DEVICE" | grep -q "400"; then
    test_result 0 "Invalid serial number correctly rejected"
  else
    test_result 1 "Invalid serial number not properly validated"
  fi

  echo ""
fi

# =====================================================
# 5. DATABASE CONNECTIVITY
# =====================================================
echo "📋 5. DATABASE CONNECTIVITY"
echo "----------------------------------------------------"

# Test 5.1: Check if database is accessible
echo "Test 5.1: Database connection"
if [ -n "$SUPER_TOKEN" ]; then
  DB_TEST=$(curl -s -w "%{http_code}" -X GET "$BASE_URL/super/stats" \
    -H "Authorization: Bearer $SUPER_TOKEN")

  if echo "$DB_TEST" | grep -q "200"; then
    test_result 0 "Database connection successful"
  else
    test_result 1 "Database connection failed"
  fi
else
  test_result 1 "Cannot test database (no auth token)"
fi

echo ""

# =====================================================
# 6. ENVIRONMENT CONFIGURATION
# =====================================================
echo "📋 6. ENVIRONMENT CONFIGURATION"
echo "----------------------------------------------------"

# Test 6.1: Check if .env file exists
echo "Test 6.1: .env file exists"
if [ -f "../.env" ]; then
  test_result 0 ".env file found"
else
  test_result 1 ".env file missing"
fi

echo ""

# Test 6.2: Check JWT_SECRET
echo "Test 6.2: JWT_SECRET is set"
if grep -q "JWT_SECRET" ../.env; then
  JWT_SECRET=$(grep JWT_SECRET ../.env | cut -d'=' -f2)
  JWT_LENGTH=${#JWT_SECRET}

  if [ $JWT_LENGTH -ge 32 ]; then
    test_result 0 "JWT_SECRET is strong (${JWT_LENGTH} chars)"
  else
    test_result 1 "JWT_SECRET is too weak (${JWT_LENGTH} chars - should be 32+)"
  fi
else
  test_result 1 "JWT_SECRET not found in .env"
fi

echo ""

# Test 6.3: Check DATABASE_URL
echo "Test 6.3: DATABASE_URL is set"
if grep -q "DATABASE_URL" ../.env; then
  test_result 0 "DATABASE_URL is configured"
else
  test_result 1 "DATABASE_URL not found in .env"
fi

echo ""

# Test 6.4: Check Twilio credentials
echo "Test 6.4: Twilio credentials configured"
if grep -q "TWILIO_ACCOUNT_SID" ../.env && grep -q "TWILIO_AUTH_TOKEN" ../.env; then
  test_result 0 "Twilio credentials found"
else
  test_result 1 "Twilio credentials missing"
fi

echo ""

# =====================================================
# 7. SECURITY CHECKS
# =====================================================
echo "📋 7. SECURITY CHECKS"
echo "----------------------------------------------------"

# Test 7.1: Check for hardcoded secrets in code
echo "Test 7.1: Check for hardcoded secrets"
HARDCODED_SECRETS=$(grep -r "password.*=.*['\"][^'\"]\{8,\}['\"]" ../src/ 2>/dev/null | grep -v "Password" | wc -l)

if [ $HARDCODED_SECRETS -eq 0 ]; then
  test_result 0 "No hardcoded secrets found"
else
  test_result 1 "Found $HARDCODED_SECRETS potential hardcoded secrets"
fi

echo ""

# Test 7.2: Check for console.log in production code
echo "Test 7.2: Check for debug console.log statements"
CONSOLE_LOGS=$(grep -r "console\.log" ../src/ 2>/dev/null | wc -l)

if [ $CONSOLE_LOGS -lt 50 ]; then
  test_result 0 "Acceptable amount of console.log statements ($CONSOLE_LOGS)"
else
  echo -e "${YELLOW}⚠️  WARNING${NC}: High number of console.log statements ($CONSOLE_LOGS)"
  echo "   Consider using a proper logging library for production"
fi

echo ""

# =====================================================
# SUMMARY
# =====================================================
echo ""
echo "=========================================================="
echo "🎯 TESTING SUMMARY"
echo "=========================================================="
echo ""
echo "✅ All critical tests completed!"
echo ""
echo "Next steps:"
echo "1. Fix any failed tests above"
echo "2. Run database fixes: psql < PRODUCTION_FIXES.sql"
echo "3. Review PRODUCTION_READINESS_COMPLETE_AUDIT.md"
echo "4. Deploy to VPS"
echo ""
echo "=========================================================="
