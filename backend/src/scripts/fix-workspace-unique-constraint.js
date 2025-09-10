import { sequelize } from '../config/database.js';

async function fixWorkspaceUniqueConstraint() {
  try {
    console.log('🔄 Fixing workspace unique constraint to exclude soft-deleted records...');
    
    // First, drop the existing unique constraint
    await sequelize.query(`
      ALTER TABLE workspaces 
      DROP CONSTRAINT IF EXISTS "workspaces_name_user_id"
    `);
    
    console.log('✅ Dropped existing unique constraint');
    
    // Create a new partial unique index that excludes soft-deleted records
    await sequelize.query(`
      CREATE UNIQUE INDEX "workspaces_name_user_id_active" 
      ON workspaces (name, "userId") 
      WHERE "deletedAt" IS NULL
    `);
    
    console.log('✅ Created new partial unique index for active workspaces');
    
    // Verify the index was created
    const [results] = await sequelize.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'workspaces' AND indexname = 'workspaces_name_user_id_active'
    `);
    
    if (results.length > 0) {
      console.log('✅ Index verification successful:', results[0].indexname);
    } else {
      console.log('⚠️ Index verification failed - index may not have been created');
    }
    
  } catch (error) {
    console.error('❌ Error fixing workspace unique constraint:', error);
    throw error;
  }
}

// Run the migration
fixWorkspaceUniqueConstraint()
  .then(() => {
    console.log('🎉 Workspace unique constraint fix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Workspace unique constraint fix failed:', error);
    process.exit(1);
  }); 