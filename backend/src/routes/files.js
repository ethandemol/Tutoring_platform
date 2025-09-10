import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth.js';
import { upload, handleUploadError } from '../middleware/upload.js';
import { uploadToS3, deleteFromS3, getFileFromS3, s3Client } from '../config/s3.js';
import File from '../models/File.js';
import Workspace from '../models/Workspace.js';
import chunkingService from '../services/chunkingServices.js';
import fileDeletionService from '../services/fileDeletionService.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const router = express.Router();

// Direct upload - creates default workspace if needed
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Find or create a default workspace for the user
    let workspace = await Workspace.findOne({
      where: {
        userId: req.user.id,
        name: 'Default Workspace',
        isActive: true
      }
    });

    if (!workspace) {
      // Create a default workspace
      workspace = await Workspace.create({
        name: 'Default Workspace',
        description: 'Default workspace for uploaded files',
        userId: req.user.id,
        isActive: true
      });
    }

    // Upload file to S3
    const s3Result = await uploadToS3(req.file, workspace.id);

    // Save file record to database
    const fileRecord = await File.create({
      originalName: req.file.originalname,
      fileName: s3Result.fileName,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      s3Key: s3Result.s3Key,
      s3Bucket: s3Result.s3Bucket,
      s3Url: s3Result.s3Url,
      workspaceId: workspace.id,
      userId: req.user.id,
      processingStatus: 'pending'
    });

    // Start automatic chunking in the background (non-blocking)
    // Use setImmediate to ensure it runs after the response is sent
    setImmediate(async () => {
      try {
        console.log(`🔄 Starting automatic chunking for file ${fileRecord.id}`);
        await chunkingService.processFile(fileRecord.id, req.user.id, workspace.id);
        console.log(`✅ Automatic chunking completed for file ${fileRecord.id}`);
      } catch (error) {
        console.error(`❌ Automatic chunking failed for file ${fileRecord.id}:`, error);
        // Update file status to failed
        await File.update({
          processingStatus: 'failed',
          metadata: {
            error: error.message,
            failedAt: new Date().toISOString(),
            retryAttempt: 1,
            uploadMethod: 'direct'
          }
        }, { where: { id: fileRecord.id } });
      }
    });

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully. Chunking will start automatically.',
      data: {
        id: fileRecord.id,
        originalName: fileRecord.originalName,
        fileName: fileRecord.fileName,
        fileSize: fileRecord.fileSize,
        s3Url: fileRecord.s3Url,
        workspaceId: fileRecord.workspaceId,
        workspaceName: workspace.name,
        processingStatus: fileRecord.processingStatus,
        createdAt: fileRecord.createdAt
      }
    });

  } catch (error) {
    console.error('Direct file upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload file'
    });
  }
}, handleUploadError);

// Upload a PDF file to a workspace
router.post('/upload/:workspaceId', authenticate, upload.single('file'), async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    
    console.log('Upload request received:', {
      workspaceId,
      hasFile: !!req.file,
      fileSize: req.file?.size,
      fileName: req.file?.originalname
    });
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Verify workspace exists and belongs to user
    const workspace = await Workspace.findOne({
      where: {
        id: workspaceId,
        userId: req.user.id,
        isActive: true
      }
    });

    if (!workspace) {
      console.log('Workspace not found:', { workspaceId, userId: req.user.id });
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    console.log('Workspace found:', workspace.name);

    // Upload file to S3
    console.log('Starting S3 upload...');
    const s3Result = await uploadToS3(req.file, workspaceId);
    console.log('S3 upload successful:', s3Result);

    // Get category from request body
    const category = req.body.category || 'Others';
    
    // Save file record to database
    console.log('Saving file record to database...');
    const fileRecord = await File.create({
      originalName: req.file.originalname,
      fileName: s3Result.fileName,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      s3Key: s3Result.s3Key,
      s3Bucket: s3Result.s3Bucket,
      s3Url: s3Result.s3Url,
      workspaceId: parseInt(workspaceId),
      userId: req.user.id,
      category: category,
      processingStatus: 'pending'
    });

    console.log('File record created:', fileRecord.id);

    // Start automatic chunking in the background (non-blocking)
    setImmediate(async () => {
      try {
        console.log(`🔄 Starting automatic chunking for file ${fileRecord.id}`);
        await chunkingService.processFile(fileRecord.id, req.user.id, parseInt(workspaceId));
        console.log(`✅ Automatic chunking completed for file ${fileRecord.id}`);
      } catch (error) {
        console.error(`❌ Automatic chunking failed for file ${fileRecord.id}:`, error);
        // Update file status to failed
        await File.update({
          processingStatus: 'failed',
          metadata: {
            error: error.message,
            failedAt: new Date().toISOString(),
            uploadMethod: 'workspace'
          }
        }, { where: { id: fileRecord.id } });
      }
    });

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully. Chunking will start automatically.',
      data: {
        id: fileRecord.id,
        originalName: fileRecord.originalName,
        fileName: fileRecord.fileName,
        fileSize: fileRecord.fileSize,
        s3Url: fileRecord.s3Url,
        workspaceId: fileRecord.workspaceId,
        processingStatus: fileRecord.processingStatus,
        createdAt: fileRecord.createdAt
      }
    });

  } catch (error) {
    console.error('File upload error:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload file'
    });
  }
}, handleUploadError);

// Get all files in a workspace with optional category filtering
router.get('/workspace/:workspaceId', authenticate, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const { category } = req.query;

    // Verify workspace exists and belongs to user
    const workspace = await Workspace.findOne({
      where: {
        id: workspaceId,
        userId: req.user.id,
        isActive: true
      }
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    // Build where clause
    const whereClause = {
      workspaceId: workspaceId,
      isActive: true
    };
    if (category && category !== 'All') {
      whereClause.category = category;
    }

    const files = await File.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: files
    });

  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch files'
    });
  }
});

// Get website screenshot
router.get('/:id/screenshot', async (req, res) => {
  try {
    console.log('Screenshot request received for file ID:', req.params.id);
    
    // Get token from query parameter for iframe compatibility
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      console.log('No token provided');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token verified for user ID:', decoded.userId || decoded.id);
    } catch (error) {
      console.log('Token verification failed:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    const file = await File.findOne({
      where: {
        id: req.params.id,
        userId: decoded.userId || decoded.id, // Support both userId and id
        isActive: true
      }
    });

    if (!file) {
      console.log('File not found for ID:', req.params.id, 'and user ID:', decoded.userId || decoded.id);
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Only generate screenshots for website files
    if (file.metadata?.type !== 'website') {
      return res.status(400).json({
        success: false,
        message: 'Screenshot generation only supported for website files'
      });
    }

    console.log('Generating preview for website file:', file.originalName);

    // Get the text file from S3 (same pattern as PDF preview)
    const fileBuffer = await getFileFromS3(file.s3Key);
    console.log('Website file retrieved from S3, size:', fileBuffer.length);
    
    if (!fileBuffer || fileBuffer.length === 0) {
      console.log('File buffer is empty or null');
      return res.status(404).json({
        success: false,
        message: 'File content not found'
      });
    }

    // Convert text content to an image preview
    try {
      const textContent = fileBuffer.toString('utf8');
      
      // Create an SVG that looks like a document preview
      const svgContent = `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f8fafc;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        
        <!-- Document header -->
        <rect x="40" y="40" width="1120" height="80" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
        <text x="60" y="70" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#1e293b">${file.metadata?.title || file.originalName}</text>
        <text x="60" y="95" font-family="Arial, sans-serif" font-size="14" fill="#64748b">${file.metadata?.originalUrl || ''}</text>
        
        <!-- Content area -->
        <rect x="40" y="140" width="1120" height="620" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
        
        <!-- Text content (truncated and formatted) -->
        ${(() => {
          const lines = textContent.split('\n').slice(0, 25); // Show first 25 lines
          let yOffset = 170;
          let content = '';
          
          lines.forEach((line, index) => {
            if (line.trim() && yOffset < 720) {
              const displayLine = line.length > 80 ? line.substring(0, 80) + '...' : line;
              content += `<text x="60" y="${yOffset}" font-family="Arial, sans-serif" font-size="12" fill="#374151">${displayLine}</text>`;
              yOffset += 20;
            }
          });
          
          if (textContent.split('\n').length > 25) {
            content += `<text x="60" y="${yOffset + 10}" font-family="Arial, sans-serif" font-size="12" fill="#6b7280" font-style="italic">... (content truncated)</text>`;
          }
          
          return content;
        })()}
        
        <!-- Globe icon overlay -->
        <circle cx="1100" cy="80" r="20" fill="#3b82f6" opacity="0.1"/>
        <circle cx="1100" cy="80" r="15" fill="#3b82f6" opacity="0.2"/>
        <circle cx="1100" cy="80" r="10" fill="#3b82f6" opacity="0.3"/>
      </svg>`;
      
      const svgBuffer = Buffer.from(svgContent, 'utf-8');
      
      // Set appropriate headers for image preview (same pattern as PDF preview)
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', `inline; filename="preview.svg"`);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // Allow iframe embedding
      
      // Add CORS headers for cross-origin requests (same as PDF preview)
      res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      // Send the SVG buffer (same pattern as PDF preview)
      res.send(svgBuffer);
    } catch (previewError) {
      console.error('Preview generation failed:', previewError);
      
      // Return a fallback image buffer
      const fallbackSvg = `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f8fafc"/>
        <text x="50%" y="40%" font-family="Arial, sans-serif" font-size="24" fill="#64748b" text-anchor="middle">Website Content Preview</text>
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle">Preview generation failed</text>
        <text x="50%" y="60%" font-family="Arial, sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">${file.originalName}</text>
      </svg>`;
      
      const svgBuffer = Buffer.from(fallbackSvg, 'utf-8');
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', `inline; filename="fallback.svg"`);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      res.send(svgBuffer);
    }
    
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate preview'
    });
  }
});

// Test route to check if files exist (for debugging)
router.get('/test/:id', async (req, res) => {
  try {
    console.log('Test request received for file ID:', req.params.id);
    
    const file = await File.findOne({
      where: {
        id: req.params.id,
        isActive: true
      }
    });

    if (!file) {
      console.log('File not found for ID:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    console.log('File found:', file.originalName, 'S3 Key:', file.s3Key);
    
    res.json({
      success: true,
      data: {
        id: file.id,
        originalName: file.originalName,
        s3Key: file.s3Key,
        userId: file.userId,
        workspaceId: file.workspaceId
      }
    });

  } catch (error) {
    console.error('Test file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get file info',
      error: error.message
    });
  }
});

// Handle OPTIONS requests for CORS preflight
router.options('/:id/preview', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
  res.status(200).end();
});

// Get file for preview (stream from S3)
router.get('/:id/preview', async (req, res) => {
  try {
    console.log('Preview request received for file ID:', req.params.id);
    
    // Get token from query parameter for iframe compatibility
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      console.log('No token provided');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token verified for user ID:', decoded.userId || decoded.id);
    } catch (error) {
      console.log('Token verification failed:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    const file = await File.findOne({
      where: {
        id: req.params.id,
        userId: decoded.userId || decoded.id, // Support both userId and id
        isActive: true
      }
    });

    if (!file) {
      console.log('File not found for ID:', req.params.id, 'and user ID:', decoded.userId || decoded.id);
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    console.log('File found:', file.originalName, 'S3 Key:', file.s3Key);

    // Get file from S3
    console.log('Attempting to retrieve file from S3...');
    const fileBuffer = await getFileFromS3(file.s3Key);
    console.log('File retrieved from S3, size:', fileBuffer.length);
    
    if (!fileBuffer || fileBuffer.length === 0) {
      console.log('File buffer is empty or null');
      return res.status(404).json({
        success: false,
        message: 'File content not found'
      });
    }
    
    // Set appropriate headers based on file type
    if (file.metadata?.type === 'website') {
      // For website files, return as text/plain
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `inline; filename="${file.originalName}.txt"`);
    } else {
      // For PDFs and other files, return as PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    }
    
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // Allow iframe embedding
    
    // Add CORS headers for cross-origin requests
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    
    // Handle range requests for PDF.js
    const range = req.headers.range;
    if (range) {
      console.log(`📊 [RANGE] Range request: ${range}`);
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileBuffer.length - 1;
      const chunksize = (end - start) + 1;
      
      console.log(`📊 [RANGE] Serving bytes ${start}-${end} (${chunksize} bytes) of ${fileBuffer.length} total`);
      
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileBuffer.length}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunksize);
      res.end(fileBuffer.slice(start, end + 1));
    } else {
      console.log(`📊 [RANGE] Full file request, sending ${fileBuffer.length} bytes`);
      // Send the file buffer
      res.send(fileBuffer);
    }

  } catch (error) {
    // Log the error safely without circular references
    console.error('Preview file error:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      fileId: req.params.id,
      userId: decoded?.userId || decoded?.id,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasS3Config: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to load file for preview',
      error: error.message || 'Unknown error'
    });
  }
});

// Download a file (get presigned URL)
router.get('/:id/download', authenticate, async (req, res) => {
  try {
    const file = await File.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
        isActive: true
      }
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Generate presigned URL for download
    const command = new GetObjectCommand({
      Bucket: file.s3Bucket,
      Key: file.s3Key
    });
    
    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600 // URL expires in 1 hour
    });

    res.json({
      success: true,
      data: {
        downloadUrl: presignedUrl,
        fileName: file.originalName,
        fileSize: file.fileSize
      }
    });

  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate download URL'
    });
  }
});

// Get a specific file
router.get('/:id', authenticate, async (req, res) => {
  try {
    const file = await File.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
        isActive: true
      }
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    res.json({
      success: true,
      data: file
    });

  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch file'
    });
  }
});

// Rename a file
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { originalName } = req.body;
    const fileId = parseInt(req.params.id);

    // Validate input
    if (!originalName || originalName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'File name is required'
      });
    }

    const file = await File.findOne({
      where: {
        id: fileId,
        userId: req.user.id,
        isActive: true
      }
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check if the new name is different from the current name
    if (originalName.trim() === file.originalName) {
      return res.status(400).json({
        success: false,
        message: 'New file name is the same as the current name'
      });
    }

    // Update the file name
    await file.update({
      originalName: originalName.trim(),
      metadata: {
        ...file.metadata,
        renamedAt: new Date().toISOString(),
        previousName: file.originalName
      }
    });

    res.json({
      success: true,
      message: 'File renamed successfully',
      data: {
        id: file.id,
        originalName: file.originalName,
        fileName: file.fileName,
        fileSize: file.fileSize,
        s3Url: file.s3Url,
        workspaceId: file.workspaceId,
        processingStatus: file.processingStatus,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt
      }
    });

  } catch (error) {
    console.error('Rename file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to rename file',
      error: error.message
    });
  }
});

// Update file properties (for drag and drop)
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const fileId = parseInt(req.params.id);
    const { folderId, originalName } = req.body;
    const userId = req.user.id;

    const file = await File.findOne({
      where: { id: fileId, userId, isActive: true }
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Update allowed properties
    const updateData = {};
    if (folderId !== undefined) updateData.folderId = folderId;
    if (originalName) updateData.originalName = originalName;

    await file.update(updateData);

    res.json({
      success: true,
      message: 'File updated successfully',
      data: file
    });

  } catch (error) {
    console.error('Update file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update file'
    });
  }
});

// Update file category
router.put('/:id/category', authenticate, async (req, res) => {
  try {
    const { category } = req.body;
    const fileId = req.params.id;

    if (!category || typeof category !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Category is required and must be a string'
      });
    }

    const file = await File.findOne({
      where: {
        id: fileId,
        userId: req.user.id,
        isActive: true
      }
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    await file.update({ category });

    res.json({
      success: true,
      message: 'File category updated successfully',
      data: file
    });
  } catch (error) {
    console.error('Update file category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update file category'
    });
  }
});

// Delete a file (comprehensive deletion)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const fileId = parseInt(req.params.id);
    const userId = req.user.id;
    const result = await fileDeletionService.deleteFile(fileId, userId);
    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: error.message
    });
  }
});

// Update file processing status (for future RAG processing)
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { processingStatus, metadata } = req.body;
    
    const file = await File.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
        isActive: true
      }
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const updateData = {};
    if (processingStatus) updateData.processingStatus = processingStatus;
    if (metadata) updateData.metadata = { ...file.metadata, ...metadata };
    if (processingStatus === 'completed') updateData.isProcessed = true;

    await file.update(updateData);

    res.json({
      success: true,
      message: 'File status updated successfully',
      data: file
    });

  } catch (error) {
    console.error('Update file status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update file status'
    });
  }
});

// Manual file processing endpoint (for debugging)
router.post('/:id/process', authenticate, async (req, res) => {
  try {
    const fileId = parseInt(req.params.id);
    console.log(`🔧 [DEBUG] Manual processing requested for file ${fileId}`);
    
    // Get file info
    const file = await File.findOne({
      where: { id: fileId, userId: req.user.id, isActive: true }
    });

    if (!file) {
      console.log(`❌ [DEBUG] File ${fileId} not found for user ${req.user.id}`);
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    console.log(`✅ [DEBUG] Found file "${file.originalName}" with status: ${file.processingStatus}`);

    // Check if file is already processed
    if (file.processingStatus === 'completed') {
      console.log(`✅ [DEBUG] File ${fileId} is already processed`);
      return res.json({
        success: true,
        message: 'File is already processed',
        data: {
          id: file.id,
          originalName: file.originalName,
          processingStatus: file.processingStatus,
          metadata: file.metadata
        }
      });
    }

    // Start processing
    console.log(`🚀 [DEBUG] Starting manual processing for file ${fileId}`);
    
    try {
      const result = await chunkingService.processFile(fileId, req.user.id, file.workspaceId);
      console.log(`✅ [DEBUG] Manual processing completed for file ${fileId}:`, result);
      
      res.json({
        success: true,
        message: 'File processing completed successfully',
        data: result
      });
    } catch (error) {
      console.error(`❌ [DEBUG] Manual processing failed for file ${fileId}:`, error);
      
      // Update file status to failed
      await File.update({
        processingStatus: 'failed',
        metadata: {
          error: error.message,
          failedAt: new Date().toISOString()
        }
      }, { where: { id: fileId } });
      
      res.status(500).json({
        success: false,
        message: 'File processing failed',
        error: error.message
      });
    }

  } catch (error) {
    console.error('Manual processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process file',
      error: error.message
    });
  }
});

export default router; 