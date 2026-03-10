const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');

class GoogleDriveBackupService {

  /**
   * Generate Google Drive OAuth URL for school to authorize
   */
  static getAuthUrl(schoolId) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const scopes = [
      'https://www.googleapis.com/auth/drive.file' // Access to files created by app
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Get refresh token
      scope: scopes,
      state: schoolId.toString() // Pass school ID to identify which school is connecting
    });

    return authUrl;
  }

  /**
   * Exchange authorization code for tokens and save to database
   */
  static async saveTokens(schoolId, authCode) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(authCode);

    // Save tokens to database
    await query(
      `UPDATE school_settings
       SET google_drive_refresh_token = $1,
           google_drive_access_token = $2,
           google_drive_connected = TRUE,
           updated_at = CURRENT_TIMESTAMP
       WHERE school_id = $3`,
      [tokens.refresh_token, tokens.access_token, schoolId]
    );

    console.log(`✅ Google Drive connected for school ${schoolId}`);

    return { success: true };
  }

  /**
   * Upload backup file to school's Google Drive
   */
  static async uploadBackup(schoolId, backupFilePath) {
    try {
      // Get school's Google Drive tokens from database
      const result = await query(
        `SELECT google_drive_refresh_token, google_drive_access_token
         FROM school_settings
         WHERE school_id = $1`,
        [schoolId]
      );

      if (result.rows.length === 0 || !result.rows[0].google_drive_refresh_token) {
        throw new Error('Google Drive not connected for this school');
      }

      const { google_drive_refresh_token, google_drive_access_token } = result.rows[0];

      // Setup OAuth client with school's tokens
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      oauth2Client.setCredentials({
        refresh_token: google_drive_refresh_token,
        access_token: google_drive_access_token
      });

      // Create Google Drive instance
      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      // Get or create "School Backups" folder
      const folderId = await this.getOrCreateBackupFolder(drive);

      // Upload file
      const fileName = path.basename(backupFilePath);
      const fileMetadata = {
        name: fileName,
        parents: [folderId] // Upload to backup folder
      };

      const media = {
        mimeType: 'application/gzip',
        body: fs.createReadStream(backupFilePath)
      };

      console.log(`📤 Uploading backup to Google Drive: ${fileName}`);

      const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, size, webViewLink'
      });

      console.log(`✅ Backup uploaded successfully: ${file.data.name}`);

      // Save upload log to database
      await query(
        `INSERT INTO backup_logs (school_id, backup_file, cloud_provider, file_size, status, cloud_file_id)
         VALUES ($1, $2, 'google_drive', $3, 'success', $4)`,
        [schoolId, fileName, file.data.size, file.data.id]
      );

      return {
        success: true,
        fileId: file.data.id,
        fileName: file.data.name,
        fileSize: file.data.size,
        webViewLink: file.data.webViewLink
      };

    } catch (error) {
      console.error('❌ Google Drive upload failed:', error.message);

      // Log failure
      await query(
        `INSERT INTO backup_logs (school_id, backup_file, cloud_provider, status, error_message)
         VALUES ($1, $2, 'google_drive', 'failed', $3)`,
        [schoolId, path.basename(backupFilePath), error.message]
      );

      throw error;
    }
  }

  /**
   * Get or create "School Backups" folder in Google Drive
   */
  static async getOrCreateBackupFolder(drive) {
    const folderName = 'School Attendance Backups';

    // Search for existing folder
    const response = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (response.data.files.length > 0) {
      // Folder exists
      return response.data.files[0].id;
    } else {
      // Create new folder
      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      };

      const folder = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id'
      });

      console.log(`📁 Created backup folder: ${folderName}`);
      return folder.data.id;
    }
  }

  /**
   * Disconnect Google Drive for a school
   */
  static async disconnect(schoolId) {
    await query(
      `UPDATE school_settings
       SET google_drive_refresh_token = NULL,
           google_drive_access_token = NULL,
           google_drive_connected = FALSE,
           updated_at = CURRENT_TIMESTAMP
       WHERE school_id = $1`,
      [schoolId]
    );

    console.log(`🔌 Google Drive disconnected for school ${schoolId}`);
    return { success: true };
  }

  /**
   * Check if Google Drive is connected for school
   */
  static async isConnected(schoolId) {
    const result = await query(
      `SELECT google_drive_connected FROM school_settings WHERE school_id = $1`,
      [schoolId]
    );

    return result.rows.length > 0 && result.rows[0].google_drive_connected === true;
  }

  /**
   * List backups in Google Drive
   */
  static async listBackups(schoolId) {
    const result = await query(
      `SELECT google_drive_refresh_token, google_drive_access_token
       FROM school_settings
       WHERE school_id = $1`,
      [schoolId]
    );

    if (result.rows.length === 0 || !result.rows[0].google_drive_refresh_token) {
      throw new Error('Google Drive not connected');
    }

    const { google_drive_refresh_token, google_drive_access_token } = result.rows[0];

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: google_drive_refresh_token,
      access_token: google_drive_access_token
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Get backup folder
    const folderId = await this.getOrCreateBackupFolder(drive);

    // List files in backup folder
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, size, createdTime, webViewLink)',
      orderBy: 'createdTime desc'
    });

    return response.data.files;
  }
}

module.exports = GoogleDriveBackupService;
