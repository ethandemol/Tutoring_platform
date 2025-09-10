import { sequelize } from '../config/database.js';
import { ChatSession, ChatMessage, User } from '../models/index.js';

async function debugChatData() {
  try {
    console.log('🔍 [DEBUG] Checking chat data in database...');
    
    // Check all users
    const users = await User.findAll();
    console.log(`👥 [DEBUG] Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`   User ${user.id}: ${user.email} (${user.role})`);
    });
    
    // Check all chat sessions
    const allSessions = await ChatSession.findAll();
    console.log(`\n📋 [DEBUG] Found ${allSessions.length} total chat sessions:`);
    allSessions.forEach(session => {
      console.log(`   Session ${session.id}: "${session.name}" - User: ${session.userId}, Workspace: ${session.workspaceId}, File: ${session.fileId}, Active: ${session.isActive}`);
    });
    
    // Check all chat messages
    const allMessages = await ChatMessage.findAll();
    console.log(`\n📨 [DEBUG] Found ${allMessages.length} total chat messages:`);
    allMessages.forEach(msg => {
      console.log(`   Message ${msg.id}: Session ${msg.sessionId}, User ${msg.userId}, ${msg.isUser ? 'User' : 'AI'}: "${msg.content.substring(0, 50)}..."`);
    });
    
    // Check sessions with messages
    const sessionsWithMessages = await ChatSession.findAll({
      include: [
        {
          model: ChatMessage,
          as: 'messages'
        }
      ]
    });
    
    console.log(`\n📝 [DEBUG] Sessions with messages:`);
    sessionsWithMessages.forEach(session => {
      console.log(`   Session ${session.id}: "${session.name}" - ${session.messages?.length || 0} messages`);
    });
    
  } catch (error) {
    console.error('❌ [DEBUG] Error:', error);
  } finally {
    await sequelize.close();
  }
}

debugChatData(); 