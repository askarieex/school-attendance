/**
 * ZKTeco Command Generator
 * Generates properly formatted command strings for ZKTeco devices
 */

class CommandGenerator {

  /**
   * Generate "Add User" or "Update User" command
   * @param {number} pin - User PIN on device
   * @param {string} name - Student's full name
   * @param {string} cardNumber - RFID card number
   * @param {number} commandId - Database command ID (optional, defaults to 295)
   * @returns {string} Command string
   */
  static addUser(pin, name, cardNumber, commandId = 295) {
    // CRITICAL: Fields MUST be separated by TAB character (\t), not spaces
    // Format: C:<ID>:DATA USER PIN=<PIN>\tName=<NAME>\tCard=<CARD>\tGrp=1\tTZ=...\tVerifyMode=0\tPwd=
    // ⚠️ MUST use "DATA USER" (not "DATA UPDATE user") and "PIN=" (uppercase)
    // ⚠️ MUST include Grp, TZ, VerifyMode, Pwd fields (device requires them)

    // Sanitize name (max 24 characters, no special characters)
    const sanitizedName = name
      .replace(/[^\w\s]/g, '') // Remove special characters
      .substring(0, 24)         // Max 24 chars
      .trim();

    // ✅ TESTED AND WORKING FORMAT:
    return `C:${commandId}:DATA USER PIN=${pin}\tName=${sanitizedName}\tCard=${cardNumber}\tGrp=1\tTZ=0000000000000000\tVerifyMode=0\tPwd=`;
  }

  /**
   * Generate "Delete User" command
   * @param {number} pin - User PIN on device
   * @param {number} commandId - Database command ID (optional, defaults to 337)
   * @returns {string} Command string
   */
  static deleteUser(pin, commandId = 337) {
    return `C:${commandId}:DATA DELETE user Pin=${pin}`;
  }

  /**
   * Generate "Restart Device" command
   * @param {number} commandId - Database command ID (optional, defaults to 1)
   * @returns {string} Command string
   */
  static restartDevice(commandId = 1) {
    return `C:${commandId}:Restart`;
  }

  /**
   * Generate "Clear All Attendance Logs" command
   * @param {number} commandId - Database command ID (optional, defaults to 337)
   * @returns {string} Command string
   */
  static clearAttendanceLogs(commandId = 337) {
    return `C:${commandId}:DATA DELETE attlog Pin=*`;
  }

  /**
   * Generate "Clear User Data" command (delete all users)
   * @param {number} commandId - Database command ID (optional, defaults to 337)
   * @returns {string} Command string
   */
  static clearAllUsers(commandId = 337) {
    return `C:${commandId}:DATA DELETE user Pin=*`;
  }

  /**
   * Generate "Set Device Time" command using Unix Timestamp (Official ZKTeco PUSH Protocol)
   *
   * ✅ TWO-STAGE TIME SYNC PROTOCOL ✅
   *
   * Stage 1: Server sends "C:<ID>:SET OPTIONS DateTime=<timestamp>"
   * Stage 2: Device requests "GET /iclock/rtdata?type=time"
   *          Server responds with "DateTime=<timestamp>,ServerTZ=+0530"
   *
   * The device uses BOTH the timestamp AND timezone to calculate correct local time.
   *
   * @param {Date} datetime - Date/time to set (defaults to current time)
   * @param {number} commandId - Database command ID (optional, defaults to 210)
   * @returns {string} Command string
   */
  static setDeviceTime(datetime = new Date(), commandId = 210) {
    // Get current Unix timestamp (seconds since Jan 1, 1970 UTC)
    const unixTimestamp = Math.floor(datetime.getTime() / 1000);

    // Format the time for logging
    const istTime = datetime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    console.log(`⏰ Generating time sync command (Two-Stage Protocol):`);
    console.log(`   IST Time: ${istTime}`);
    console.log(`   Unix Timestamp: ${unixTimestamp}`);
    console.log(`   Stage 1: Sending SET OPTIONS DateTime command`);
    console.log(`   Stage 2: Device will request /iclock/rtdata?type=time`);
    console.log(`   Stage 2: Server will respond with ServerTZ=+0530`);

    // Stage 1: Send the SET OPTIONS command
    // Device will acknowledge with Return=0, then make Stage 2 request
    return `C:${commandId}:SET OPTIONS DateTime=${unixTimestamp}`;
  }

  /**
   * Generate "Get Device Time" command (Official ZKTeco PUSH Protocol)
   * Device will respond with POST to /iclock/cdata containing DateTime=<timestamp>
   * @param {number} commandId - Database command ID (optional, defaults to 211)
   * @returns {string} Command string
   */
  static getDeviceTime(commandId = 211) {
    // OFFICIAL PROTOCOL: Request device's current time setting
    // Format: C:<ID>:GET OPTIONS DateTime
    return `C:${commandId}:GET OPTIONS DateTime`;
  }

  /**
   * Generate "Get Device Info" command
   * @param {number} commandId - Database command ID (optional, defaults to 50)
   * @returns {string} Command string
   */
  static getDeviceInfo(commandId = 50) {
    return `C:${commandId}:INFO`;
  }

  /**
   * Generate "Disable Auto Time Sync" command
   * Sets device to Manual time mode (disables PC Sync Time)
   * This prevents the device from auto-syncing time via TCP connection
   * @param {number} commandId - Database command ID (optional, defaults to 220)
   * @returns {string} Command string
   */
  static disableAutoTimeSync(commandId = 220) {
    // Set SyncTime option to 0 (disabled)
    // This is equivalent to setting "Adjust Mode: Manual" in web interface
    console.log(`🔒 Generating disable auto time sync command:`);
    console.log(`   This will set device to Manual time mode`);
    console.log(`   Device will stop auto-syncing from PC/TCP connection`);

    return `C:${commandId}:SET OPTIONS SyncTime=0`;
  }

  /**
   * Generate "Enable Auto Time Sync" command
   * Sets device to Auto time mode (enables PC Sync Time)
   * @param {number} commandId - Database command ID (optional, defaults to 221)
   * @returns {string} Command string
   */
  static enableAutoTimeSync(commandId = 221) {
    // Set SyncTime option to 1 (enabled)
    console.log(`🔓 Generating enable auto time sync command:`);
    console.log(`   This will set device to Auto time mode`);

    return `C:${commandId}:SET OPTIONS SyncTime=1`;
  }

  /**
   * Generate batched "Add User" command for multiple students
   * More efficient for bulk enrollment
   * @param {Array} students - Array of student objects [{pin, name, cardNumber}, ...]
   * @param {number} commandId - Database command ID (optional, defaults to 295)
   * @returns {string} Batched command string
   */
  static addUsersBatch(students, commandId = 295) {
    // CRITICAL: Each student's data is on a new line
    // Format: C:<ID>:DATA USER PIN=101\tName=Name1\t...\nPIN=102\tName=Name2\t...

    const userLines = students.map(student => {
      const sanitizedName = student.name
        .replace(/[^\w\s]/g, '')
        .substring(0, 24)
        .trim();

      return `PIN=${student.pin}\tName=${sanitizedName}\tCard=${student.cardNumber}\tGrp=1\tTZ=0000000000000000\tVerifyMode=0\tPwd=`;
    });

    return `C:${commandId}:DATA USER ${userLines.join('\n')}`;
  }

  /**
   * ========================================
   * 🌍 TIMEZONE MANAGEMENT COMMANDS
   * ========================================
   * These commands permanently configure the device timezone
   * so attendance logs have correct timestamps (critical for K40 Pro)
   */

  /**
   * Generate "Set TimeZone" command (PERMANENT - survives reboot)
   * This sets the device's timezone offset permanently in flash memory
   *
   * For India Standard Time (IST): +0530
   * For other zones, use format: +HHMM or -HHMM
   *
   * Example formats:
   * - India (IST): +0530
   * - Pakistan: +0500
   * - Bangladesh: +0600
   * - Nepal: +0545
   * - Sri Lanka: +0530
   *
   * @param {string} timezoneOffset - Timezone offset in format +HHMM or -HHMM (e.g., "+0530" for IST)
   * @param {number} commandId - Database command ID (optional, defaults to 230)
   * @returns {string} Command string
   */
  static setTimeZone(timezoneOffset = '+0530', commandId = 230) {
    // Validate timezone format
    const timezoneRegex = /^[+-]\d{4}$/;
    if (!timezoneRegex.test(timezoneOffset)) {
      throw new Error(`Invalid timezone format: ${timezoneOffset}. Must be ±HHMM (e.g., +0530)`);
    }

    console.log(`🌍 Generating SET TIMEZONE command:`);
    console.log(`   Timezone Offset: ${timezoneOffset}`);
    console.log(`   This will be stored in device flash memory`);
    console.log(`   Effect: All future attendance logs will use this offset`);
    console.log(`   Survives: Device reboot ✅`);

    // Official ZKTeco protocol: SET OPTIONS TimeZone=<offset>
    return `C:${commandId}:SET OPTIONS TimeZone=${timezoneOffset}`;
  }

  /**
   * Generate "Disable Daylight Saving Time" command
   * Prevents automatic DST adjustments that can cause time drift
   *
   * @param {number} commandId - Database command ID (optional, defaults to 231)
   * @returns {string} Command string
   */
  static disableDST(commandId = 231) {
    console.log(`🔒 Generating DISABLE DST command:`);
    console.log(`   This prevents automatic daylight saving time adjustments`);
    console.log(`   Recommended for stable attendance timestamps`);

    // Official ZKTeco protocol: SET OPTIONS DaylightSavings=0
    return `C:${commandId}:SET OPTIONS DaylightSavings=0`;
  }

  /**
   * Generate "Enable Daylight Saving Time" command
   * Enables automatic DST adjustments (not recommended for attendance systems)
   *
   * @param {number} commandId - Database command ID (optional, defaults to 232)
   * @returns {string} Command string
   */
  static enableDST(commandId = 232) {
    console.log(`🔓 Generating ENABLE DST command:`);
    console.warn(`   ⚠️  WARNING: DST can cause time jumps in attendance logs!`);
    console.warn(`   ⚠️  Only enable if your region actually uses DST`);

    return `C:${commandId}:SET OPTIONS DaylightSavings=1`;
  }

  /**
   * Generate "Save Settings to Flash" command
   * CRITICAL: Must be sent after timezone/DST changes to persist them permanently
   * Without this, settings may be lost on reboot
   *
   * @param {number} commandId - Database command ID (optional, defaults to 233)
   * @returns {string} Command string
   */
  static saveToFlash(commandId = 233) {
    console.log(`💾 Generating SAVE TO FLASH command:`);
    console.log(`   This persists all recent settings to device flash memory`);
    console.log(`   CRITICAL: Always send this after timezone/DST changes!`);

    return `C:${commandId}:SET OPTIONS Save=1`;
  }

  /**
   * Generate "Get TimeZone" command
   * Queries the device's current timezone setting
   * Device will respond via POST /iclock/cdata with TimeZone=<offset>
   *
   * @param {number} commandId - Database command ID (optional, defaults to 234)
   * @returns {string} Command string
   */
  static getTimeZone(commandId = 234) {
    console.log(`📥 Generating GET TIMEZONE command:`);
    console.log(`   Device will respond with current TimeZone setting`);
    console.log(`   Check backend logs for: "TimeZone=" in /iclock/cdata POST`);

    return `C:${commandId}:GET OPTIONS TimeZone`;
  }

  /**
   * 🚀 COMPLETE TIMEZONE SETUP - One-shot solution
   *
   * This generates a complete timezone configuration sequence:
   * 1. Set timezone offset (e.g., +0530 for IST)
   * 2. Disable DST to prevent time drift
   * 3. Save settings to flash memory (persist across reboots)
   *
   * Usage:
   * ```
   * const commands = CommandGenerator.completeTimeZoneSetup('+0530');
   * // Send all 3 commands sequentially to device
   * ```
   *
   * @param {string} timezoneOffset - Timezone offset in format +HHMM or -HHMM (e.g., "+0530" for IST)
   * @param {number} baseCommandId - Starting command ID (will use baseId, baseId+1, baseId+2)
   * @returns {Array<Object>} Array of command objects: [{type, commandString, description}, ...]
   */
  static completeTimeZoneSetup(timezoneOffset = '+0530', baseCommandId = 230) {
    console.log(`\n🎯 ========== COMPLETE TIMEZONE SETUP ==========`);
    console.log(`   Timezone: ${timezoneOffset}`);
    console.log(`   This will configure device permanently (survives reboot)`);
    console.log(`   Commands: 3 sequential commands`);
    console.log(`==============================================\n`);

    return [
      {
        type: 'SET_TIMEZONE',
        commandString: this.setTimeZone(timezoneOffset, baseCommandId),
        description: `Set timezone to ${timezoneOffset}`,
        priority: 10
      },
      {
        type: 'DISABLE_DST',
        commandString: this.disableDST(baseCommandId + 1),
        description: 'Disable daylight saving time',
        priority: 9
      },
      {
        type: 'SAVE_FLASH',
        commandString: this.saveToFlash(baseCommandId + 2),
        description: 'Save settings to flash memory',
        priority: 8
      }
    ];
  }
}

module.exports = CommandGenerator;
