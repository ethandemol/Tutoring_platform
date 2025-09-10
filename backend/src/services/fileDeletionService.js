import { File, Chunk, ChatSession, ChatMessage } from '../models/index.js';
import { deleteFromS3 } from '../config/s3.js';

class FileDeletionService {
  constructor() {
    // Service initialization
  }

  /**
   * Delete a file completely from all storage systems
   * @param {number} fileId - File ID to delete
   * @param {number} userId - User ID for authorization
   * @returns {Promise<Object>} Deletion result
   */
  async deleteFile(fileId, userId) {
    try {
      console.log('️ [DELETE] Starting comprehensive file deletion...');
      console.log(`📋 [DELETE] File ID: ${fileId}, User ID: ${userId}`);

      // Step 1: Get file information
      console.log('📁 [DELETE] Step 1: Retrieving file information...');
      const file = await File.findOne({
        where: { id: fileId, userId, isActive: true }
      });

      if (!file) {
        console.log(`❌ [DELETE] Step 1 FAILED: File ${fileId} not found for user ${userId}`);
        return {
          success: false,
          message: 'File not found or access denied'
        };
      }
      console.log(`✅ [DELETE] Step 1 COMPLETED: Found file "${file.originalName}"`);

      // Step 2: Delete chunks and embeddings from database
      console.log('📄 [DELETE] Step 2: Deleting chunks and embeddings...');
      const chunksDeleted = await this.deleteChunksForFile(fileId, userId);
      console.log(`✅ [DELETE] Step 2 COMPLETED: Deleted ${chunksDeleted} chunks`);

      // Step 3: Delete related chat sessions
      console.log('💬 [DELETE] Step 3: Deleting related chat sessions...');
      const relatedDataDeleted = await this.deleteRelatedData(fileId, userId);
      console.log(`✅ [DELETE] Step 3 COMPLETED: Deleted ${relatedDataDeleted.chatMessages} chat messages, ${relatedDataDeleted.chatSessions} chat sessions`);

      // Step 4: Delete file from S3
      console.log(`☁️ [DELETE] Step 4: Deleting file from S3: ${file.s3Key}`);
      await this.deleteFileFromS3(file.s3Key);
      console.log('✅ [DELETE] Step 4 COMPLETED: File deleted from S3');

      // Step 5: Hard delete file record from database
      console.log('💾 [DELETE] Step 5: Hard deleting file record...');
      await this.hardDeleteFileRecord(fileId, userId);
      console.log('✅ [DELETE] Step 5 COMPLETED: File record hard deleted');

      console.log(' [DELETE] ALL STEPS COMPLETED SUCCESSFULLY!');

      return {
        success: true,
        message: `File "${file.originalName}" deleted successfully`,
        data: {
          fileId,
          fileName: file.originalName,
          chunksDeleted,
          s3Key: file.s3Key,
          fileSize: file.fileSize
        }
      };

    } catch (error) {
      console.error(`❌ [DELETE] File deletion failed for file ${fileId}:`, error);
      return {
        success: false,
        message: 'Failed to delete file. Please try again.',
        error: error.message
      };
    }
  }

  /**
   * Delete chunks and embeddings for a specific file
   * @param {number} fileId - File ID
   * @param {number} userId - User ID
   * @returns {Promise<number>} Number of chunks deleted
   */
  async deleteChunksForFile(fileId, userId) {
    try {
      console.log(`📄 [DELETE-CHUNKS] Deleting chunks for file ${fileId}...`);
      
      // Get count of chunks before deletion
      const chunkCount = await Chunk.count({
        where: { fileId, userId, isActive: true }
      });
      console.log(`📊 [DELETE-CHUNKS] Found ${chunkCount} chunks to delete`);

      // Hard delete all chunks for this file
      const result = await Chunk.destroy({
        where: { fileId, userId, isActive: true },
        force: true
      });

      console.log(`✅ [DELETE-CHUNKS] Successfully deleted ${chunkCount} chunks for file ${fileId}`);
      return chunkCount;

    } catch (error) {
      console.error(`❌ [DELETE-CHUNKS] Failed to delete chunks for file ${fileId}:`, error);
      throw new Error(`Failed to delete chunks: ${error.message}`);
    }
  }

  /**
   * Delete related data (chat sessions) for a specific file
   * @param {number} fileId - File ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Number of records deleted
   */
  async deleteRelatedData(fileId, userId) {
    try {
      console.log(`💬 [DELETE-RELATED] Deleting related data for file ${fileId}...`);
      
      // First, get all chat sessions related to this file (including inactive ones)
      const chatSessions = await ChatSession.findAll({
        where: { fileId, userId },
        attributes: ['id']
      });
      
      console.log(`💬 [DELETE-RELATED] Found ${chatSessions.length} chat sessions to delete for file ${fileId}`);
      
      // Delete chat messages for all related chat sessions
      let chatMessagesDeleted = 0;
      for (const session of chatSessions) {
        const messagesDeleted = await ChatMessage.destroy({
          where: { sessionId: session.id },
          force: true
        });
        chatMessagesDeleted += messagesDeleted;
      }
      console.log(`💬 [DELETE-RELATED] Deleted ${chatMessagesDeleted} chat messages for file ${fileId}`);
      
      // Now delete the chat sessions (including inactive ones)
      const chatSessionsDeleted = await ChatSession.destroy({
        where: { fileId, userId },
        force: true
      });
      console.log(`💬 [DELETE-RELATED] Deleted ${chatSessionsDeleted} chat sessions for file ${fileId}`);

      return {
        chatSessions: chatSessionsDeleted,
        chatMessages: chatMessagesDeleted
      };

    } catch (error) {
      console.error(`❌ [DELETE-RELATED] Failed to delete related data for file ${fileId}:`, error);
      throw new Error(`Failed to delete related data: ${error.message}`);
    }
  }

  /**
   * Delete file from S3 storage
   * @param {string} s3Key - S3 key of the file
   * @returns {Promise<void>}
   */
  async deleteFileFromS3(s3Key) {
    try {
      console.log(`☁️ [DELETE-S3] Deleting file from S3: ${s3Key}`);
      await deleteFromS3(s3Key);
      console.log(`✅ [DELETE-S3] Successfully deleted file from S3: ${s3Key}`);
    } catch (error) {
      console.error(`❌ [DELETE-S3] Failed to delete file from S3: ${s3Key}`, error);
      // Don't throw error here - we want to continue with database cleanup even if S3 fails
      console.warn(`⚠️ [DELETE-S3] Continuing with database cleanup despite S3 deletion failure`);
    }
  }

  /**
   * Hard delete file record from database
   * @param {number} fileId - File ID
   * @param {number} userId - User ID
   * @returns {Promise<void>}
   */
  async hardDeleteFileRecord(fileId, userId) {
    try {
      console.log(`💾 [DELETE-RECORD] Hard deleting file record ${fileId}...`);
      
      await File.destroy({
        where: { id: fileId, userId, isActive: true },
        force: true
      });

      console.log(`✅ [DELETE-RECORD] Successfully hard deleted file record ${fileId}`);
    } catch (error) {
      console.error(`❌ [DELETE-RECORD] Failed to hard delete file record ${fileId}:`, error);
      throw new Error(`Failed to delete file record: ${error.message}`);
    }
  }

  /**
   * Delete multiple files (batch deletion)
   * @param {Array<number>} fileIds - Array of file IDs to delete
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Batch deletion result
   */
  async deleteMultipleFiles(fileIds, userId) {
    try {
      console.log(`🗑️ [BATCH-DELETE] Starting batch deletion of ${fileIds.length} files...`);
      console.log(`📋 [BATCH-DELETE] File IDs: ${fileIds.join(', ')}, User ID: ${userId}`);

      const results = [];
      const errors = [];

      for (const fileId of fileIds) {
        try {
          const result = await this.deleteFile(fileId, userId);
          results.push({ fileId, ...result });
        } catch (error) {
          console.error(`❌ [BATCH-DELETE] Failed to delete file ${fileId}:`, error);
          errors.push({ fileId, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const errorCount = errors.length;

      console.log(`🎉 [BATCH-DELETE] Batch deletion completed: ${successCount} successful, ${errorCount} failed`);

      return {
        success: errorCount === 0,
        message: `Batch deletion completed: ${successCount} successful, ${errorCount} failed`,
        data: {
          totalFiles: fileIds.length,
          successful: successCount,
          failed: errorCount,
          results,
          errors
        }
      };

    } catch (error) {
      console.error(`❌ [BATCH-DELETE] Batch deletion failed:`, error);
      return {
        success: false,
        message: 'Batch deletion failed',
        error: error.message
      };
    }
  }

  /**
   * Get deletion statistics for a user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Deletion statistics
   */
  async getDeletionStats(userId) {
    try {
      const totalFiles = await File.count({
        where: { userId, isActive: true }
      });

      const deletedFiles = await File.count({
        where: { userId, isActive: false }
      });

      const totalChunks = await Chunk.count({
        where: { userId, isActive: true }
      });

      const deletedChunks = await Chunk.count({
        where: { userId, isActive: false }
      });

      return {
        success: true,
        data: {
          activeFiles: totalFiles,
          deletedFiles,
          activeChunks: totalChunks,
          deletedChunks,
          totalFiles: totalFiles + deletedFiles,
          totalChunks: totalChunks + deletedChunks
        }
      };
    } catch (error) {
      console.error('Failed to get deletion stats:', error);
      return {
        success: false,
        message: 'Failed to get deletion statistics',
        error: error.message
      };
    }
  }
}

export default new FileDeletionService(); 