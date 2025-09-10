import { sequelize } from '../config/database.js';
import { Chunk, File } from '../models/index.js';

async function checkChunkMetadata() {
  try {
    console.log('🔍 [CHECK] Checking chunk metadata...');
    
    // Get a sample of chunks with their metadata
    const chunks = await Chunk.findAll({
      include: [{
        model: File,
        as: 'file',
        attributes: ['id', 'originalName', 'fileName']
      }],
      attributes: ['id', 'content', 'chunkIndex', 'metadata', 'fileId'],
      limit: 10
    });

    console.log(`📊 [CHECK] Found ${chunks.length} sample chunks`);
    
    chunks.forEach((chunk, index) => {
      console.log(`\n📄 [CHECK] Chunk ${index + 1}:`);
      console.log(`   ID: ${chunk.id}`);
      console.log(`   File: ${chunk.file?.originalName || 'Unknown'}`);
      console.log(`   Chunk Index: ${chunk.chunkIndex}`);
      console.log(`   Metadata:`, chunk.metadata);
      console.log(`   Page Number: ${chunk.metadata?.pageNumber || 'N/A'}`);
      console.log(`   Start Char: ${chunk.metadata?.startChar || 'N/A'}`);
      console.log(`   End Char: ${chunk.metadata?.endChar || 'N/A'}`);
    });

    // Check if any chunks are missing page numbers
    const chunksWithoutPageNumbers = chunks.filter(chunk => !chunk.metadata?.pageNumber);
    console.log(`\n⚠️ [CHECK] Chunks without page numbers: ${chunksWithoutPageNumbers.length}/${chunks.length}`);

    if (chunksWithoutPageNumbers.length > 0) {
      console.log('📝 [CHECK] Sample chunks without page numbers:');
      chunksWithoutPageNumbers.slice(0, 3).forEach((chunk, index) => {
        console.log(`   ${index + 1}. Chunk ${chunk.id} (${chunk.file?.originalName || 'Unknown'})`);
      });
    }

    console.log('\n✅ [CHECK] Metadata check completed');
  } catch (error) {
    console.error('❌ [CHECK] Error checking chunk metadata:', error);
  } finally {
    await sequelize.close();
  }
}

checkChunkMetadata(); 