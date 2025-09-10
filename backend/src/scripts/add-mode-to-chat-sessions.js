import { sequelize } from '../config/database.js';

async function addModeToChatSessions() {
  try {
    console.log('🔄 Adding mode column to chat_sessions table...');
    
    // Add the mode column with a default value
    await sequelize.query(`
      ALTER TABLE chat_sessions 
      ADD COLUMN mode VARCHAR(10) NOT NULL DEFAULT 'chat'
    `);
    
    console.log('✅ Successfully added mode column to chat_sessions table');
    
    // Update existing sessions to have 'chat' mode
    await sequelize.query(`
      UPDATE chat_sessions 
      SET mode = 'chat' 
      WHERE mode IS NULL OR mode = ''
    `);
    
    // Add a check constraint to ensure only valid modes
    await sequelize.query(`
      ALTER TABLE chat_sessions 
      ADD CONSTRAINT check_mode 
      CHECK (mode IN ('chat', 'call'))
    `);
    
    console.log('✅ Updated existing sessions to have chat mode');
    
  } catch (error) {
    console.error('❌ Error adding mode column:', error);
    throw error;
  }
}

// Run the migration
addModeToChatSessions()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }); 