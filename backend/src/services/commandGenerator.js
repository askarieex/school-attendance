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
   * @returns {string} Command string
   */
  static addUser(pin, name, cardNumber) {
    // CRITICAL: Fields MUST be separated by TAB character (\t), not spaces
    // Format: C:295:DATA UPDATE user Pin=<PIN>\tName=<NAME>\tCard=<CARDNO>\tPrivilege=0

    // Sanitize name (max 24 characters, no special characters)
    const sanitizedName = name
      .replace(/[^\w\s]/g, '') // Remove special characters
      .substring(0, 24)         // Max 24 chars
      .trim();

    return `C:295:DATA UPDATE user Pin=${pin}\tName=${sanitizedName}\tCard=${cardNumber}\tPrivilege=0`;
  }

  /**
   * Generate "Delete User" command
   * @param {number} pin - User PIN on device
   * @returns {string} Command string
   */
  static deleteUser(pin) {
    return `C:337:DATA DELETE user Pin=${pin}`;
  }

  /**
   * Generate "Restart Device" command
   * @returns {string} Command string
   */
  static restartDevice() {
    return `C:1:Restart`;
  }

  /**
   * Generate "Clear All Attendance Logs" command
   * @returns {string} Command string
   */
  static clearAttendanceLogs() {
    return `C:337:DATA DELETE attlog Pin=*`;
  }

  /**
   * Generate "Clear User Data" command (delete all users)
   * @returns {string} Command string
   */
  static clearAllUsers() {
    return `C:337:DATA DELETE user Pin=*`;
  }

  /**
   * Generate "Set Device Time" command
   * @param {Date} datetime - Date/time to set
   * @returns {string} Command string
   */
  static setDeviceTime(datetime = new Date()) {
    // Format: C:210:TIME <YYYY-MM-DD HH:MM:SS>
    const year = datetime.getFullYear();
    const month = String(datetime.getMonth() + 1).padStart(2, '0');
    const day = String(datetime.getDate()).padStart(2, '0');
    const hours = String(datetime.getHours()).padStart(2, '0');
    const minutes = String(datetime.getMinutes()).padStart(2, '0');
    const seconds = String(datetime.getSeconds()).padStart(2, '0');

    const timeString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    return `C:210:TIME ${timeString}`;
  }

  /**
   * Generate "Get Device Info" command
   * @returns {string} Command string
   */
  static getDeviceInfo() {
    return `C:50:INFO`;
  }

  /**
   * Generate batched "Add User" command for multiple students
   * More efficient for bulk enrollment
   * @param {Array} students - Array of student objects [{pin, name, cardNumber}, ...]
   * @returns {string} Batched command string
   */
  static addUsersBatch(students) {
    // CRITICAL: Each student's data is on a new line
    // Format: C:295:DATA UPDATE user Pin=101\tName=Name1\tCard=Card1\nPin=102\tName=Name2\tCard=Card2

    const userLines = students.map(student => {
      const sanitizedName = student.name
        .replace(/[^\w\s]/g, '')
        .substring(0, 24)
        .trim();

      return `Pin=${student.pin}\tName=${sanitizedName}\tCard=${student.cardNumber}\tPrivilege=0`;
    });

    return `C:295:DATA UPDATE user ${userLines.join('\n')}`;
  }
}

module.exports = CommandGenerator;
