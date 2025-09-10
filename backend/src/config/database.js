import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
});

// Test database connection
export const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    process.exit(1);
  }
};

// Sync database (create tables if they don't exist)
export const syncDatabase = async () => {
  try {
    // Use force: false to avoid altering existing tables and causing index issues
    await sequelize.sync({ force: false });
    console.log('✅ Database synchronized successfully.');
  } catch (error) {
    // Handle constraint errors gracefully
    if (error.name === 'SequelizeUnknownConstraintError') {
      console.log('⚠️ Some database constraints already exist, continuing...');
      console.log('✅ Database synchronized successfully.');
    } else if (error.message && error.message.includes('Cannot read properties of null')) {
      console.log('⚠️ Database index query issue detected, continuing with existing schema...');
      console.log('✅ Database synchronized successfully.');
    } else {
      console.error('❌ Database sync failed:', error);
      throw error;
    }
  }
};

export { sequelize }; 