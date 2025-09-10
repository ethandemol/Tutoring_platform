import aiProviderService from './aiProviderService.js';
import embeddingService from './embeddingService.js';
import { Chunk, File } from '../models/index.js';

class RAGChatService {
  constructor() {
    this.aiProvider = aiProviderService;
  }

  /**
   * Get mode-specific instructions for the AI
   * @param {string} chatMode - The chat mode ('focused', 'regular', 'socratic', 'deeper')
   * @param {boolean} contextOnly - Whether to restrict responses to workspace content only
   * @returns {string} Mode-specific instructions
   */
  getModeInstructions(chatMode, contextOnly = false) {
    let baseInstructions = '';
    
    switch (chatMode) {
      case 'focused':
        baseInstructions = `CHAT MODE: FOCUSED
- Provide direct, concise answers
- Get straight to the point
- Avoid unnecessary explanations
- Keep responses brief and actionable
- Focus on the most relevant information only
- Use short, direct sentences
- Avoid lengthy explanations or background context
- Give the most important information first`;
        break;

      case 'socratic':
        baseInstructions = `CHAT MODE: SOCRATIC
- Use the Socratic method of teaching
- Ask thought-provoking questions to guide the user
- Help users discover answers through questioning
- Encourage critical thinking and self-reflection
- Guide users to reach conclusions themselves
- Use questions like "What do you think about...?", "How might we approach...?", "What evidence supports...?"
- Start responses with questions when possible
- Ask follow-up questions to deepen understanding
- Encourage the user to think critically about the material`;
        break;

      case 'deeper':
        baseInstructions = `CHAT MODE: DEEPER DIVE
- Provide comprehensive, detailed explanations
- Break down complex concepts thoroughly
- Include background context and related information
- Explain the "why" behind concepts
- Provide multiple perspectives when relevant
- Include practical examples and applications
- Go beyond surface-level information
- Provide extensive context and background
- Include multiple examples and applications
- Explain the underlying principles and reasoning
- Connect concepts to broader themes and real-world applications`;
        break;

      case 'regular':
      default:
        baseInstructions = `CHAT MODE: REGULAR
- Provide balanced, helpful responses
- Be conversational and engaging
- Include relevant context when needed
- Adapt response length to the complexity of the question
- Maintain a natural, helpful tone
- Be friendly and approachable
- Provide a good balance of detail and clarity
- Use a conversational style that feels natural`;
        break;
    }

    if (contextOnly) {
      baseInstructions += `

CONTEXT ONLY MODE:
- ONLY respond based on information found in the provided workspace documents
- If no relevant information is found in the documents, respond with: "I can't find information about that in your workspace. Please try rephrasing your question or ask about something else related to your documents."
- Do NOT use any external knowledge or general information
- Do NOT provide explanations based on your training data
- Only reference information that is explicitly stated in the provided document sections
- Be direct and honest when information is not available`;
    }

    return baseInstructions;
  }

  /**
   * Send a RAG-enhanced message
   * @param {Array} messages - Chat messages
   * @param {number} workspaceId - Workspace ID
   * @param {number} userId - User ID
   * @param {number} fileId - Optional file ID for specific file context
   * @param {string} sessionId - Optional session ID for saving messages
   * @param {string} modelName - Optional model name to use
   * @param {string} chatMode - Chat mode ('focused', 'regular', 'socratic', 'deeper')
   * @param {boolean} contextOnly - Whether to restrict responses to workspace content only
   * @returns {Promise<Object>} Response
   */
  async sendRAGMessage(messages, workspaceId, userId, fileId = null, sessionId = null, modelName = null, chatMode = 'regular', contextOnly = false) {
    try {
      console.log('🚀 [RAG] Starting RAG message processing...');
      console.log(`📋 [RAG] User ID: ${userId}, Workspace ID: ${workspaceId}, File ID: ${fileId || 'N/A'}`);
      console.log(`🎯 [RAG] Chat Mode: ${chatMode}`);
      
      // Use default model if none specified
      const selectedModel = modelName || this.aiProvider.getDefaultModel();
      
      // Validate model
      if (!this.aiProvider.isValidModel(selectedModel)) {
        throw new Error(`Invalid model: ${selectedModel}`);
      }
      
      const lastMessage = messages[messages.length - 1];
      const query = lastMessage.content;
      console.log(`❓ [RAG] User query: "${query}"`);
      console.log(`🤖 [RAG] Using model: ${selectedModel}`);

      // Step 1: Search for relevant chunks with file information
      console.log('🔍 [RAG] Step 1: Searching for relevant chunks...');
      const relevantChunks = await embeddingService.searchSimilarChunksWithFileInfo(
        query, 
        workspaceId, 
        userId, 
        5, // Get top 5 most relevant chunks
        fileId // Pass fileId for file-specific search
      );
      console.log(`✅ [RAG] Step 1 COMPLETED: Found ${relevantChunks.length} relevant chunks`);

      // Step 2: Prepare context from relevant chunks
      console.log('📝 [RAG] Step 2: Preparing context from chunks...');
      let context = '';
      const sourceCitations = [];
      let systemMessage = ''; // Declare systemMessage here

      if (relevantChunks.length > 0) {
        // Build context from relevant chunks
        relevantChunks.forEach((chunk, index) => {
          console.log(`📄 [RAG] Chunk ${index + 1} metadata:`, chunk.metadata);
          console.log(`📄 [RAG] Chunk ${index + 1} page number:`, chunk.metadata?.pageNumber);
          
          const chunkInfo = `[SOURCE ${index + 1}]
File: ${chunk.file?.originalName || chunk.file?.fileName || 'Unknown File'}
Page: ${chunk.metadata?.pageNumber || 'N/A'}
Content: ${chunk.content}

`;
          context += chunkInfo;
          
          // Store source citation info
          sourceCitations.push({
            chunkId: chunk.id,
            fileId: chunk.fileId,
            fileName: chunk.file?.originalName || chunk.file?.fileName || 'Unknown File',
            pageNumber: chunk.metadata?.pageNumber,
            startChar: chunk.metadata?.startChar || 0,
            endChar: chunk.metadata?.endChar || 0,
            similarity: chunk.similarity,
            chunkIndex: index,
            content: chunk.content,
            metadata: chunk.metadata // Include the full metadata for timestamp and type information
          });
        });

        // Prepare system message with context
        const modeInstructions = this.getModeInstructions(chatMode, contextOnly);
        console.log(`🎯 [RAG] Mode Instructions: ${modeInstructions}`);
        console.log(`🎯 [RAG] Mode Instructions length: ${modeInstructions.length}`);
        systemMessage = `You are a helpful AI assistant with access to document content. 

MANDATORY REQUIREMENT: You MUST use source citations for EVERY piece of information you reference from the provided documents. This is NOT optional.

CITATION FORMAT: Use [SOURCE X] where X is the source number (1, 2, 3, etc.)

IMPORTANT: You are currently in ${chatMode.toUpperCase()} mode. Follow these instructions carefully:

${modeInstructions}

Remember: You MUST respond according to the ${chatMode} mode instructions above.

FORMATTING GUIDELINES:
- Use **bold text** to emphasize key concepts, important terms, or main points
- Use numbered lists (1., 2., 3.) for step-by-step explanations
- Use > for important quotes or highlighted information
- Structure your response with clear sections when appropriate
- Maintain consistent paragraph spacing throughout your response

EXAMPLES OF CORRECT INLINE CITATIONS WITH FORMATTING:
- "According to [SOURCE 1], the **main topic** is..."
- "The document states [SOURCE 2] that **this principle** applies to..."
- "Based on [SOURCE 1, 2], we can see that **the key findings** are..."
- "This concept is explained in [SOURCE 3] as **a fundamental approach**..."
- "The research shows [SOURCE 1] that **this method** is effective..."

RESPONSE FORMAT GUIDELINES:
- Use source citations INLINE with the text they reference - place them immediately after the information they support
- Citations should be part of the same sentence, not on separate lines
- If referencing multiple sources for one point, use [SOURCE 1, 2, 3]
- Be conversational and helpful
- Use **bold formatting** to highlight important concepts and key terms
- Structure longer responses with clear sections
- Maintain consistent spacing between paragraphs (4 units of spacing)
- If you're providing information not found in the documents, clearly state that it's based on your general knowledge
- Keep responses concise but comprehensive
- When citing sources, mention the page number if available (e.g., "as mentioned in [SOURCE 1] on page X")
- If a page number is not available, just cite the source without mentioning page numbers

CRITICAL: Every single piece of information from the documents MUST have its citation immediately following it in the same sentence. Do not wait until the end to cite sources. Citations should flow naturally within the text. If you reference ANY information from the documents, you MUST cite it with [SOURCE X]. Citations should be part of the same sentence, not on separate lines.${fileId ? ' You are currently analyzing a specific document, so focus your responses on that document\'s content.' : ''}

Here are the relevant document sections:

${context}`;

        console.log(`🎯 [RAG] Full system message length: ${systemMessage.length}`);
        console.log(`🎯 [RAG] System message preview: ${systemMessage.substring(0, 1000)}...`);
        console.log(`✅ [RAG] Step 2 COMPLETED: Context prepared with ${relevantChunks.length} chunks`);
      } else {
        console.log('⚠️ [RAG] Step 2: No relevant chunks found');
        if (contextOnly) {
          systemMessage = `You are a helpful AI assistant in CONTEXT ONLY mode. Since no relevant document content was found, you must respond with: "I can't find information about that in your workspace. Please try rephrasing your question or ask about something else related to your documents." Do not provide any other information or explanations.`;
        } else {
          systemMessage = `You are a helpful AI assistant. Since no relevant document content was found, please provide a helpful response based on your general knowledge. Be clear that you're not referencing specific documents.`;
        }
      }

      // Step 3: Prepare messages for AI
      console.log('🤖 [RAG] Step 3: Preparing messages for AI...');
      const openaiMessages = [
        { role: 'system', content: systemMessage },
        ...messages
      ];
      console.log(`✅ [RAG] Step 3 COMPLETED: Prepared ${openaiMessages.length} messages`);

      // Step 4: Call AI with selected model
      console.log(`🤖 [RAG] Step 4: Calling AI with model ${selectedModel}...`);
      
      // Get model configuration
      const modelConfig = this.aiProvider.getModelInfo(selectedModel);
      const options = {
        max_tokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        stream: false,
      };

      const response = await this.aiProvider.sendMessage(openaiMessages, selectedModel, options);

      if (!response.success) {
        console.error('❌ [RAG] AI response failed:', response.error);
        throw new Error(response.message || 'Failed to get AI response');
      }

      const aiResponse = response.message;
      console.log(`✅ [RAG] Step 4 COMPLETED: AI response received (${aiResponse.length} characters)`);

      // Step 5: Validate citations in response
      console.log('🔍 [RAG] Step 5: Validating citations in response...');
      const sourcePatterns = [
        /\[SOURCE (\d+)(?:, (\d+))*\]/g,
        /\[source (\d+)(?:, (\d+))*\]/g,
        /SOURCE (\d+)(?:, (\d+))*\b/g,
        /Source (\d+)(?:, (\d+))*\b/g,
      ];
      
      let citationsFound = false;
      let citationCount = 0;
      for (const pattern of sourcePatterns) {
        const matches = [...aiResponse.matchAll(pattern)];
        if (matches.length > 0) {
          console.log('✅ [RAG] Found source citations in response:', matches);
          citationsFound = true;
          citationCount += matches.length;
          break;
        }
      }
      
      if (!citationsFound) {
        console.log('⚠️ [RAG] No source citations found in AI response');
      } else {
        console.log(`📊 [RAG] Found ${citationCount} source citations in response`);
        
        // Check if citations are distributed throughout the response (not just at the end)
        const responseLength = aiResponse.length;
        const lastCitationIndex = Math.max(...Array.from(aiResponse.matchAll(/\[SOURCE \d+\]/g)).map(match => match.index || 0));
        const citationDistribution = (lastCitationIndex / responseLength) * 100;
        
        console.log(`📊 [RAG] Citation distribution: Last citation at ${citationDistribution.toFixed(1)}% of response`);
        
        if (citationDistribution > 80) {
          console.log('⚠️ [RAG] WARNING: Citations appear to be clustered near the end of the response');
        } else {
          console.log('✅ [RAG] Citations appear to be well-distributed throughout the response');
        }
      }

      console.log('🎉 [RAG] ALL STEPS COMPLETED SUCCESSFULLY!');

      console.log('📄 [RAG] Source citations being sent:', sourceCitations.map(c => ({
        chunkIndex: c.chunkIndex,
        fileName: c.fileName,
        pageNumber: c.pageNumber
      })));

      // Save messages to session if sessionId is provided
      if (sessionId) {
        try {
          const { ChatMessage } = await import('../models/index.js');
          
          // Save user message
          await ChatMessage.create({
            sessionId,
            content: lastMessage.content,
            isUser: true,
            userId
          });

          // Save AI response
          await ChatMessage.create({
            sessionId,
            content: aiResponse,
            isUser: false,
            userId
          });

          console.log(`💾 [RAG] Messages saved to session ${sessionId}`);
        } catch (error) {
          console.error('❌ [RAG] Error saving messages to session:', error);
        }
      }

      return {
        success: true,
        message: aiResponse,
        context: {
          sourceCitations,
          relevantChunks: relevantChunks.length
        },
        usage: response.usage,
        model: response.model,
        provider: response.provider
      };

    } catch (error) {
      console.error('❌ [RAG] RAG message processing failed:', error);
      return {
        success: false,
        message: 'Sorry, I encountered an error processing your request. Please try again.',
        error: error.message
      };
    }
  }

  /**
   * Send a RAG-enhanced message across all workspaces
   * @param {Array} messages - Chat messages
   * @param {number} userId - User ID
   * @param {string} modelName - Optional model name to use
   * @returns {Promise<Object>} Response
   */
  async sendRAGMessageAllWorkspaces(messages, userId, modelName = null) {
    try {
      console.log('🚀 [RAG-ALL] Starting RAG message processing for all workspaces...');
      console.log(`📋 [RAG-ALL] User ID: ${userId}`);
      
      // Use default model if none specified
      const selectedModel = modelName || this.aiProvider.getDefaultModel();
      
      // Validate model
      if (!this.aiProvider.isValidModel(selectedModel)) {
        throw new Error(`Invalid model: ${selectedModel}`);
      }
      
      const lastMessage = messages[messages.length - 1];
      const query = lastMessage.content;
      console.log(`❓ [RAG-ALL] User query: "${query}"`);
      console.log(`🤖 [RAG-ALL] Using model: ${selectedModel}`);

      // Step 1: Search for relevant chunks across all workspaces
      console.log('🔍 [RAG-ALL] Step 1: Searching for relevant chunks across all workspaces...');
      const relevantChunks = await embeddingService.searchSimilarChunksAllWorkspaces(
        query, 
        userId, 
        8 // Get top 8 most relevant chunks from all workspaces
      );
      console.log(`✅ [RAG-ALL] Step 1 COMPLETED: Found ${relevantChunks.length} relevant chunks`);

      // Step 2: Prepare context from relevant chunks
      console.log('📝 [RAG-ALL] Step 2: Preparing context from chunks...');
      let context = '';
      const sourceCitations = [];
      let systemMessage = '';
      
      if (relevantChunks.length > 0) {
        context = 'Based on the following relevant information from your documents across all workspaces:\n\n';
        relevantChunks.forEach((chunk, index) => {
          const workspaceName = chunk.workspaceName || 'Unknown Workspace';
          const fileName = chunk.fileName || 'Unknown File';
          context += `${index + 1}. [${workspaceName} - ${fileName}] ${chunk.content}\n\n`;
          console.log(`📄 [RAG-ALL] Chunk ${index + 1} similarity: ${chunk.similarity?.toFixed(4) || 'N/A'} (${workspaceName} - ${fileName})`);
          
          // Store source citation info
          sourceCitations.push({
            chunkId: chunk.id,
            fileId: chunk.fileId,
            fileName: chunk.fileName || 'Unknown File',
            workspaceName: chunk.workspaceName || 'Unknown Workspace',
            pageNumber: chunk.metadata?.pageNumber,
            startChar: chunk.metadata?.startChar || 0,
            endChar: chunk.metadata?.endChar || 0,
            similarity: chunk.similarity,
            chunkIndex: index,
            content: chunk.content,
            metadata: chunk.metadata
          });
        });
        
        systemMessage = `You are a helpful AI assistant that can analyze documents and answer questions about their content across all your workspaces. 

MANDATORY REQUIREMENT: You MUST use source citations for EVERY piece of information you reference from the provided documents. This is NOT optional.

CITATION FORMAT: Use [SOURCE X] where X is the source number (1, 2, 3, etc.)

FORMATTING GUIDELINES:
- Use **bold text** to emphasize key concepts, important terms, or main points
- Use bullet points (• or -) for lists and multiple examples
- Use numbered lists (1., 2., 3.) for step-by-step explanations
- Use > for important quotes or highlighted information
- Structure your response with clear sections when appropriate
- Maintain consistent paragraph spacing throughout your response

EXAMPLES OF CORRECT INLINE CITATIONS WITH FORMATTING:
- "According to [SOURCE 1], the **main topic** is..."
- "The document states [SOURCE 2] that **this principle** applies to..."
- "Based on [SOURCE 1, 2], we can see that **the key findings** are..."
- "This concept is explained in [SOURCE 3] as **a fundamental approach**..."
- "The research shows [SOURCE 1] that **this method** is effective..."

RESPONSE FORMAT GUIDELINES:
- Use source citations INLINE with the text they reference - place them immediately after the information they support
- Citations should be part of the same sentence, not on separate lines
- If referencing multiple sources for one point, use [SOURCE 1, 2, 3]
- Be conversational and helpful
- Use **bold formatting** to highlight important concepts and key terms
- Structure longer responses with clear sections
- Maintain consistent spacing between paragraphs (4 units of spacing)
- If you're providing information not found in the documents, clearly state that it's based on your general knowledge
- Keep responses concise but comprehensive
- When citing sources, mention the workspace and file name if available (e.g., "as mentioned in [SOURCE 1] from [Workspace Name - File Name]")
- If workspace/file information is not available, just cite the source without mentioning specific details

CRITICAL: Every single piece of information from the documents MUST have its citation immediately following it in the same sentence. Do not wait until the end to cite sources. Citations should flow naturally within the text. If you reference ANY information from the documents, you MUST cite it with [SOURCE X]. Citations should be part of the same sentence, not on separate lines.

Here are the relevant document sections:

${context}`;
        console.log(`✅ [RAG-ALL] Step 2 COMPLETED: Context prepared with ${relevantChunks.length} chunks`);
      } else {
        // No relevant documents found - provide general GPT response
        systemMessage = `You are a helpful AI assistant. 

I don't see any documents in your workspaces that are relevant to your question, or you may not have uploaded any documents yet. 

Please provide a helpful, informative response to the user's question based on your general knowledge. Be conversational and helpful. Answer the question directly without mentioning that you don't have access to specific documents unless the question specifically asks about documents or files.`;
        console.log('⚠️ [RAG-ALL] Step 2 COMPLETED: No relevant chunks found, using general GPT mode');
      }

      // Step 3: Prepare messages for AI
      console.log('🤖 [RAG-ALL] Step 3: Preparing messages for AI...');
      const openaiMessages = [
        { role: 'system', content: systemMessage },
        ...messages
      ];
      console.log(`✅ [RAG-ALL] Step 3 COMPLETED: Prepared ${openaiMessages.length} messages`);

      // Step 4: Call AI with selected model
      console.log(`🤖 [RAG-ALL] Step 4: Calling AI with model ${selectedModel}...`);
      
      // Get model configuration
      const modelConfig = this.aiProvider.getModelInfo(selectedModel);
      const options = {
        max_tokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        stream: false,
      };

      const response = await this.aiProvider.sendMessage(openaiMessages, selectedModel, options);

      if (!response.success) {
        console.error('❌ [RAG-ALL] AI response failed:', response.error);
        throw new Error(response.message || 'Failed to get AI response');
      }

      console.log(`✅ [RAG-ALL] Step 4 COMPLETED: AI response received (${response.message.length} characters)`);
      console.log('🎉 [RAG-ALL] ALL STEPS COMPLETED SUCCESSFULLY!');

      return {
        success: true,
        message: response.message,
        usage: response.usage,
        model: response.model,
        provider: response.provider,
        context: {
          chunksUsed: relevantChunks.length,
          similarityScores: relevantChunks.map(chunk => chunk.similarity),
          hasDocuments: relevantChunks.length > 0,
          sourceCitations: sourceCitations
        }
      };

    } catch (error) {
      console.error('❌ [RAG-ALL] Error in sendRAGMessageAllWorkspaces:', error);
      return {
        success: false,
        message: 'Sorry, I encountered an error processing your request. Please try again.',
        error: error.message
      };
    }
  }

  /**
   * Analyze a specific document using RAG
   * @param {number} fileId - File ID
   * @param {string} question - User question
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Response
   */
  async analyzeDocumentWithRAG(fileId, question, userId) {
    try {
      console.log('🚀 [DOC-RAG] Starting document-specific RAG analysis...');
      console.log(`📋 [DOC-RAG] File ID: ${fileId}, User ID: ${userId}`);
      console.log(`❓ [DOC-RAG] Question: "${question}"`);

      // Step 1: Get file info
      console.log('📁 [DOC-RAG] Step 1: Retrieving file information...');
      const file = await File.findOne({
        where: { id: fileId, userId, isActive: true }
      });

      if (!file) {
        console.log('❌ [DOC-RAG] Step 1 FAILED: File not found');
        return {
          success: false,
          message: 'File not found. Please make sure the file exists and belongs to you.'
        };
      }
      console.log(`✅ [DOC-RAG] Step 1 COMPLETED: Found file "${file.originalName}"`);

      // Step 2: Check if file has been processed
      console.log('🔍 [DOC-RAG] Step 2: Checking file processing status...');
      if (file.processingStatus !== 'completed') {
        console.log(`❌ [DOC-RAG] Step 2 FAILED: File processing status is "${file.processingStatus}"`);
        return {
          success: false,
          message: `File "${file.originalName}" is still being processed. Please wait a moment and try again. Current status: ${file.processingStatus}`
        };
      }
      console.log('✅ [DOC-RAG] Step 2 COMPLETED: File processing status is "completed"');

      // Step 3: Get chunks for this specific file
      console.log('📄 [DOC-RAG] Step 3: Retrieving document chunks...');
      const chunks = await Chunk.findAll({
        where: { fileId, userId, isActive: true },
        order: [['chunkIndex', 'ASC']],
        attributes: ['id', 'content', 'chunkIndex', 'metadata']
      });

      if (chunks.length === 0) {
        console.log('❌ [DOC-RAG] Step 3 FAILED: No chunks found for file');
        return {
          success: false,
          message: `No content found for "${file.originalName}". The file may not have been processed yet or may be empty. Please try uploading the file again.`
        };
      }
      console.log(`✅ [DOC-RAG] Step 3 COMPLETED: Found ${chunks.length} chunks for document`);

      // Step 4: Create context from all chunks (since it's document-specific)
      console.log('📝 [DOC-RAG] Step 4: Creating context from document chunks...');
      const context = chunks.map(chunk => chunk.content).join('\n\n');
      console.log(`✅ [DOC-RAG] Step 4 COMPLETED: Context created (${context.length} characters)`);

      // Step 5: Prepare messages for OpenAI
      console.log('💬 [DOC-RAG] Step 5: Preparing messages for OpenAI...');
      const messages = [
        {
          role: 'system',
          content: `You are an AI assistant analyzing the document "${file.originalName}". 

Document content:
${context}

Provide a helpful, accurate response based on the document content. Be specific and reference the document when possible.`
        },
        {
          role: 'user',
          content: question
        }
      ];
      console.log('✅ [DOC-RAG] Step 5 COMPLETED: Messages prepared for OpenAI');

      // Step 6: Call OpenAI API
      console.log('🤖 [DOC-RAG] Step 6: Calling OpenAI GPT API...');
      const response = await this.aiProvider.sendMessage(messages, 'gpt-4o-mini', { max_tokens: 2000, temperature: 0.7, stream: false });
      console.log(`✅ [DOC-RAG] Step 6 COMPLETED: OpenAI API call successful`);
      console.log(`📊 [DOC-RAG] OpenAI Usage - Tokens: ${response.usage?.total_tokens || 'N/A'}, Prompt: ${response.usage?.prompt_tokens || 'N/A'}, Completion: ${response.usage?.completion_tokens || 'N/A'}`);

      console.log('🎉 [DOC-RAG] ALL STEPS COMPLETED SUCCESSFULLY!');

      return {
        success: true,
        message: response.message,
        usage: response.usage,
        context: {
          documentName: file.originalName,
          chunksUsed: chunks.length
        }
      };

    } catch (error) {
      console.error('❌ [DOC-RAG] Document RAG analysis error:', error);
      return {
        success: false,
        message: 'Sorry, I encountered an error analyzing the document. Please try again.',
        error: error.message
      };
    }
  }
}

export default new RAGChatService();
