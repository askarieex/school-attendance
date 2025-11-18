#!/bin/bash

# Quick Fix Script for SMS Authentication Error
# Run this on your VPS server

echo "🔧 SMS Authentication Fix Script"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if database has settings table
echo "📊 Step 1: Checking database settings..."
DB_CHECK=$(sudo -u postgres psql school_attendance -t -c "SELECT COUNT(*) FROM settings WHERE key LIKE 'twilio%';" 2>/dev/null)

if [ -z "$DB_CHECK" ]; then
    echo -e "${RED}❌ Cannot connect to database${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Database connected${NC}"
echo "   Found $DB_CHECK Twilio settings"
echo ""

# Step 2: Show current settings (hide auth token)
echo "📋 Step 2: Current Twilio Settings:"
echo "-----------------------------------"
sudo -u postgres psql school_attendance -c "
SELECT
  key,
  CASE
    WHEN key = 'twilio_auth_token' THEN CONCAT(LEFT(value, 4), '***', RIGHT(value, 4))
    ELSE value
  END as value,
  CASE
    WHEN value IS NULL OR value = '' THEN '❌ MISSING'
    ELSE '✅ SET'
  END as status
FROM settings
WHERE key IN ('twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number', 'whatsapp_enabled')
ORDER BY key;
"
echo ""

# Step 3: Interactive configuration
echo "🔧 Step 3: Configure Twilio Credentials"
echo "----------------------------------------"
echo ""
echo -e "${YELLOW}Do you want to update Twilio credentials now? (y/n)${NC}"
read -r UPDATE_CREDS

if [ "$UPDATE_CREDS" = "y" ] || [ "$UPDATE_CREDS" = "Y" ]; then
    echo ""
    echo "Enter your Twilio credentials:"
    echo ""

    # Get Account SID
    echo -n "Twilio Account SID (starts with AC): "
    read -r TWILIO_SID

    # Get Auth Token
    echo -n "Twilio Auth Token: "
    read -rs TWILIO_TOKEN
    echo ""

    # Get Phone Number
    echo -n "Twilio Phone Number (e.g., +1234567890): "
    read -r TWILIO_PHONE

    # Validate inputs
    if [ -z "$TWILIO_SID" ] || [ -z "$TWILIO_TOKEN" ] || [ -z "$TWILIO_PHONE" ]; then
        echo -e "${RED}❌ Error: All fields are required${NC}"
        exit 1
    fi

    if [[ ! $TWILIO_SID =~ ^AC ]]; then
        echo -e "${YELLOW}⚠️  Warning: Account SID should start with 'AC'${NC}"
    fi

    if [[ ! $TWILIO_PHONE =~ ^\+ ]]; then
        echo -e "${YELLOW}⚠️  Warning: Phone number should start with '+' (e.g., +1234567890)${NC}"
    fi

    echo ""
    echo "📝 Updating database settings..."

    # Update database
    sudo -u postgres psql school_attendance << EOF
-- Update Twilio Account SID
INSERT INTO settings (key, value)
VALUES ('twilio_account_sid', '$TWILIO_SID')
ON CONFLICT (key) DO UPDATE SET value = '$TWILIO_SID', updated_at = CURRENT_TIMESTAMP;

-- Update Twilio Auth Token
INSERT INTO settings (key, value)
VALUES ('twilio_auth_token', '$TWILIO_TOKEN')
ON CONFLICT (key) DO UPDATE SET value = '$TWILIO_TOKEN', updated_at = CURRENT_TIMESTAMP;

-- Update Twilio Phone Number
INSERT INTO settings (key, value)
VALUES ('twilio_phone_number', '$TWILIO_PHONE')
ON CONFLICT (key) DO UPDATE SET value = '$TWILIO_PHONE', updated_at = CURRENT_TIMESTAMP;

-- Enable WhatsApp
INSERT INTO settings (key, value)
VALUES ('whatsapp_enabled', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = CURRENT_TIMESTAMP;
EOF

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Settings updated successfully${NC}"
    else
        echo -e "${RED}❌ Failed to update settings${NC}"
        exit 1
    fi
else
    echo "⏭️  Skipping credential update"
fi

echo ""

# Step 4: Check backend logs for errors
echo "📋 Step 4: Checking Recent SMS Errors"
echo "--------------------------------------"
SMS_ERRORS=$(pm2 logs school-attendance-api --nostream --lines 100 2>/dev/null | grep -i "sms send failed\|authenticate" | tail -5)

if [ -z "$SMS_ERRORS" ]; then
    echo -e "${GREEN}✅ No recent SMS errors found${NC}"
else
    echo -e "${YELLOW}Recent SMS errors:${NC}"
    echo "$SMS_ERRORS"
fi

echo ""

# Step 5: Restart backend
echo "🔄 Step 5: Restart Backend"
echo "--------------------------"
echo -e "${YELLOW}Do you want to restart the backend now? (y/n)${NC}"
read -r RESTART

if [ "$RESTART" = "y" ] || [ "$RESTART" = "Y" ]; then
    echo "Restarting backend..."
    pm2 restart school-attendance-api

    echo ""
    echo "Waiting for backend to start..."
    sleep 3

    echo ""
    echo "📋 Latest logs:"
    pm2 logs school-attendance-api --nostream --lines 20 | grep -i "whatsapp\|twilio\|sms"
else
    echo "⏭️  Skipping restart"
    echo ""
    echo -e "${YELLOW}Remember to restart backend later:${NC}"
    echo "  pm2 restart school-attendance-api"
fi

echo ""
echo "================================"
echo -e "${GREEN}✅ SMS Fix Script Complete!${NC}"
echo "================================"
echo ""
echo "📝 Next steps:"
echo "1. Test SMS by marking a student absent in admin panel"
echo "2. Watch logs: pm2 logs school-attendance-api --lines 0"
echo "3. Look for: '✅ SMS sent successfully' in logs"
echo ""
echo "🚨 If still not working:"
echo "1. Check Twilio dashboard for errors: https://www.twilio.com/console"
echo "2. Verify phone numbers are in E.164 format (+91XXXXXXXXXX)"
echo "3. For trial accounts, verify recipient numbers in Twilio console"
echo ""
