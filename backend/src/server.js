import dotenv from 'dotenv';
import { File } from 'node:buffer';

// Polyfill for File global if not available (for OpenAI SDK)
if (!globalThis.File) {
  globalThis.File = File;
}

dotenv.config();
console.log('JWT_SECRET:', process.env.JWT_SECRET);

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import workspaceRoutes from './routes/workspace.js';
import fileRoutes from './routes/files.js';
import chatRoutes from './routes/chat.js';
import chatSessionRoutes from './routes/chatSessions.js';
import ragRoutes from './routes/rag.js';
import handwritingRoutes from './routes/handwriting.js';
import urlRoutes from './routes/urls.js';

import generateRoutes from './routes/generate.js';
import generateNewRoutes from './routes/generate-new.js';
import todoRoutes from './routes/todos.js';
import transcriptRoutes from './routes/transcript.js';
import transcribeRoutes from './routes/transcribe.js';
import ttsRoutes from './routes/tts.js';
import feedbackRoutes from './routes/feedback.js';
import youtubeCacheRoutes from './routes/youtubeCache.js';
import folderRoutes from './routes/folders.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { testConnection, syncDatabase } from './config/database.js';
import { ensureBucketExists } from './config/s3.js';
import fileProcessingScheduler from './services/fileProcessingScheduler.js';

import './models/index.js'; // <-- Ensure associations are set up

const app = express();
console.log('Environment PORT:', process.env.PORT);
const PORT = process.env.PORT || 5002;
console.log('Final PORT:', PORT);

// Trust proxy for Railway deployment
app.set('trust proxy', 1);

// Security middleware with custom CSP for iframe support
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", "http://localhost:5001", "https://localhost:5001"],
      frameAncestors: ["'self'", "http://localhost:3000", "http://localhost:5173", "http://localhost:4173", "http://localhost:8080"],
    },
  },
}));

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:8080',
  // Add Railway frontend URL from environment variable
  process.env.CORS_ORIGIN,
  // Add common Railway patterns
  'https://ample-rejoicing-production-d879.up.railway.app',
  'https://*.up.railway.app'
].filter(Boolean); // Remove undefined values

console.log('Allowed CORS origins:', allowedOrigins);

// CORS configuration - More permissive for Railway deployment
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) {
      console.log('CORS allowing request with no origin');
      return callback(null, true);
    }
    
    console.log('CORS checking origin:', origin);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      console.log('CORS allowed origin (from list):', origin);
      return callback(null, true);
    }
    
    // Check if origin matches Railway pattern - more permissive
    if (origin && (origin.includes('.up.railway.app') || origin.includes('railway.app'))) {
      console.log('CORS allowed Railway origin:', origin);
      return callback(null, true);
    }
    
    // Allow all Railway domains in production
    if (process.env.NODE_ENV === 'production' && origin && origin.includes('railway.app')) {
      console.log('CORS allowed production Railway origin:', origin);
      return callback(null, true);
    }
    
    // In production, allow all Railway domains
    if (process.env.NODE_ENV === 'production') {
      console.log('CORS allowing all origins in production:', origin);
      return callback(null, true);
    }
    
    console.log('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100000, // limit each IP to 100,000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Sparqit Backend is running',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/chat-sessions', chatSessionRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/handwriting', handwritingRoutes);
app.use('/api/urls', urlRoutes);

app.use('/api/generate', generateRoutes);
app.use('/api/generate-new', generateNewRoutes);
app.use('/api', todoRoutes);
app.use('/api/transcript', transcriptRoutes);
app.use('/api/transcribe', transcribeRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/youtube-cache', youtubeCacheRoutes);
app.use('/api/folders', folderRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️ OPENAI_API_KEY not found. Some AI features may be disabled.');
  }

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    
    // Sync database (create tables if they don't exist)
    await syncDatabase();
    
    // Ensure S3 bucket exists
    await ensureBucketExists();
    
    // Start file processing scheduler
    fileProcessingScheduler.start();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  
      console.log(`📄 File processing scheduler: Running (checks every 5 minutes)`);
    });
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  fileProcessingScheduler.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  fileProcessingScheduler.stop();
  process.exit(0);
});

startServer();

export default app; 