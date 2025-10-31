const Leave = require('../models/Leave');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Get all leaves
 */
const getLeaves = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { studentId, status, startDate, endDate, month, year } = req.query;

    const leaves = await Leave.findAll(schoolId, {
      studentId,
      status,
      startDate,
      endDate,
      month: month ? parseInt(month) : undefined,
      year: year ? parseInt(year) : undefined
    });

    sendSuccess(res, leaves, 'Leaves retrieved successfully');
  } catch (error) {
    console.error('Get leaves error:', error);
    sendError(res, error.message, 500);
  }
};

/**
 * Get monthly leaves (for calendar view)
 */
const getMonthlyLeaves = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { year, month } = req.query;

    if (!year || !month) {
      return sendError(res, 'Year and month are required', 400);
    }

    const leaves = await Leave.getMonthlyLeaves(schoolId, parseInt(year), parseInt(month));
    sendSuccess(res, leaves, 'Monthly leaves retrieved successfully');
  } catch (error) {
    console.error('Get monthly leaves error:', error);
    sendError(res, error.message, 500);
  }
};

/**
 * Get leave by ID
 */
const getLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const leave = await Leave.findById(id);

    if (!leave) {
      return sendError(res, 'Leave not found', 404);
    }

    sendSuccess(res, leave, 'Leave retrieved successfully');
  } catch (error) {
    console.error('Get leave error:', error);
    sendError(res, error.message, 500);
  }
};

/**
 * Create a new leave
 */
const createLeave = async (req, res) => {
  try {
    const { schoolId, userId } = req.user;
    const { studentId, leaveType, startDate, endDate, reason, appliedVia } = req.body;

    // Validation
    if (!studentId || !leaveType || !startDate || !endDate) {
      return sendError(res, 'Student ID, leave type, start date, and end date are required', 400);
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      return sendError(res, 'End date must be after start date', 400);
    }

    const leave = await Leave.create({
      studentId,
      leaveType,
      startDate,
      endDate,
      reason,
      appliedVia: appliedVia || 'manual',
      status: 'approved' // Auto-approve leaves created by school admin
    }, schoolId);

    sendSuccess(res, leave, 'Leave created successfully', 201);
  } catch (error) {
    console.error('Create leave error:', error);
    sendError(res, error.message, 500);
  }
};

/**
 * Update leave
 */
const updateLeave = async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;
    const updates = req.body;

    const leave = await Leave.update(id, updates, userId);

    if (!leave) {
      return sendError(res, 'Leave not found', 404);
    }

    sendSuccess(res, leave, 'Leave updated successfully');
  } catch (error) {
    console.error('Update leave error:', error);
    sendError(res, error.message, 500);
  }
};

/**
 * Delete leave
 */
const deleteLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const leave = await Leave.delete(id);

    if (!leave) {
      return sendError(res, 'Leave not found', 404);
    }

    sendSuccess(res, leave, 'Leave deleted successfully');
  } catch (error) {
    console.error('Delete leave error:', error);
    sendError(res, error.message, 500);
  }
};

/**
 * Approve/Reject leave
 */
const updateLeaveStatus = async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return sendError(res, 'Invalid status. Must be "approved" or "rejected"', 400);
    }

    const leave = await Leave.update(id, { status }, userId);

    if (!leave) {
      return sendError(res, 'Leave not found', 404);
    }

    sendSuccess(res, leave, `Leave ${status} successfully`);
  } catch (error) {
    console.error('Update leave status error:', error);
    sendError(res, error.message, 500);
  }
};

module.exports = {
  getLeaves,
  getMonthlyLeaves,
  getLeave,
  createLeave,
  updateLeave,
  deleteLeave,
  updateLeaveStatus
};
