const cron = require('node-cron');
const { pool } = require('../config/database');
const whatsappService = require('./whatsappService');
const { maskPhone } = require('../utils/logger');

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

    // Run every HOUR at minute 0 (Monday-Saturday)
    // Cron format: minute hour day month dayOfWeek
    // '0 * * * 1-6' = Every hour on the hour, Monday to Saturday
    this.job = cron.schedule('0 * * * 1-6', async () => {
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
    console.log('   Schedule: Hourly (Monday-Saturday)');
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
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      const dayOfWeek = new Date().getDay(); // 0=Sunday, 6=Saturday

      // Skip on Sundays UNLESS forced
      if (dayOfWeek === 0 && !forceRun) {
        console.log('⏭️  Today is Sunday, skipping auto-absence check');
        return;
      }

      // Check if today is a holiday (across all schools)
      // Note: Ideally holiday checks should be per-school, but existing logic is global.
      // Keeping it global for now, but `forceRun` overrides it.
      if (!forceRun) {
        const holidayCheck = await pool.query(
          `SELECT COUNT(*) as count FROM holidays
           WHERE holiday_date = $1 AND is_active = true`,
          [today]
        );

        if (parseInt(holidayCheck.rows[0].count) > 0) {
          console.log('🎉 Today is a holiday, skipping auto-absence check');
          return;
        }
      }

      // Get current hour in Indian Time
      const currentHour = parseInt(new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hour12: false
      }));

      console.log(`   Current Hour (IST): ${currentHour}:00`);

      let totalStudents = 0;
      let totalAbsent = 0;
      let totalNotified = 0;
      let totalErrors = 0;
      const schoolsProcessed = [];

      // Get all schools with auto-absence enabled
      const schoolsResult = await pool.query(`
        SELECT
          s.id as school_id,
          s.name as school_name,
          COALESCE(ss.auto_absence_enabled, true) as auto_absence_enabled,
          COALESCE(ss.absence_grace_period_hours, 2) as grace_period_hours,
          COALESCE(ss.school_open_time, '09:00:00') as school_start_time,
          COALESCE(ss.absence_check_time, '11:00:00') as absence_check_time
        FROM schools s
        LEFT JOIN school_settings ss ON s.id = ss.school_id
      `);

      console.log(`\n📚 Found ${schoolsResult.rows.length} total schools`);

      // Filter schools to process
      const schoolsToProcess = schoolsResult.rows.filter(school => {
        if (!school.auto_absence_enabled) {
          if (forceRun) console.log(`   ⏭️  School: ${school.school_name} - Disabled`);
          return false;
        }

        if (forceRun) return true; // Process all if forced

        // Check time match
        const checkTimeParts = school.absence_check_time.split(':');
        const checkHour = parseInt(checkTimeParts[0]);

        if (checkHour === currentHour) {
          return true;
        } else {
          // Debug log for skipped schools (optional, maybe too noisy)
          // console.log(`   ⏭️  School: ${school.school_name} - Scheduled for ${checkHour}:00 (Current: ${currentHour}:00)`);
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
                      schoolNotified++;
                      totalNotified++;
                      console.log(`      📱 SMS sent to ${parentName}: ${maskPhone(phoneToUse)}`);
                    } else {
                      console.error(`      ❌ SMS failed: ${result.error}`);
                      totalErrors++;
                    }
                  } catch (smsError) {
                    console.error(`      ❌ SMS failed: ${smsError.message}`);
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
