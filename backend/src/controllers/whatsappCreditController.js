/**
 * WhatsApp Credit Controller
 * Manages WhatsApp message credits for schools (Super Admin only)
 */

const { query } = require('../config/database');
const School = require('../models/School');

/**
 * GET /api/v1/super/whatsapp/schools
 * Get all schools with their WhatsApp status and credits
 */
exports.getAllSchoolsWhatsAppStatus = async (req, res) => {
    try {
        const result = await query(
            `SELECT 
        id, 
        name, 
        email, 
        phone,
        whatsapp_enabled, 
        whatsapp_credits, 
        whatsapp_credits_used, 
        whatsapp_last_refill, 
        whatsapp_low_credit_threshold,
        whatsapp_use_own_key,
        CASE WHEN whatsapp_api_key IS NOT NULL AND whatsapp_api_key != '' THEN TRUE ELSE FALSE END as has_own_api_key,
        is_active
       FROM schools 
       WHERE is_active = TRUE
       ORDER BY name`
        );

        res.json({
            success: true,
            data: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching WhatsApp status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/v1/super/whatsapp/schools/:id
 * Get single school WhatsApp status
 */
exports.getSchoolWhatsAppStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `SELECT 
        id, 
        name, 
        email,
        whatsapp_enabled, 
        whatsapp_credits, 
        whatsapp_credits_used, 
        whatsapp_last_refill, 
        whatsapp_low_credit_threshold
       FROM schools 
       WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'School not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error fetching school WhatsApp status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/v1/super/whatsapp/schools/:id/enable
 * Enable or disable WhatsApp for a school
 */
exports.setWhatsAppEnabled = async (req, res) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ success: false, error: 'enabled must be a boolean' });
        }

        const result = await query(
            `UPDATE schools 
       SET whatsapp_enabled = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, whatsapp_enabled, whatsapp_credits`,
            [id, enabled]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'School not found' });
        }

        const school = result.rows[0];
        console.log(`✅ WhatsApp ${enabled ? 'enabled' : 'disabled'} for school: ${school.name}`);

        res.json({
            success: true,
            data: school,
            message: `WhatsApp ${enabled ? 'enabled' : 'disabled'} for ${school.name}`
        });
    } catch (error) {
        console.error('Error setting WhatsApp status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/v1/super/whatsapp/schools/:id/credits
 * Add credits to a school (top-up)
 */
exports.addCredits = async (req, res) => {
    try {
        const { id } = req.params;
        const { credits, note } = req.body;

        if (!credits || typeof credits !== 'number' || credits <= 0) {
            return res.status(400).json({ success: false, error: 'Credits must be a positive number' });
        }

        // Get current credits before update
        const beforeResult = await query('SELECT name, whatsapp_credits FROM schools WHERE id = $1', [id]);
        if (beforeResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'School not found' });
        }

        const beforeCredits = beforeResult.rows[0].whatsapp_credits || 0;
        const schoolName = beforeResult.rows[0].name;

        // Add credits
        const result = await query(
            `UPDATE schools 
       SET whatsapp_credits = COALESCE(whatsapp_credits, 0) + $2,
           whatsapp_last_refill = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, whatsapp_enabled, whatsapp_credits, whatsapp_last_refill`,
            [id, credits]
        );

        const school = result.rows[0];
        console.log(`✅ Added ${credits} WhatsApp credits to ${schoolName} (${beforeCredits} → ${school.whatsapp_credits})`);

        // TODO: Log this in audit_logs table for tracking

        res.json({
            success: true,
            data: school,
            message: `Added ${credits} credits to ${school.name}. New balance: ${school.whatsapp_credits}`,
            details: {
                previousCredits: beforeCredits,
                addedCredits: credits,
                newCredits: school.whatsapp_credits
            }
        });
    } catch (error) {
        console.error('Error adding credits:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/v1/super/whatsapp/schools/:id/set-credits
 * Set credits to a specific value (override)
 */
exports.setCredits = async (req, res) => {
    try {
        const { id } = req.params;
        const { credits } = req.body;

        if (typeof credits !== 'number' || credits < 0) {
            return res.status(400).json({ success: false, error: 'Credits must be a non-negative number' });
        }

        const result = await query(
            `UPDATE schools 
       SET whatsapp_credits = $2,
           whatsapp_last_refill = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, whatsapp_credits`,
            [id, credits]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'School not found' });
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: `Set credits to ${credits} for ${result.rows[0].name}`
        });
    } catch (error) {
        console.error('Error setting credits:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * PUT /api/v1/super/whatsapp/schools/:id/threshold
 * Update low credit alert threshold
 */
exports.setLowCreditThreshold = async (req, res) => {
    try {
        const { id } = req.params;
        const { threshold } = req.body;

        if (typeof threshold !== 'number' || threshold < 0) {
            return res.status(400).json({ success: false, error: 'Threshold must be a non-negative number' });
        }

        const result = await query(
            `UPDATE schools 
       SET whatsapp_low_credit_threshold = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, whatsapp_low_credit_threshold`,
            [id, threshold]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'School not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error setting threshold:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/v1/super/whatsapp/low-credits
 * Get schools with low credits (below threshold)
 */
exports.getLowCreditSchools = async (req, res) => {
    try {
        const result = await query(
            `SELECT 
        id, 
        name, 
        email, 
        phone,
        whatsapp_credits, 
        whatsapp_low_credit_threshold,
        whatsapp_last_refill
       FROM schools
       WHERE whatsapp_enabled = TRUE 
       AND whatsapp_credits <= COALESCE(whatsapp_low_credit_threshold, 50)
       AND is_active = TRUE
       ORDER BY whatsapp_credits ASC`
        );

        res.json({
            success: true,
            data: result.rows,
            count: result.rows.length,
            message: result.rows.length > 0
                ? `${result.rows.length} school(s) have low WhatsApp credits`
                : 'All schools have sufficient credits'
        });
    } catch (error) {
        console.error('Error fetching low credit schools:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/v1/super/whatsapp/stats
 * Get overall WhatsApp usage statistics
 */
exports.getWhatsAppStats = async (req, res) => {
    try {
        const result = await query(
            `SELECT 
        COUNT(*) FILTER (WHERE whatsapp_enabled = TRUE) as enabled_schools,
        COUNT(*) FILTER (WHERE whatsapp_enabled = FALSE OR whatsapp_enabled IS NULL) as disabled_schools,
        SUM(whatsapp_credits) as total_credits_remaining,
        SUM(whatsapp_credits_used) as total_credits_used,
        COUNT(*) FILTER (WHERE whatsapp_enabled = TRUE AND whatsapp_credits <= COALESCE(whatsapp_low_credit_threshold, 50)) as low_credit_schools
       FROM schools
       WHERE is_active = TRUE`
        );

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error fetching WhatsApp stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/v1/super/whatsapp/schools/:id/api-key
 * Set per-school API key (for schools using their own YCloud account)
 */
exports.setSchoolApiKey = async (req, res) => {
    try {
        const { id } = req.params;
        const { apiKey, useOwnKey } = req.body;

        // If clearing the API key
        if (!apiKey || apiKey.trim() === '') {
            const result = await query(
                `UPDATE schools 
                 SET whatsapp_api_key = NULL,
                     whatsapp_use_own_key = FALSE,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1
                 RETURNING id, name`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'School not found' });
            }

            console.log(`✅ Cleared API key for school: ${result.rows[0].name} (will use master key)`);
            return res.json({
                success: true,
                message: `Cleared API key for ${result.rows[0].name}. Will use master key.`,
                data: { has_own_api_key: false, whatsapp_use_own_key: false }
            });
        }

        // Set the API key
        const result = await query(
            `UPDATE schools 
             SET whatsapp_api_key = $2,
                 whatsapp_use_own_key = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING id, name`,
            [id, apiKey, useOwnKey !== false]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'School not found' });
        }

        console.log(`✅ Set custom API key for school: ${result.rows[0].name}`);
        res.json({
            success: true,
            message: `API key set for ${result.rows[0].name}. Will use school's own YCloud account.`,
            data: { has_own_api_key: true, whatsapp_use_own_key: true }
        });
    } catch (error) {
        console.error('Error setting school API key:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
