import { Workspace, File, Chunk, ChatSession, ChatMessage } from '../models/index.js';
import { deleteFromS3 } from '../config/s3.js';

class WorkspaceDeletionService {
  constructor() {
    // Service initialization
  }

  /**
   * Permanently delete a workspace and all its data from all storage systems
   * @param {number} workspaceId - Workspace ID to delete
   * @param {number} userId - User ID for authorization
   * @returns {Promise<Object>} Deletion result
   */
  async deleteWorkspace(workspaceId, userId) {
    try {
      console.log('🗑️ [WORKSPACE-DELETE] Starting permanent workspace deletion...');
      console.log(`📋 [WORKSPACE-DELETE] Workspace ID: ${workspaceId}, User ID: ${userId}`);

      // Step 1: Get workspace information
      console.log('📁 [WORKSPACE-DELETE] Step 1: Retrieving workspace information...');
      const workspace = await Workspace.findOne({
        where: { id: workspaceId, userId, isActive: true }
      });

      if (!workspace) {
        console.log(`❌ [WORKSPACE-DELETE] Step 1 FAILED: Workspace ${workspaceId} not found for user ${userId}`);
        return {
          success: false,
          message: 'Workspace not found or access denied'
        };
      }
      console.log(`✅ [WORKSPACE-DELETE] Step 1 COMPLETED: Found workspace "${workspace.name}"`);

      // Step 2: Get all files in the workspace
      console.log('📄 [WORKSPACE-DELETE] Step 2: Retrieving workspace files...');
      const files = await File.findAll({
        where: { workspaceId, userId, isActive: true }
      });
      console.log(`✅ [WORKSPACE-DELETE] Step 2 COMPLETED: Found ${files.length} files in workspace`);

      // Step 3: Delete all files in the workspace
      console.log('🗂️ [WORKSPACE-DELETE] Step 3: Deleting all files in workspace...');
      const fileDeletionResults = await this.deleteAllFilesInWorkspace(workspaceId, userId, files);
      console.log(`✅ [WORKSPACE-DELETE] Step 3 COMPLETED: Deleted ${fileDeletionResults.successful} files, ${fileDeletionResults.failed} failed`);

      // Step 4: Hard delete workspace record from database
      console.log('💾 [WORKSPACE-DELETE] Step 4: Hard deleting workspace record...');
      await this.hardDeleteWorkspaceRecord(workspaceId, userId);
      console.log('✅ [WORKSPACE-DELETE] Step 4 COMPLETED: Workspace record hard deleted');

      console.log('🎉 [WORKSPACE-DELETE] ALL STEPS COMPLETED SUCCESSFULLY!');

      return {
        success: true,
        message: `Workspace "${workspace.name}" deleted successfully`,
        data: {
          workspaceId,
          workspaceName: workspace.name,
          filesDeleted: fileDeletionResults.successful,
          filesFailed: fileDeletionResults.failed,
          totalFiles: files.length
        }
      };

    } catch (error) {
      console.error(`❌ [WORKSPACE-DELETE] Workspace deletion failed for workspace ${workspaceId}:`, error);
      return {
        success: false,
        message: 'Failed to delete workspace. Please try again.',
        error: error.message
      };
    }
  }

  /**
   * Delete all files in a workspace
   * @param {number} workspaceId - Workspace ID
   * @param {number} userId - User ID
   * @param {Array} files - Array of file objects
   * @returns {Promise<Object>} Deletion results
   */
  async deleteAllFilesInWorkspace(workspaceId, userId, files) {
    try {
      console.log(`🗂️ [WORKSPACE-FILES-DELETE] Deleting ${files.length} files from workspace ${workspaceId}...`);
      
      const results = [];
      const errors = [];

      for (const file of files) {
        try {
          // Delete chunks and embeddings for this file
          console.log(`📄 [WORKSPACE-FILES-DELETE] Deleting chunks for file ${file.id}...`);
          const chunksDeleted = await this.deleteChunksForFile(file.id, userId);
          
          // Delete related chat sessions for this file
          console.log(`💬 [WORKSPACE-FILES-DELETE] Deleting related data for file ${file.id}...`);
          const relatedDataDeleted = await this.deleteRelatedData(file.id, userId);
          
          // Delete file from S3
          console.log(`☁️ [WORKSPACE-FILES-DELETE] Deleting file from S3: ${file.s3Key}`);
          await this.deleteFileFromS3(file.s3Key);
          
          // Hard delete file record
          console.log(`💾 [WORKSPACE-FILES-DELETE] Hard deleting file record ${file.id}...`);
          await this.hardDeleteFileRecord(file.id, userId);
          
          results.push({ 
            fileId: file.id, 
            fileName: file.originalName,
            chunksDeleted,
            success: true 
          });
          
          console.log(`✅ [WORKSPACE-FILES-DELETE] Successfully deleted file ${file.id}: ${file.originalName}`);
          
        } catch (error) {
          console.error(`❌ [WORKSPACE-FILES-DELETE] Failed to delete file ${file.id}:`, error);
          errors.push({ 
            fileId: file.id, 
            fileName: file.originalName,
            error: error.message 
          });
        }
      }

      const successful = results.length;
      const failed = errors.length;

      console.log(`🎉 [WORKSPACE-FILES-DELETE] File deletion completed: ${successful} successful, ${failed} failed`);

      return {
        successful,
        failed,
        results,
        errors
      };

    } catch (error) {
      console.error(`❌ [WORKSPACE-FILES-DELETE] Failed to delete files in workspace ${workspaceId}:`, error);
      throw new Error(`Failed to delete workspace files: ${error.message}`);
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
      console.log(`📄 [WORKSPACE-CHUNKS-DELETE] Deleting chunks for file ${fileId}...`);
      
      // Get count of chunks before deletion
      const chunkCount = await Chunk.count({
        where: { fileId, userId, isActive: true }
      });
      console.log(`📊 [WORKSPACE-CHUNKS-DELETE] Found ${chunkCount} chunks to delete`);

      // Hard delete all chunks for this file
      const result = await Chunk.destroy({
        where: { fileId, userId, isActive: true },
        force: true
      });

      console.log(`✅ [WORKSPACE-CHUNKS-DELETE] Successfully deleted ${chunkCount} chunks for file ${fileId}`);
      return chunkCount;

    } catch (error) {
      console.error(`❌ [WORKSPACE-CHUNKS-DELETE] Failed to delete chunks for file ${fileId}:`, error);
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
      console.log(`💬 [WORKSPACE-RELATED-DELETE] Deleting related data for file ${fileId}...`);
      
      // First, get all chat sessions related to this file (including inactive ones)
      const chatSessions = await ChatSession.findAll({
        where: { fileId, userId },
        attributes: ['id']
      });
      
      console.log(`💬 [WORKSPACE-RELATED-DELETE] Found ${chatSessions.length} chat sessions to delete for file ${fileId}`);
      
      // Delete chat messages for all related chat sessions
      let chatMessagesDeleted = 0;
      for (const session of chatSessions) {
        const messagesDeleted = await ChatMessage.destroy({
          where: { sessionId: session.id },
          force: true
        });
        chatMessagesDeleted += messagesDeleted;
      }
      console.log(`💬 [WORKSPACE-RELATED-DELETE] Deleted ${chatMessagesDeleted} chat messages for file ${fileId}`);
      
      // Now delete the chat sessions (including inactive ones)
      const chatSessionsDeleted = await ChatSession.destroy({
        where: { fileId, userId },
        force: true
      });
      console.log(`💬 [WORKSPACE-RELATED-DELETE] Deleted ${chatSessionsDeleted} chat sessions for file ${fileId}`);

      return {
        chatSessions: chatSessionsDeleted,
        chatMessages: chatMessagesDeleted
      };

    } catch (error) {
      console.error(`❌ [WORKSPACE-RELATED-DELETE] Failed to delete related data for file ${fileId}:`, error);
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
      console.log(`☁️ [WORKSPACE-S3-DELETE] Deleting file from S3: ${s3Key}`);
      await deleteFromS3(s3Key);
      console.log(`✅ [WORKSPACE-S3-DELETE] Successfully deleted file from S3: ${s3Key}`);
    } catch (error) {
      console.error(`❌ [WORKSPACE-S3-DELETE] Failed to delete file from S3: ${s3Key}`, error);
      // Don't throw error here - we want to continue with database cleanup even if S3 fails
      console.warn(`⚠️ [WORKSPACE-S3-DELETE] Continuing with database cleanup despite S3 deletion failure`);
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
      console.log(`💾 [WORKSPACE-FILE-RECORD-DELETE] Hard deleting file record ${fileId}...`);
      
      await File.destroy({
        where: { id: fileId, userId, isActive: true },
        force: true
      });

      console.log(`✅ [WORKSPACE-FILE-RECORD-DELETE] Successfully hard deleted file record ${fileId}`);
    } catch (error) {
      console.error(`❌ [WORKSPACE-FILE-RECORD-DELETE] Failed to hard delete file record ${fileId}:`, error);
      throw new Error(`Failed to delete file record: ${error.message}`);
    }
  }

  /**
   * Hard delete workspace record from database
   * @param {number} workspaceId - Workspace ID
   * @param {number} userId - User ID
   * @returns {Promise<void>}
   */
  async hardDeleteWorkspaceRecord(workspaceId, userId) {
    try {
      console.log(`💾 [WORKSPACE-RECORD-DELETE] Hard deleting workspace record ${workspaceId}...`);
      
      await Workspace.destroy({
        where: { id: workspaceId, userId, isActive: true },
        force: true
      });

      console.log(`✅ [WORKSPACE-RECORD-DELETE] Successfully hard deleted workspace record ${workspaceId}`);
    } catch (error) {
      console.error(`❌ [WORKSPACE-RECORD-DELETE] Failed to hard delete workspace record ${workspaceId}:`, error);
      throw new Error(`Failed to delete workspace record: ${error.message}`);
    }
  }

  /**
   * Get workspace deletion statistics
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Deletion statistics
   */
  async getWorkspaceDeletionStats(userId) {
    try {
      const totalWorkspaces = await Workspace.count({
        where: { userId, isActive: true }
      });

      const deletedWorkspaces = await Workspace.count({
        where: { userId, isActive: false }
      });

      const totalFiles = await File.count({
        where: { userId, isActive: true }
      });

      const deletedFiles = await File.count({
        where: { userId, isActive: false }
      });

      return {
        success: true,
        data: {
          activeWorkspaces: totalWorkspaces,
          deletedWorkspaces,
          activeFiles: totalFiles,
          deletedFiles,
          totalWorkspaces: totalWorkspaces + deletedWorkspaces,
          totalFiles: totalFiles + deletedFiles
        }
      };
    } catch (error) {
      console.error('Failed to get workspace deletion stats:', error);
      return {
        success: false,
        message: 'Failed to get workspace deletion statistics',
        error: error.message
      };
    }
  }
}

export default new WorkspaceDeletionService(); 