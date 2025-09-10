import { sequelize } from '../config/database.js';
import { Feedback } from '../models/index.js';

async function viewFeedback() {
  try {
    console.log('📋 Viewing all feedback...\n');
    
    const feedback = await Feedback.findAll({
      order: [['createdAt', 'DESC']]
    });
    
    if (feedback.length === 0) {
      console.log('❌ No feedback found in database');
      return;
    }
    
    console.log(`📊 Found ${feedback.length} feedback record(s):\n`);
    
    feedback.forEach((item, index) => {
      console.log(`--- Feedback #${item.id} ---`);
      console.log(`Type: ${item.feedbackType}`);
      console.log(`User: ${item.userName} (${item.userEmail})`);
      console.log(`Status: ${item.status}`);
      console.log(`Date: ${item.createdAt.toLocaleString()}`);
      console.log(`Message: ${item.feedback}`);
      if (item.adminNotes) {
        console.log(`Admin Notes: ${item.adminNotes}`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error viewing feedback:', error);
  } finally {
    await sequelize.close();
  }
}

viewFeedback(); 