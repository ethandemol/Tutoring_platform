import ChatSession from '../models/ChatSession.js';
import ChatMessage from '../models/ChatMessage.js';
import { Op } from 'sequelize';

/**
 * Clean up old unstarred chat sessions that haven't been active in 24 hours
 * @returns {Promise<number>} Number of sessions deleted
 */
export async function cleanupOldSessions() {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Find unstarred sessions that haven't been active in 24 hours
    const oldSessions = await ChatSession.findAll({
      where: {
        isStarred: false,
        lastActivityAt: {
          [Op.lt]: twentyFourHoursAgo
        }
      }
    });

    let deletedCount = 0;

    for (const session of oldSessions) {
      try {
        // Delete all messages for this session
        await ChatMessage.destroy({
          where: { sessionId: session.id }
        });

        // Delete the session
        await session.destroy();
        deletedCount++;

        console.log(`🗑️ [CLEANUP] Deleted old session: ${session.id}`);
      } catch (error) {
        console.error(`Error deleting session ${session.id}:`, error);
      }
    }

    if (deletedCount > 0) {
      console.log(`🧹 [CLEANUP] Cleaned up ${deletedCount} old chat sessions`);
    }

    return deletedCount;
  } catch (error) {
    console.error('Error during chat cleanup:', error);
    return 0;
  }
}

/**
 * Get cleanup statistics
 * @returns {Promise<Object>} Cleanup statistics
 */
export async function getCleanupStats() {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const oldUnstarredCount = await ChatSession.count({
      where: {
        isStarred: false,
        lastActivityAt: {
          [Op.lt]: twentyFourHoursAgo
        }
      }
    });

    const totalSessions = await ChatSession.count();
    const starredSessions = await ChatSession.count({
      where: { isStarred: true }
    });

    return {
      oldUnstarredCount,
      totalSessions,
      starredSessions,
      willBeDeleted: oldUnstarredCount
    };
  } catch (error) {
    console.error('Error getting cleanup stats:', error);
    return {
      oldUnstarredCount: 0,
      totalSessions: 0,
      starredSessions: 0,
      willBeDeleted: 0
    };
  }
}

/**
 * Clean up inactive sessions (sessions without both user input and AI response)
 * @returns {Promise<number>} Number of deleted sessions
 */
export async function cleanupInactiveSessions() {
  try {
    console.log('🧹 [CLEANUP] Starting inactive session cleanup...');
    
    // Get all sessions marked as active
    const allSessions = await ChatSession.findAll({
      where: {
        isActive: true
      },
      attributes: ['id', 'name', 'createdAt', 'isStarred']
    });

    console.log(`📋 [CLEANUP] Checking ${allSessions.length} sessions for inactivity`);

    let deletedCount = 0;

    for (const session of allSessions) {
      try {
        // Skip starred sessions
        if (session.isStarred) {
          console.log(`⭐ [CLEANUP] Skipping starred session ${session.id}: ${session.name}`);
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
          console.log(`🗑️ [CLEANUP] Deleting inactive session ${session.id}: ${session.name} (user: ${userMessageCount}, AI: ${aiMessageCount})`);
          
          // Delete all messages first
          await ChatMessage.destroy({
            where: { sessionId: session.id }
          });

          // Delete the session
          await session.destroy();
          deletedCount++;
        } else {
          console.log(`✅ [CLEANUP] Session ${session.id} is active (user: ${userMessageCount}, AI: ${aiMessageCount})`);
        }
      } catch (error) {
        console.error(`❌ [CLEANUP] Error processing session ${session.id}:`, error);
      }
    }

    console.log(`🎉 [CLEANUP] Inactive session cleanup completed: ${deletedCount} deleted`);

    return deletedCount;
  } catch (error) {
    console.error('❌ [CLEANUP] Error during inactive session cleanup:', error);
    return 0;
  }
} 