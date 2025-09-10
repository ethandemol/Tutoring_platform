import { sequelize } from '../config/database.js';
import { File } from '../models/index.js';
import chunkingService from '../services/chunkingServices.js';
import { Op } from 'sequelize';

async function processHandwritingFiles() {
  try {
    console.log('🔄 Processing existing handwriting files for RAG...');
    
    // Find all handwriting files that are marked as completed but may not have RAG processing
    const handwritingFiles = await File.findAll({
      where: { 
        originalName: { [Op.like]: '%Handwriting%' },
        processingStatus: 'completed'
      },
      attributes: ['id', 'originalName', 'userId', 'workspaceId', 'createdAt']
    });
    
    console.log(`📋 Found ${handwritingFiles.length} handwriting files to process for RAG`);
    
    if (handwritingFiles.length === 0) {
      console.log('✅ No handwriting files found that need RAG processing');
      return;
    }
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const file of handwritingFiles) {
      try {
        console.log(`\n🚀 Processing handwriting file ${file.id}: ${file.originalName}`);
        console.log(`📅 Created: ${file.createdAt}`);
        
        // First, update status to pending
        await File.update({
          processingStatus: 'pending'
        }, { where: { id: file.id } });
        
        const result = await chunkingService.processFile(file.id, file.userId, file.workspaceId);
        
        console.log(`✅ Successfully processed handwriting file ${file.id}`);
        console.log(`📊 Result: ${result.chunksCreated} chunks, ${result.totalTokens} tokens`);
        
        successCount++;
        
      } catch (error) {
        console.error(`❌ Failed to process handwriting file ${file.id}: ${error.message}`);
        
        // Update file status to failed
        await File.update({
          processingStatus: 'failed',
          metadata: {
            error: error.message,
            failedAt: new Date().toISOString(),
            retryAttempt: 1
          }
        }, { where: { id: file.id } });
        
        failureCount++;
      }
    }
    
    console.log(`\n🎉 Handwriting file processing completed!`);
    console.log(`✅ Successfully processed: ${successCount} files`);
    console.log(`❌ Failed to process: ${failureCount} files`);
    
  } catch (error) {
    console.error('❌ Error during handwriting file processing:', error);
    process.exit(1);
  }
}

// Run the processing
processHandwritingFiles().then(() => {
  console.log('🎉 Handwriting file processing completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Handwriting file processing failed:', error);
  process.exit(1);
}); 