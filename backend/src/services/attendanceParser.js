/**
 * Attendance Data Parser
 * Parses the tab-separated attendance data sent by ZKTeco devices
 */

/**
 * Parse raw attendance data from device
 * @param {string} rawText - Raw text data from device body
 * @returns {Array} Array of parsed attendance log objects
 */
function parseAttendanceData(rawText) {
  const logs = [];

  if (!rawText || typeof rawText !== 'string') {
    console.warn('Invalid attendance data received: empty or not a string');
    return logs;
  }

  // Split by newlines to get individual records
  const lines = rawText.trim().split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) continue;

    // Skip OPERLOG entries (operation logs, not attendance)
    // OPERLOG format: OPLOG ID\tUserPIN\tTimestamp\t...
    // We only want ATTLOG (attendance logs)
    if (trimmedLine.startsWith('OPLOG')) {
      console.log('⏭️  Skipping OPERLOG entry (operation log, not attendance)');
      continue;
    }

    try {
      // Split by TAB character (\t)
      const fields = trimmedLine.split('\t');

      // Validate minimum required fields (UserPIN, Timestamp are required at minimum)
      // Full format: UserPIN\tTimestamp\tStatus\tVerifyMethod\tWorkCode\tReserved
      if (fields.length < 2) {
        console.warn(`Invalid attendance record (expected at least 2 fields, got ${fields.length}): ${trimmedLine}`);
        continue;
      }

      // Parse according to ZKTeco ADMS format
      // Format: UserPIN\tTimestamp\tStatus\tVerifyMethod\tWorkCode\tReserved
      const log = {
        userPin: fields[0].trim(),                        // e.g., "101"
        timestamp: fields[1].trim(),                       // e.g., "2025-10-18 08:45:30"
        status: fields[2] ? parseInt(fields[2]) : 1,       // 1=check-in, 2=check-out
        verifyMethod: fields[3] ? parseInt(fields[3]) : 15, // 15=RFID card
        workCode: fields[4] ? fields[4].trim() : '0',
        reserved: fields[5] ? fields[5].trim() : '0'
      };

      // Validate userPin and timestamp
      if (!log.userPin || !log.timestamp) {
        console.warn(`Invalid attendance record (missing PIN or timestamp): ${trimmedLine}`);
        continue;
      }

      logs.push(log);

    } catch (error) {
      console.error(`Error parsing attendance line: ${trimmedLine}`, error);
    }
  }

  console.log(`📋 Parsed ${logs.length} attendance records from device`);
  return logs;
}

module.exports = parseAttendanceData;
