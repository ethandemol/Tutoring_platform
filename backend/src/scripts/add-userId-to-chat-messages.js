import { sequelize } from '../config/database.js';

async function addUserIdToChatMessages() {
  try {
    console.log('🔄 [MIGRATION] Adding userId field to chat_messages table...');
    
    // Add userId column to chat_messages table
    await sequelize.query(`
      ALTER TABLE chat_messages 
      ADD COLUMN IF NOT EXISTS "userId" INTEGER NOT NULL DEFAULT 1,
      ADD CONSTRAINT "chat_messages_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
    `);
    
    console.log('✅ [MIGRATION] Successfully added userId field to chat_messages table');
  } catch (error) {
    console.error('❌ [MIGRATION] Error adding userId field:', error);
  } finally {
    await sequelize.close();
  }
}

addUserIdToChatMessages(); 