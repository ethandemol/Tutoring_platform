import express from 'express';
import { authenticate } from '../middleware/auth.js';
import ragChatService from '../services/ragChatService.js';
import { Chunk, File } from '../models/index.js';

const router = express.Router();

// RAG chat endpoint (workspace context)
router.post('/message', authenticate, async (req, res) => {
  try {
    const { messages, workspaceId, fileId, sessionId, modelName, chatMode, contextOnly } = req.body;
    const userId = req.user.id;
    
    console.log('🎯 [RAG-ROUTE] Received chat mode:', chatMode);
    console.log('🎯 [RAG-ROUTE] Received context only:', contextOnly);
    if (!messages || !workspaceId) {
      return res.status(400).json({ success: false, message: 'messages and workspaceId are required' });
    }

    // Convert frontend message format to OpenAI format
    const openaiMessages = messages.map(msg => ({
      role: msg.isUser ? 'user' : 'assistant',
      content: msg.content
    }));

    const response = await ragChatService.sendRAGMessage(openaiMessages, workspaceId, userId, fileId, sessionId, modelName, chatMode, contextOnly);
    res.json(response);
  } catch (error) {
    console.error('RAG message error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// RAG chat endpoint (all workspaces context)
router.post('/message-all', authenticate, async (req, res) => {
  try {
    const { messages, modelName } = req.body;
    const userId = req.user.id;
    if (!messages) {
      return res.status(400).json({ success: false, message: 'messages are required' });
    }

    // Convert frontend message format to OpenAI format
    const openaiMessages = messages.map(msg => ({
      role: msg.isUser ? 'user' : 'assistant',
      content: msg.content
    }));

    const response = await ragChatService.sendRAGMessageAllWorkspaces(openaiMessages, userId, modelName);
    res.json(response);
  } catch (error) {
    console.error('RAG message-all error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// RAG document analysis endpoint
router.post('/analyze-document', authenticate, async (req, res) => {
  try {
    const { fileId, question } = req.body;
    const userId = req.user.id;
    if (!fileId || !question) {
      return res.status(400).json({ success: false, message: 'fileId and question are required' });
    }
    const response = await ragChatService.analyzeDocumentWithRAG(fileId, question, userId);
    res.json(response);
  } catch (error) {
    console.error('RAG analyze-document error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get source citation details for navigation
router.get('/source/:chunkId', authenticate, async (req, res) => {
  try {
    const { chunkId } = req.params;
    const userId = req.user.id;
    
    const chunk = await Chunk.findOne({
      where: { id: chunkId, userId, isActive: true },
      include: [{
        model: File,
        as: 'file',
        attributes: ['id', 'originalName', 'fileName']
      }],
      attributes: ['id', 'content', 'chunkIndex', 'metadata', 'fileId']
    });

    if (!chunk) {
      return res.status(404).json({ success: false, message: 'Source not found' });
    }

    const sourceInfo = {
      chunkId: chunk.id,
      fileId: chunk.fileId,
      fileName: chunk.file.originalName,
      pageNumber: chunk.metadata?.pageNumber || null,
      startChar: chunk.metadata?.startChar || 0,
      endChar: chunk.metadata?.endChar || 0,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content
    };

    res.json({
      success: true,
      data: sourceInfo
    });
  } catch (error) {
    console.error('Source citation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router; 