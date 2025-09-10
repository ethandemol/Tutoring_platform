import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

// Configure multer for memory storage (for S3 upload)
const storage = multer.memoryStorage();

// File filter to only allow PDFs
const fileFilter = (req, file, cb) => {
  // Check file type
  if (file.mimetype !== 'application/pdf') {
    return cb(new Error('Only PDF files are allowed'), false);
  }
  
  // Check file size (max 50MB)
  if (file.size > 50 * 1024 * 1024) {
    return cb(new Error('File size too large. Maximum size is 50MB'), false);
  }
  
  cb(null, true);
};

// File filter for handwriting (images and PDFs allowed)
const handwritingFileFilter = (req, file, cb) => {
  // Allow images and PDFs
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff', 'image/webp', 'application/pdf'
  ];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error('Only image or PDF files are allowed for handwriting conversion'), false);
  }
  // Set size limits: 10MB for images, 20MB for PDFs
  if ((file.mimetype === 'application/pdf' && file.size > 20 * 1024 * 1024) ||
      (file.mimetype !== 'application/pdf' && file.size > 10 * 1024 * 1024)) {
    return cb(new Error('File size too large. Maximum size is 10MB for images and 20MB for PDFs'), false);
  }
  cb(null, true);
};

// Configure multer for PDFs
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1 // Only one file at a time
  }
});

// Configure multer for handwriting (images)
const handwritingUpload = multer({
  storage: storage,
  fileFilter: handwritingFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10 // Allow up to 10 files at a time
  }
});

// Error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 50MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Only one file allowed at a time'
      });
    }
    return res.status(400).json({
      success: false,
      message: 'File upload error'
    });
  }
  
  if (error.message.includes('Only PDF files are allowed')) {
    return res.status(400).json({
      success: false,
      message: 'Only PDF files are allowed'
    });
  }
  
  if (error.message.includes('Only image files are allowed for handwriting conversion')) {
    return res.status(400).json({
      success: false,
      message: 'Only image files are allowed for handwriting conversion'
    });
  }
  
  if (error.message.includes('File size too large')) {
    return res.status(400).json({
      success: false,
      message: 'File size too large. Maximum size is 10MB'
    });
  }
  
  console.error('Upload error:', error);
  return res.status(500).json({
    success: false,
    message: 'File upload failed'
  });
};

export { upload, handwritingUpload, handleUploadError }; 