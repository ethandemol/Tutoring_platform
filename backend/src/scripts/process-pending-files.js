import { sequelize } from '../config/database.js';
import { File } from '../models/index.js';
import chunkingService from '../services/chunkingServices.js';

async function processPendingFiles() {
  try {
    console.log('🔄 Processing all pending files...');
    
    // Find all pending files
    const pendingFiles = await File.findAll({
      where: { processingStatus: 'pending' },
      attributes: ['id', 'originalName', 'userId', 'workspaceId', 'createdAt']
    });
    
    console.log(`📋 Found ${pendingFiles.length} pending files to process`);
    
    if (pendingFiles.length === 0) {
      console.log('✅ No pending files found');
      return;
    }
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const file of pendingFiles) {
      try {
        console.log(`\n🚀 Processing file ${file.id}: ${file.originalName}`);
        console.log(`📅 Created: ${file.createdAt}`);
        
        const result = await chunkingService.processFile(file.id, file.userId, file.workspaceId);
        
        console.log(`✅ Successfully processed file ${file.id}`);
        console.log(`📊 Result: ${result.chunksCreated} chunks, ${result.totalTokens} tokens`);
        
        successCount++;
        
      } catch (error) {
        console.error(`❌ Failed to process file ${file.id}: ${error.message}`);
        
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
    
    console.log(`\n🎉 Processing completed!`);
    console.log(`✅ Successfully processed: ${successCount} files`);
    console.log(`❌ Failed to process: ${failureCount} files`);
    
  } catch (error) {
    console.error('❌ Error during batch processing:', error);
    process.exit(1);
  }
}

// Run the processing
processPendingFiles().then(() => {
  console.log('🎉 Batch processing completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Batch processing failed:', error);
  process.exit(1);
}); 