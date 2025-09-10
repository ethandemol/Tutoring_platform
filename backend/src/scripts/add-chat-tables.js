import { sequelize } from '../config/database.js';
import { ChatSession, ChatMessage } from '../models/index.js';

const addChatTables = async () => {
  try {
    console.log('🔄 Creating chat tables...');
    
    // Sync ChatSession table
    await ChatSession.sync({ force: false });
    console.log('✅ ChatSession table created/verified');
    
    // Sync ChatMessage table
    await ChatMessage.sync({ force: false });
    console.log('✅ ChatMessage table created/verified');
    
    console.log('🎉 Chat tables setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating chat tables:', error);
    process.exit(1);
  }
};

addChatTables(); 