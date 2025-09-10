import { sequelize } from '../config/database.js';

async function updateExistingChatMessagesUserId() {
  try {
    console.log('🔄 [MIGRATION] Updating existing chat messages with correct userId...');
    
    // Update existing chat messages to have the correct userId based on their session
    await sequelize.query(`
      UPDATE chat_messages 
      SET "userId" = chat_sessions."userId"
      FROM chat_sessions 
      WHERE chat_messages."sessionId" = chat_sessions.id
      AND chat_messages."userId" = 1
    `);
    
    console.log('✅ [MIGRATION] Successfully updated existing chat messages with correct userId');
  } catch (error) {
    console.error('❌ [MIGRATION] Error updating existing chat messages:', error);
  } finally {
    await sequelize.close();
  }
}

updateExistingChatMessagesUserId(); 