import { sequelize } from '../config/database.js';

async function addDeletedAtColumn() {
  try {
    console.log('🔄 Adding deletedAt column to workspaces table...');
    
    // Add the deletedAt column to the workspaces table
    await sequelize.query(`
      ALTER TABLE workspaces 
      ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP WITH TIME ZONE
    `);
    
    console.log('✅ Successfully added deletedAt column to workspaces table');
    
    // Verify the column was added
    const [results] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'workspaces' AND column_name = 'deletedAt'
    `);
    
    if (results.length > 0) {
      console.log('✅ Column verification successful:', results[0]);
    } else {
      console.log('⚠️ Column verification failed - column may not have been added');
    }
    
  } catch (error) {
    console.error('❌ Error adding deletedAt column:', error);
    throw error;
  }
}

// Run the migration
addDeletedAtColumn()
  .then(() => {
    console.log('🎉 Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }); 