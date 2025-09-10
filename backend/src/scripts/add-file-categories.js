import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';

async function addFileCategories() {
  try {
    console.log('Starting file categories migration...');

    // Add category column to files table
    await sequelize.query(`
      ALTER TABLE files 
      ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'All'
    `, { type: QueryTypes.RAW });

    // Add index for category column
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_files_category ON files(category)
    `, { type: QueryTypes.RAW });

    // Add fileCategories column to workspaces table
    await sequelize.query(`
      ALTER TABLE workspaces 
      ADD COLUMN IF NOT EXISTS file_categories JSONB DEFAULT '["All", "Websites", "Youtube", "Syllabus", "Homeworks", "Notes", "Slides", "Exams"]'::jsonb
    `, { type: QueryTypes.RAW });

    console.log('File categories migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run the migration
addFileCategories()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  }); 