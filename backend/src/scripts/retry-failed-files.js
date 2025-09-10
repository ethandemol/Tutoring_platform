import { sequelize } from '../config/database.js';
import { File } from '../models/index.js';
import chunkingService from '../services/chunkingServices.js';

async function retryFailedFiles() {
  try {
    console.log('🔄 Retrying failed files...');
    
    // Find all failed files
    const failedFiles = await File.findAll({
      where: { processingStatus: 'failed' },
      attributes: ['id', 'originalName', 'userId', 'workspaceId', 'createdAt', 'metadata']
    });
    
    console.log(`📋 Found ${failedFiles.length} failed files to retry`);
    
    if (failedFiles.length === 0) {
      console.log('✅ No failed files found');
      return;
    }
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const file of failedFiles) {
      try {
        console.log(`\n🚀 Retrying file ${file.id}: ${file.originalName}`);
        console.log(`📅 Created: ${file.createdAt}`);
        console.log(`❌ Previous error: ${file.metadata?.error || 'Unknown error'}`);
        
        // Reset status to pending
        await File.update({
          processingStatus: 'pending',
          metadata: {
            ...file.metadata,
            retryAttempt: (file.metadata?.retryAttempt || 0) + 1,
            lastRetryAt: new Date().toISOString()
          }
        }, { where: { id: file.id } });
        
        const result = await chunkingService.processFile(file.id, file.userId, file.workspaceId);
        
        console.log(`✅ Successfully processed file ${file.id}`);
        console.log(`📊 Result: ${result.chunksCreated} chunks, ${result.totalTokens} tokens`);
        
        successCount++;
        
      } catch (error) {
        console.error(`❌ Failed to process file ${file.id}: ${error.message}`);
        
        // Update file status to failed again
        await File.update({
          processingStatus: 'failed',
          metadata: {
            ...file.metadata,
            error: error.message,
            failedAt: new Date().toISOString(),
            retryAttempt: (file.metadata?.retryAttempt || 0) + 1
          }
        }, { where: { id: file.id } });
        
        failureCount++;
      }
    }
    
    console.log(`\n🎉 Retry processing completed!`);
    console.log(`✅ Successfully processed: ${successCount} files`);
    console.log(`❌ Failed to process: ${failureCount} files`);
    
  } catch (error) {
    console.error('❌ Error during retry processing:', error);
    process.exit(1);
  }
}

// Run the retry processing
retryFailedFiles().then(() => {
  console.log('🎉 Retry processing completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Retry processing failed:', error);
  process.exit(1);
}); 