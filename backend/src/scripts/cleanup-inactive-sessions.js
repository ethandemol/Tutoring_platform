import { ChatSession, ChatMessage } from '../models/index.js';
import { sequelize } from '../config/database.js';

/**
 * Clean up inactive sessions (sessions without both user input and AI response)
 */
async function cleanupInactiveSessions() {
  try {
    console.log('🧹 [CLEANUP-SCRIPT] Starting inactive session cleanup...');
    
    // Get all sessions
    const allSessions = await ChatSession.findAll({
      attributes: ['id', 'name', 'createdAt', 'isStarred']
    });

    console.log(`📋 [CLEANUP-SCRIPT] Found ${allSessions.length} total sessions to check`);

    let deletedCount = 0;
    let skippedCount = 0;

    for (const session of allSessions) {
      try {
        // Skip starred sessions
        if (session.isStarred) {
          console.log(`⭐ [CLEANUP-SCRIPT] Skipping starred session ${session.id}: ${session.name}`);
          skippedCount++;
          continue;
        }

        // Count user messages
        const userMessageCount = await ChatMessage.count({
          where: { sessionId: session.id, isUser: true }
        });
        
        // Count AI messages
        const aiMessageCount = await ChatMessage.count({
          where: { sessionId: session.id, isUser: false }
        });
        
        // Session is inactive if it doesn't have both user input and AI response
        const isActive = userMessageCount > 0 && aiMessageCount > 0;
        
        if (!isActive) {
          console.log(`🗑️ [CLEANUP-SCRIPT] Deleting inactive session ${session.id}: ${session.name} (user: ${userMessageCount}, AI: ${aiMessageCount})`);
          
          // Delete all messages first
          await ChatMessage.destroy({
            where: { sessionId: session.id }
          });

          // Delete the session
          await session.destroy();
          deletedCount++;
        } else {
          console.log(`✅ [CLEANUP-SCRIPT] Session ${session.id} is active (user: ${userMessageCount}, AI: ${aiMessageCount})`);
        }
      } catch (error) {
        console.error(`❌ [CLEANUP-SCRIPT] Error processing session ${session.id}:`, error);
      }
    }

    console.log(`🎉 [CLEANUP-SCRIPT] Cleanup completed:`);
    console.log(`   - Total sessions checked: ${allSessions.length}`);
    console.log(`   - Sessions deleted: ${deletedCount}`);
    console.log(`   - Starred sessions skipped: ${skippedCount}`);
    console.log(`   - Active sessions remaining: ${allSessions.length - deletedCount - skippedCount}`);

    return deletedCount;
  } catch (error) {
    console.error('❌ [CLEANUP-SCRIPT] Error during cleanup:', error);
    return 0;
  }
}

// Run the cleanup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupInactiveSessions()
    .then((deletedCount) => {
      console.log(`✅ Cleanup completed. ${deletedCount} sessions deleted.`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    });
}

export { cleanupInactiveSessions }; 