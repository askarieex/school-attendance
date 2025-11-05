# WhatsApp Integration Setup Guide

Complete step-by-step guide to integrate WhatsApp Business API with your School Attendance System using Twilio.

---

## Step 1: Create Twilio Account

### 1.1 Sign Up
1. Go to: https://www.twilio.com/try-twilio
2. Click "Sign up"
3. Fill in your details:
   - Email address
   - Password
   - Phone number (for verification)
4. Verify your email and phone number

### 1.2 Complete Verification
1. Check your email for verification link
2. Enter the verification code sent to your phone
3. You'll get **$15 free credit** to test

---

## Step 2: Get Twilio Credentials

### 2.1 Find Your Account SID and Auth Token
1. Login to Twilio Console: https://console.twilio.com/
2. On the Dashboard, you'll see:
   - **Account SID**: Starts with "AC..." (like `AC694e98adca7ed9fba67f4b070e27e90b`)
   - **Auth Token**: Click "Show" to reveal it
3. **IMPORTANT**: Copy both values - you'll need them soon

### 2.2 Screenshot Reference
Look at your Twilio dashboard (like in your screenshot):
- Top right shows: "Trial: $15.485 Upgrade"
- Left sidebar: Account Dashboard
- Main area: Account SID and Auth Token

---

## Step 3: Setup WhatsApp Sandbox (For Testing)

### 3.1 Navigate to WhatsApp Sandbox
1. In Twilio Console, go to: **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Or direct link: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn

### 3.2 Join Sandbox
1. You'll see a sandbox number: `+1 415 523 8886`
2. You'll see a code like: `join <your-code>` (e.g., `join correctly-wolf`)
3. **On your phone**:
   - Open WhatsApp
   - Send a message to: `+1 415 523 8886`
   - Type exactly: `join correctly-wolf` (use YOUR code, not this example)
4. You'll receive: "Sandbox is all set! Try sending a message back."

---

## Step 4: Configure Your Backend

### 4.1 Update .env File
1. Open: `backend/.env`
2. Find these lines:
```env
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=+14155238886
```

3. Replace with YOUR values:
```env
TWILIO_ACCOUNT_SID=AC694e98adca7ed9fba67f4b070e27e90b
TWILIO_AUTH_TOKEN=d13eefeb3ad21292203df9ed72136adb
TWILIO_WHATSAPP_NUMBER=+14155238886
```

**IMPORTANT**:
- Use YOUR Account SID (from Step 2)
- Use YOUR Auth Token (from Step 2)
- Keep sandbox number as `+14155238886` for testing

### 4.2 Restart Your Backend Server
```bash
cd backend
npm run dev
```

You should see:
```
✅ WhatsApp Service initialized
🚀 Server is running on port 3001
```

---

## Step 5: Test WhatsApp Integration

### 5.1 Test API Endpoint
1. Use this curl command (replace TOKEN with your login token):

```bash
TOKEN="your_jwt_token_here"

curl -X POST http://localhost:3001/api/v1/whatsapp/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "phoneNumber": "+923001234567"
  }'
```

2. Replace `+923001234567` with YOUR phone number (the one you joined sandbox with)

3. You should receive a WhatsApp message:
```
🧪 Test Message

This is a test message from your School Attendance System.

✅ WhatsApp integration is working correctly!

Time: [current time]
```

### 5.2 Test Attendance Alert
```bash
curl -X POST http://localhost:3001/api/v1/whatsapp/send-alert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "parentPhone": "+923001234567",
    "studentName": "Ahmed Khan",
    "status": "late",
    "checkInTime": "09:30 AM",
    "schoolName": "CPS School"
  }'
```

Parent will receive:
```
🔔 Attendance Alert

Dear Parent,

Your child Ahmed Khan arrived LATE at school.

⏰ Check-in Time: 09:30 AM
📅 Date: [today's date]
🏫 School: CPS School

Please ensure timely arrival tomorrow.

_This is an automated message from CPS School_
```

---

## Step 6: Production Setup (When Ready)

### 6.1 Request WhatsApp Business Number
1. In Twilio Console: **Messaging** → **Senders** → **WhatsApp senders**
2. Click "Request to have your sender enabled"
3. Fill in business details:
   - Business name: "CPS School Management"
   - Business description: "School attendance notification system"
   - Business website: Your school website
4. Wait for approval (usually 1-3 business days)

### 6.2 Get Your Business Number
After approval:
1. Twilio will assign you a dedicated WhatsApp number
2. Update `.env` file:
```env
TWILIO_WHATSAPP_NUMBER=+923001234567  # Your new business number
```

### 6.3 Pricing (Production)
- **Phone number**: $1.50/month
- **WhatsApp messages**: $0.005 per message
- **Example calculation**:
  - 100 schools × 100 students = 10,000 students
  - 1 alert per student per day = 10,000 messages/day
  - Cost: 10,000 × $0.005 = $50/day = $1,500/month

---

## Step 7: Integration with Attendance System

The WhatsApp service is already integrated into your backend! It will automatically send alerts when:

### 7.1 Automatic Triggers
- Student marked as **LATE**: Parents get late alert
- Student marked as **ABSENT**: Parents get absence alert
- Student marked as **LEAVE**: Parents get leave notification
- Student marked as **PRESENT** (optional): Parents get confirmation

### 7.2 Available Endpoints

#### Check WhatsApp Status
```bash
GET http://localhost:3001/api/v1/whatsapp/status
Authorization: Bearer {your_token}
```

#### Test Connection
```bash
POST http://localhost:3001/api/v1/whatsapp/test
{
  "phoneNumber": "+923001234567"
}
```

#### Send Attendance Alert
```bash
POST http://localhost:3001/api/v1/whatsapp/send-alert
{
  "parentPhone": "+923001234567",
  "studentName": "Ahmed Khan",
  "status": "late",
  "checkInTime": "09:30 AM",
  "schoolName": "CPS School"
}
```

#### Send Daily Summary
```bash
POST http://localhost:3001/api/v1/whatsapp/send-summary
{
  "parentPhone": "+923001234567",
  "studentName": "Ahmed Khan",
  "summary": {
    "status": "present",
    "checkInTime": "08:00 AM",
    "checkOutTime": "02:00 PM"
  },
  "schoolName": "CPS School"
}
```

#### Send Custom Message
```bash
POST http://localhost:3001/api/v1/whatsapp/send-custom
{
  "parentPhone": "+923001234567",
  "message": "School will be closed tomorrow for national holiday.",
  "schoolName": "CPS School"
}
```

---

## Step 8: Troubleshooting

### 8.1 "WhatsApp Service disabled" Error
**Problem**: Backend shows "⚠️ WhatsApp Service disabled"

**Solution**:
1. Check `.env` file has correct credentials
2. Verify Account SID starts with "AC"
3. Verify Auth Token is correct (no spaces)
4. Restart backend: `npm run dev`

### 8.2 "accountSid must start with AC" Error
**Problem**: Twilio initialization fails

**Solution**:
1. Your Account SID is incorrect
2. Go to Twilio Dashboard and copy the correct SID
3. Update `.env` file
4. Restart backend

### 8.3 "Phone number not registered in sandbox" Error
**Problem**: Cannot send test message to a phone number

**Solution**:
1. That phone number must join the sandbox first
2. Send `join <code>` to `+1 415 523 8886` from that phone
3. Wait for confirmation
4. Try again

### 8.4 Message Not Received
**Problem**: No WhatsApp message received

**Solution**:
1. Check phone number format: Must include country code (+92)
2. Check WhatsApp is installed on that phone
3. Check sandbox is joined (for testing)
4. Check Twilio account has credit
5. Check Twilio logs: https://console.twilio.com/us1/monitor/logs/errors

---

## Step 9: Best Practices

### 9.1 Phone Number Format
Always use international format:
- ✅ Correct: `+923001234567`
- ✅ Correct: `+92 300 1234567`
- ❌ Wrong: `03001234567` (missing country code)
- ❌ Wrong: `923001234567` (missing + sign)

### 9.2 Message Timing
- Send alerts immediately when attendance is marked
- Send daily summaries at end of school day (3:00 PM)
- Avoid sending messages at night (after 9:00 PM)

### 9.3 Message Templates
- Keep messages short and clear
- Include school name
- Include student name
- Include date/time
- Add action items if needed

### 9.4 Error Handling
- Log all WhatsApp send attempts to database
- Retry failed messages after 5 minutes
- Alert admin if multiple failures occur
- Monitor Twilio usage dashboard

---

## Step 10: Next Steps

### 10.1 Integration with Flutter App
1. Add WhatsApp settings to school admin panel
2. Allow enabling/disabling WhatsApp alerts per school
3. Allow parents to opt-in/opt-out of alerts
4. Show WhatsApp delivery status in dashboard

### 10.2 Advanced Features (Future)
- Two-way messaging (parents can reply)
- Broadcast messages to all parents
- Emergency alerts (school closures, etc.)
- Attendance reports via WhatsApp
- Parent acknowledgment system

---

## Summary

You now have:
- ✅ WhatsApp service created (`whatsappService.js`)
- ✅ Test endpoint ready (`/api/v1/whatsapp/test`)
- ✅ Alert endpoint ready (`/api/v1/whatsapp/send-alert`)
- ✅ Backend configured and running
- ✅ Ready for Twilio credentials

**Next immediate steps**:
1. Sign up for Twilio (if not done)
2. Copy Account SID and Auth Token
3. Join WhatsApp Sandbox
4. Update `.env` file
5. Restart backend
6. Test with `/whatsapp/test` endpoint
7. Verify message received on phone

---

## Support

**Twilio Support**:
- Docs: https://www.twilio.com/docs/whatsapp
- Support: https://www.twilio.com/help/contact
- Console: https://console.twilio.com/

**Common Issues**:
- https://www.twilio.com/docs/whatsapp/troubleshooting

---

**Created**: November 2025
**For**: School Attendance System
**API Version**: v1
