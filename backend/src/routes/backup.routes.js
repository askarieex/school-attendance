const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const GoogleDriveBackupService = require('../services/googleDriveBackup');
const { exec } = require('child_process');
const { sendSuccess, sendError } = require('../utils/response');
const path = require('path');

/**
 * Backup Routes
 * Base: /api/v1/school/backup
 */

/**
 * GET /api/v1/school/backup/google-drive/connect
 * Generate Google OAuth URL for school to connect their Google Drive
 */
router.get('/google-drive/connect', authenticate, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    // Generate OAuth URL
    const authUrl = GoogleDriveBackupService.getAuthUrl(schoolId);

    sendSuccess(res, { authUrl }, 'Please visit this URL to connect Google Drive');
  } catch (error) {
    console.error('Generate auth URL error:', error);
    sendError(res, 'Failed to generate authorization URL', 500);
  }
});

/**
 * GET /api/v1/school/backup/google-drive/callback
 * Handle Google OAuth callback
 */
router.get('/google-drive/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const schoolId = parseInt(state); // School ID passed in state parameter

    if (!code) {
      return res.redirect('/settings?error=google_drive_auth_failed');
    }

    // Save tokens to database
    await GoogleDriveBackupService.saveTokens(schoolId, code);

    // Redirect back to settings page with success message
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Google Drive Connected</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
          }
          .success-icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
          h1 {
            color: #4CAF50;
            margin: 0 0 10px 0;
          }
          p {
            color: #666;
            margin: 10px 0 30px 0;
          }
          .button {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
          }
          .button:hover {
            background: #45a049;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h1>Google Drive Connected!</h1>
          <p>Your school's backups will now be automatically saved to Google Drive every night.</p>
          <a href="/settings" class="button">Go to Dashboard</a>
        </div>
        <script>
          // Auto-close after 3 seconds
          setTimeout(() => {
            window.close();
          }, 3000);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Google Drive callback error:', error);
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Connection Failed</title>
        <style>
          body { font-family: Arial; text-align: center; padding-top: 50px; }
          .error { color: #f44336; font-size: 24px; }
        </style>
      </head>
      <body>
        <div class="error">❌ Failed to connect Google Drive</div>
        <p>Please try again or contact support.</p>
        <a href="/settings">Go back</a>
      </body>
      </html>
    `);
  }
});

/**
 * GET /api/v1/school/backup/google-drive/status
 * Check if Google Drive is connected
 */
router.get('/google-drive/status', authenticate, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const isConnected = await GoogleDriveBackupService.isConnected(schoolId);

    sendSuccess(res, { connected: isConnected });
  } catch (error) {
    console.error('Check Google Drive status error:', error);
    sendError(res, 'Failed to check Google Drive status', 500);
  }
});

/**
 * POST /api/v1/school/backup/google-drive/disconnect
 * Disconnect Google Drive
 */
router.post('/google-drive/disconnect', authenticate, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    await GoogleDriveBackupService.disconnect(schoolId);

    sendSuccess(res, null, 'Google Drive disconnected successfully');
  } catch (error) {
    console.error('Disconnect Google Drive error:', error);
    sendError(res, 'Failed to disconnect Google Drive', 500);
  }
});

/**
 * POST /api/v1/school/backup/google-drive/upload-now
 * Upload backup to Google Drive manually
 */
router.post('/google-drive/upload-now', authenticate, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    // Check if Google Drive is connected
    const isConnected = await GoogleDriveBackupService.isConnected(schoolId);
    if (!isConnected) {
      return sendError(res, 'Google Drive not connected. Please connect first.', 400);
    }

    // Create backup first
    const backupDir = path.join(__dirname, '../../backups/schools', `school_${schoolId}`);
    const backupScript = path.join(__dirname, '../../scripts/backups/backup-database.sh');

    console.log(`📦 Creating backup for school ${schoolId}...`);

    exec(`mkdir -p ${backupDir} && ${backupScript} school ${schoolId}`, async (error, stdout, stderr) => {
      if (error) {
        console.error('Backup creation error:', stderr);
        return sendError(res, 'Backup creation failed', 500);
      }

      console.log('Backup created:', stdout);

      // Find the latest backup file
      const fs = require('fs');
      const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.sql.gz'));

      if (files.length === 0) {
        return sendError(res, 'No backup file found', 500);
      }

      // Sort by modification time and get the latest
      const latestFile = files
        .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime }))
        .sort((a, b) => b.time - a.time)[0].name;

      const backupFilePath = path.join(backupDir, latestFile);

      console.log(`📤 Uploading backup to Google Drive: ${backupFilePath}`);

      try {
        // Upload to Google Drive
        const result = await GoogleDriveBackupService.uploadBackup(schoolId, backupFilePath);

        sendSuccess(res, result, 'Backup uploaded to Google Drive successfully');
      } catch (uploadError) {
        console.error('Upload error:', uploadError);
        sendError(res, uploadError.message, 500);
      }
    });

  } catch (error) {
    console.error('Upload to Google Drive error:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * GET /api/v1/school/backup/google-drive/list
 * List backups in Google Drive
 */
router.get('/google-drive/list', authenticate, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const backups = await GoogleDriveBackupService.listBackups(schoolId);

    sendSuccess(res, backups, 'Backups retrieved successfully');
  } catch (error) {
    console.error('List Google Drive backups error:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * GET /api/v1/school/backup/logs
 * Get backup history logs
 */
router.get('/logs', authenticate, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { query } = require('../config/database');

    const result = await query(
      `SELECT * FROM backup_logs
       WHERE school_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [schoolId]
    );

    sendSuccess(res, result.rows, 'Backup logs retrieved successfully');
  } catch (error) {
    console.error('Get backup logs error:', error);
    sendError(res, 'Failed to retrieve backup logs', 500);
  }
});

module.exports = router;
