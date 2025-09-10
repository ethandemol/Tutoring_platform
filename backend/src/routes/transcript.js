import express from 'express';
import { authenticate } from '../middleware/auth.js';
import transcriptService from '../services/transcriptService.js';

const router = express.Router();

// Get transcript data for a YouTube video
router.get('/:fileId', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    console.log(`🎬 [TRANSCRIPT-API] Getting transcript for file ${fileId}, user ${userId}`);

    // Get transcript data from chunks
    const transcriptData = await transcriptService.getTranscriptFromChunks(fileId, userId);

    if (!transcriptData) {
      return res.status(404).json({
        success: false,
        message: 'Transcript not available for this video'
      });
    }

    // Get processed transcript data with sentences
    const processedTranscript = await transcriptService.getProcessedTranscript(fileId, userId);

    // Get transcript summary
    const transcriptSummary = await transcriptService.getTranscriptSummary(fileId, userId);

    res.json({
      success: true,
      data: {
        transcript: transcriptData,
        processedTranscript: processedTranscript,
        summary: transcriptSummary
      }
    });

  } catch (error) {
    console.error('❌ [TRANSCRIPT-API] Error getting transcript:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transcript',
      error: error.message
    });
  }
});

// Check transcript availability
router.get('/:fileId/availability', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    console.log(`🔍 [TRANSCRIPT-API] Checking transcript availability for file ${fileId}, user ${userId}`);

    const availability = await transcriptService.checkTranscriptAvailability(fileId, userId);

    res.json({
      success: true,
      data: availability
    });

  } catch (error) {
    console.error('❌ [TRANSCRIPT-API] Error checking transcript availability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check transcript availability',
      error: error.message
    });
  }
});

export default router; 