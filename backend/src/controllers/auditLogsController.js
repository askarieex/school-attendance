const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Audit Logs Controller
 * View and export audit logs
 */

/**
 * Get audit logs with filters
 * GET /api/v1/super/audit-logs?page=1&limit=50&userId=123&actionType=create&startDate=2025-11-01
 */
const getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      userId,
      actionType,
      resourceType,
      startDate,
      endDate
    } = req.query;

    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];
    let paramCount = 0;

    // Build WHERE clause
    if (userId) {
      paramCount++;
      conditions.push(`user_id = $${paramCount}`);
      params.push(userId);
    }

    if (actionType) {
      paramCount++;
      conditions.push(`action_type = $${paramCount}`);
      params.push(actionType);
    }

    if (resourceType) {
      paramCount++;
      conditions.push(`resource_type = $${paramCount}`);
      params.push(resourceType);
    }

    if (startDate) {
      paramCount++;
      conditions.push(`created_at >= $${paramCount}`);
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      conditions.push(`created_at <= $${paramCount}`);
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM audit_logs ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Get logs
    paramCount++;
    paramCount++;
    const logsResult = await query(
      `SELECT * FROM audit_logs 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
      [...params, limit, offset]
    );

    sendSuccess(res, {
      logs: logsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    }, 'Audit logs retrieved successfully');

  } catch (error) {
    console.error('Get audit logs error:', error);
    sendError(res, 'Failed to retrieve audit logs', 500);
  }
};

/**
 * Get audit log details
 * GET /api/v1/super/audit-logs/:id
 */
const getAuditLogDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM audit_logs WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'Audit log not found', 404);
    }

    sendSuccess(res, result.rows[0], 'Audit log details retrieved');
  } catch (error) {
    console.error('Get audit log details error:', error);
    sendError(res, 'Failed to retrieve audit log details', 500);
  }
};

/**
 * Export audit logs to CSV
 * GET /api/v1/super/audit-logs/export
 */
const exportAuditLogs = async (req, res) => {
  try {
    const { startDate, endDate, actionType, resourceType } = req.query;

    const params = [];
    const conditions = [];
    let paramCount = 0;

    if (startDate) {
      paramCount++;
      conditions.push(`created_at >= $${paramCount}`);
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      conditions.push(`created_at <= $${paramCount}`);
      params.push(endDate);
    }

    if (actionType) {
      paramCount++;
      conditions.push(`action_type = $${paramCount}`);
      params.push(actionType);
    }

    if (resourceType) {
      paramCount++;
      conditions.push(`resource_type = $${paramCount}`);
      params.push(resourceType);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC`,
      params
    );

    // Convert to CSV
    const csv = convertToCSV(result.rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);

  } catch (error) {
    console.error('Export audit logs error:', error);
    sendError(res, 'Failed to export audit logs', 500);
  }
};

/**
 * Get audit statistics
 * GET /api/v1/super/audit-logs/stats
 */
const getAuditStats = async (req, res) => {
  try {
    // Get stats for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Total logs
    const totalResult = await query(
      'SELECT COUNT(*) FROM audit_logs WHERE created_at >= $1',
      [thirtyDaysAgo]
    );

    // By action type
    const actionTypeResult = await query(
      `SELECT action_type, COUNT(*) as count 
       FROM audit_logs 
       WHERE created_at >= $1
       GROUP BY action_type
       ORDER BY count DESC`,
      [thirtyDaysAgo]
    );

    // By resource type
    const resourceTypeResult = await query(
      `SELECT resource_type, COUNT(*) as count 
       FROM audit_logs 
       WHERE created_at >= $1
       GROUP BY resource_type
       ORDER BY count DESC`,
      [thirtyDaysAgo]
    );

    // By user (top 10)
    const topUsersResult = await query(
      `SELECT user_email, COUNT(*) as count 
       FROM audit_logs 
       WHERE created_at >= $1 AND user_email IS NOT NULL
       GROUP BY user_email
       ORDER BY count DESC
       LIMIT 10`,
      [thirtyDaysAgo]
    );

    // Daily activity (last 7 days)
    const dailyActivityResult = await query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM audit_logs
       WHERE created_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`
    );

    sendSuccess(res, {
      period: 'Last 30 days',
      total: parseInt(totalResult.rows[0].count),
      byActionType: actionTypeResult.rows,
      byResourceType: resourceTypeResult.rows,
      topUsers: topUsersResult.rows,
      dailyActivity: dailyActivityResult.rows
    }, 'Audit statistics retrieved');

  } catch (error) {
    console.error('Get audit stats error:', error);
    sendError(res, 'Failed to retrieve audit statistics', 500);
  }
};

/**
 * Helper: Convert array of objects to CSV
 */
function convertToCSV(data) {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [];

  // Add header row
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      let value = row[header];
      
      // Handle special types
      if (value === null || value === undefined) {
        value = '';
      } else if (typeof value === 'object') {
        value = JSON.stringify(value);
      } else {
        value = String(value);
      }
      
      // Escape quotes and wrap in quotes if contains comma
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        value = `"${value.replace(/"/g, '""')}"`;
      }
      
      return value;
    });
    
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

module.exports = {
  getAuditLogs,
  getAuditLogDetails,
  exportAuditLogs,
  getAuditStats
};
