import openai from '../config/openai.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';

class AIProviderService {
  constructor() {
    this.openai = openai;
    this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    // Available models configuration
    this.models = {
      'gpt-4o-mini': {
        provider: 'openai',
        model: 'gpt-4o-mini',
        maxTokens: 2000,
        temperature: 0.7,
        description: 'Fast and cost-effective GPT-4o-mini model'
      },
      'gpt-4o': {
        provider: 'openai',
        model: 'gpt-4o',
        maxTokens: 2000,
        temperature: 0.7,
        description: 'High-performance GPT-4o model with vision capabilities'
      },
      'gpt-4.1': {
        provider: 'openai',
        model: 'gpt-4.1',
        maxTokens: 2000,
        temperature: 0.7,
        description: 'Advanced GPT-4.1 model for complex reasoning tasks'
      },
      'claude-opus-4': {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 2000,
        temperature: 0.7,
        description: 'Claude Opus 4 - Most advanced Claude model'
      },
      'claude-sonnet-4': {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 2000,
        temperature: 0.7,
        description: 'Claude Sonnet 4 - Balanced performance model'
      },
      'gemini-2.5-pro': {
        provider: 'gemini',
        model: 'gemini-2.5-pro',
        maxTokens: 2000,
        temperature: 0.7,
        description: 'Google Gemini 2.5 Pro model for text generation'
      },
      'gemini-2.5-flash': {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        maxTokens: 2000,
        temperature: 0.7,
        description: 'Fast Google Gemini 2.5 Flash model'
      }
    };
  }

  /**
   * Get available models
   * @returns {Object} Available models configuration
   */
  getAvailableModels() {
    return this.models;
  }

  /**
   * Get default model
   * @returns {string} Default model name
   */
  getDefaultModel() {
    return 'gpt-4o-mini';
  }

  /**
   * Send message using specified model
   * @param {Array} messages - Array of message objects
   * @param {string} modelName - Model to use
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response object
   */
  async sendMessage(messages, modelName = 'gpt-4o-mini', options = {}) {
    const modelConfig = this.models[modelName];
    
    if (!modelConfig) {
      throw new Error(`Model ${modelName} not found`);
    }

    const { provider } = modelConfig;
    
    if (provider === 'openai') {
      return await this.sendOpenAIMessage(messages, modelName, options);
    } else if (provider === 'gemini') {
      return await this.sendGeminiMessage(messages, modelName, options);
    } else if (provider === 'anthropic') {
      return await this.sendAnthropicMessage(messages, modelName, options);
    } else {
      throw new Error(`Provider ${provider} not supported`);
    }
  }

  /**
   * Send message using OpenAI
   * @param {Array} messages - Array of message objects
   * @param {string} modelName - OpenAI model name
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response object
   */
  async sendOpenAIMessage(messages, modelName, options = {}) {
    try {
      const modelConfig = this.models[modelName];
      const {
        max_tokens = modelConfig.maxTokens,
        temperature = modelConfig.temperature,
        stream = false
      } = options;

      const response = await this.openai.chat.completions.create({
        model: modelName,
        messages: messages,
        max_tokens,
        temperature,
        stream,
      });

      return {
        success: true,
        message: response.choices[0].message.content,
        usage: response.usage,
        model: modelName,
        provider: 'openai'
      };
    } catch (error) {
      console.error('OpenAI API Error:', error);
      return {
        success: false,
        message: 'Sorry, I encountered an error processing your request. Please try again.',
        error: error.message,
        model: modelName,
        provider: 'openai'
      };
    }
  }

  /**
   * Send message using Google Gemini
   * @param {Array} messages - Array of message objects
   * @param {string} modelName - Gemini model name
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response object
   */
  async sendGeminiMessage(messages, modelName, options = {}) {
    try {
      const modelConfig = this.models[modelName];
      const {
        maxTokens = modelConfig.maxTokens,
        temperature = modelConfig.temperature
      } = options;

      // Get the Gemini model
      const geminiModel = this.gemini.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: temperature,
        }
      });

      // Convert OpenAI format messages to Gemini format, handling system messages
      const geminiMessages = this.convertToGeminiFormat(messages);
      
      // Start chat session
      const chat = geminiModel.startChat({
        history: geminiMessages.slice(0, -1), // All messages except the last one
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: temperature,
        }
      });

      // Send the last message
      const lastMessage = geminiMessages[geminiMessages.length - 1];
      const result = await chat.sendMessage(lastMessage.parts[0].text);
      const response = await result.response;
      const text = response.text();

      return {
        success: true,
        message: text,
        usage: {
          prompt_tokens: 0, // Gemini doesn't provide token usage
          completion_tokens: 0,
          total_tokens: 0
        },
        model: modelName,
        provider: 'gemini'
      };
    } catch (error) {
      console.error('Gemini API Error:', error);
      return {
        success: false,
        message: 'Sorry, I encountered an error processing your request. Please try again.',
        error: error.message,
        model: modelName,
        provider: 'gemini'
      };
    }
  }

  /**
   * Send message using Anthropic Claude
   * @param {Array} messages - Array of message objects
   * @param {string} modelName - Anthropic model name
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response object
   */
  async sendAnthropicMessage(messages, modelName, options = {}) {
    try {
      const modelConfig = this.models[modelName];
      const {
        maxTokens = modelConfig.maxTokens,
        temperature = modelConfig.temperature
      } = options;

      // Extract system message and convert other messages to Anthropic format
      let systemMessage = '';
      const anthropicMessages = [];
      
      for (const msg of messages) {
        if (msg.role === 'system') {
          systemMessage = msg.content;
        } else {
          anthropicMessages.push({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
          });
        }
      }

      const requestBody = {
        model: modelConfig.model,
        max_tokens: maxTokens,
        temperature: temperature,
        messages: anthropicMessages
      };

      // Add system parameter if there's a system message
      if (systemMessage) {
        requestBody.system = systemMessage;
      }

      const response = await this.anthropic.messages.create(requestBody);

      return {
        success: true,
        message: response.content[0].text,
        usage: {
          prompt_tokens: response.usage?.input_tokens || 0,
          completion_tokens: response.usage?.output_tokens || 0,
          total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
        },
        model: modelName,
        provider: 'anthropic'
      };
    } catch (error) {
      console.error('Anthropic API Error:', error);
      return {
        success: false,
        message: 'Sorry, I encountered an error processing your request. Please try again.',
        error: error.message,
        model: modelName,
        provider: 'anthropic'
      };
    }
  }

  /**
   * Convert OpenAI message format to Gemini format
   * @param {Array} messages - OpenAI format messages
   * @returns {Array} Gemini format messages
   */
  convertToGeminiFormat(messages) {
    const geminiMessages = [];
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      if (msg.role === 'system') {
        // For system messages, we need to handle them differently
        // Option 1: Skip system messages (not recommended)
        // Option 2: Convert system message to user message with context
        // Option 3: Incorporate system message into the first user message
        
        // We'll use Option 3: incorporate system message into the next user message
        if (i + 1 < messages.length && messages[i + 1].role === 'user') {
          // Combine system message with the next user message
          const nextMsg = messages[i + 1];
          geminiMessages.push({
            role: 'user',
            parts: [{ text: `${msg.content}\n\nUser: ${nextMsg.content}` }]
          });
          i++; // Skip the next message since we've combined it
        } else {
          // If no next user message, convert system to user message
          geminiMessages.push({
            role: 'user',
            parts: [{ text: `System Instructions: ${msg.content}` }]
          });
        }
      } else {
        // Convert regular messages
        geminiMessages.push({
          role: msg.role === 'assistant' ? 'model' : msg.role,
          parts: [{ text: msg.content }]
        });
      }
    }
    
    return geminiMessages;
  }

  /**
   * Validate model name
   * @param {string} modelName - Model name to validate
   * @returns {boolean} True if valid
   */
  isValidModel(modelName) {
    return Object.keys(this.models).includes(modelName);
  }

  /**
   * Get model information
   * @param {string} modelName - Model name
   * @returns {Object|null} Model configuration
   */
  getModelInfo(modelName) {
    return this.models[modelName] || null;
  }
}

export default new AIProviderService(); 