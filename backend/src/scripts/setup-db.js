import dotenv from 'dotenv';
dotenv.config();

// Import the main sequelize instance
import { sequelize, syncDatabase } from '../config/database.js';
// Import all models so they are registered with sequelize
import '../models/index.js';

const setupDatabase = async () => {
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Connected to PostgreSQL database successfully');

    // Sync the database (create tables)
    await sequelize.sync({ alter: true });
    console.log('✅ Database tables synchronized successfully');

    await sequelize.close();
    console.log('✅ Database setup completed');
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.log('\n📋 Please ensure:');
    console.log('1. PostgreSQL is installed and running');
    console.log('2. Your DATABASE_URL is correctly configured in .env');
    console.log('3. The database and user exist');
    process.exit(1);
  }
};

setupDatabase(); 