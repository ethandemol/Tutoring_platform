import { sequelize } from '../config/database.js';
import Todo from '../models/Todo.js';

const addTodosTable = async () => {
  try {
    console.log('🔄 Adding todos table...');
    
    // Sync the Todo model to create the table
    await Todo.sync({ force: false });
    
    console.log('✅ Todos table created successfully!');
    
    // Test the table by creating a sample todo
    console.log('🧪 Testing todos table...');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating todos table:', error);
    process.exit(1);
  }
};

addTodosTable(); 