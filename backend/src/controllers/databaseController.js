const { query } = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

/**
 * DATABASE EXPLORER CONTROLLER
 * Allows Super Admins to view raw database tables and data.
 * ⚠️ READ-ONLY ACCESS: No update/delete methods implemented here for safety.
 */

// Get list of all tables in the public schema
const getTables = async (req, res) => {
    try {
        const result = await query(
            `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = 'public' 
       AND table_type = 'BASE TABLE'
       ORDER BY table_name`
        );

        // Extract just the names for cleaner frontend handling
        const tables = result.rows.map(row => row.table_name);

        sendSuccess(res, tables);
    } catch (error) {
        console.error('Get tables error:', error);
        sendError(res, 'Failed to fetch tables', 500);
    }
};

// Get data from a specific table with pagination
const getTableData = async (req, res) => {
    try {
        const { tableName } = req.params;
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        // ✅ SECURITY: Validate table name against allowlist
        // This prevents SQL Injection since table names can't be parameterized in identifiers
        if (!/^[a-z0-9_]+$/i.test(tableName)) {
            return sendError(res, 'Invalid table name format', 400);
        }

        // Double check if table actually exists in public schema
        const checkTable = await query(
            `SELECT EXISTS (
         SELECT FROM information_schema.tables 
         WHERE table_schema = 'public' 
         AND table_name = $1
       )`,
            [tableName]
        );

        if (!checkTable.rows[0].exists) {
            return sendError(res, 'Table not found', 404);
        }

        // Get total rows estimate (fast count)
        const countResult = await query(`SELECT COUNT(*) FROM "${tableName}"`);
        const total = parseInt(countResult.rows[0].count);

        // Get Data
        // We use double quotes "${tableName}" to handle case sensitivity if any, 
        // though strict validation assumes snake_case mostly
        const result = await query(
            `SELECT * FROM "${tableName}" LIMIT $1 OFFSET $2`,
            [parseInt(limit), offset]
        );

        sendPaginated(res, result.rows, page, limit, total);
    } catch (error) {
        console.error(`Get table data error for ${req.params.tableName}:`, error);
        sendError(res, 'Failed to fetch table data', 500);
    }
};

module.exports = {
    getTables,
    getTableData
};
