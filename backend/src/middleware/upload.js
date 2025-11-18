const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

/**
 * 🖼️ PHOTO UPLOAD MIDDLEWARE
 *
 * Features:
 * - 2MB file size limit
 * - Only JPG/JPEG/PNG allowed
 * - Auto-resize to 300x300px
 * - Organized by date folders
 * - Filename sanitization
 */

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads/students');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory:', uploadsDir);
}

/**
 * Multer storage configuration
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create date-based folder (YYYY-MM)
    const dateFolder = new Date().toISOString().slice(0, 7); // "2025-11"
    const fullPath = path.join(uploadsDir, dateFolder);

    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: studentId_timestamp_original.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `student_${uniqueSuffix}_${sanitizedOriginalName}`;
    cb(null, filename);
  }
});

/**
 * File filter - only allow images
 */
const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, JPEG, and PNG files are allowed.'), false);
  }
};

/**
 * Multer configuration
 */
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
    files: 1 // Only 1 file per request
  }
});

/**
 * 🖼️ MIDDLEWARE: Process uploaded photo
 * Auto-resize to 300x300px using Sharp
 */
const processPhoto = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    const originalPath = req.file.path;
    const processedFilename = `processed_${req.file.filename}`;
    const processedPath = path.join(path.dirname(originalPath), processedFilename);

    console.log('🖼️ Processing photo:', {
      original: originalPath,
      processed: processedPath
    });

    // Resize image to 300x300px
    await sharp(originalPath)
      .resize(300, 300, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 85 }) // Convert to JPEG with 85% quality
      .toFile(processedPath);

    console.log('✅ Photo processed successfully');

    // Delete original file
    fs.unlinkSync(originalPath);

    // Update req.file with processed file info
    req.file.path = processedPath;
    req.file.filename = processedFilename;
    req.file.size = fs.statSync(processedPath).size;

    // Generate relative URL for database storage
    const dateFolder = new Date().toISOString().slice(0, 7);
    req.file.url = `/uploads/students/${dateFolder}/${processedFilename}`;

    next();
  } catch (error) {
    console.error('❌ Error processing photo:', error);

    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to process photo. Please try again.'
    });
  }
};

/**
 * 🗑️ HELPER: Delete old photo file
 */
const deletePhoto = (photoUrl) => {
  if (!photoUrl || !photoUrl.startsWith('/uploads/')) {
    return;
  }

  try {
    const filePath = path.join(__dirname, '../..', photoUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('✅ Deleted old photo:', photoUrl);
    }
  } catch (error) {
    console.error('❌ Error deleting photo:', error.message);
  }
};

module.exports = {
  upload,
  processPhoto,
  deletePhoto,
  uploadStudentPhoto: upload.single('photo')
};
