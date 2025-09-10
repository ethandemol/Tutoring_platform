import express from 'express';
import { authenticate } from '../middleware/auth.js';
import chatService from '../services/chatService.js';

const router = express.Router();

// Get available models
router.get('/models', authenticate, async (req, res) => {
  try {
    const models = chatService.getAvailableModels();
    const defaultModel = chatService.getDefaultModel();
    
    res.json({
      success: true,
      models,
      defaultModel,
      message: 'Available models retrieved successfully'
    });
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve available models'
    });
  }
});

// Send a chat message
router.post('/message', authenticate, async (req, res) => {
  try {
    const { messages, fileId, workspaceContext, context, sessionId, modelName } = req.body;
    const userId = req.user.id;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        message: 'Messages array is required'
      });
    }

    // Validate model if provided
    if (modelName && !chatService.isValidModel(modelName)) {
      return res.status(400).json({
        success: false,
        message: `Invalid model: ${modelName}. Use /api/chat/models to see available models.`
      });
    }

    // Convert frontend message format to OpenAI format
    const openaiMessages = messages.map(msg => ({
      role: msg.isUser ? 'user' : 'assistant',
      content: msg.content
    }));

    // Get file context if fileId is provided
    let fileContext = null;
    if (fileId) {
      // You can add file context extraction here if needed
      // For now, we'll just pass the fileId as context
      fileContext = `Analyzing file with ID: ${fileId}`;
    }

    // Determine additional context
    let additionalContext = null;
    if (workspaceContext) {
      additionalContext = workspaceContext;
    } else if (context) {
      additionalContext = context;
    }

    const response = await chatService.sendMessage(openaiMessages, fileContext, additionalContext, modelName);

    if (response.success) {
      // Save messages to session if sessionId is provided
      if (sessionId) {
        try {
          // Use the new session saving logic that ensures only active sessions are saved
          const saveResult = await chatService.saveMessagesToSession(
            sessionId,
            messages[0].content,
            response.message,
            userId
          );
          
          if (!saveResult.success) {
            console.error('Error saving messages to session:', saveResult.message);
            // Don't fail the request if saving fails
          }
        } catch (error) {
          console.error('Error saving messages to session:', error);
          // Don't fail the request if saving fails
        }
      }

      res.json({
        success: true,
        message: response.message,
        usage: response.usage,
        model: response.model,
        provider: response.provider
      });
    } else {
      res.status(500).json({
        success: false,
        message: response.message,
        model: response.model,
        provider: response.provider
      });
    }
  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Analyze a specific document
router.post('/analyze-document', authenticate, async (req, res) => {
  try {
    const { fileId, question, modelName } = req.body;
    const userId = req.user.id;

    if (!fileId || !question) {
      return res.status(400).json({
        success: false,
        message: 'File ID and question are required'
      });
    }

    // Validate model if provided
    if (modelName && !chatService.isValidModel(modelName)) {
      return res.status(400).json({
        success: false,
        message: `Invalid model: ${modelName}. Use /api/chat/models to see available models.`
      });
    }

    // TODO: Extract file content from S3 or database
    // For now, we'll use a placeholder
    const fileContent = "This is a placeholder for the actual file content.";

    const response = await chatService.analyzeDocument(fileContent, question, modelName);

    if (response.success) {
      res.json({
        success: true,
        message: response.message,
        usage: response.usage,
        model: response.model,
        provider: response.provider
      });
    } else {
      res.status(500).json({
        success: false,
        message: response.message,
        model: response.model,
        provider: response.provider
      });
    }
  } catch (error) {
    console.error('Document analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router; 