import { sequelize } from '../config/database.js';
import { Folder } from '../models/index.js';

async function addFoldersTable() {
  try {
    console.log('🔄 Starting folders table migration...');
    
    // Sync the Folder model to create the table
    await Folder.sync({ force: false });
    console.log('✅ Folders table created/updated');
    
    // Add folderId column to files table if it doesn't exist
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'files' AND column_name = 'folderId'
    `);
    
    if (results.length === 0) {
      await sequelize.query(`
        ALTER TABLE files 
        ADD COLUMN "folderId" INTEGER REFERENCES folders(id)
      `);
      console.log('✅ Added folderId column to files table');
    } else {
      console.log('ℹ️ folderId column already exists in files table');
    }
    
    console.log('✅ Folders migration completed successfully');
  } catch (error) {
    console.error('❌ Error during folders migration:', error);
    throw error;
  }
}

// Run the migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addFoldersTable()
    .then(() => {
      console.log('✅ Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export default addFoldersTable; 