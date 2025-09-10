import pkg from 'tiktoken';
const { encoding_for_model } = pkg;
import { getFileFromS3 } from '../config/s3.js';
import { Chunk, File } from '../models/index.js';
import embeddingService from './embeddingService.js';
import pymupdfService from './pymupdfService.js';

class ChunkingService {
  constructor() {
    this.chunkSize = 500; // tokens per chunk
    this.chunkOverlap = 100; // tokens overlap between chunks
    this.encoding = null; // Will be initialized when needed
  }

  /**
   * Initialize the tokenizer encoding
   */
  async initializeEncoding() {
    if (!this.encoding) {
      this.encoding = await encoding_for_model('gpt-4');
    }
  }

  /**
   * Process a file for chunking
   * @param {number} fileId - The file ID to process
   * @param {number} userId - The user ID
   * @param {number} workspaceId - The workspace ID
   * @returns {Promise<Object>} Processing result
   */
  async processFile(fileId, userId, workspaceId) {
    let file = null;
    let chunksCreated = 0;
    
    try {
      console.log('🚀 [CHUNK] Starting chunking process...');
      console.log(`📋 [CHUNK] File ID: ${fileId}, User ID: ${userId}, Workspace ID: ${workspaceId}`);

      // Initialize encoding
      await this.initializeEncoding();

      // Step 1: Get file record
      console.log('📁 [CHUNK] Step 1: Retrieving file information...');
      file = await File.findOne({
        where: { id: fileId, userId, isActive: true }
      });

      if (!file) {
        console.log(`❌ [CHUNK] Step 1 FAILED: File ${fileId} not found for user ${userId}`);
        throw new Error('File not found or access denied');
      }
      console.log(`✅ [CHUNK] Step 1 COMPLETED: Found file "${file.originalName}"`);

      // Step 2: Update file status to processing
      console.log('🔄 [CHUNK] Step 2: Updating file status to processing...');
      await file.update({ 
        processingStatus: 'processing',
        metadata: { ...file.metadata, chunkingStarted: new Date().toISOString() }
      });
      console.log('✅ [CHUNK] Step 2 COMPLETED: File status updated to processing');

      // Step 3: Download file from S3
      console.log(`📥 [CHUNK] Step 3: Downloading file from S3: ${file.s3Key}`);
      const fileBuffer = await getFileFromS3(file.s3Key);

      if (!fileBuffer || fileBuffer.length === 0) {
        console.log('❌ [CHUNK] Step 3 FAILED: Failed to download file from S3 or file is empty');
        throw new Error('Failed to download file from S3 or file is empty');
      }
      console.log(`✅ [CHUNK] Step 3 COMPLETED: File downloaded (${fileBuffer.length} bytes)`);

      // Step 4: Extract text from PDF
      console.log('📄 [CHUNK] Step 4: Extracting text from PDF...');
      const textData = await pymupdfService.extractTextFromPDF(fileBuffer);

      if (!textData.text || textData.text.trim().length === 0) {
        console.log('❌ [CHUNK] Step 4 FAILED: No text content found in the PDF');
        throw new Error('No text content found in the PDF. The file may be empty or contain only images.');
      }
      console.log(`✅ [CHUNK] Step 4 COMPLETED: Text extracted (${textData.text.length} characters, ${textData.pages} pages)`);

      // Step 5: Tokenize the text
      console.log(`🔤 [CHUNK] Step 5: Tokenizing text (${textData.text.length} characters)...`);
      const tokens = await this.tokenizeText(textData.text);

      if (tokens.length === 0) {
        console.log('❌ [CHUNK] Step 5 FAILED: No tokens found in the text');
        throw new Error('No tokens found in the text. The document may be empty or unreadable.');
      }
      console.log(`✅ [CHUNK] Step 5 COMPLETED: Text tokenized (${tokens.length} tokens)`);

      // Step 6: Create chunks (with page awareness if available)
      console.log(`✂️ [CHUNK] Step 6: Creating chunks from ${tokens.length} tokens...`);
      console.log(`⚙️ [CHUNK] Chunking config: size=${this.chunkSize}, overlap=${this.chunkOverlap}`);
      
      // Use page-aware chunking if page texts are available
      const chunks = textData.pageTexts ? 
        await this.createChunksWithPageAwareness(tokens, textData.text, textData.pageTexts) :
        await this.createChunks(tokens, textData.text);

      if (chunks.length === 0) {
        console.log('❌ [CHUNK] Step 6 FAILED: Failed to create chunks from the document');
        throw new Error('Failed to create chunks from the document. The content may be too short or unprocessable.');
      }
      console.log(`✅ [CHUNK] Step 6 COMPLETED: Created ${chunks.length} chunks`);

      // Step 7: Store chunks in database
      console.log('💾 [CHUNK] Step 7: Storing chunks in database...');
      chunksCreated = await this.storeChunks(chunks, fileId, userId, workspaceId, textData);
      console.log(`✅ [CHUNK] Step 7 COMPLETED: Stored ${chunksCreated} chunks in database`);

      // Step 8: Generate embeddings for chunks
      console.log('🧠 [CHUNK] Step 8: Generating embeddings for chunks...');
      await embeddingService.processEmbeddingsForFile(fileId, userId);
      console.log('✅ [CHUNK] Step 8 COMPLETED: Embeddings generated');

      // Step 9: Update file status to completed
      console.log('✅ [CHUNK] Step 9: Updating file status to completed...');
      await file.update({ 
        processingStatus: 'completed',
        isProcessed: true,
        metadata: { 
          ...file.metadata, 
          chunkingCompleted: new Date().toISOString(),
          chunksCreated: chunksCreated,
          totalPages: textData.pages,
          totalTokens: tokens.length
        }
      });
      console.log('✅ [CHUNK] Step 9 COMPLETED: File status updated to completed');

      console.log(`🎉 [CHUNK] SUCCESS: File "${file.originalName}" processed successfully!`);
      console.log(`📊 [CHUNK] Summary: ${chunksCreated} chunks created, ${textData.pages} pages, ${tokens.length} tokens`);

      return {
        success: true,
        chunksCreated: chunksCreated,
        pages: textData.pages,
        tokens: tokens.length,
        fileName: file.originalName
      };

    } catch (error) {
      console.error(`❌ [CHUNK] FAILED: Error processing file ${fileId}:`, error.message);
      
      // Cleanup: Update file status to failed and clean up any partial chunks
      if (file) {
        try {
          await file.update({ 
            processingStatus: 'failed',
            metadata: { 
              ...file.metadata, 
              chunkingFailed: new Date().toISOString(),
              error: error.message,
              chunksCreated: chunksCreated
            }
          });
          
          // Clean up any partial chunks that were created
          if (chunksCreated > 0) {
            console.log(`🧹 [CHUNK] Cleaning up ${chunksCreated} partial chunks...`);
            await Chunk.destroy({ where: { fileId } });
            console.log('✅ [CHUNK] Partial chunks cleaned up');
          }
        } catch (cleanupError) {
          console.error('❌ [CHUNK] Failed to cleanup after error:', cleanupError.message);
        }
      }
      
      throw error;
    }
  }

  /**
   * Extract text from PDF buffer using PyMuPDF
   * @param {Buffer} fileBuffer - PDF file buffer
   * @returns {Promise<Object>} Extracted text and metadata
   */
  async extractTextFromPDF(fileBuffer) {
    try {
      console.log('📄 [PDF] Extracting text from PDF buffer using PyMuPDF...');
      
      // Use PyMuPDF for better text extraction
      const pymupdf = await import('pymupdf-node');
      const fitz = pymupdf.fitz || pymupdf.default?.fitz;
      
      if (!fitz) {
        throw new Error('PyMuPDF fitz module not available');
      }
      
      // Load PDF from buffer
      const doc = await fitz.open(fileBuffer);
      const pageCount = doc.pageCount;
      
      let extractedText = '';
      const pageTexts = [];
      
      // Extract text from each page
      for (let pageNum = 0; pageNum < pageCount; pageNum++) {
        const page = await doc.loadPage(pageNum);
        const text = await page.getText();
        pageTexts.push(text);
        extractedText += text + '\n\n'; // Add page breaks
        await page.close();
      }
      
      await doc.close();
      
      // Get PDF metadata
      const metadata = {
        title: doc.metadata?.title || '',
        author: doc.metadata?.author || '',
        subject: doc.metadata?.subject || '',
        creator: doc.metadata?.creator || '',
        producer: doc.metadata?.producer || '',
        creationDate: doc.metadata?.creationDate || '',
        modDate: doc.metadata?.modDate || ''
      };
      
      console.log(`✅ [PDF] PyMuPDF extraction completed: ${extractedText.length} characters, ${pageCount} pages`);
      return {
        text: extractedText,
        pages: pageCount,
        pageTexts: pageTexts, // Individual page texts for better chunking
        info: metadata,
        metadata: {
          ...metadata,
          extractionMethod: 'pymupdf',
          hasImages: false // You can enhance this to detect images
        }
      };
    } catch (error) {
      console.error('❌ [PDF] PyMuPDF extraction failed:', error);
      
      // Fallback to pdf-parse if PyMuPDF fails
      console.log('🔄 [PDF] Falling back to pdf-parse...');
      try {
        const pdfParse = (await import('pdf-parse')).default;
        const data = await pdfParse(fileBuffer);
        
        console.log(`✅ [PDF] Fallback extraction completed: ${data.text.length} characters, ${data.numpages} pages`);
        return {
          text: data.text,
          pages: data.numpages,
          pageTexts: null, // No page-level data with pdf-parse
          info: data.info,
          metadata: {
            ...data.metadata,
            extractionMethod: 'pdf-parse-fallback'
          }
        };
      } catch (fallbackError) {
        console.error('❌ [PDF] Fallback extraction also failed:', fallbackError);
        throw new Error(`Failed to extract text from PDF: ${error.message}`);
      }
    }
  }

  /**
   * Tokenize text using tiktoken
   * @param {string} text - Text to tokenize
   * @returns {Array} Array of token IDs
   */
  async tokenizeText(text) {
    try {
      console.log(`🔤 [TOKEN] Tokenizing text (${text.length} characters)...`);
      const tokens = this.encoding.encode(text);
      console.log(`✅ [TOKEN] Tokenization completed: ${tokens.length} tokens`);
      return tokens;
    } catch (error) {
      console.error('❌ [TOKEN] Tokenization failed:', error);
      throw new Error(`Failed to tokenize text: ${error.message}`);
    }
  }

  /**
   * Create chunks from tokenized text with page boundary awareness
   * @param {Array} tokens - Array of token IDs
   * @param {string} originalText - Original text for context
   * @param {Array} pageTexts - Array of individual page texts (optional)
   * @returns {Array} Array of chunk objects
   */
  async createChunksWithPageAwareness(tokens, originalText, pageTexts = null) {
    console.log(`✂️ [CHUNKS] Creating page-aware chunks from ${tokens.length} tokens...`);
    
    // Ensure encoding is initialized
    await this.initializeEncoding();
    
    const chunks = [];
    let chunkIndex = 0;

    // If we have page texts, try to respect page boundaries
    if (pageTexts && pageTexts.length > 0) {
      console.log(`📄 [CHUNKS] Using page-aware chunking with ${pageTexts.length} pages`);
      
      let currentTokenIndex = 0;
      let currentCharIndex = 0;
      
      for (let pageNum = 0; pageNum < pageTexts.length; pageNum++) {
        const pageText = pageTexts[pageNum];
        const pageTokens = this.encoding.encode(pageText);
        
        // If page is smaller than chunk size, keep it as one chunk
        if (pageTokens.length <= this.chunkSize) {
          const chunkText = this.tokensToText(pageTokens, pageText, 0);
          chunks.push({
            chunkIndex,
            content: chunkText,
            tokenCount: pageTokens.length,
            startToken: currentTokenIndex,
            endToken: currentTokenIndex + pageTokens.length - 1,
            metadata: {
              pageNumber: pageNum + 1,
              startChar: currentCharIndex,
              endChar: currentCharIndex + chunkText.length - 1,
              isPageBoundary: true,
              pageTokens: pageTokens.length,
              chunkType: 'page_complete'
            }
          });
          currentTokenIndex += pageTokens.length;
          currentCharIndex += chunkText.length;
          chunkIndex++;
        } else {
          // Page is larger than chunk size, split it
          let pageTokenIndex = 0;
          while (pageTokenIndex < pageTokens.length) {
            const chunkTokens = pageTokens.slice(pageTokenIndex, pageTokenIndex + this.chunkSize);
            const chunkText = this.tokensToText(chunkTokens, pageText, pageTokenIndex);
            
            chunks.push({
              chunkIndex,
              content: chunkText,
              tokenCount: chunkTokens.length,
              startToken: currentTokenIndex + pageTokenIndex,
              endToken: currentTokenIndex + pageTokenIndex + chunkTokens.length - 1,
              metadata: {
                pageNumber: pageNum + 1,
                startChar: currentCharIndex,
                endChar: currentCharIndex + chunkText.length - 1,
                isPageBoundary: pageTokenIndex === 0,
                pageTokens: chunkTokens.length,
                chunkType: 'page_partial',
                pageTokenOffset: pageTokenIndex
              }
            });
            
            pageTokenIndex += this.chunkSize - this.chunkOverlap;
            currentCharIndex += chunkText.length;
            chunkIndex++;
          }
          currentTokenIndex += pageTokens.length;
        }
      }
    } else {
      // Fallback to regular chunking without page awareness
      console.log(`📄 [CHUNKS] Using regular chunking (no page data available)`);
      chunks.push(...await this.createChunks(tokens, originalText));
    }

    console.log(`✅ [CHUNKS] Created ${chunks.length} chunks with source tracking`);
    chunks.forEach((chunk, index) => {
      console.log(`📄 [CHUNKS] Chunk ${index + 1}: ${chunk.tokenCount} tokens, ${chunk.content.length} chars, page: ${chunk.metadata?.pageNumber || 'N/A'}`);
    });

    return chunks;
  }

  /**
   * Create chunks from tokenized text
   * @param {Array} tokens - Array of token IDs
   * @param {string} originalText - Original text for context
   * @returns {Array} Array of chunk objects
   */
  async createChunks(tokens, originalText) {
    console.log(`✂️ [CHUNKS] Creating regular chunks from ${tokens.length} tokens...`);
    
    const chunks = [];
    let chunkIndex = 0;
    let currentCharIndex = 0;

    for (let i = 0; i < tokens.length; i += this.chunkSize - this.chunkOverlap) {
      const chunkTokens = tokens.slice(i, i + this.chunkSize);
      const chunkText = this.tokensToText(chunkTokens, originalText, i);
      
      chunks.push({
        chunkIndex,
        content: chunkText,
        tokenCount: chunkTokens.length,
        startToken: i,
        endToken: i + chunkTokens.length - 1,
        metadata: {
          startChar: currentCharIndex,
          endChar: currentCharIndex + chunkText.length - 1,
          chunkType: 'regular',
          isPageBoundary: false
        }
      });

      currentCharIndex += chunkText.length;
      chunkIndex++;
    }

    console.log(`✅ [CHUNKS] Created ${chunks.length} regular chunks`);
    return chunks;
  }

  /**
   * Create chunks from text content (for URL processing)
   * @param {string} text - Text content to chunk
   * @param {string} fileId - File ID for metadata
   * @returns {Array} Array of chunk objects
   */
  async createChunksFromText(text, fileId) {
    console.log(`✂️ [CHUNKS] Creating chunks from text (${text.length} characters)...`);
    
    // Ensure encoding is initialized
    await this.initializeEncoding();
    
    // Tokenize the text first
    const tokens = await this.tokenizeText(text);
    console.log(`🔤 [CHUNKS] Text tokenized into ${tokens.length} tokens`);
    
    const chunks = [];
    let chunkIndex = 0;

    for (let i = 0; i < tokens.length; i += this.chunkSize - this.chunkOverlap) {
      const chunkTokens = tokens.slice(i, i + this.chunkSize);
      
      // Convert tokens back to text for the chunk
      const chunkText = this.tokensToText(chunkTokens, text, i);
      
      chunks.push({
        chunkIndex,
        content: chunkText,
        tokenCount: chunkTokens.length,
        startToken: i,
        endToken: Math.min(i + this.chunkSize - 1, tokens.length - 1),
        metadata: {
          chunkNumber: chunkIndex + 1,
          isLastChunk: i + this.chunkSize >= tokens.length,
          sourceType: 'url_content',
          fileId: fileId
        }
      });

      chunkIndex++;
    }

    console.log(`✅ [CHUNKS] Created ${chunks.length} chunks from text`);
    chunks.forEach((chunk, index) => {
      console.log(`📄 [CHUNKS] Chunk ${index + 1}: ${chunk.tokenCount} tokens, ${chunk.content.length} characters`);
    });

    return chunks;
  }

  /**
   * Create chunks from YouTube transcript with timestamp information
   * @param {string} text - Transcript text content to chunk
   * @param {string} fileId - File ID for metadata
   * @param {Array} transcriptData - Original transcript data with timestamps
   * @returns {Array} Array of chunk objects with timestamp metadata
   */
  async createChunksFromYouTubeTranscript(text, fileId, transcriptData) {
    console.log(`✂️ [CHUNKS] Creating chunks from YouTube transcript (${text.length} characters)...`);
    
    // Ensure encoding is initialized
    await this.initializeEncoding();
    
    // Tokenize the text first
    const tokens = await this.tokenizeText(text);
    console.log(`🔤 [CHUNKS] YouTube transcript tokenized into ${tokens.length} tokens`);
    
    const chunks = [];
    let chunkIndex = 0;

    for (let i = 0; i < tokens.length; i += this.chunkSize - this.chunkOverlap) {
      const chunkTokens = tokens.slice(i, i + this.chunkSize);
      
      // Convert tokens back to text for the chunk
      const chunkText = this.tokensToText(chunkTokens, text, i);
      
      // Find the approximate timestamp for this chunk
      const timestamp = this.findTimestampForChunk(chunkText, transcriptData);
      
      chunks.push({
        chunkIndex,
        content: chunkText,
        tokenCount: chunkTokens.length,
        startToken: i,
        endToken: Math.min(i + this.chunkSize - 1, tokens.length - 1),
        metadata: {
          chunkNumber: chunkIndex + 1,
          isLastChunk: i + this.chunkSize >= tokens.length,
          sourceType: 'youtube_transcript',
          fileId: fileId,
          timestamp: timestamp, // Add timestamp to metadata
          hasTimestamp: !!timestamp,
          type: 'youtube' // Add type for frontend identification
        }
      });

      chunkIndex++;
    }

    console.log(`✅ [CHUNKS] Created ${chunks.length} chunks from YouTube transcript`);
    chunks.forEach((chunk, index) => {
      console.log(`📄 [CHUNKS] Chunk ${index + 1}: ${chunk.tokenCount} tokens, ${chunk.content.length} characters, timestamp: ${chunk.metadata.timestamp || 'N/A'}`);
    });

    return chunks;
  }

  /**
   * Find the approximate timestamp for a chunk based on text content
   * @param {string} chunkText - The chunk text content
   * @param {Array} transcriptData - Original transcript data with timestamps
   * @returns {number|null} Timestamp in seconds, or null if not found
   */
  findTimestampForChunk(chunkText, transcriptData) {
    try {
      if (!transcriptData || !transcriptData.snippets || transcriptData.snippets.length === 0) {
        return null;
      }

      // Clean the chunk text for better matching
      const cleanChunkText = chunkText.toLowerCase().replace(/\s+/g, ' ').trim();
      
      // Find the best matching snippet
      let bestMatch = null;
      let bestScore = 0;

      for (const snippet of transcriptData.snippets) {
        const cleanSnippetText = snippet.text.toLowerCase().replace(/\s+/g, ' ').trim();
        
        // Calculate word overlap score
        const chunkWords = new Set(cleanChunkText.split(' '));
        const snippetWords = new Set(cleanSnippetText.split(' '));
        
        const intersection = new Set([...chunkWords].filter(x => snippetWords.has(x)));
        const union = new Set([...chunkWords, ...snippetWords]);
        
        const score = intersection.size / union.size;
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = snippet;
        }
      }

      // Return timestamp if we found a good match (score > 0.1)
      if (bestMatch && bestScore > 0.1) {
        return bestMatch.start;
      }

      return null;
    } catch (error) {
      console.warn('Error finding timestamp for chunk:', error.message);
      return null;
    }
  }

  /**
   * Convert tokens back to text (approximate)
   * @param {Array} chunkTokens - Tokens for this chunk
   * @param {string} originalText - Original text
   * @param {number} startTokenIndex - Starting token index
   * @returns {string} Text content for the chunk
   */
  tokensToText(chunkTokens, originalText, startTokenIndex) {
    try {
      // Ensure encoding is available
      if (!this.encoding) {
        throw new Error('Encoding not initialized');
      }
      
      // This is a simplified approach - in production you might want more sophisticated text reconstruction
      const decodedBytes = this.encoding.decode(chunkTokens);
      // Convert Uint8Array to string
      const chunkText = new TextDecoder().decode(decodedBytes);
      return chunkText;
    } catch (error) {
      console.warn('Failed to decode tokens to text, using fallback method:', error.message);
      // Fallback: estimate text position based on token count
      try {
        if (!this.encoding) {
          throw new Error('Encoding not available for fallback');
        }
        const avgCharsPerToken = originalText.length / this.encoding.encode(originalText).length;
        const startChar = Math.floor(startTokenIndex * avgCharsPerToken);
        const endChar = Math.min(startChar + (chunkTokens.length * avgCharsPerToken), originalText.length);
        return originalText.substring(startChar, endChar);
      } catch (fallbackError) {
        console.warn('Fallback method also failed, using simple text splitting');
        // Last resort: simple text splitting
        const totalTokens = this.encoding ? this.encoding.encode(originalText).length : originalText.length;
        const tokensPerChunk = Math.ceil(totalTokens / Math.ceil(totalTokens / this.chunkSize));
        const startChar = Math.floor((startTokenIndex / tokensPerChunk) * originalText.length);
        const endChar = Math.min(startChar + (originalText.length / Math.ceil(totalTokens / this.chunkSize)), originalText.length);
        return originalText.substring(startChar, endChar);
      }
    }
  }

  /**
   * Store chunks in database
   * @param {Array} chunks - Array of chunk objects
   * @param {number} fileId - File ID
   * @param {number} userId - User ID
   * @param {number} workspaceId - Workspace ID
   * @param {Object} textData - Text extraction metadata
   * @returns {number} Number of chunks created
   */
  async storeChunks(chunks, fileId, userId, workspaceId, textData) {
    try {
      console.log(`💾 [STORE] Starting to store ${chunks.length} chunks in database...`);
      
      // Delete existing chunks for this file (in case of reprocessing)
      console.log('🗑️ [STORE] Deleting existing chunks for this file...');
      await Chunk.destroy({
        where: { fileId, isActive: true }
      });
      console.log('✅ [STORE] Existing chunks deleted');

      // Create new chunks
      console.log('📝 [STORE] Preparing chunk records for database...');
      const chunkRecords = chunks.map(chunk => ({
        fileId,
        workspaceId,
        userId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        startToken: chunk.startToken,
        endToken: chunk.endToken,
        metadata: {
          ...chunk.metadata,
          extractionInfo: {
            totalPages: textData.pages,
            extractionMethod: 'pymupdf' // Updated to reflect PyMuPDF
          }
        },
        isEmbedded: false,
        isActive: true
      }));
      console.log(`✅ [STORE] Prepared ${chunkRecords.length} chunk records`);

      console.log('💾 [STORE] Bulk creating chunks in database...');
      await Chunk.bulkCreate(chunkRecords);
      console.log(`✅ [STORE] Successfully stored ${chunks.length} chunks in database`);

      return chunks.length;
    } catch (error) {
      console.error('❌ [STORE] Failed to store chunks:', error);
      throw new Error(`Failed to store chunks in database: ${error.message}`);
    }
  }

  /**
   * Get chunks for a file
   * @param {number} fileId - File ID
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of chunks
   */
  async getChunksForFile(fileId, userId) {
    try {
      const chunks = await Chunk.findAll({
        where: { fileId, userId, isActive: true },
        order: [['chunkIndex', 'ASC']],
        attributes: ['id', 'chunkIndex', 'content', 'tokenCount', 'metadata', 'isEmbedded']
      });

      return chunks;
    } catch (error) {
      console.error('Failed to get chunks:', error);
      throw new Error(`Failed to get chunks: ${error.message}`);
    }
  }

  /**
   * Get chunks for a workspace
   * @param {number} workspaceId - Workspace ID
   * @param {number} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of chunks
   */
  async getChunksForWorkspace(workspaceId, userId, options = {}) {
    try {
      const { limit = 100, offset = 0, fileId } = options;
      
      const whereClause = {
        workspaceId,
        userId,
        isActive: true
      };

      if (fileId) {
        whereClause.fileId = fileId;
      }

      const chunks = await Chunk.findAll({
        where: whereClause,
        order: [['fileId', 'ASC'], ['chunkIndex', 'ASC']],
        limit,
        offset,
        attributes: ['id', 'fileId', 'chunkIndex', 'content', 'tokenCount', 'metadata', 'isEmbedded']
      });

      return chunks;
    } catch (error) {
      console.error('Failed to get workspace chunks:', error);
      throw new Error(`Failed to get workspace chunks: ${error.message}`);
    }
  }

  /**
   * Delete chunks for a file
   * @param {number} fileId - File ID
   * @param {number} userId - User ID
   */
  async deleteChunksForFile(fileId, userId) {
    try {
      await Chunk.update(
        { isActive: false },
        { where: { fileId, userId } }
      );
      console.log(`✅ Deleted chunks for file ${fileId}`);
    } catch (error) {
      console.error('Failed to delete chunks:', error);
      throw new Error(`Failed to delete chunks: ${error.message}`);
    }
  }
}

export default new ChunkingService();
