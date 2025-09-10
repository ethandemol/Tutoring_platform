import { sequelize } from '../config/database.js';

async function addSourceCitationsToChatMessages() {
  try {
    console.log('🔄 [MIGRATION] Adding sourceCitations field to chat_messages table...');
    
    // Add sourceCitations column to chat_messages table
    await sequelize.query(`
      ALTER TABLE chat_messages 
      ADD COLUMN IF NOT EXISTS source_citations JSONB;
    `);
    
    console.log('✅ [MIGRATION] Successfully added sourceCitations field to chat_messages table');
    
    // Update the ChatMessage model to include the new field
    console.log('📝 [MIGRATION] Note: You may need to restart the server for the model changes to take effect');
    
  } catch (error) {
    console.error('❌ [MIGRATION] Error adding sourceCitations field:', error);
  } finally {
    await sequelize.close();
  }
}

addSourceCitationsToChatMessages(); 