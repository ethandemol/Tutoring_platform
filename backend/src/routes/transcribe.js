import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import openai from '../config/openai.js';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  },
});

// POST /api/transcribe
router.post('/', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      console.log('❌ [TRANSCRIBE] No file provided');
      console.log('❌ [TRANSCRIBE] Request body:', req.body);
      console.log('❌ [TRANSCRIBE] Request files:', req.files);
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Check if buffer exists
    if (!req.file.buffer) {
      console.log('❌ [TRANSCRIBE] No buffer found in uploaded file');
      console.log('❌ [TRANSCRIBE] File object keys:', Object.keys(req.file));
      console.log('❌ [TRANSCRIBE] File object:', req.file);
      return res.status(400).json({ error: 'Invalid audio file: no buffer data' });
    }

    console.log('🎤 [TRANSCRIBE] Processing audio file:', {
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      fileId: req.body.fileId,
      workspaceId: req.body.workspaceId,
      bufferLength: req.file.buffer.length
    });

    // Check if file is too small (likely empty or corrupted)
    if (req.file.size < 1000) {
      console.log('❌ [TRANSCRIBE] File too small:', req.file.size, 'bytes');
      return res.status(400).json({ 
        error: 'Audio file too small. Please try recording again.' 
      });
    }

    // Check if file is too small for meaningful audio (at least 2 seconds worth)
    // Assuming ~16KB per second for webm audio
    const minSizeForAudio = 32000; // ~2 seconds of audio
    if (req.file.size < minSizeForAudio) {
      console.log('❌ [TRANSCRIBE] File too small for meaningful audio:', req.file.size, 'bytes');
      return res.status(400).json({ 
        error: 'Recording too short. Please record for at least 2 seconds.' 
      });
    }

    // Check if buffer has content
    if (req.file.buffer.length === 0) {
      console.log('❌ [TRANSCRIBE] Buffer is empty');
      return res.status(400).json({ 
        error: 'Audio file is empty. Please try recording again.' 
      });
    }

    // Check file size (OpenAI limit is 25MB)
    const maxSize = 25 * 1024 * 1024; // 25MB in bytes
    if (req.file.size > maxSize) {
      console.log('❌ [TRANSCRIBE] File too large:', req.file.size, 'bytes');
      return res.status(400).json({ 
        error: 'Audio file too large. Maximum size is 25MB.' 
      });
    }

    // Check file format (OpenAI supports: mp3, mp4, mpeg, mpga, m4a, wav, webm)
    const supportedFormats = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'];
    const fileExtension = req.file.originalname.split('.').pop()?.toLowerCase();
    const mimeType = req.file.mimetype.toLowerCase();
    
    const isSupported = supportedFormats.some(format => 
      fileExtension === format || mimeType.includes(format)
    );
    
    if (!isSupported) {
      console.log('❌ [TRANSCRIBE] Unsupported file format:', fileExtension, mimeType);
      return res.status(400).json({ 
        error: `Unsupported audio format. Supported formats: ${supportedFormats.join(', ')}` 
      });
    }

    // Create a File object that OpenAI can handle
    const audioFile = new File([req.file.buffer], req.file.originalname, {
      type: req.file.mimetype
    });

    console.log('🎤 [TRANSCRIBE] Created file object:', {
      name: audioFile.name,
      size: audioFile.size,
      type: audioFile.type
    });

    // Transcribe using OpenAI Whisper
    console.log('🎤 [TRANSCRIBE] Sending to OpenAI...');
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en', // You can make this configurable
      response_format: 'json',
    });

    console.log('🎤 [TRANSCRIBE] OpenAI response received:', transcription);

    // Check if transcription was successful
    if (!transcription || !transcription.text) {
      console.log('❌ [TRANSCRIBE] No transcription text received');
      console.log('❌ [TRANSCRIBE] Transcription object:', transcription);
      return res.status(500).json({ 
        error: 'Transcription failed: No text received from OpenAI' 
      });
    }

    console.log('✅ [TRANSCRIBE] Transcription completed:', {
      text: transcription.text,
      length: transcription.text.length
    });

    res.json({
      text: transcription.text,
      success: true
    });

  } catch (error) {
    console.error('❌ [TRANSCRIBE] Error:', error);
    console.error('❌ [TRANSCRIBE] Error details:', {
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

    if (error.message?.includes('file')) {
      return res.status(400).json({ 
        error: 'Invalid audio file format. Please try again.' 
      });
    }

    res.status(500).json({ 
      error: `Transcription failed: ${error.message}` 
    });
  }
});

export default router; 