import express from 'express';
import OpenAI from 'openai';
import openai from '../config/openai.js';

const router = express.Router();

// POST /api/tts
router.post('/', async (req, res) => {
  try {
    const { text, voice = 'alloy' } = req.body;

    if (!text || !text.trim()) {
      console.log('❌ [TTS] No text provided');
      return res.status(400).json({ error: 'No text provided for speech synthesis' });
    }

    console.log('🔊 [TTS] Converting text to speech:', {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      voice: voice,
      length: text.length
    });

    // Convert text to speech using OpenAI TTS
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice, // alloy, echo, fable, onyx, nova, shimmer
      input: text,
    });

    console.log('✅ [TTS] Speech synthesis completed');

    // Convert the response to buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());

    // Set headers for audio response
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Send the audio buffer
    res.send(buffer);

  } catch (error) {
    console.error('❌ [TTS] Error:', error);
    console.error('❌ [TTS] Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      response: error.response?.data
    });
    
    if (error.code === 'insufficient_quota') {
      return res.status(429).json({ 
        error: 'OpenAI API quota exceeded. Please try again later.' 
      });
    }
    
    if (error.code === 'invalid_api_key') {
      return res.status(401).json({ 
        error: 'Invalid OpenAI API key' 
      });
    }

    res.status(500).json({ 
      error: `Text-to-speech failed: ${error.message}` 
    });
  }
});

export default router; 