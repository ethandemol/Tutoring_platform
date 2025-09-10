import { File } from '../models/index.js';
import chunkingService from './chunkingServices.js';
import { cleanupInactiveSessions } from './chatCleanupService.js';
import { Op } from 'sequelize';

class FileProcessingScheduler {
  constructor() {
    this.isRunning = false;
    this.interval = null;
  }

  /**
   * Start the scheduler to process pending files every 5 minutes
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ File processing scheduler is already running');
      return;
    }

    console.log('🚀 Starting file processing scheduler...');
    this.isRunning = true;

    // Process immediately
    this.processPendingFiles();

    // Then schedule to run every 2 minutes for faster processing
    this.interval = setInterval(() => {
      this.processPendingFiles();
    }, 2 * 60 * 1000); // 2 minutes

    console.log('✅ File processing scheduler started (runs every 2 minutes)');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ File processing scheduler is not running');
      return;
    }

    console.log('🛑 Stopping file processing scheduler...');
    this.isRunning = false;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    console.log('✅ File processing scheduler stopped');
  }

  /**
   * Process all pending files
   */
  async processPendingFiles() {
    try {
      console.log('🔄 Checking for pending files...');
      
      // First, check for files stuck in 'processing' status for too long (more than 5 minutes)
      const stuckFiles = await File.findAll({
        where: {
          processingStatus: 'processing',
          updatedAt: {
            [Op.lt]: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
          }
        },
        attributes: ['id', 'originalName', 'userId', 'workspaceId', 'createdAt', 'updatedAt']
      });
      
      if (stuckFiles.length > 0) {
        console.log(`⚠️ Found ${stuckFiles.length} files stuck in processing status, resetting to pending...`);
        
        for (const file of stuckFiles) {
          console.log(`🔄 Resetting file ${file.id} (${file.originalName}) from processing to pending`);
          await File.update({
            processingStatus: 'pending',
            metadata: {
              ...file.metadata,
              resetFromProcessing: new Date().toISOString(),
              previousProcessingAttempt: file.updatedAt
            }
          }, { where: { id: file.id } });
        }
      }
      
      // Find all pending files (including the ones we just reset)
      const pendingFiles = await File.findAll({
        where: { processingStatus: 'pending' },
        attributes: ['id', 'originalName', 'userId', 'workspaceId', 'createdAt'],
        limit: 10 // Process max 10 files at a time to avoid overwhelming the system
      });
      
      if (pendingFiles.length === 0) {
        console.log('✅ No pending files found');
        return;
      }
      
      console.log(`📋 Found ${pendingFiles.length} pending files to process`);
      
      let successCount = 0;
      let failureCount = 0;
      
      for (const file of pendingFiles) {
        try {
          console.log(`🚀 Processing file ${file.id}: ${file.originalName}`);
          
          const result = await chunkingService.processFile(file.id, file.userId, file.workspaceId);
          
          console.log(`✅ Successfully processed file ${file.id} (${result.chunksCreated} chunks)`);
          successCount++;
          
        } catch (error) {
          console.error(`❌ Failed to process file ${file.id}: ${error.message}`);
          
          // Update file status to failed
          await File.update({
            processingStatus: 'failed',
            metadata: {
              error: error.message,
              failedAt: new Date().toISOString(),
              retryAttempt: 1
            }
          }, { where: { id: file.id } });
          
          failureCount++;
        }
      }
      
      console.log(`📊 Processing complete: ${successCount} successful, ${failureCount} failed`);
      
      // Also clean up inactive sessions
      try {
        const deletedInactiveCount = await cleanupInactiveSessions();
        if (deletedInactiveCount > 0) {
          console.log(`🧹 Cleaned up ${deletedInactiveCount} inactive sessions`);
        }
      } catch (error) {
        console.error('❌ Error during inactive session cleanup:', error);
      }
      
    } catch (error) {
      console.error('❌ Error in file processing scheduler:', error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasInterval: !!this.interval
    };
  }
}

export default new FileProcessingScheduler(); 