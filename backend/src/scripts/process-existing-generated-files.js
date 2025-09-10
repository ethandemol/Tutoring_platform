import { sequelize } from '../config/database.js';
import File from '../models/File.js';
import chunkingService from '../services/chunkingServices.js';

/**
 * Script to process all existing generated files for RAG
 * This script finds all files with type 'generated' that haven't been processed for RAG
 * and processes them through the chunking service.
 */

async function processExistingGeneratedFiles() {
  try {
    console.log('🚀 Starting to process existing generated files for RAG...');

    // Find all generated files that haven't been processed for RAG
    const generatedFiles = await File.findAll({
      where: {
        metadata: {
          type: 'generated'
        },
        isProcessed: false,
        isActive: true
      },
      attributes: ['id', 'originalName', 'workspaceId', 'userId', 'processingStatus', 'metadata']
    });

    console.log(`📋 Found ${generatedFiles.length} generated files that need RAG processing`);

    if (generatedFiles.length === 0) {
      console.log('✅ No generated files found that need processing');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Process each file
    for (const file of generatedFiles) {
      try {
        console.log(`🔄 Processing file ${file.id}: ${file.originalName}`);
        
        // Update status to processing
        await file.update({
          processingStatus: 'processing',
          metadata: {
            ...file.metadata,
            ragProcessingStarted: new Date().toISOString()
          }
        });

        // Process the file through chunking service
        await chunkingService.processFile(file.id, file.userId, file.workspaceId);
        
        console.log(`✅ Successfully processed file ${file.id}: ${file.originalName}`);
        successCount++;

      } catch (error) {
        console.error(`❌ Failed to process file ${file.id}: ${file.originalName}`, error.message);
        
        // Update file status to failed
        await file.update({
          processingStatus: 'failed',
          metadata: {
            ...file.metadata,
            ragError: error.message,
            ragFailedAt: new Date().toISOString()
          }
        });
        
        errorCount++;
        errors.push({
          fileId: file.id,
          fileName: file.originalName,
          error: error.message
        });
      }
    }

    // Summary
    console.log('\n📊 Processing Summary:');
    console.log(`✅ Successfully processed: ${successCount} files`);
    console.log(`❌ Failed to process: ${errorCount} files`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach(error => {
        console.log(`  - File ${error.fileId} (${error.fileName}): ${error.error}`);
      });
    }

    console.log('\n🎉 Script completed!');

  } catch (error) {
    console.error('❌ Script failed:', error);
    throw error;
  }
}

// Also find files that might be marked as processed but don't have chunks
async function processFilesWithoutChunks() {
  try {
    console.log('\n🔍 Checking for files marked as processed but without chunks...');

    // Find files that are marked as processed but might not have chunks
    const processedFiles = await File.findAll({
      where: {
        metadata: {
          type: 'generated'
        },
        isProcessed: true,
        isActive: true
      },
      attributes: ['id', 'originalName', 'workspaceId', 'userId', 'processingStatus', 'metadata']
    });

    console.log(`📋 Found ${processedFiles.length} processed generated files`);

    // Check if these files actually have chunks by querying the chunks table
    const { Chunk } = await import('../models/index.js');
    
    let filesWithoutChunks = 0;
    let reprocessedCount = 0;

    for (const file of processedFiles) {
      const chunkCount = await Chunk.count({
        where: {
          fileId: file.id,
          isActive: true
        }
      });

      if (chunkCount === 0) {
        console.log(`⚠️ File ${file.id} (${file.originalName}) is marked as processed but has no chunks. Reprocessing...`);
        
        try {
          // Reset file status
          await file.update({
            isProcessed: false,
            processingStatus: 'pending',
            metadata: {
              ...file.metadata,
              reprocessingStarted: new Date().toISOString(),
              originalProcessingStatus: file.processingStatus
            }
          });

          // Reprocess the file
          await chunkingService.processFile(file.id, file.userId, file.workspaceId);
          console.log(`✅ Successfully reprocessed file ${file.id}: ${file.originalName}`);
          reprocessedCount++;

        } catch (error) {
          console.error(`❌ Failed to reprocess file ${file.id}: ${file.originalName}`, error.message);
          
          await file.update({
            processingStatus: 'failed',
            metadata: {
              ...file.metadata,
              reprocessingError: error.message,
              reprocessingFailedAt: new Date().toISOString()
            }
          });
        }

        filesWithoutChunks++;
      }
    }

    console.log(`\n📊 Reprocessing Summary:`);
    console.log(`🔍 Files without chunks found: ${filesWithoutChunks}`);
    console.log(`✅ Successfully reprocessed: ${reprocessedCount} files`);

  } catch (error) {
    console.error('❌ Error checking for files without chunks:', error);
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting comprehensive RAG processing for existing generated files...\n');
    
    // Process files that haven't been processed
    await processExistingGeneratedFiles();
    
    // Check and reprocess files that might be missing chunks
    await processFilesWithoutChunks();
    
    console.log('\n🎉 All processing completed successfully!');
    
  } catch (error) {
    console.error('❌ Main execution failed:', error);
  } finally {
    // Close database connection
    await sequelize.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { processExistingGeneratedFiles, processFilesWithoutChunks }; 