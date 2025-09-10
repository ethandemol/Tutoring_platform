import aiProviderService from './aiProviderService.js';

class ChatService {
  constructor() {
    this.aiProvider = aiProviderService;
  }

  async sendMessage(messages, fileContext = null, additionalContext = null, modelName = null) {
    try {
      // Use default model if none specified
      const selectedModel = modelName || this.aiProvider.getDefaultModel();
      
      // Validate model
      if (!this.aiProvider.isValidModel(selectedModel)) {
        throw new Error(`Invalid model: ${selectedModel}`);
      }

      // Prepare system message with context
      let systemMessage = {
        role: 'system',
        content: 'You are a helpful AI assistant that can analyze documents and answer questions about their content. Be concise, accurate, and helpful.'
      };

      // If we have file context, add it to the system message
      if (fileContext) {
        systemMessage.content += `\n\nYou are analyzing a document with the following context: ${fileContext}`;
      }

      // If we have additional context (workspace, homepage, etc.), add it
      if (additionalContext) {
        systemMessage.content += `\n\n${additionalContext}`;
      }

      // Prepare messages array with system message
      const messagesToSend = [systemMessage, ...messages];

      // Get model configuration
      const modelConfig = this.aiProvider.getModelInfo(selectedModel);
      const options = {
        max_tokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        stream: false,
      };

      const response = await this.aiProvider.sendMessage(messagesToSend, selectedModel, options);

      return {
        success: response.success,
        message: response.message,
        usage: response.usage,
        model: response.model,
        provider: response.provider
      };
    } catch (error) {
      console.error('Chat Service Error:', error);
      return {
        success: false,
        message: 'Sorry, I encountered an error processing your request. Please try again.',
        error: error.message
      };
    }
  }

  async analyzeDocument(fileContent, userQuestion, modelName = null) {
    try {
      // Use default model if none specified
      const selectedModel = modelName || this.aiProvider.getDefaultModel();
      
      // Validate model
      if (!this.aiProvider.isValidModel(selectedModel)) {
        throw new Error(`Invalid model: ${selectedModel}`);
      }

      const messages = [
        {
          role: 'system',
          content: 'You are an AI assistant that analyzes documents. You will be given document content and a user question. Provide a helpful, accurate response based on the document content.'
        },
        {
          role: 'user',
          content: `Document content: ${fileContent}\n\nUser question: ${userQuestion}`
        }
      ];

      // Get model configuration
      const modelConfig = this.aiProvider.getModelInfo(selectedModel);
      const options = {
        max_tokens: modelConfig.maxTokens,
        temperature: 0.5, // Lower temperature for analysis
        stream: false,
      };

      const response = await this.aiProvider.sendMessage(messages, selectedModel, options);

      return {
        success: response.success,
        message: response.message,
        usage: response.usage,
        model: response.model,
        provider: response.provider
      };
    } catch (error) {
      console.error('Document Analysis Error:', error);
      return {
        success: false,
        message: 'Sorry, I encountered an error analyzing the document. Please try again.',
        error: error.message
      };
    }
  }

  /**
   * Get available models for chat
   * @returns {Object} Available models
   */
  getAvailableModels() {
    return this.aiProvider.getAvailableModels();
  }

  /**
   * Get default model
   * @returns {string} Default model name
   */
  getDefaultModel() {
    return this.aiProvider.getDefaultModel();
  }

  /**
   * Validate model name
   * @param {string} modelName - Model name to validate
   * @returns {boolean} True if valid
   */
  isValidModel(modelName) {
    return this.aiProvider.isValidModel(modelName);
  }

  /**
   * Check if a session is active (has both user input and AI response)
   * @param {number} sessionId - The session ID to check
   * @returns {Promise<boolean>} True if session is active
   */
  async isSessionActive(sessionId) {
    try {
      const { ChatMessage } = await import('../models/index.js');
      
      // Count user messages
      const userMessageCount = await ChatMessage.count({
        where: { sessionId, isUser: true }
      });
      
      // Count AI messages
      const aiMessageCount = await ChatMessage.count({
        where: { sessionId, isUser: false }
      });
      
      // Session is active if it has at least one user message and at least one AI response
      return userMessageCount > 0 && aiMessageCount > 0;
    } catch (error) {
      console.error('Error checking session activity:', error);
      return false;
    }
  }

  /**
   * Save messages to session only if the session will be active after saving
   * @param {number} sessionId - The session ID
   * @param {string} userMessage - The user message content
   * @param {string} aiMessage - The AI response content
   * @param {number} userId - The user ID
   * @returns {Promise<Object>} Result of the save operation
   */
  async saveMessagesToSession(sessionId, userMessage, aiMessage, userId) {
    try {
      const { ChatSession, ChatMessage } = await import('../models/index.js');
      const { updateSessionActivity } = await import('../services/chatSummaryService.js');
      
      // Get the session
      const session = await ChatSession.findOne({
        where: { id: sessionId, userId }
      });

      if (!session) {
        return { success: false, message: 'Session not found' };
      }

      // Save user message
      await ChatMessage.create({
        sessionId: sessionId,
        content: userMessage,
        isUser: true,
        userId: userId
      });

      // Save assistant message
      await ChatMessage.create({
        sessionId: sessionId,
        content: aiMessage,
        isUser: false,
        userId: userId
      });

      // Update session activity
      await updateSessionActivity(sessionId);

      console.log(`✅ [CHAT] Messages saved to session ${sessionId}`);
      
      return { success: true, message: 'Messages saved successfully' };
    } catch (error) {
      console.error('Error saving messages to session:', error);
      return { success: false, message: 'Failed to save messages', error: error.message };
    }
  }

  /**
   * Clean up inactive sessions (sessions without both user input and AI response)
   * @returns {Promise<number>} Number of sessions cleaned up
   */
  async cleanupInactiveSessions() {
    try {
      const { ChatSession, ChatMessage } = await import('../models/index.js');
      
      console.log('🧹 [CHAT] Starting inactive session cleanup...');
      
      // Get all sessions
      const allSessions = await ChatSession.findAll({
        where: { isActive: true }
      });
      
      let cleanedCount = 0;
      
      for (const session of allSessions) {
        const isActive = await this.isSessionActive(session.id);
        
        if (!isActive) {
          console.log(`🗑️ [CHAT] Cleaning up inactive session ${session.id}: ${session.name}`);
          
          // Delete all messages for this session
          await ChatMessage.destroy({
            where: { sessionId: session.id }
          });
          
          // Delete the session
          await session.destroy();
          cleanedCount++;
        }
      }
      
      console.log(`🎉 [CHAT] Inactive session cleanup completed: ${cleanedCount} sessions cleaned`);
      return cleanedCount;
    } catch (error) {
      console.error('❌ [CHAT] Error during inactive session cleanup:', error);
      return 0;
    }
  }
}

export default new ChatService(); 