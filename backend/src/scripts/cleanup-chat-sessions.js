import { cleanupOldSessions, getCleanupStats } from '../services/chatCleanupService.js';

async function runCleanup() {
  try {
    console.log('🧹 Starting chat session cleanup...');
    
    // Get stats before cleanup
    const statsBefore = await getCleanupStats();
    console.log('📊 Before cleanup:', statsBefore);
    
    // Run cleanup
    const deletedCount = await cleanupOldSessions();
    
    // Get stats after cleanup
    const statsAfter = await getCleanupStats();
    console.log('📊 After cleanup:', statsAfter);
    
    console.log(`✅ Cleanup completed! Deleted ${deletedCount} old sessions`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the cleanup
runCleanup().then(() => {
  console.log('🎉 Cleanup script completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Cleanup script failed:', error);
  process.exit(1);
}); 