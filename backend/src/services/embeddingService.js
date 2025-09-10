import openai from '../config/openai.js';
import { Chunk, File, Workspace } from '../models/index.js';

class EmbeddingService {
  constructor() {
    this.openai = openai;
    this.model = 'text-embedding-3-small'; // OpenAI's latest embedding model
    this.dimensions = 1536; // Dimensions for text-embedding-3-small
  }

  /**
   * Generate embeddings for a chunk
   * @param {string} text - Text content to embed
   * @returns {Promise<Array>} Embedding vector
   */
  async generateEmbedding(text) {
    try {
      console.log(`🔤 [EMBED] Generating embedding for text (${text.length} characters)...`);
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text,
      });
      console.log(`✅ [EMBED] Embedding generated successfully (${response.data[0].embedding.length} dimensions)`);
      return response.data[0].embedding;
    } catch (error) {
      console.error('❌ [EMBED] Embedding generation failed:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Generate and store embeddings for all chunks of a file
   * @param {number} fileId
   * @param {number} userId
   */
  async processEmbeddingsForFile(fileId, userId) {
    console.log(`🚀 [EMBED] Starting embedding processing for file ${fileId}...`);
    const chunks = await Chunk.findAll({
      where: { fileId, userId, isActive: true },
    });
    console.log(`📄 [EMBED] Found ${chunks.length} chunks to process`);
    
    let processedCount = 0;
    for (const chunk of chunks) {
      if (!chunk.embedding) {
        console.log(`🔤 [EMBED] Processing chunk ${chunk.chunkIndex + 1}/${chunks.length}...`);
        const embedding = await this.generateEmbedding(chunk.content);
        await chunk.update({ embedding: JSON.stringify(embedding) });
        processedCount++;
        console.log(`✅ [EMBED] Chunk ${chunk.chunkIndex + 1} processed successfully`);
      } else {
        console.log(`⏭️ [EMBED] Chunk ${chunk.chunkIndex + 1} already has embedding, skipping`);
      }
    }
    console.log(`🎉 [EMBED] Embedding processing completed: ${processedCount} chunks processed`);
  }

  /**
   * Search for similar chunks using cosine similarity
   * @param {string} query - User query
   * @param {number} workspaceId
   * @param {number} userId
   * @param {number} topK - Number of top results
   * @param {number} fileId - Optional file ID for file-specific search
   * @returns {Promise<Array>} Top K most similar chunks
   */
  async searchSimilarChunks(query, workspaceId, userId, topK = 5, fileId = null) {
    try {
      console.log(`🔍 [SIMILARITY] Starting similarity search for query: "${query}"`);
      console.log(`📋 [SIMILARITY] Workspace: ${workspaceId}, User: ${userId}, Top K: ${topK}`);

      // Step 1: Get all chunks with embeddings in this workspace (and file if specified)
      console.log('📄 [SIMILARITY] Step 1: Retrieving chunks from database...');
      const whereClause = { workspaceId, userId, isActive: true };
      if (fileId) {
        whereClause.fileId = fileId;
        console.log(`📁 [SIMILARITY] Filtering by file ID: ${fileId}`);
      }
      
      const chunks = await Chunk.findAll({
        where: whereClause,
        attributes: ['id', 'content', 'embedding', 'chunkIndex', 'metadata'],
      });

      // If no chunks exist, return empty array
      if (chunks.length === 0) {
        console.log(`❌ [SIMILARITY] Step 1 FAILED: No chunks found for workspace ${workspaceId} and user ${userId}`);
        return [];
      }
      console.log(`✅ [SIMILARITY] Step 1 COMPLETED: Found ${chunks.length} total chunks`);

      // Step 2: Filter chunks that have embeddings
      console.log('🔍 [SIMILARITY] Step 2: Filtering chunks with embeddings...');
      const chunksWithEmbeddings = chunks.filter(chunk => chunk.embedding);
      
      if (chunksWithEmbeddings.length === 0) {
        console.log(`❌ [SIMILARITY] Step 2 FAILED: No chunks with embeddings found for workspace ${workspaceId} and user ${userId}`);
        return [];
      }
      console.log(`✅ [SIMILARITY] Step 2 COMPLETED: Found ${chunksWithEmbeddings.length} chunks with embeddings`);

      // Step 3: Generate embedding for the query
      console.log('🔤 [SIMILARITY] Step 3: Generating embedding for user query...');
      const queryEmbedding = await this.generateEmbedding(query);
      console.log(`✅ [SIMILARITY] Step 3 COMPLETED: Query embedding generated (${queryEmbedding.length} dimensions)`);

      // Step 4: Compute similarity scores
      console.log('🧮 [SIMILARITY] Step 4: Computing similarity scores...');
      const scoredChunks = chunksWithEmbeddings.map(chunk => {
        const embedding = JSON.parse(chunk.embedding);
        const similarity = this.cosineSimilarity(queryEmbedding, embedding);
        console.log(`📊 [SIMILARITY] Chunk ${chunk.chunkIndex} similarity: ${similarity.toFixed(4)}`);
        return { ...chunk.toJSON(), similarity };
      });
      console.log(`✅ [SIMILARITY] Step 4 COMPLETED: Computed similarity for ${scoredChunks.length} chunks`);
      
      // Step 5: Sort by similarity, descending
      console.log('📊 [SIMILARITY] Step 5: Sorting chunks by similarity...');
      scoredChunks.sort((a, b) => b.similarity - a.similarity);
      const topResults = scoredChunks.slice(0, topK);
      console.log(`✅ [SIMILARITY] Step 5 COMPLETED: Top ${topResults.length} results selected`);
      
      // Log top results
      topResults.forEach((chunk, index) => {
        console.log(`🏆 [SIMILARITY] Top ${index + 1}: Chunk ${chunk.chunkIndex} (similarity: ${chunk.similarity.toFixed(4)})`);
      });

      console.log('🎉 [SIMILARITY] ALL STEPS COMPLETED SUCCESSFULLY!');
      return topResults;
    } catch (error) {
      console.error('❌ [SIMILARITY] Error searching similar chunks:', error);
      return [];
    }
  }

  /**
   * Search for similar chunks across all workspaces and files
   * @param {string} query - User query
   * @param {number} userId - User ID
   * @param {number} topK - Number of top results
   * @returns {Promise<Array>} Top K most similar chunks with workspace and file info
   */
  async searchSimilarChunksAllWorkspaces(query, userId, topK = 8) {
    try {
      console.log(`🔍 [SIMILARITY-ALL] Starting similarity search across all workspaces for query: "${query}"`);
      console.log(`📋 [SIMILARITY-ALL] User: ${userId}, Top K: ${topK}`);

      // Step 1: Get all chunks with embeddings across all workspaces
      console.log('📄 [SIMILARITY-ALL] Step 1: Retrieving chunks from all workspaces...');
      const chunks = await Chunk.findAll({
        where: { userId, isActive: true },
        include: [
          {
            model: File,
            as: 'file',
            attributes: ['originalName', 'workspaceId'],
            where: { isActive: true },
            include: [
              {
                model: Workspace,
                as: 'workspace',
                attributes: ['name']
              }
            ]
          }
        ],
        attributes: ['id', 'content', 'embedding', 'chunkIndex', 'metadata', 'fileId'],
      });

      // If no chunks exist, return empty array
      if (chunks.length === 0) {
        console.log(`❌ [SIMILARITY-ALL] Step 1 FAILED: No chunks found for user ${userId}`);
        return [];
      }
      console.log(`✅ [SIMILARITY-ALL] Step 1 COMPLETED: Found ${chunks.length} total chunks`);

      // Step 2: Filter chunks that have embeddings
      console.log('🔍 [SIMILARITY-ALL] Step 2: Filtering chunks with embeddings...');
      const chunksWithEmbeddings = chunks.filter(chunk => chunk.embedding);
      
      if (chunksWithEmbeddings.length === 0) {
        console.log(`❌ [SIMILARITY-ALL] Step 2 FAILED: No chunks with embeddings found for user ${userId}`);
        return [];
      }
      console.log(`✅ [SIMILARITY-ALL] Step 2 COMPLETED: Found ${chunksWithEmbeddings.length} chunks with embeddings`);

      // Step 3: Generate embedding for the query
      console.log('🔤 [SIMILARITY-ALL] Step 3: Generating embedding for user query...');
      const queryEmbedding = await this.generateEmbedding(query);
      console.log(`✅ [SIMILARITY-ALL] Step 3 COMPLETED: Query embedding generated (${queryEmbedding.length} dimensions)`);

      // Step 4: Compute similarity scores
      console.log('🧮 [SIMILARITY-ALL] Step 4: Computing similarity scores...');
      const scoredChunks = chunksWithEmbeddings.map(chunk => {
        const embedding = JSON.parse(chunk.embedding);
        const similarity = this.cosineSimilarity(queryEmbedding, embedding);
        console.log(`📊 [SIMILARITY-ALL] Chunk ${chunk.chunkIndex} similarity: ${similarity.toFixed(4)}`);
        return { 
          ...chunk.toJSON(), 
          similarity,
          workspaceName: chunk.file?.workspace?.name || 'Unknown Workspace',
          fileName: chunk.file?.originalName || 'Unknown File'
        };
      });
      console.log(`✅ [SIMILARITY-ALL] Step 4 COMPLETED: Computed similarity for ${scoredChunks.length} chunks`);
      
      // Step 5: Sort by similarity, descending
      console.log('📊 [SIMILARITY-ALL] Step 5: Sorting chunks by similarity...');
      scoredChunks.sort((a, b) => b.similarity - a.similarity);
      const topResults = scoredChunks.slice(0, topK);
      console.log(`✅ [SIMILARITY-ALL] Step 5 COMPLETED: Top ${topResults.length} results selected`);
      
      // Log top results
      topResults.forEach((chunk, index) => {
        console.log(`🏆 [SIMILARITY-ALL] Top ${index + 1}: Chunk ${chunk.chunkIndex} (similarity: ${chunk.similarity.toFixed(4)}) - ${chunk.workspaceName} - ${chunk.fileName}`);
      });

      console.log('🎉 [SIMILARITY-ALL] ALL STEPS COMPLETED SUCCESSFULLY!');
      return topResults;
    } catch (error) {
      console.error('❌ [SIMILARITY-ALL] Error searching similar chunks across all workspaces:', error);
      return [];
    }
  }

  /**
   * Search for similar chunks using cosine similarity with file information
   * @param {string} query - User query
   * @param {number} workspaceId
   * @param {number} userId
   * @param {number} topK - Number of top results
   * @param {number} fileId - Optional file ID for file-specific search
   * @returns {Promise<Array>} Top K most similar chunks with file info
   */
  async searchSimilarChunksWithFileInfo(query, workspaceId, userId, topK = 5, fileId = null) {
    try {
      console.log(`🔍 [SIMILARITY] Starting similarity search with file info for query: "${query}"`);
      console.log(`📋 [SIMILARITY] Workspace: ${workspaceId}, User: ${userId}, Top K: ${topK}`);

      // Step 1: Get all chunks with embeddings in this workspace (and file if specified)
      console.log('📄 [SIMILARITY] Step 1: Retrieving chunks from database...');
      const whereClause = { workspaceId, userId, isActive: true };
      if (fileId) {
        whereClause.fileId = fileId;
        console.log(`📁 [SIMILARITY] Filtering by file ID: ${fileId}`);
      }
      
      const chunks = await Chunk.findAll({
        where: whereClause,
        include: [{
          model: File,
          as: 'file',
          attributes: ['id', 'originalName', 'fileName']
        }],
        attributes: ['id', 'content', 'embedding', 'chunkIndex', 'metadata', 'fileId'],
      });

      // If no chunks exist, return empty array
      if (chunks.length === 0) {
        console.log(`❌ [SIMILARITY] Step 1 FAILED: No chunks found for workspace ${workspaceId} and user ${userId}`);
        return [];
      }
      console.log(`✅ [SIMILARITY] Step 1 COMPLETED: Found ${chunks.length} total chunks`);

      // Step 2: Filter chunks that have embeddings
      console.log('🔍 [SIMILARITY] Step 2: Filtering chunks with embeddings...');
      const chunksWithEmbeddings = chunks.filter(chunk => chunk.embedding);
      
      if (chunksWithEmbeddings.length === 0) {
        console.log(`❌ [SIMILARITY] Step 2 FAILED: No chunks with embeddings found`);
        return [];
      }
      console.log(`✅ [SIMILARITY] Step 2 COMPLETED: Found ${chunksWithEmbeddings.length} chunks with embeddings`);

      // Step 3: Generate embedding for the query
      console.log('🔤 [SIMILARITY] Step 3: Generating embedding for user query...');
      const queryEmbedding = await this.generateEmbedding(query);
      console.log(`✅ [SIMILARITY] Step 3 COMPLETED: Query embedding generated (${queryEmbedding.length} dimensions)`);

      // Step 4: Compute similarity scores
      console.log('🧮 [SIMILARITY] Step 4: Computing similarity scores...');
      const scoredChunks = chunksWithEmbeddings.map(chunk => {
        const embedding = JSON.parse(chunk.embedding);
        const similarity = this.cosineSimilarity(queryEmbedding, embedding);
        console.log(`📊 [SIMILARITY] Chunk ${chunk.chunkIndex} similarity: ${similarity.toFixed(4)}`);
        return { ...chunk.toJSON(), similarity };
      });
      console.log(`✅ [SIMILARITY] Step 4 COMPLETED: Computed similarity for ${scoredChunks.length} chunks`);
      
      // Step 5: Sort by similarity, descending
      console.log('📊 [SIMILARITY] Step 5: Sorting chunks by similarity...');
      scoredChunks.sort((a, b) => b.similarity - a.similarity);
      const topResults = scoredChunks.slice(0, topK);
      console.log(`✅ [SIMILARITY] Step 5 COMPLETED: Top ${topResults.length} results selected`);
      
      // Log top results
      topResults.forEach((chunk, index) => {
        console.log(`🏆 [SIMILARITY] Top ${index + 1}: Chunk ${chunk.chunkIndex} (similarity: ${chunk.similarity.toFixed(4)}) - ${chunk.file?.originalName || 'Unknown File'}`);
      });

      return topResults;
    } catch (error) {
      console.error('❌ [SIMILARITY] Similarity search with file info failed:', error);
      throw new Error(`Failed to search similar chunks: ${error.message}`);
    }
  }

  /**
   * Compute cosine similarity between two vectors
   * @param {Array} a
   * @param {Array} b
   * @returns {number}
   */
  cosineSimilarity(a, b) {
    const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
    const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
    return dot / (normA * normB);
  }
}

export default new EmbeddingService(); 