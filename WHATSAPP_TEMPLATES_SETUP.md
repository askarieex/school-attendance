# 📱 WHATSAPP MESSAGE TEMPLATES FOR PRODUCTION

**Required for:** Production WhatsApp Business API
**Approval Time:** 1-2 business days
**Where to create:** Meta Business Manager

---

## 🎯 TEMPLATES YOU NEED TO CREATE

You need **4 templates** for your school attendance system:

1. ✅ **Late Arrival Alert**
2. ✅ **Absent Alert**
3. ✅ **Leave Notification**
4. ✅ **Attendance Report**

---

## 📝 HOW TO CREATE TEMPLATES

### **STEP 1: Go to Meta Business Manager**

**URL:** https://business.facebook.com/latest/whatsapp_manager/message_templates

**Path:**
1. Login to your Facebook Business account
2. WhatsApp Manager → Message templates
3. Click **"Create template"** button

---

### **STEP 2: Create Each Template**

For each template below:
1. Click **"Create template"**
2. Fill in the details exactly as shown
3. Click **"Submit"**
4. Wait for approval (1-2 days)

---

## 📋 TEMPLATE 1: LATE ARRIVAL ALERT

**Template Details:**

| Field | Value |
|-------|-------|
| **Template Name** | `attendance_late_alert` |
| **Category** | `ALERT_UPDATE` |
| **Language** | English |

**Message Body:**
```
🔔 *Attendance Alert*

Dear Parent,

Your child *{{1}}* arrived LATE at school.

⏰ Check-in Time: {{2}}
📅 Date: {{3}}
🏫 School: {{4}}

Please ensure timely arrival tomorrow.

_This is an automated message from {{4}}_
```

**Variables:**
- `{{1}}` = Student name (e.g., "John Doe")
- `{{2}}` = Check-in time (e.g., "08:45 AM")
- `{{3}}` = Date (e.g., "Thursday, November 7, 2025")
- `{{4}}` = School name (e.g., "ABC International School")

**Sample Message:**
```
🔔 *Attendance Alert*

Dear Parent,

Your child *John Doe* arrived LATE at school.

⏰ Check-in Time: 08:45 AM
📅 Date: Thursday, November 7, 2025
🏫 School: ABC International School

Please ensure timely arrival tomorrow.

_This is an automated message from ABC International School_
```

---

## 📋 TEMPLATE 2: ABSENT ALERT

**Template Details:**

| Field | Value |
|-------|-------|
| **Template Name** | `attendance_absent_alert` |
| **Category** | `ALERT_UPDATE` |
| **Language** | English |

**Message Body:**
```
⚠️ *Absence Alert*

Dear Parent,

Your child *{{1}}* is marked ABSENT from school today.

📅 Date: {{2}}
🏫 School: {{3}}

If this is an error or your child is sick, please contact the school immediately.

_This is an automated message from {{3}}_
```

**Variables:**
- `{{1}}` = Student name
- `{{2}}` = Date
- `{{3}}` = School name

**Sample Message:**
```
⚠️ *Absence Alert*

Dear Parent,

Your child *John Doe* is marked ABSENT from school today.

📅 Date: Thursday, November 7, 2025
🏫 School: ABC International School

If this is an error or your child is sick, please contact the school immediately.

_This is an automated message from ABC International School_
```

---

## 📋 TEMPLATE 3: LEAVE NOTIFICATION

**Template Details:**

| Field | Value |
|-------|-------|
| **Template Name** | `attendance_leave_notification` |
| **Category** | `ALERT_UPDATE` |
| **Language** | English |

**Message Body:**
```
📋 *Leave Notification*

Dear Parent,

Your child *{{1}}* has been marked on LEAVE today.

📅 Date: {{2}}
📝 Reason: {{3}}
🏫 School: {{4}}

_This is an automated message from {{4}}_
```

**Variables:**
- `{{1}}` = Student name
- `{{2}}` = Date
- `{{3}}` = Leave reason (e.g., "Sick leave", "Family emergency")
- `{{4}}` = School name

**Sample Message:**
```
📋 *Leave Notification*

Dear Parent,

Your child *John Doe* has been marked on LEAVE today.

📅 Date: Thursday, November 7, 2025
📝 Reason: Sick leave
🏫 School: ABC International School

_This is an automated message from ABC International School_
```

---

## 📋 TEMPLATE 4: ATTENDANCE REPORT

**Template Details:**

| Field | Value |
|-------|-------|
| **Template Name** | `attendance_monthly_report` |
| **Category** | `ALERT_UPDATE` |
| **Language** | English |

**Message Body:**
```
📊 *Monthly Attendance Report*

Dear Parent,

Attendance summary for *{{1}}*

📅 Period: {{2}}
✅ Present: {{3}} days
⏰ Late: {{4}} days
❌ Absent: {{5}} days
📋 Leave: {{6}} days

Total Working Days: {{7}}
Attendance Percentage: {{8}}%

🏫 {{9}}

_This is an automated message from {{9}}_
```

**Variables:**
- `{{1}}` = Student name
- `{{2}}` = Period (e.g., "October 2025")
- `{{3}}` = Present days count
- `{{4}}` = Late days count
- `{{5}}` = Absent days count
- `{{6}}` = Leave days count
- `{{7}}` = Total working days
- `{{8}}` = Attendance percentage
- `{{9}}` = School name

**Sample Message:**
```
📊 *Monthly Attendance Report*

Dear Parent,

Attendance summary for *John Doe*

📅 Period: October 2025
✅ Present: 20 days
⏰ Late: 3 days
❌ Absent: 2 days
📋 Leave: 1 day

Total Working Days: 26
Attendance Percentage: 88.5%

🏫 ABC International School

_This is an automated message from ABC International School_
```

---

## 🚀 AFTER TEMPLATES ARE APPROVED

Once Meta approves your templates (1-2 days), you'll get:
- **Template SID** (e.g., `HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
- **Template Name** confirmation

Then update your code to use templates.

---

## 💻 CODE IMPLEMENTATION

After templates are approved, update your `whatsappService.js`:

### **Current Code (Freeform - Won't Work in Production):**
```javascript
// ❌ This fails in production
await this.client.messages.create({
  from: `whatsapp:${this.whatsappNumber}`,
  to: `whatsapp:+917889484343`,
  body: `🔔 Attendance Alert\n\nYour child John Doe arrived LATE...`
});
```

### **New Code (Using Templates - Works in Production):**
```javascript
// ✅ This works in production
await this.client.messages.create({
  from: `whatsapp:${this.whatsappNumber}`,
  to: `whatsapp:+917889484343`,
  contentSid: 'HXxxxx...', // Template SID from Meta
  contentVariables: JSON.stringify({
    "1": "John Doe",           // Student name
    "2": "08:45 AM",           // Check-in time
    "3": "November 7, 2025",   // Date
    "4": "ABC School"          // School name
  })
});
```

---

## 📝 TEMPLATE CREATION CHECKLIST

Before creating templates in Meta Business Manager:

### **For Each Template:**

- [ ] Template name is clear and descriptive
- [ ] Category is set to `ALERT_UPDATE`
- [ ] Language is set to `English`
- [ ] Message text is copied exactly (including emojis)
- [ ] Variables are numbered correctly `{{1}}`, `{{2}}`, `{{3}}`, etc.
- [ ] Sample values provided for approval review
- [ ] No personal information in template (only in variables)

### **Meta Requirements:**
- [ ] No promotional content
- [ ] No clickbait language
- [ ] Clear purpose (attendance notification)
- [ ] Professional tone
- [ ] School name mentioned
- [ ] Footer disclaimer included

---

## ⚠️ COMMON MISTAKES TO AVOID

1. ❌ **Don't use curly braces wrong:**
   - ❌ Wrong: `{1}`, `{{1`, `{{{1}}}`
   - ✅ Correct: `{{1}}`

2. ❌ **Don't skip variable numbers:**
   - ❌ Wrong: `{{1}}`, `{{3}}`, `{{4}}` (missing {{2}})
   - ✅ Correct: `{{1}}`, `{{2}}`, `{{3}}`, `{{4}}`

3. ❌ **Don't make templates too long:**
   - ✅ Keep under 1024 characters

4. ❌ **Don't use personal data in template:**
   - ❌ Wrong: "Your child John Doe" (hardcoded name)
   - ✅ Correct: "Your child {{1}}" (variable)

---

## 🔍 HOW TO GET TEMPLATE SID

After approval:

1. Go to Meta Business Manager → Message templates
2. Find your template (e.g., `attendance_late_alert`)
3. Click on it
4. Copy the **Template ID** or **Content SID**
5. It looks like: `HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

**Store these SIDs:**
```javascript
// backend/src/config/whatsappTemplates.js
module.exports = {
  LATE_ALERT: 'HXabc123...',
  ABSENT_ALERT: 'HXdef456...',
  LEAVE_NOTIFICATION: 'HXghi789...',
  MONTHLY_REPORT: 'HXjkl012...'
};
```

---

## 📊 TEMPLATE APPROVAL TIMELINE

| Day | Status |
|-----|--------|
| Day 0 | Submit all 4 templates |
| Day 1 | Under review by Meta |
| Day 2 | Approved (usually) |
| Day 3 | Ready to use |

**If rejected:**
- Meta will tell you why
- Fix the issue
- Resubmit
- Wait 1-2 days again

---

## 🧪 TESTING TEMPLATES

**Before approval:** Use Twilio Sandbox
**After approval:** Test with templates

**Test command:**
```bash
curl -X POST https://api.twilio.com/2010-04-01/Accounts/ACb11bf698d58c6803b66c3f021043369b/Messages.json \
  -u ACb11bf698d58c6803b66c3f021043369b:da75a5ef1d2e7d225807990fb0a524e4 \
  -d "From=whatsapp:+15558986539" \
  -d "To=whatsapp:+917889484343" \
  -d "ContentSid=HXxxxx..." \
  -d "ContentVariables={\"1\":\"John Doe\",\"2\":\"08:45 AM\",\"3\":\"Nov 7\",\"4\":\"ABC School\"}"
```

---

## 💡 TIPS

1. **Create all 4 templates at once** - Same approval time
2. **Use simple, clear language** - Higher approval rate
3. **Test with sandbox while waiting** - Don't block development
4. **Keep template names consistent** - Easier to manage
5. **Document Template SIDs** - You'll need them in code

---

## 🆘 IF TEMPLATE IS REJECTED

**Common rejection reasons:**

1. **"Promotional content detected"**
   - Solution: Remove any promotional language
   - Example: Remove "Best school in town"

2. **"Missing business context"**
   - Solution: Add school name and purpose
   - Example: Add footer "This is an automated message from {{school}}"

3. **"Variables not clear"**
   - Solution: Provide clear sample values
   - Example: For {{1}}, provide "John Doe (student name)"

4. **"Inappropriate use case"**
   - Solution: Change category from MARKETING to ALERT_UPDATE

---

## 📞 NEED HELP?

**Meta Support:**
- https://business.facebook.com/business/help
- WhatsApp Business API Support

**Twilio Support:**
- https://support.twilio.com/
- WhatsApp sender documentation

---

## ✅ NEXT STEPS

1. **Go to Meta Business Manager** now
2. **Create all 4 templates** (takes 10 minutes)
3. **Submit for approval**
4. **While waiting:** Use Twilio Sandbox for testing
5. **After approval:** Update code with Template SIDs
6. **Test in production**

---

**Creation Time:** 10-15 minutes
**Approval Time:** 1-2 business days
**Then:** Production-ready WhatsApp! 🚀
