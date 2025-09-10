import { sequelize } from '../config/database.js';
import { Chunk } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Migration script to enhance existing chunks with source tracking metadata
 * This script adds page numbers, character positions, and other metadata to existing chunks
 */
async function enhanceChunkMetadata() {
  try {
    console.log('🚀 Starting chunk metadata enhancement...');

    // Get all chunks that don't have enhanced metadata
    const chunks = await Chunk.findAll({
      where: {
        [Op.or]: [
          { metadata: null },
          { metadata: {} },
          { metadata: { pageNumber: null } }
        ]
      },
      order: [['fileId', 'ASC'], ['chunkIndex', 'ASC']]
    });

    console.log(`📄 Found ${chunks.length} chunks to enhance`);

    let updatedCount = 0;
    let currentFileId = null;
    let currentCharIndex = 0;

    for (const chunk of chunks) {
      try {
        // Reset character index for new files
        if (chunk.fileId !== currentFileId) {
          currentFileId = chunk.fileId;
          currentCharIndex = 0;
        }

        // Calculate character positions
        const contentLength = chunk.content.length;
        const startChar = currentCharIndex;
        const endChar = currentCharIndex + contentLength - 1;

        // Update chunk metadata
        const enhancedMetadata = {
          ...chunk.metadata,
          startChar,
          endChar,
          chunkType: chunk.metadata?.pageNumber ? 'page_aware' : 'regular',
          isPageBoundary: chunk.metadata?.isPageBoundary || false,
          lastUpdated: new Date().toISOString()
        };

        await chunk.update({
          metadata: enhancedMetadata
        });

        currentCharIndex = endChar + 1;
        updatedCount++;

        if (updatedCount % 100 === 0) {
          console.log(`✅ Enhanced ${updatedCount} chunks...`);
        }
      } catch (error) {
        console.error(`❌ Error enhancing chunk ${chunk.id}:`, error);
      }
    }

    console.log(`🎉 Chunk metadata enhancement completed! Updated ${updatedCount} chunks`);
  } catch (error) {
    console.error('❌ Chunk metadata enhancement failed:', error);
    throw error;
  }
}

// Run the migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  enhanceChunkMetadata()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export default enhanceChunkMetadata; 