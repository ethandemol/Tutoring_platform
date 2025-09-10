import Chunk from '../models/Chunk.js';
import File from '../models/File.js';
import youtubeTranscriptService from './youtubeTranscriptService.js';

class TranscriptService {
  /**
   * Get transcript data for a YouTube video by reconstructing from chunks
   * @param {number} fileId - File ID
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Transcript data or null if not available
   */
  async getTranscriptFromChunks(fileId, userId) {
    try {
      console.log(`🎬 [TRANSCRIPT] Getting transcript from chunks for file ${fileId}`);
      
      // First, check if this is a YouTube file
      const file = await File.findOne({
        where: { id: fileId, userId, isActive: true },
        attributes: ['id', 'originalName', 'metadata']
      });

      if (!file) {
        console.log(`❌ [TRANSCRIPT] File ${fileId} not found`);
        return null;
      }

      if (file.metadata?.type !== 'youtube') {
        console.log(`❌ [TRANSCRIPT] File ${fileId} is not a YouTube video`);
        return null;
      }

      // Check if we have stored transcript data
      if (file.metadata?.originalTranscript) {
        console.log(`✅ [TRANSCRIPT] Using stored original transcript data`);
        return file.metadata.originalTranscript;
      }

      // Fallback: Get all chunks for this file, ordered by chunkIndex
      const chunks = await Chunk.findAll({
        where: { fileId, userId, isActive: true },
        order: [['chunkIndex', 'ASC']],
        attributes: ['id', 'content', 'chunkIndex', 'metadata']
      });

      if (chunks.length === 0) {
        console.log(`❌ [TRANSCRIPT] No chunks found for file ${fileId}`);
        return null;
      }

      console.log(`✅ [TRANSCRIPT] Found ${chunks.length} chunks for file ${fileId}`);

      // Reconstruct the transcript content
      const fullContent = chunks.map(chunk => chunk.content).join(' ');
      
      // Try to extract transcript snippets from the content
      const transcriptSnippets = this.extractTranscriptSnippets(fullContent, file.metadata);
      
      if (transcriptSnippets.length === 0) {
        console.log(`⚠️ [TRANSCRIPT] Could not extract transcript snippets from chunks`);
        return null;
      }

      // Calculate total duration
      const totalDuration = transcriptSnippets.length > 0 
        ? transcriptSnippets[transcriptSnippets.length - 1].start + transcriptSnippets[transcriptSnippets.length - 1].duration
        : 0;

      const transcriptData = {
        video_id: file.metadata?.videoId,
        snippets: transcriptSnippets,
        total_duration: totalDuration,
        snippet_count: transcriptSnippets.length,
        success: true
      };

      console.log(`✅ [TRANSCRIPT] Successfully reconstructed transcript with ${transcriptSnippets.length} snippets`);
      return transcriptData;

    } catch (error) {
      console.error(`❌ [TRANSCRIPT] Error getting transcript from chunks:`, error);
      return null;
    }
  }

  /**
   * Extract transcript snippets from the reconstructed content
   * @param {string} content - Full transcript content
   * @param {Object} fileMetadata - File metadata
   * @returns {Array} Array of transcript snippets
   */
  extractTranscriptSnippets(content, fileMetadata) {
    try {
      // Look for timestamp patterns in the content
      const timestampPattern = /\[(\d{2}):(\d{2})\]\s*(.+?)(?=\s*\[\d{2}:\d{2}\]|$)/gs;
      const matches = [...content.matchAll(timestampPattern)];
      
      if (matches.length === 0) {
        // If no timestamp pattern found, try to split by lines and estimate timestamps
        return this.estimateTranscriptSnippets(content);
      }

      const snippets = matches.map((match, index) => {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const text = match[3].trim();
        const start = minutes * 60 + seconds;
        
        // Estimate duration based on text length and next timestamp
        let duration = 5; // Default 5 seconds
        if (index < matches.length - 1) {
          const nextMinutes = parseInt(matches[index + 1][1]);
          const nextSeconds = parseInt(matches[index + 1][2]);
          const nextStart = nextMinutes * 60 + nextSeconds;
          duration = nextStart - start;
        }

        return {
          text,
          start,
          duration: Math.max(1, duration) // Ensure minimum 1 second duration
        };
      });

      return snippets;

    } catch (error) {
      console.error(`❌ [TRANSCRIPT] Error extracting transcript snippets:`, error);
      return this.estimateTranscriptSnippets(content);
    }
  }

  /**
   * Estimate transcript snippets when timestamps are not available
   * @param {string} content - Full transcript content
   * @returns {Array} Array of estimated transcript snippets
   */
  estimateTranscriptSnippets(content) {
    try {
      // Split content into sentences or phrases
      const sentences = content
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 10) // Filter out very short sentences
        .slice(0, 50); // Limit to first 50 sentences to avoid too many snippets

      const snippets = sentences.map((sentence, index) => {
        // Estimate 3-5 seconds per sentence based on average speaking rate
        const estimatedDuration = Math.max(3, Math.min(5, sentence.length / 15));
        const start = index * 3; // Rough estimate

        return {
          text: sentence,
          start,
          duration: estimatedDuration
        };
      });

      return snippets;

    } catch (error) {
      console.error(`❌ [TRANSCRIPT] Error estimating transcript snippets:`, error);
      return [];
    }
  }

  /**
   * Get transcript summary from file metadata
   * @param {number} fileId - File ID
   * @param {number} userId - User ID
   * @returns {Promise<string|null>} Transcript summary or null
   */
  async getTranscriptSummary(fileId, userId) {
    try {
      const file = await File.findOne({
        where: { id: fileId, userId, isActive: true },
        attributes: ['metadata']
      });

      if (!file || file.metadata?.type !== 'youtube') {
        return null;
      }

      return file.metadata?.transcriptSummary || null;

    } catch (error) {
      console.error(`❌ [TRANSCRIPT] Error getting transcript summary:`, error);
      return null;
    }
  }

  /**
   * Get processed transcript data with sentences
   * @param {number} fileId - File ID
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Processed transcript data or null
   */
  async getProcessedTranscript(fileId, userId) {
    try {
      console.log(`🎬 [TRANSCRIPT] Getting processed transcript for file ${fileId}`);
      
      // First, check if we have stored processed transcript data
      const file = await File.findOne({
        where: { id: fileId, userId, isActive: true },
        attributes: ['metadata']
      });

      if (file?.metadata?.processedTranscript) {
        console.log(`✅ [TRANSCRIPT] Using stored processed transcript data`);
        return file.metadata.processedTranscript;
      }

      // Fallback: Get the basic transcript data and process it
      const transcriptData = await this.getTranscriptFromChunks(fileId, userId);
      
      if (!transcriptData) {
        return null;
      }

      // Process the transcript into sentences with commas and timestamps
      const processedTranscript = await youtubeTranscriptService.processTranscriptWithCommasAndSentences(transcriptData);
      
      console.log(`✅ [TRANSCRIPT] Successfully processed transcript into ${processedTranscript.sentences.length} sentences`);
      return processedTranscript;

    } catch (error) {
      console.error(`❌ [TRANSCRIPT] Error getting processed transcript:`, error);
      return null;
    }
  }

  /**
   * Check if a file has transcript data available
   * @param {number} fileId - File ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Transcript availability info
   */
  async checkTranscriptAvailability(fileId, userId) {
    try {
      const file = await File.findOne({
        where: { id: fileId, userId, isActive: true },
        attributes: ['metadata']
      });

      if (!file || file.metadata?.type !== 'youtube') {
        return {
          hasTranscript: false,
          reason: 'Not a YouTube video'
        };
      }

      // Check if chunks exist
      const chunkCount = await Chunk.count({
        where: { fileId, userId, isActive: true }
      });

      if (chunkCount === 0) {
        return {
          hasTranscript: false,
          reason: 'No content chunks available'
        };
      }

      return {
        hasTranscript: true,
        hasSummary: !!file.metadata?.transcriptSummary,
        chunkCount,
        error: file.metadata?.transcriptError || null
      };

    } catch (error) {
      console.error(`❌ [TRANSCRIPT] Error checking transcript availability:`, error);
      return {
        hasTranscript: false,
        reason: 'Error checking availability'
      };
    }
  }
}

export default new TranscriptService(); 