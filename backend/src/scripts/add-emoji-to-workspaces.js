import { sequelize } from '../config/database.js';
import subjectClassifierService from '../services/subjectClassifierService.js';

async function addEmojiToWorkspaces() {
  try {
    console.log('🔄 Starting migration: Adding emoji column to workspaces...');

    // Add the emoji column if it doesn't exist
    await sequelize.query(`
      ALTER TABLE workspaces 
      ADD COLUMN IF NOT EXISTS emoji VARCHAR(10) DEFAULT '📚'
    `);

    console.log('✅ Emoji column added successfully');

    // Get all workspaces that don't have an emoji set (or have the default)
    const [workspaces] = await sequelize.query(`
      SELECT id, name FROM workspaces 
      WHERE emoji IS NULL OR emoji = '📚'
      AND "isActive" = true
    `);

    console.log(`📊 Found ${workspaces.length} workspaces to update`);

    // Update each workspace with its classified emoji
    for (const workspace of workspaces) {
      try {
        const classification = await subjectClassifierService.classifyWorkspace(workspace.name);
        
        await sequelize.query(`
          UPDATE workspaces 
          SET emoji = ? 
          WHERE id = ?
        `, {
          replacements: [classification.emoji, workspace.id]
        });

        console.log(`✅ Updated workspace "${workspace.name}" with emoji ${classification.emoji}`);
      } catch (error) {
        console.warn(`⚠️ Failed to classify workspace "${workspace.name}", keeping default emoji:`, error.message);
      }
    }

    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the migration
addEmojiToWorkspaces().catch(console.error); 