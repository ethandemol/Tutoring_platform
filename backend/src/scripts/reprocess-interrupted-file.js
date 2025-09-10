import { sequelize } from '../config/database.js';
import { File } from '../models/index.js';
import chunkingService from '../services/chunkingServices.js';

async function reprocessInterruptedFile(fileId) {
  try {
    console.log(`🔄 [REPROCESS] Starting reprocessing for file ID: ${fileId}`);
    
    // Find the file
    const file = await File.findByPk(fileId);
    if (!file) {
      console.log(`❌ [REPROCESS] File ${fileId} not found`);
      return;
    }
    
    console.log(`📄 [REPROCESS] Found file: ${file.originalName}`);
    console.log(`📊 [REPROCESS] Current status: ${file.processingStatus}`);
    
    // Check if file is in a stuck state
    if (file.processingStatus === 'processing') {
      console.log(`⚠️ [REPROCESS] File is stuck in processing status, resetting to pending...`);
      await file.update({
        processingStatus: 'pending',
        metadata: {
          ...file.metadata,
          reprocessedAt: new Date().toISOString(),
          previousProcessingStatus: 'processing'
        }
      });
    }
    
    // Process the file
    console.log(`🚀 [REPROCESS] Starting chunking process...`);
    const result = await chunkingService.processFile(fileId, file.userId, file.workspaceId);
    
    console.log(`✅ [REPROCESS] SUCCESS: File reprocessed successfully!`);
    console.log(`📊 [REPROCESS] Summary: ${result.chunksCreated} chunks, ${result.pages} pages, ${result.tokens} tokens`);
    
  } catch (error) {
    console.error(`❌ [REPROCESS] Failed to reprocess file ${fileId}:`, error.message);
  } finally {
    await sequelize.close();
  }
}

// Get file ID from command line argument
const fileId = process.argv[2];

if (!fileId) {
  console.log('❌ Please provide a file ID as an argument');
  console.log('Usage: node src/scripts/reprocess-interrupted-file.js <fileId>');
  process.exit(1);
}

reprocessInterruptedFile(parseInt(fileId)); 