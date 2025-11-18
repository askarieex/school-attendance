# 🛠️ Scripts Directory

Utility scripts for ZKTeco device command management and verification.

---

## 📋 Available Scripts

### `verify-and-fix-commands.js`
**Comprehensive verification and auto-fix tool**

```bash
# Check everything
node scripts/verify-and-fix-commands.js

# Check and auto-fix issues
node scripts/verify-and-fix-commands.js --fix

# Test command generation
node scripts/verify-and-fix-commands.js --test
```

**What it checks:**
- ✅ Code files have correct format
- ✅ Database schema is correct
- ✅ No commands with wrong format
- ✅ No stuck PLACEHOLDER commands
- ✅ Command generation works

---

### `test-queue-command.js`
**Test command generation and verify format**

```bash
node scripts/test-queue-command.js
```

**What it does:**
- Creates a test command using DeviceCommand.queueAddUser()
- Verifies format in database
- Validates all required fields
- Shows exact command string

**Use when:**
- You want to test without creating a real student
- Debugging command format issues
- Verifying fixes are working

---

## 🚀 Quick Start

### First Time Setup

1. **Run migration:**
   ```bash
   psql -U postgres -d school_attendance -f ../migrations/008_fix_command_format_and_cleanup.sql
   ```

2. **Verify everything:**
   ```bash
   node scripts/verify-and-fix-commands.js
   ```

3. **Test command generation:**
   ```bash
   node scripts/test-queue-command.js
   ```

---

## 📊 Understanding Output

### ✅ Success Example
```
🔍 ZKTeco Command Format - Complete Verification

📁 CHECK 1: Verifying Code Files
   ✅ commandGenerator.js: Correct format
   ✅ commandGenerator.js: Uses tab separators
   ✅ DeviceCommand.js: Uses insert-then-update pattern

🗄️  CHECK 2: Verifying Database Schema
   ✅ device_commands table exists
   ✅ command_string column: text (adequate)

📋 CHECK 3: Analyzing Existing Commands
   ✅ No commands with wrong format found

✅ ALL CHECKS PASSED!
```

### ⚠️ Issues Found Example
```
📋 CHECK 3: Analyzing Existing Commands
   ⚠️  Found 3 command(s) with WRONG format:
      ID: 5 | Status: pending
      Preview: DATA USER PIN=6 Name=Test...

🔧 AUTO-FIX AVAILABLE
To auto-fix, run: node scripts/verify-and-fix-commands.js --fix
```

---

## 🔧 Troubleshooting

### Script fails with "Cannot find module"
```bash
# Make sure you're in the backend directory
cd /path/to/backend
npm install
```

### Database connection error
```bash
# Check your .env file has correct DB credentials
cat .env | grep DB_
```

### Permission denied
```bash
# Make scripts executable
chmod +x scripts/*.js
```

---

## 📚 Related Documentation

- **Complete Fix Guide:** `../COMPLETE_FIX_INSTRUCTIONS.md`
- **Fix Summary:** `../FIX_SUMMARY.md`
- **Command ID Fix:** `../COMMAND_ID_FIX.md`
- **Testing Guide:** `../TESTING_GUIDE.md`

---

## 💡 Pro Tips

1. **Always verify after code changes:**
   ```bash
   node scripts/verify-and-fix-commands.js
   ```

2. **Test before creating real students:**
   ```bash
   node scripts/test-queue-command.js
   ```

3. **Auto-fix is safe:**
   - Only deletes wrong-format commands
   - Marks stuck PLACEHOLDERs as failed
   - Never modifies code files

4. **Check logs when testing:**
   ```bash
   npm run dev
   # Watch for command queue/execution logs
   ```

---

**Need help? See `COMPLETE_FIX_INSTRUCTIONS.md` for detailed guide.**
