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
   * Generate "Set Device Time" command
   * @param {Date} datetime - Date/time to set
   * @param {number} commandId - Database command ID (optional, defaults to 210)
   * @returns {string} Command string
   */
  static setDeviceTime(datetime = new Date(), commandId = 210) {
    // Format: C:<ID>:TIME <YYYY-MM-DD HH:MM:SS>
    const year = datetime.getFullYear();
    const month = String(datetime.getMonth() + 1).padStart(2, '0');
    const day = String(datetime.getDate()).padStart(2, '0');
    const hours = String(datetime.getHours()).padStart(2, '0');
    const minutes = String(datetime.getMinutes()).padStart(2, '0');
    const seconds = String(datetime.getSeconds()).padStart(2, '0');

    const timeString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    return `C:${commandId}:TIME ${timeString}`;
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
}

module.exports = CommandGenerator;
