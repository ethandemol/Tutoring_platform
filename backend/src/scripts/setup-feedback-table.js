import { sequelize } from '../config/database.js';
import { Feedback } from '../models/index.js';

async function setupFeedbackTable() {
  try {
    console.log('🔄 Setting up feedback table...');
    
    // Sync the Feedback model to create the table
    await Feedback.sync({ force: false });
    
    console.log('✅ Feedback table created successfully!');
    console.log('📋 Table structure:');
    console.log('   - id (INTEGER, PRIMARY KEY)');
    console.log('   - feedbackType (ENUM: bug, feature, layout, other)');
    console.log('   - feedback (TEXT)');
    console.log('   - userId (INTEGER, FOREIGN KEY)');
    console.log('   - userName (STRING)');
    console.log('   - userEmail (STRING)');
    console.log('   - status (ENUM: pending, reviewed, resolved, closed)');
    console.log('   - adminNotes (TEXT, nullable)');
    console.log('   - createdAt (DATE)');
    console.log('   - updatedAt (DATE)');
    
    // Check if there are any existing feedback records
    const count = await Feedback.count();
    console.log(`📊 Current feedback count: ${count}`);
    
    if (count > 0) {
      const recentFeedback = await Feedback.findAll({
        order: [['createdAt', 'DESC']],
        limit: 5
      });
      
      console.log('📝 Recent feedback:');
      recentFeedback.forEach((feedback, index) => {
        console.log(`   ${index + 1}. [${feedback.feedbackType}] ${feedback.feedback.substring(0, 50)}...`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error setting up feedback table:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

setupFeedbackTable(); 