import { sequelize } from '../config/database.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';

const addDefaultWorkspaces = async () => {
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Connected to PostgreSQL database successfully');

    // Get all users
    const users = await User.findAll();
    console.log(`📊 Found ${users.length} users`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      // Check if user already has a workspace
      const existingWorkspace = await Workspace.findOne({
        where: {
          userId: user.id,
          isActive: true
        }
      });

      if (!existingWorkspace) {
        // Create default workspace for user
        await Workspace.create({
          name: 'My Workspace',
          description: 'Your default workspace for organizing files and projects',
          emoji: '📚',
          userId: user.id,
          isActive: true
        });
        createdCount++;
        console.log(`✅ Created default workspace for user: ${user.name} (${user.email})`);
      } else {
        skippedCount++;
        console.log(`⏭️  User ${user.name} already has a workspace, skipping`);
      }
    }

    console.log('\n📋 Summary:');
    console.log(`✅ Created ${createdCount} default workspaces`);
    console.log(`⏭️  Skipped ${skippedCount} users (already had workspaces)`);
    console.log('✅ Default workspace migration completed');

    await sequelize.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Default workspace migration failed:', error.message);
    console.log('\n📋 Please ensure:');
    console.log('1. PostgreSQL is installed and running');
    console.log('2. Your DATABASE_URL is correctly configured in .env');
    console.log('3. The database and user exist');
    process.exit(1);
  }
};

// Run the migration
addDefaultWorkspaces(); 