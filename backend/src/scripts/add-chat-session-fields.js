import { sequelize } from '../config/database.js';
import ChatSession from '../models/ChatSession.js';

async function addChatSessionFields() {
  try {
    console.log('🔄 Adding new fields to chat_sessions table...');
    
    // First, add the columns as nullable
    await sequelize.query(`
      ALTER TABLE "chat_sessions" 
      ADD COLUMN IF NOT EXISTS "isStarred" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "summary" TEXT,
      ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP WITH TIME ZONE;
    `);
    
    // Update existing records to set lastActivityAt to updatedAt
    await sequelize.query(`
      UPDATE "chat_sessions" 
      SET "lastActivityAt" = "updatedAt" 
      WHERE "lastActivityAt" IS NULL;
    `);
    
    // Now make lastActivityAt NOT NULL
    await sequelize.query(`
      ALTER TABLE "chat_sessions" 
      ALTER COLUMN "lastActivityAt" SET NOT NULL,
      ALTER COLUMN "isStarred" SET NOT NULL;
    `);
    
    console.log('✅ Successfully added new fields to chat_sessions table');
    console.log('📋 Added fields:');
    console.log('   - isStarred (BOOLEAN, default: false)');
    console.log('   - summary (TEXT, nullable)');
    console.log('   - lastActivityAt (DATE, default: NOW)');
    
  } catch (error) {
    console.error('❌ Error adding chat session fields:', error);
    process.exit(1);
  }
}

// Run the migration
addChatSessionFields().then(() => {
  console.log('🎉 Migration completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Migration failed:', error);
  process.exit(1);
}); 