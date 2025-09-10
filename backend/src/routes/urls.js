import express from 'express';
import { authenticate } from '../middleware/auth.js';
import urlProcessingService from '../services/urlProcessingService.js';
import chunkingService from '../services/chunkingServices.js';
import embeddingService from '../services/embeddingService.js';
import File from '../models/File.js';
import Chunk from '../models/Chunk.js';
import Workspace from '../models/Workspace.js';
import { uploadToS3 } from '../config/s3.js';

const router = express.Router();

// Process URL and create a document with RAG integration
router.post('/process/:workspaceId', authenticate, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL is required'
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid URL format'
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
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    // Process the URL
    const urlContent = await urlProcessingService.processUrl(url);
    
    // Generate summary using OpenAI
    const summary = await urlProcessingService.generateSummary(urlContent, urlContent.type);
    
    let fileRecord;
    let contentForChunking = '';
    
    if (urlContent.type === 'youtube') {
      // For YouTube videos, create a video file with metadata
      const fileName = `${Date.now()}_${urlContent.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;
      
      // Use transcript content if available, otherwise fall back to basic content
      if (urlContent.hasTranscript && urlContent.transcriptContent) {
        contentForChunking = urlContent.transcriptContent;
        console.log(`✅ [URL-PROCESS] Using transcript content for RAG processing (${contentForChunking.length} characters)`);
      } else {
        contentForChunking = `Title: ${urlContent.title}\n\nDescription: ${urlContent.description}\n\nChannel: ${urlContent.channel}\n\nSummary: ${summary}\n\nOriginal URL: ${url}`;
        console.log(`⚠️ [URL-PROCESS] Using basic content for RAG processing (transcript not available)`);
      }
      
      // Create a minimal video file (placeholder)
      const videoContent = `YouTube Video: ${urlContent.title}\n\nThis is a placeholder for the YouTube video. The actual video can be played from the original URL.\n\n${contentForChunking}`;
      const buffer = Buffer.from(videoContent, 'utf8');
      
      const mockFile = {
        originalname: fileName,
        buffer: buffer,
        size: buffer.length,
        mimetype: 'video/mp4'
      };
      
      const s3Result = await uploadToS3(mockFile, workspaceId);
      
      fileRecord = await File.create({
        originalName: urlContent.title,
        fileName: s3Result.fileName,
        fileSize: buffer.length,
        mimeType: 'video/mp4',
        s3Key: s3Result.s3Key,
        s3Bucket: s3Result.s3Bucket,
        s3Url: s3Result.s3Url,
        workspaceId: parseInt(workspaceId),
        userId: req.user.id,
        processingStatus: 'pending', // Will be updated after chunking
        metadata: {
          type: 'youtube',
          originalUrl: url,
          videoId: urlContent.videoId,
          title: urlContent.title,
          description: urlContent.description,
          channel: urlContent.channel,
          thumbnail: urlContent.thumbnail,
          summary: summary,
          transcriptSummary: urlContent.transcriptSummary,
          hasTranscript: urlContent.hasTranscript,
          transcriptError: urlContent.transcriptError,
          embedUrl: `https://www.youtube.com/embed/${urlContent.videoId}`,
          originalTranscript: urlContent.transcript, // Store original transcript data
          processedTranscript: urlContent.processedTranscript // Store processed transcript data
        }
      });
    } else if (urlContent.type === 'website') {
      // For websites, create a text file with the content
      const fileName = `${Date.now()}_${urlContent.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
      
      // Create content for chunking and RAG
      contentForChunking = `Title: ${urlContent.title}\n\nDescription: ${urlContent.description}\n\nSummary: ${summary}\n\nContent:\n${urlContent.content}\n\nOriginal URL: ${url}`;
      
      const buffer = Buffer.from(contentForChunking, 'utf8');
      
      const mockFile = {
        originalname: fileName,
        buffer: buffer,
        size: buffer.length,
        mimetype: 'text/plain'
      };
      
      const s3Result = await uploadToS3(mockFile, workspaceId);
      
      fileRecord = await File.create({
        originalName: urlContent.title,
        fileName: s3Result.fileName,
        fileSize: buffer.length,
        mimeType: 'text/plain',
        s3Key: s3Result.s3Key,
        s3Bucket: s3Result.s3Bucket,
        s3Url: s3Result.s3Url,
        workspaceId: parseInt(workspaceId),
        userId: req.user.id,
        processingStatus: 'pending', // Will be updated after chunking
        metadata: {
          type: 'website',
          originalUrl: url,
          title: urlContent.title,
          description: urlContent.description,
          summary: summary,
          content: urlContent.content
        }
      });
    }

    // Process content through RAG pipeline (chunking and embedding)
    try {
      console.log(`Starting RAG processing for URL file: ${fileRecord.id}`);
      
      // Update status to processing
      await fileRecord.update({ processingStatus: 'processing' });
      
      // Create chunks from the content (use YouTube-specific method if available)
      let chunks;
      if (urlContent.type === 'youtube' && urlContent.transcript) {
        chunks = await chunkingService.createChunksFromYouTubeTranscript(contentForChunking, fileRecord.id, urlContent.transcript);
        console.log(`Created ${chunks.length} chunks with timestamps for YouTube file: ${fileRecord.id}`);
      } else {
        chunks = await chunkingService.createChunksFromText(contentForChunking, fileRecord.id);
        console.log(`Created ${chunks.length} chunks for URL file: ${fileRecord.id}`);
      }
      
      // Generate embeddings for each chunk
      const embeddingPromises = chunks.map(async (chunk) => {
        const embedding = await embeddingService.generateEmbedding(chunk.content);
        return {
          ...chunk,
          embedding: embedding
        };
      });
      
      const chunksWithEmbeddings = await Promise.all(embeddingPromises);
      console.log(`Generated embeddings for ${chunksWithEmbeddings.length} chunks`);
      
      // Save chunks to database
      const chunkRecords = await Chunk.bulkCreate(chunksWithEmbeddings.map(chunk => ({
        content: chunk.content,
        fileId: fileRecord.id,
        workspaceId: parseInt(workspaceId),
        userId: req.user.id,
        chunkIndex: chunk.chunkIndex,
        tokenCount: chunk.tokenCount,
        startToken: chunk.startToken,
        endToken: chunk.endToken,
        embedding: JSON.stringify(chunk.embedding),
        isEmbedded: true,
        isActive: true,
        metadata: {
          type: urlContent.type,
          originalUrl: url,
          title: urlContent.title,
          ...(chunk.metadata || {}) // Include any additional metadata from the chunk
        }
      })));
      
      console.log(`Saved ${chunkRecords.length} chunks to database`);
      
      // Update file status to completed
      await fileRecord.update({ 
        processingStatus: 'completed',
        isProcessed: true
      });
      
      console.log(`URL file processing completed: ${fileRecord.id}`);
      
    } catch (ragError) {
      console.error('RAG processing error:', ragError);
      
      // Update file status to failed but don't return error response
      // This allows the file to be saved even if RAG processing fails
      await fileRecord.update({ 
        processingStatus: 'failed',
        metadata: {
          ...fileRecord.metadata,
          ragError: ragError.message,
          ragFailedAt: new Date().toISOString()
        }
      });
      
      console.log(`URL file saved but RAG processing failed: ${fileRecord.id}`);
      
      // Continue with success response - file is saved but RAG processing failed
      // This allows users to still see and use the file, even without AI analysis
    }

    res.json({
      success: true,
      message: 'URL processed successfully',
      data: {
        file: fileRecord,
        urlContent: {
          title: urlContent.title,
          type: urlContent.type,
          summary: summary
        }
      }
    });

  } catch (error) {
    console.error('URL processing error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process URL'
    });
  }
});

// Get URL processing status
router.get('/status/:fileId', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    
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

    res.json({
      success: true,
      data: {
        processingStatus: file.processingStatus,
        originalName: file.originalName,
        createdAt: file.createdAt,
        metadata: file.metadata
      }
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check status'
    });
  }
});

export default router; 