import express from 'express';
import youtubeTranscriptCacheService from '../services/youtubeTranscriptCacheService.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/youtube-cache/stats - Get cache statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = await youtubeTranscriptCacheService.getCacheStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ [YT-CACHE-ROUTE] Error getting cache stats:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache statistics'
    });
  }
});

// DELETE /api/youtube-cache/:videoId - Delete cached transcript
router.delete('/:videoId', authenticate, async (req, res) => {
  try {
    const { videoId } = req.params;
    
    await youtubeTranscriptCacheService.deleteCachedTranscript(videoId);
    
    res.json({
      success: true,
      message: `Cached transcript for video ${videoId} deleted successfully`
    });
  } catch (error) {
    console.error('❌ [YT-CACHE-ROUTE] Error deleting cached transcript:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to delete cached transcript'
    });
  }
});

// POST /api/youtube-cache/cleanup - Clean up old transcripts
router.post('/cleanup', authenticate, async (req, res) => {
  try {
    const { daysOld = 30 } = req.body;
    
    const deletedCount = await youtubeTranscriptCacheService.cleanupOldTranscripts(daysOld);
    
    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} old transcripts`,
      deletedCount
    });
  } catch (error) {
    console.error('❌ [YT-CACHE-ROUTE] Error cleaning up old transcripts:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to clean up old transcripts'
    });
  }
});

// GET /api/youtube-cache/:videoId - Get cached transcript info
router.get('/:videoId', authenticate, async (req, res) => {
  try {
    const { videoId } = req.params;
    
    const cached = await youtubeTranscriptCacheService.getCachedTranscript(videoId);
    
    if (!cached) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found in cache'
      });
    }
    
    res.json({
      success: true,
      transcript: {
        videoId: cached.videoId,
        videoTitle: cached.videoTitle,
        videoDescription: cached.videoDescription,
        channelName: cached.channelName,
        totalDuration: cached.totalDuration,
        snippetCount: cached.snippetCount,
        storageType: cached.storageType,
        lastAccessed: cached.lastAccessed,
        accessCount: cached.accessCount,
        createdAt: cached.createdAt,
        updatedAt: cached.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ [YT-CACHE-ROUTE] Error getting cached transcript info:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get cached transcript info'
    });
  }
});

// POST /api/youtube-cache/refresh/:videoId - Force refresh cached transcript
router.post('/refresh/:videoId', authenticate, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { proxyConfig } = req.body;
    
    // Delete existing cache
    await youtubeTranscriptCacheService.deleteCachedTranscript(videoId);
    
    // Fetch fresh transcript
    const transcriptData = await youtubeTranscriptCacheService.getTranscript(
      videoId,
      proxyConfig,
      req.user.id,
      req.body.videoMetadata
    );
    
    res.json({
      success: true,
      message: `Transcript for video ${videoId} refreshed successfully`,
      transcript: transcriptData
    });
  } catch (error) {
    console.error('❌ [YT-CACHE-ROUTE] Error refreshing transcript:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh transcript'
    });
  }
});

export default router; 