const cron = require('node-cron');
const { pool } = require('../config/database');
const whatsappService = require('./whatsappService');
const { maskPhone } = require('../utils/logger');
const { getCurrentDateIST } = require('../utils/timezone');

/**
 * AUTOMATIC ABSENCE DETECTION SERVICE
 *
 * Purpose: Automatically mark students as absent if they don't scan RFID card
 *          within specified grace period after school start time.
 *
 * How it works:
 * 1. Runs HOURLY (Monday-Saturday)
 * 2. Checks each school's configured `absence_check_time`
 * 3. If current hour matches school's check time, it runs the detection
 * 4. Finds students with no attendance record today
 * 5. Marks them as "absent" automatically
 * 6. Sends SMS notification to parents (WhatsApp disabled)
 *
 * Configuration:
 * - auto_absence_enabled: Enable/disable feature (default: true)
 * - absence_grace_period_hours: Hours after school start (default: 2)
 * - school_start_time: When school opens (default: 09:00:00)
 * - absence_check_time: When to run check (default: 11:00:00)
 */

class AutoAbsenceDetectionService {
  constructor() {
    this.job = null;
    this.isRunning = false;
  }

  /**
   * Start the scheduled job
   */
  start() {
    if (this.job) {
      console.log('⚠️  Auto-absence service already running');
      return;
    }

    // Run every MINUTE (Monday-Saturday) to support any configured time
    // Cron format: minute hour day month dayOfWeek
    // '* * * * 1-6' = Every minute, Monday to Saturday
    this.job = cron.schedule('* * * * 1-6', async () => {
      if (this.isRunning) {
        console.log('⏭️  Auto-absence check already running, skipping...');
        return;
      }

      this.isRunning = true;
      try {
        await this.detectAndMarkAbsences();
      } catch (error) {
        console.error('❌ Auto-absence check failed:', error);
      } finally {
        this.isRunning = false;
      }
    }, {
      timezone: "Asia/Kolkata", // Indian timezone
      scheduled: true
    });

    console.log('✅ Auto-absence detection service started');
    console.log('   Schedule: Every minute (Monday-Saturday)');
    console.log('   Timezone: Asia/Kolkata');
  }

  /**
   * Main function to detect and mark absences
   * @param {boolean} forceRun - If true, runs for ALL schools regardless of time check (used for manual trigger)
   */
  async detectAndMarkAbsences(forceRun = false) {
    const startTime = Date.now();
    console.log('\n' + '='.repeat(70));
    console.log('🔍 [AUTO-ABSENCE] Starting automatic absence detection...');
    console.log('   Time:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
    if (forceRun) console.log('   Mode: MANUAL FORCE RUN (Checking ALL schools)');
    console.log('='.repeat(70));

    try {
      // Get today's date in YYYY-MM-DD format (IST timezone)
      const today = getCurrentDateIST(); // ✅ FIX: Use IST date, not UTC

      // Get day of week in IST timezone
      const istNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const dayOfWeek = istNow.getDay(); // 0=Sunday, 6=Saturday

      // 🛑 REMOVED GLOBAL HOLIDAY CHECK
      // Reason: It was blocking ALL schools if ANY school had a holiday.
      // Moved to inside the PER-SCHOOL loop.

      // Get current hour AND minute in Indian Time
      // 🛑 FIXED: Use robust IST time check (ignoring server locale)
      const { getCurrentHourIST, getCurrentMinuteIST } = require('../utils/timezone');
      const currentHour = getCurrentHourIST();
      const currentMinute = getCurrentMinuteIST();

      console.log(`   Current Time (IST): ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);
      console.log(`   Day of Week: ${dayOfWeek} (0=Sun, 6=Sat)`);

      let totalStudents = 0;
      let totalAbsent = 0;
      let totalNotified = 0;
      let totalErrors = 0;
      const schoolsProcessed = [];

      // Get all schools with auto-absence enabled AND their schedule settings
      const schoolsResult = await pool.query(`
        SELECT
          s.id as school_id,
          s.name as school_name,
          COALESCE(ss.auto_absence_enabled, true) as auto_absence_enabled,
          COALESCE(ss.absence_grace_period_hours, 2) as grace_period_hours,
          COALESCE(ss.school_open_time, '09:00:00') as school_start_time,
          COALESCE(ss.absence_check_time, '11:00:00') as absence_check_time,
          COALESCE(ss.weekly_holiday, 'Sunday') as weekly_holiday,
          COALESCE(ss.working_days, 'Mon-Sat') as working_days
        FROM schools s
        LEFT JOIN school_settings ss ON s.id = ss.school_id
      `);

      console.log(`\n📚 Found ${schoolsResult.rows.length} total schools`);

      // Filter schools to process
      const schoolsToProcess = schoolsResult.rows.filter(school => {
        if (!school.auto_absence_enabled) {
          if (forceRun) console.log(`   ⏭️  School: ${school.school_name} - Disabled.`);
          return false;
        }

        if (forceRun) return true; // Process all if forced

        // 1. CHECK WEEKLY HOLIDAY
        const holidayMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
        const schoolHolidayIndex = holidayMap[school.weekly_holiday] ?? 0; // Default Sunday

        if (dayOfWeek === schoolHolidayIndex) {
          console.log(`   ⏭️  School: ${school.school_name} - Today is Weekly Holiday (${school.weekly_holiday})`);
          return false;
        }

        // 2. CHECK WORKING DAYS PATTERN being strictly followed?
        // Patterns: 'Mon-Fri' (1-5), 'Mon-Sat' (1-6), 'Sun-Thu' (0-4)
        // If today is NOT in the working window, skip.
        let isWorkingDay = true;
        if (school.working_days === 'Mon-Fri' && (dayOfWeek === 0 || dayOfWeek === 6)) isWorkingDay = false;
        if (school.working_days === 'Mon-Sat' && dayOfWeek === 0) isWorkingDay = false;
        if (school.working_days === 'Sun-Thu' && (dayOfWeek === 5 || dayOfWeek === 6)) isWorkingDay = false;

        if (!isWorkingDay) {
          console.log(`   ⏭️  School: ${school.school_name} - Today is not a working day (${school.working_days})`);
          return false;
        }

        // 3. CHECK TIME MATCH (hour AND minute must match)
        const timeStr = String(school.absence_check_time); // e.g., "12:30:00" or "11:00:00"
        const timeParts = timeStr.split(':');
        const checkHour = parseInt(timeParts[0], 10);
        const checkMinute = parseInt(timeParts[1] || '0', 10);

        if (checkHour === currentHour && checkMinute === currentMinute) {
          console.log(`   ✅ Time match for ${school.school_name}: ${checkHour}:${checkMinute.toString().padStart(2, '0')}`);
          return true;
        } else {
          // Silent skip for non-matching times (too noisy otherwise)
          return false;
        }
      });

      console.log(`📚 Schools matching criteria: ${schoolsToProcess.length}`);

      if (schoolsToProcess.length === 0) {
        console.log('   No schools scheduled for this hour.');
      }

      // Process each eligible school
      for (const school of schoolsToProcess) {
        console.log(`\n🏫 Processing School: ${school.school_name} (ID: ${school.school_id})`);
        console.log(`   Grace Period: ${school.grace_period_hours} hours`);
        console.log(`   Check Time: ${school.absence_check_time}`);

        // 🛑 NEW: Per-School Holiday Check
        if (!forceRun) {
          const holidayCheck = await pool.query(
            `SELECT holiday_name FROM holidays
             WHERE school_id = $1 AND holiday_date = $2 AND is_active = true
             LIMIT 1`,
            [school.school_id, today]
          );

          if (holidayCheck.rows.length > 0) {
            console.log(`   🎉 Holiday detected for ${school.school_name}: ${holidayCheck.rows[0].holiday_name} - SKIPPING`);
            continue; // Skip this school
          }
        }

        // ✅ PERFORMANCE FIX: Process students in batches to avoid memory issues with large schools
        const BATCH_SIZE = 500;
        let offset = 0;
        let hasMore = true;
        let schoolTotalStudents = 0;

        let schoolAbsent = 0;
        let schoolNotified = 0;

        // Process students in batches
        while (hasMore) {
          // Fetch batch of students
          const studentsResult = await pool.query(`
            SELECT
              s.id,
              s.full_name,
              s.roll_number,
              c.class_name as class,
              sec.section_name as section,
              s.guardian_phone,
              s.parent_phone,
              s.mother_phone,
              s.guardian_name,
              s.parent_name
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN sections sec ON s.section_id = sec.id
            WHERE s.school_id = $1
              AND s.is_active = true
            ORDER BY s.id
            LIMIT $2 OFFSET $3
          `, [school.school_id, BATCH_SIZE, offset]);

          const students = studentsResult.rows;

          if (students.length === 0) {
            hasMore = false;
            break;
          }

          schoolTotalStudents += students.length;
          const batchNum = Math.floor(offset / BATCH_SIZE) + 1;
          console.log(`   📦 Processing batch ${batchNum} (${students.length} students, offset: ${offset})`);

          // Check each student in this batch
          for (const student of students) {
            try {
              // Check if student has attendance record today
              const attendanceResult = await pool.query(`
              SELECT id, status
              FROM attendance_logs
              WHERE student_id = $1
                AND DATE(check_in_time) = $2
              LIMIT 1
            `, [student.id, today]);

              // If NO attendance record, mark as absent
              if (attendanceResult.rows.length === 0) {
                // Create absent record (trigger will auto-set academic_year from student)
                await pool.query(`
                INSERT INTO attendance_logs (
                  student_id,
                  school_id,
                  check_in_time,
                  date,
                  status,
                  marked_by,
                  notes,
                  is_manual,
                  created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                ON CONFLICT (student_id, date, school_id) DO NOTHING
              `, [
                  student.id,
                  school.school_id,
                  `${today} ${school.absence_check_time}`, // Use check time as timestamp
                  today,  // ✅ Date column for unique constraint
                  'absent',
                  null,  // ✅ NULL = system-automated (no specific user)
                  `Auto-marked absent by system: No scan recorded by ${school.absence_check_time} (${school.grace_period_hours}h grace period)`,
                  true  // ✅ is_manual = true to distinguish from RFID scans
                ]);

                schoolAbsent++;
                totalAbsent++;

                console.log(`   ❌ ABSENT: ${student.full_name} (${student.class}-${student.section}, Roll: ${student.roll_number})`);

                // Send SMS notification to parent (WhatsApp is disabled)
                // Try multiple phone fields in order of priority (same as attendanceProcessor)
                let phoneToUse = null;
                let parentName = 'Parent';

                if (student.guardian_phone && student.guardian_phone.trim() !== '') {
                  phoneToUse = student.guardian_phone;
                  parentName = student.guardian_name || 'Guardian';
                } else if (student.parent_phone && student.parent_phone.trim() !== '') {
                  phoneToUse = student.parent_phone;
                  parentName = student.parent_name || 'Parent';
                } else if (student.mother_phone && student.mother_phone.trim() !== '') {
                  phoneToUse = student.mother_phone;
                  parentName = 'Mother';
                }

                if (phoneToUse) {
                  try {
                    // ✅ FIX: Check if school can send WhatsApp (enabled + has credits)
                    const School = require('../models/School');
                    const canSend = await School.canSendWhatsApp(school.school_id);

                    if (!canSend) {
                      const whatsappStatus = await School.getWhatsAppStatus(school.school_id);
                      if (!whatsappStatus?.whatsapp_enabled) {
                        console.log(`      ⚠️ WhatsApp DISABLED for ${school.school_name}, skipping notification`);
                      } else if (whatsappStatus?.whatsapp_credits <= 0) {
                        console.log(`      ⚠️ OUT OF CREDITS for ${school.school_name} (credits: ${whatsappStatus?.whatsapp_credits}), skipping notification`);
                      }
                      // Don't send notification, but continue processing other students
                    } else {
                      // Use whatsappService.sendAttendanceAlert which will automatically use SMS when WhatsApp is disabled
                      const alertData = {
                        parentPhone: phoneToUse,
                        studentName: student.full_name,
                        studentId: student.id,
                        schoolId: school.school_id,
                        status: 'absent',
                        checkInTime: school.absence_check_time,
                        schoolName: school.school_name,
                        date: today
                      };

                      const result = await whatsappService.sendAttendanceAlert(alertData);

                      if (result.success) {
                        // ✅ FIX: Deduct credit after successful send (if not skipped/duplicate)
                        if (!result.skipped) {
                          const remainingCredits = await School.decrementWhatsAppCredit(school.school_id);
                          if (remainingCredits !== null) {
                            console.log(`      💳 Credit used. Remaining: ${remainingCredits}`);
                          }
                        }
                        schoolNotified++;
                        totalNotified++;
                        console.log(`      📱 WhatsApp sent to ${parentName}: ${maskPhone(phoneToUse)}`);
                      } else {
                        console.error(`      ❌ WhatsApp failed: ${result.error}`);
                        totalErrors++;
                      }
                    }
                  } catch (smsError) {
                    console.error(`      ❌ WhatsApp failed: ${smsError.message}`);
                    totalErrors++;
                  }

                } else {
                  console.log(`      ⚠️  No phone number found for ${student.full_name} (tried guardian/parent/mother)`);
                }
              }
            } catch (studentError) {
              console.error(`   ❌ Error processing ${student.full_name}:`, studentError.message);
              totalErrors++;
            }
          }

          // Move to next batch
          offset += BATCH_SIZE;
        }

        // Add school total to overall total
        totalStudents += schoolTotalStudents;

        schoolsProcessed.push({
          name: school.school_name,
          total: schoolTotalStudents,
          absent: schoolAbsent,
          notified: schoolNotified
        });

        console.log(`   ✅ School complete: ${schoolAbsent}/${schoolTotalStudents} absent, ${schoolNotified} notified`);
      }

      // Final summary
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log('\n' + '='.repeat(70));
      console.log('✅ [AUTO-ABSENCE] COMPLETE');
      console.log('='.repeat(70));
      console.log(`📊 Summary:`);
      console.log(`   Total Students Checked: ${totalStudents}`);
      console.log(`   Total Marked Absent: ${totalAbsent}`);
      console.log(`   Total Parents Notified: ${totalNotified}`);
      console.log(`   Errors: ${totalErrors}`);
      console.log(`   Schools Processed: ${schoolsProcessed.length}`);
      console.log(`   Duration: ${duration}s`);

      if (schoolsProcessed.length > 0) {
        console.log(`\n📋 Details by School:`);
        schoolsProcessed.forEach(school => {
          console.log(`   - ${school.name}: ${school.absent}/${school.total} absent (${school.notified} notified)`);
        });
      }
      console.log('='.repeat(70) + '\n');

    } catch (error) {
      console.error('\n❌ [AUTO-ABSENCE] FATAL ERROR:', error);
      console.error('Stack trace:', error.stack);
    }
  }

  /**
   * Stop the scheduled job
   */
  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      console.log('⏹️  Auto-absence detection service stopped');
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      running: this.job !== null,
      isProcessing: this.isRunning,
      schedule: '0 * * * 1-6', // Hourly
      timezone: 'Asia/Kolkata'
    };
  }

  /**
   * Manual trigger (for testing)
   * Use this to test the service without waiting for scheduled time
   */
  async runManually() {
    if (this.isRunning) {
      console.log('⚠️  Auto-absence check already running');
      return { success: false, message: 'Check already in progress' };
    }

    console.log('\n🧪 [AUTO-ABSENCE] MANUAL TRIGGER');
    console.log('This is a manual test run. It will force run for ALL schools regardless of schedule.');

    this.isRunning = true;
    try {
      // Force run = true
      await this.detectAndMarkAbsences(true);
      return { success: true, message: 'Manual check completed' };
    } catch (error) {
      console.error('❌ Manual check failed:', error);
      return { success: false, message: error.message };
    } finally {
      this.isRunning = false;
    }
  }
}

// Export singleton instance
module.exports = new AutoAbsenceDetectionService();
