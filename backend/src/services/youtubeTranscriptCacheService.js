import { YouTubeTranscript } from '../models/index.js';
import { s3Client } from '../config/s3.js';
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import youtubeTranscriptService from './youtubeTranscriptService.js';

class YouTubeTranscriptCacheService {
  constructor() {
    this.youtubeService = youtubeTranscriptService;
  }

  /**
   * Get transcript for a video, checking cache first
   * @param {string} videoId - YouTube video ID
   * @param {Object} proxyConfig - Optional proxy configuration
   * @param {string} userId - User ID for caching
   * @param {Object} videoMetadata - Optional video metadata
   * @returns {Promise<Object>} Transcript data with processing
   */
  async getTranscript(videoId, proxyConfig = null, userId = null, videoMetadata = null) {
    try {
      console.log(`🎬 [YT-CACHE] Checking cache for video: ${videoId}`);
      
      // Check if transcript exists in cache
      const cachedTranscript = await this.getCachedTranscript(videoId);
      
      if (cachedTranscript) {
        console.log(`✅ [YT-CACHE] Found cached transcript for video: ${videoId}`);
        
        // Update access statistics
        await this.updateAccessStats(cachedTranscript);
        
        // Return cached transcript data
        return cachedTranscript.transcriptData;
      }
      
      console.log(`🔄 [YT-CACHE] No cached transcript found, fetching from YouTube: ${videoId}`);
      
      // Fetch transcript from YouTube
      const transcriptData = await this.youtubeService.fetchTranscript(videoId, proxyConfig);
      
      if (!transcriptData || !transcriptData.success) {
        throw new Error(`Failed to fetch transcript: ${transcriptData?.error || 'Unknown error'}`);
      }
      
      // Process transcript for RAG
      const processedContent = this.youtubeService.processTranscriptForRAG(
        transcriptData,
        videoMetadata?.title || 'Unknown Title',
        videoMetadata?.description || 'No description available',
        videoMetadata?.channelName || 'Unknown Channel'
      );
      
      // Store transcript in cache
      await this.cacheTranscript(videoId, transcriptData, processedContent, userId, videoMetadata);
      
      console.log(`✅ [YT-CACHE] Successfully cached transcript for video: ${videoId}`);
      
      return transcriptData;
      
    } catch (error) {
      console.error(`❌ [YT-CACHE] Error getting transcript for video ${videoId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get processed transcript with sentences and timestamps
   * @param {string} videoId - YouTube video ID
   * @param {Object} proxyConfig - Optional proxy configuration
   * @param {string} userId - User ID for caching
   * @param {Object} videoMetadata - Optional video metadata
   * @returns {Promise<Object>} Processed transcript with sentences and timestamps
   */
  async getProcessedTranscript(videoId, proxyConfig = null, userId = null, videoMetadata = null) {
    try {
      console.log(`🎬 [YT-CACHE] Getting processed transcript for video: ${videoId}`);
      
      // Get raw transcript data (from cache or fetch)
      const transcriptData = await this.getTranscript(videoId, proxyConfig, userId, videoMetadata);
      
      if (!transcriptData || !transcriptData.success) {
        throw new Error(`Failed to get transcript: ${transcriptData?.error || 'Unknown error'}`);
      }
      
      // Process transcript into sentences with commas and timestamps
      const processedTranscript = await this.youtubeService.processTranscriptWithCommasAndSentences(transcriptData);
      
      // Process transcript for RAG using paragraph with commas
      const transcriptContent = this.youtubeService.processTranscriptForRAG(
        transcriptData,
        videoMetadata?.title || 'Unknown Title',
        videoMetadata?.description || 'No description available',
        videoMetadata?.channelName || 'Unknown Channel',
        processedTranscript.paragraphWithCommas
      );
      
      // Generate transcript summary
      const transcriptSummary = await this.youtubeService.generateTranscriptSummary(
        transcriptContent,
        videoMetadata?.title || 'Unknown Title'
      );
      
      return {
        transcript: transcriptData,
        processedTranscript: processedTranscript,
        transcriptContent,
        transcriptSummary,
        hasTranscript: true
      };
      
    } catch (error) {
      console.error(`❌ [YT-CACHE] Error getting processed transcript for video ${videoId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get cached transcript from database
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object|null>} Cached transcript or null
   */
  async getCachedTranscript(videoId) {
    try {
      const cached = await YouTubeTranscript.findOne({
        where: { videoId }
      });
      
      if (!cached) {
        return null;
      }
      
      // If stored in S3, fetch from S3
      if (cached.storageType === 's3' && cached.s3Key) {
        try {
          const s3Data = await this.getFromS3(cached.s3Key);
          cached.transcriptData = JSON.parse(s3Data);
        } catch (s3Error) {
          console.warn(`⚠️ [YT-CACHE] Failed to fetch from S3, falling back to database: ${s3Error.message}`);
          // If S3 fails, try to use database data if available
          if (!cached.transcriptData) {
            return null;
          }
        }
      }
      
      return cached;
      
    } catch (error) {
      console.error(`❌ [YT-CACHE] Error getting cached transcript:`, error.message);
      return null;
    }
  }

  /**
   * Cache transcript in database and optionally S3
   * @param {string} videoId - YouTube video ID
   * @param {Object} transcriptData - Transcript data
   * @param {string} processedContent - Processed content for RAG
   * @param {string} userId - User ID
   * @param {Object} videoMetadata - Video metadata
   * @returns {Promise<void>}
   */
  async cacheTranscript(videoId, transcriptData, processedContent, userId = null, videoMetadata = null) {
    try {
      const transcriptSize = JSON.stringify(transcriptData).length;
      const maxDbSize = 1000000; // 1MB limit for database storage
      
      let storageType = 'database';
      let s3Key = null;
      
      // If transcript is large, store in S3
      if (transcriptSize > maxDbSize) {
        storageType = 's3';
        s3Key = `youtube-transcripts/${videoId}_${Date.now()}.json`;
        
        await this.storeInS3(s3Key, JSON.stringify(transcriptData));
        console.log(`📦 [YT-CACHE] Stored large transcript in S3: ${s3Key}`);
      }
      
      // Create or update cache record
      await YouTubeTranscript.upsert({
        videoId,
        videoTitle: videoMetadata?.title || null,
        videoDescription: videoMetadata?.description || null,
        channelName: videoMetadata?.channelName || null,
        transcriptData: storageType === 'database' ? transcriptData : null,
        totalDuration: transcriptData.total_duration,
        snippetCount: transcriptData.snippet_count,
        processedContent,
        s3Key,
        storageType,
        userId,
        lastAccessed: new Date(),
        accessCount: 1
      });
      
      console.log(`✅ [YT-CACHE] Cached transcript for video: ${videoId} (${storageType})`);
      
    } catch (error) {
      console.error(`❌ [YT-CACHE] Error caching transcript:`, error.message);
      throw error;
    }
  }

  /**
   * Update access statistics for cached transcript
   * @param {Object} cachedTranscript - Cached transcript record
   * @returns {Promise<void>}
   */
  async updateAccessStats(cachedTranscript) {
    try {
      await cachedTranscript.update({
        lastAccessed: new Date(),
        accessCount: cachedTranscript.accessCount + 1
      });
    } catch (error) {
      console.warn(`⚠️ [YT-CACHE] Failed to update access stats:`, error.message);
    }
  }

  /**
   * Store data in S3
   * @param {string} key - S3 key
   * @param {string} data - Data to store
   * @returns {Promise<void>}
   */
  async storeInS3(key, data) {
    try {
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Body: data,
        ContentType: 'application/json'
      });
      
      await s3Client.send(command);
    } catch (error) {
      console.error(`❌ [YT-CACHE] Error storing in S3:`, error.message);
      throw error;
    }
  }

  /**
   * Get data from S3
   * @param {string} key - S3 key
   * @returns {Promise<string>} Data from S3
   */
  async getFromS3(key) {
    try {
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key
      });
      
      const response = await s3Client.send(command);
      return await response.Body.transformToString();
    } catch (error) {
      console.error(`❌ [YT-CACHE] Error getting from S3:`, error.message);
      throw error;
    }
  }

  /**
   * Delete cached transcript
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<void>}
   */
  async deleteCachedTranscript(videoId) {
    try {
      const cached = await YouTubeTranscript.findOne({
        where: { videoId }
      });
      
      if (!cached) {
        return;
      }
      
      // Delete from S3 if stored there
      if (cached.storageType === 's3' && cached.s3Key) {
        try {
          const command = new DeleteObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: cached.s3Key
          });
          await s3Client.send(command);
        } catch (s3Error) {
          console.warn(`⚠️ [YT-CACHE] Failed to delete from S3:`, s3Error.message);
        }
      }
      
      // Delete from database
      await cached.destroy();
      
      console.log(`✅ [YT-CACHE] Deleted cached transcript for video: ${videoId}`);
      
    } catch (error) {
      console.error(`❌ [YT-CACHE] Error deleting cached transcript:`, error.message);
      throw error;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getCacheStats() {
    try {
      const totalCount = await YouTubeTranscript.count();
      const dbCount = await YouTubeTranscript.count({ where: { storageType: 'database' } });
      const s3Count = await YouTubeTranscript.count({ where: { storageType: 's3' } });
      
      const mostAccessed = await YouTubeTranscript.findAll({
        order: [['accessCount', 'DESC']],
        limit: 10
      });
      
      const recentlyAccessed = await YouTubeTranscript.findAll({
        order: [['lastAccessed', 'DESC']],
        limit: 10
      });
      
      return {
        totalCount,
        dbCount,
        s3Count,
        mostAccessed: mostAccessed.map(t => ({
          videoId: t.videoId,
          videoTitle: t.videoTitle,
          accessCount: t.accessCount,
          lastAccessed: t.lastAccessed
        })),
        recentlyAccessed: recentlyAccessed.map(t => ({
          videoId: t.videoId,
          videoTitle: t.videoTitle,
          accessCount: t.accessCount,
          lastAccessed: t.lastAccessed
        }))
      };
    } catch (error) {
      console.error(`❌ [YT-CACHE] Error getting cache stats:`, error.message);
      throw error;
    }
  }

  /**
   * Clean up old cached transcripts
   * @param {number} daysOld - Number of days old to consider for cleanup
   * @returns {Promise<number>} Number of records deleted
   */
  async cleanupOldTranscripts(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const oldTranscripts = await YouTubeTranscript.findAll({
        where: {
          lastAccessed: {
            [require('sequelize').Op.lt]: cutoffDate
          }
        }
      });
      
      let deletedCount = 0;
      
      for (const transcript of oldTranscripts) {
        await this.deleteCachedTranscript(transcript.videoId);
        deletedCount++;
      }
      
      console.log(`✅ [YT-CACHE] Cleaned up ${deletedCount} old transcripts`);
      return deletedCount;
      
    } catch (error) {
      console.error(`❌ [YT-CACHE] Error cleaning up old transcripts:`, error.message);
      throw error;
    }
  }
}

export default new YouTubeTranscriptCacheService(); 