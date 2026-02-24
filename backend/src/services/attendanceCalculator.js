const Holiday = require('../models/Holiday');
const SchoolSettings = require('../models/SchoolSettings');
const { getCurrentDateIST } = require('../utils/timezone');

/**
 * AttendanceCalculator
 * 
 * Single source of truth for:
 * 1. Is today a working day? (vs Holiday/Weekend)
 * 2. Is this check-in Late or Present?
 * 3. Monthly Calendar Generation (Filling gaps with H/S)
 */
class AttendanceCalculator {

    /**
     * Determine the status of a specific day
     * @param {string} date - YYYY-MM-DD
     * @param {number} schoolId
     * @returns {Promise<{type: 'WORKING'|'HOLIDAY'|'WEEKEND', name: string}>}
     */
    static async getDayStatus(schoolId, date) {
        // 1. Check Global/School Holidays
        const isHoliday = await Holiday.isHoliday(date, schoolId);
        if (isHoliday) {
            // Fetch holiday name if possible, for now just generic
            // In a real optimized version, we'd pass the holiday object or fetch it efficiently
            const holidayList = await Holiday.findAll(schoolId, { startDate: date, endDate: date });
            const holidayName = holidayList.length > 0 ? holidayList[0].holiday_name : 'Holiday';
            return { type: 'HOLIDAY', name: holidayName };
        }

        // 2. Check Weekly Holiday (Weekend)
        const settings = await SchoolSettings.getOrCreate(schoolId);
        const dayOfWeek = new Date(date).getDay(); // 0=Sun, 6=Sat

        // Map day name to index
        const daysMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
        const weeklyHolidayIndex = daysMap[settings.weekly_holiday] ?? 0; // Default Sunday

        if (dayOfWeek === weeklyHolidayIndex) {
            return { type: 'WEEKEND', name: settings.weekly_holiday };
        }

        // 3. Check Working Days Pattern
        // settings.working_days e.g., 'Mon-Sat', 'Mon-Fri'
        let isWorkingDay = true;
        if (settings.working_days === 'Mon-Fri' && (dayOfWeek === 0 || dayOfWeek === 6)) isWorkingDay = false;
        if (settings.working_days === 'Mon-Sat' && dayOfWeek === 0) isWorkingDay = false;
        // Add more patterns if needed

        if (!isWorkingDay) {
            return { type: 'WEEKEND', name: 'Off Day' };
        }

        return { type: 'WORKING', name: 'Working Day' };
    }

    /**
     * Calculate Present vs Late status
     * @param {object} settings - School Settings object
     * @param {string|Date} checkInTime 
     * @returns {'present'|'late'}
     */
    static calculateCheckInStatus(settings, checkInTime) {
        if (!settings.school_open_time || !settings.late_threshold_minutes) {
            return 'present'; // Default if settings missing
        }

        const checkDate = new Date(checkInTime);
        const checkHour = checkDate.getHours();
        const checkMin = checkDate.getMinutes();
        const checkTotalMinutes = checkHour * 60 + checkMin;

        // Parse school start time (e.g., "09:00:00" or "9:00 AM")
        const timeStr = settings.school_open_time;
        let startHour = 0, startMin = 0;

        if (timeStr.includes(':')) {
            const parts = timeStr.split(':');
            startHour = parseInt(parts[0]);
            startMin = parseInt(parts[1]);

            // Handle AM/PM if present
            if (timeStr.toLowerCase().includes('pm') && startHour < 12) startHour += 12;
            if (timeStr.toLowerCase().includes('am') && startHour === 12) startHour = 0;
        }

        const startTotalMinutes = startHour * 60 + startMin;
        const diffMinutes = checkTotalMinutes - startTotalMinutes;

        if (diffMinutes > settings.late_threshold_minutes) {
            return 'late';
        }

        return 'present';
    }

    /**
     * Generate Monthly Stats with Gaps Filled
     * @param {number} schoolId
     * @param {string} startDate YYYY-MM-DD
     * @param {string} endDate YYYY-MM-DD
     * @param {Array} rawLogs - Rows from AttendanceLog.getLogsForDateRange
     * @returns {Promise<Array>}
     */
    static async generateMonthlyCalendar(schoolId, startDate, endDate, rawLogs) {
        // 1. Get all Holidays in range
        const holidays = await Holiday.findAll(schoolId, { startDate, endDate });
        const holidayMap = {};
        holidays.forEach(h => {
            // Handle specific dates
            holidayMap[h.holiday_date.toISOString().split('T')[0]] = h.holiday_name;
            // recurring logic would go here if not handled by findAll
        });

        // 2. Get Settings (for Weekends)
        const settings = await SchoolSettings.getOrCreate(schoolId);

        // 3. Build Map of Existing Logs
        const logMap = {}; // Key: "studentId_date" -> log
        rawLogs.forEach(log => {
            const dateStr = new Date(log.date).toISOString().split('T')[0];
            logMap[`${log.student_id}_${dateStr}`] = log;
        });

        // 4. THIS FUNCTION IS USUALLY FOR AGGREGATES
        // If we want to fill gaps for a SPECIFIC student, we loop dates.
        // If we want detailed stats for ALL students, that's heavy.

        // Changing approach: This function specifically helps "getAnalytics" (Daily Counts)
        // for the Dashboard Chart.

        const statsMap = {}; // Date -> { present, absent, late, holiday, weekend }

        // Initialize stats for every day in range
        let curr = new Date(startDate);
        const end = new Date(endDate);

        // Case-insensitive mapping
        const dayMap = { 'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6 };
        const holidayKey = (settings.weekly_holiday || 'Sunday').toLowerCase().trim();
        const schoolHolidayIdx = dayMap[holidayKey] ?? 0;

        while (curr <= end) {
            const dateStr = curr.toISOString().split('T')[0];
            statsMap[dateStr] = { date: dateStr, present: 0, absent: 0, late: 0, holiday: 0, weekend: 0, total: 0 };

            // ✅ Deep Fix: Use getUTCDay() for "YYYY-MM-DD" dates parsed as UTC midnight
            const dayOfWeek = curr.getUTCDay();

            // Check Day Type
            // 1. Specific Holiday (High Priority)
            if (holidayMap[dateStr]) {
                statsMap[dateStr].isHoliday = true;
                statsMap[dateStr].name = holidayMap[dateStr];
            }
            // 2. Weekly Holiday (e.g., Sunday or Friday)
            else if (dayOfWeek === schoolHolidayIdx) {
                statsMap[dateStr].isWeekend = true;
                statsMap[dateStr].name = settings.weekly_holiday || 'Weekend';
            }
            // 3. Working Days Pattern (e.g. Mon-Fri excludes Sat/Sun)
            else {
                let isOffDay = false;
                if (settings.working_days === 'Mon-Fri' && (dayOfWeek === 0 || dayOfWeek === 6)) isOffDay = true;
                if (settings.working_days === 'Mon-Sat' && dayOfWeek === 0) isOffDay = true;

                if (isOffDay) {
                    statsMap[dateStr].isWeekend = true;
                    statsMap[dateStr].name = 'Off Day';
                }
            }

            curr.setDate(curr.getDate() + 1);
        }

        // Fill with Real Data
        rawLogs.forEach(log => {
            const dateStr = new Date(log.date).toISOString().split('T')[0];
            if (statsMap[dateStr]) {
                if (log.status === 'present') statsMap[dateStr].present++;
                if (log.status === 'absent') statsMap[dateStr].absent++;
                if (log.status === 'late') statsMap[dateStr].late++;
                statsMap[dateStr].total++;
            }
        });

        // Post-process: If a day is Holiday/Weekend, set counts accordingly?
        // Actually, for the dashboard chart, if it's a holiday, we usually want to show 0/0/0 or a "Holiday" distinct bar.
        // This function returns the stats array ready for frontend.

        return Object.values(statsMap).sort((a, b) => a.date.localeCompare(b.date));
    }
}

module.exports = AttendanceCalculator;
