import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { ChatSession, ChatMessage, File, Workspace } from '../models/index.js';
import chatService from '../services/chatService.js';
import ragChatService from '../services/ragChatService.js';
import { generateChatSummary, updateSessionActivity } from '../services/chatSummaryService.js';
import { cleanupOldSessions, getCleanupStats, cleanupInactiveSessions } from '../services/chatCleanupService.js';

const router = express.Router();

// Get all chat sessions for a user
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, fileId, mode } = req.query;

    const whereClause = { userId, isActive: true }; // Only fetch sessions marked as active
    if (workspaceId) whereClause.workspaceId = workspaceId;
    if (fileId) whereClause.fileId = fileId;
    if (mode) whereClause.mode = mode;
    
    console.log(`🔍 [BACKEND] Fetching sessions with whereClause:`, whereClause);

    const sessions = await ChatSession.findAll({
      where: whereClause,
      order: [['updatedAt', 'DESC']],
      include: [
        {
          model: ChatMessage,
          as: 'messages',
          order: [['createdAt', 'ASC']]
        },
        {
          model: File,
          as: 'file',
          attributes: ['originalName'],
          where: { isActive: true },
          required: false
        }
      ]
    });

    // Filter to only include active sessions (with both user input and AI response)
    const activeSessions = sessions.filter(session => {
      if (!session.messages || session.messages.length === 0) {
        return false;
      }
      
      // Check if session has both user and AI messages
      const userMessages = session.messages.filter(msg => msg.isUser);
      const aiMessages = session.messages.filter(msg => !msg.isUser);
      
      return userMessages.length > 0 && aiMessages.length > 0;
    });
    
    console.log(`🔍 [BACKEND] Found ${sessions.length} total sessions, ${activeSessions.length} active sessions`);
    activeSessions.forEach(session => {
      console.log(`📋 [BACKEND] Session ${session.id}: mode=${session.mode}, name=${session.name}`);
    });



    res.json({
      success: true,
      data: activeSessions
    });
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get recent chat sessions for a specific workspace for recent activity
router.get('/recent-sessions', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 5, workspaceId } = req.query;

    const whereClause = { 
      userId, 
      isActive: true 
    };

    // If workspaceId is provided, filter by workspace
    if (workspaceId) {
      whereClause.workspaceId = workspaceId;
    }

    console.log(`🔍 [RECENT-SESSIONS] Fetching sessions for user ${userId}, workspace: ${workspaceId || 'all'}, where:`, whereClause);

    const sessions = await ChatSession.findAll({
      where: whereClause,
      order: [['updatedAt', 'DESC']],
      limit: parseInt(limit),
      attributes: ['id', 'name', 'workspaceId', 'fileId', 'summary', 'createdAt', 'updatedAt', 'mode'],
      include: [
        {
          model: File,
          as: 'file',
          attributes: ['originalName'],
          where: { isActive: true },
          required: false
        },
        {
          model: Workspace,
          as: 'workspace',
          attributes: ['id', 'name'],
          where: { isActive: true },
          required: false
        }
      ]
    });

    // Filter sessions to only include those with both user input and AI response
    const activeSessions = [];
    for (const session of sessions) {
      // Count user and AI messages for this session
      const userMessageCount = await ChatMessage.count({
        where: { sessionId: session.id, isUser: true }
      });
      
      const aiMessageCount = await ChatMessage.count({
        where: { sessionId: session.id, isUser: false }
      });
      
      // Only include sessions that have both user and AI messages
      if (userMessageCount > 0 && aiMessageCount > 0) {
        activeSessions.push(session);
      }
    }

    console.log(`✅ [RECENT-SESSIONS] Found ${sessions.length} total sessions, ${activeSessions.length} with messages`);
    
    // Debug logging for each session
    activeSessions.forEach(session => {
      console.log(`🔍 [BACKEND-SESSION-DEBUG] Session ${session.id}:`, {
        id: session.id,
        name: session.name,
        fileId: session.fileId,
        workspaceId: session.workspaceId,
        hasFile: !!session.file,
        fileOriginalName: session.file?.originalName,
        hasWorkspace: !!session.workspace,
        workspaceName: session.workspace?.name,
        messageCount: session.messages?.length || 0
      });
    });

    res.json({
      success: true,
      data: activeSessions
    });
  } catch (error) {
    console.error('Error fetching recent chat sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get a specific chat session with all messages
router.get('/sessions/:sessionId', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    console.log(`🔍 [BACKEND] Loading session ${sessionId} for user ${userId}`);

    const session = await ChatSession.findOne({
      where: { id: sessionId, userId },
      include: [
        {
          model: ChatMessage,
          as: 'messages',
          order: [['createdAt', 'ASC']]
        }
      ]
    });

    if (!session) {
      console.log(`❌ [BACKEND] Session ${sessionId} not found for user ${userId}`);
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    console.log(`✅ [BACKEND] Session ${sessionId} loaded with ${session.messages?.length || 0} messages`);
    if (session.messages && session.messages.length > 0) {
      session.messages.forEach((msg, index) => {
        console.log(`💬 [BACKEND] Message ${index + 1}: ${msg.isUser ? 'User' : 'AI'} - ${msg.content?.substring(0, 50)}...`);
      });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error fetching chat session:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create a new chat session
router.post('/sessions', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, workspaceId, fileId, mode } = req.body;

    console.log(`🆕 [BACKEND] Creating session with mode: ${mode}, name: ${name}, fileId: ${fileId}`);
    
    const session = await ChatSession.create({
      name: name || 'New Chat',
      userId,
      workspaceId,
      fileId,
      mode: mode || 'chat', // Default to 'chat' if not specified
      isActive: true // Mark as active since this will only be created when user sends first message
    });
    
    console.log(`✅ [BACKEND] Created session ${session.id} with mode: ${session.mode}`);

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Send a message in a chat session
router.post('/sessions/:sessionId/messages', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const { content, chatMode } = req.body;
    
    console.log('🎯 [CHAT-SESSIONS] Received chat mode:', chatMode);

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Verify session exists and belongs to user
    const session = await ChatSession.findOne({
      where: { id: sessionId, userId }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    // Create user message
    const userMessage = await ChatMessage.create({
      sessionId,
      userId,
      content: content.trim(),
      isUser: true,
      role: 'user'
    });

    // Get all previous messages for context
    const previousMessages = await ChatMessage.findAll({
      where: { sessionId },
      order: [['createdAt', 'ASC']]
    });

    // Convert to OpenAI format
    const openaiMessages = previousMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Use RAG for all chats - file-specific or workspace-wide
    let aiResponse;
    console.log('🎯 [CHAT-SESSIONS] Calling RAG with chat mode:', chatMode || 'regular');
    if (session.fileId) {
      // Use RAG for document-specific chat
      aiResponse = await ragChatService.sendRAGMessage(
        openaiMessages, 
        session.workspaceId, 
        userId, 
        session.fileId,
        null, // sessionId
        null, // modelName
        chatMode || 'regular'
      );
    } else if (session.workspaceId) {
      // Use RAG for workspace-level conversations (search across all files in workspace)
      aiResponse = await ragChatService.sendRAGMessage(
        openaiMessages, 
        session.workspaceId, 
        userId, 
        null, // No specific fileId, search across all files in workspace
        null, // sessionId
        null, // modelName
        chatMode || 'regular'
      );
    } else {
      // Use RAG for general chat (search across all workspaces)
      aiResponse = await ragChatService.sendRAGMessageAllWorkspaces(
        openaiMessages, 
        userId
      );
    }

    if (!aiResponse.success) {
      return res.status(500).json({
        success: false,
        message: aiResponse.message
      });
    }

    // Create AI message
    const assistantMessage = await ChatMessage.create({
      sessionId,
      userId,
      content: aiResponse.message,
      isUser: false,
      role: 'assistant'
    });

    // Update session activity and timestamp
    await updateSessionActivity(session);
    await session.update({ updatedAt: new Date() });

    // Generate summary if this is the first few messages
    const messageCount = await ChatMessage.count({ where: { sessionId } });
    if (messageCount <= 6 && !session.summary) {
      const allMessages = await ChatMessage.findAll({
        where: { sessionId },
        order: [['createdAt', 'ASC']]
      });
      const summary = await generateChatSummary(allMessages);
      await session.update({ summary });
    }

    console.log(`✅ [SESSION] Session ${session.id} updated with ${messageCount} messages`);

    // Include source citations in the response if available
    const responseData = {
      userMessage,
      assistantMessage: {
        ...assistantMessage.toJSON(),
        sourceCitations: aiResponse.context?.sourceCitations || []
      }
    };

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update chat session name
router.put('/sessions/:sessionId', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Session name is required'
      });
    }

    const session = await ChatSession.findOne({
      where: { id: sessionId, userId }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    await session.update({ name: name.trim() });

    // Reload the session to get updated data
    const updatedSession = await ChatSession.findOne({
      where: { id: sessionId, userId }
    });

    res.json({
      success: true,
      data: updatedSession
    });
  } catch (error) {
    console.error('Error updating chat session:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete a chat session
router.delete('/sessions/:sessionId', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    const session = await ChatSession.findOne({
      where: { id: sessionId, userId }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    // Delete all messages first
    await ChatMessage.destroy({
      where: { sessionId }
    });

    // Delete the session
    await session.destroy();

    res.json({
      success: true,
      message: 'Chat session deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting chat session:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Toggle star status of a chat session
router.patch('/sessions/:sessionId/star', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const { isStarred } = req.body;

    const session = await ChatSession.findOne({
      where: { id: sessionId, userId }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    await session.update({ isStarred: !!isStarred });

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error updating session star status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Clean up inactive sessions
router.post('/cleanup-inactive', authenticate, async (req, res) => {
  try {
    const { cleanupInactiveSessions } = await import('../services/chatCleanupService.js');
    const deletedCount = await cleanupInactiveSessions();
    
    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} inactive sessions (sessions without both user input and AI response)`,
      deletedCount
    });
  } catch (error) {
    console.error('Error cleaning up inactive sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Generate summary for a chat session
router.post('/sessions/:sessionId/summary', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    const session = await ChatSession.findOne({
      where: { id: sessionId, userId },
      include: [
        {
          model: ChatMessage,
          as: 'messages',
          order: [['createdAt', 'ASC']]
        }
      ]
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    const summary = await generateChatSummary(session.messages);
    await session.update({ summary });

    res.json({
      success: true,
      data: { summary }
    });
  } catch (error) {
    console.error('Error generating session summary:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Cleanup old sessions (admin endpoint)
router.post('/cleanup', authenticate, async (req, res) => {
  try {
    const deletedOldCount = await cleanupOldSessions();
    const deletedInactiveCount = await cleanupInactiveSessions();
    const stats = await getCleanupStats();

    res.json({
      success: true,
      data: {
        deletedOldCount,
        deletedInactiveCount,
        totalDeleted: deletedOldCount + deletedInactiveCount,
        stats
      }
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get cleanup statistics
router.get('/cleanup/stats', authenticate, async (req, res) => {
  try {
    const stats = await getCleanupStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting cleanup stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update session messages
router.put('/sessions/:sessionId/messages', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const { messages } = req.body;

    const session = await ChatSession.findOne({
      where: { id: sessionId, userId }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    // Clear existing messages for this session
    await ChatMessage.destroy({
      where: { sessionId }
    });

    // Create new messages
    if (messages && messages.length > 0) {
      for (const msg of messages) {
        await ChatMessage.create({
          sessionId,
          userId,
          content: msg.content,
          isUser: msg.isUser,
          role: msg.isUser ? 'user' : 'assistant',
          sourceCitations: msg.sourceCitations || null
        });
      }
    }

    // Update session activity
    await updateSessionActivity(session);

    // Generate summary if messages exist
    if (messages && messages.length > 0) {
      const summary = await generateChatSummary(messages);
      await session.update({ summary });
    }

    res.json({
      success: true,
      message: 'Session messages updated successfully'
    });
  } catch (error) {
    console.error('Error updating session messages:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router; 