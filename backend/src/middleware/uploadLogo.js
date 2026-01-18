const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

/**
 * 🖼️ SCHOOL LOGO UPLOAD MIDDLEWARE
 */

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads/school');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Multer storage configuration
 */
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: school_logo_timestamp.ext
        const uniqueSuffix = Date.now();
        const filename = `logo_${uniqueSuffix}${path.extname(file.originalname)}`;
        cb(null, filename);
    }
});

/**
 * File filter - only allow images
 */
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, JPEG, and PNG files are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB limit
        files: 1
    }
});

/**
 * 🖼️ PROCESS LOGO: Resize to 200x200px
 */
const processLogo = async (req, res, next) => {
    if (!req.file) {
        return next();
    }

    try {
        const originalPath = req.file.path;
        const processedFilename = `processed_${req.file.filename}`;
        const processedPath = path.join(uploadsDir, processedFilename);

        // Resize image to 200x200px (contain to keep aspect ratio)
        await sharp(originalPath)
            .resize(200, 200, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 0 }
            })
            .png({ quality: 90 })
            .toFile(processedPath);

        // Delete original file
        fs.unlinkSync(originalPath);

        // Update req.file
        req.file.path = processedPath;
        req.file.filename = processedFilename;
        req.file.url = `/uploads/school/${processedFilename}`;

        next();
    } catch (error) {
        console.error('❌ Error processing logo:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({ success: false, error: 'Failed to process logo' });
    }
};

module.exports = {
    uploadLogo: upload.single('logo'),
    processLogo
};
