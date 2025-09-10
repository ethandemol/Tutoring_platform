import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class Feedback extends Model {}

Feedback.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  feedbackType: {
    type: DataTypes.ENUM('bug', 'feature', 'layout', 'other'),
    allowNull: false
  },
  feedback: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: [1, 2000]
    }
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  userName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  userEmail: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'reviewed', 'resolved', 'closed'),
    defaultValue: 'pending'
  },
  adminNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'Feedback',
  tableName: 'feedback',
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['feedbackType']
    },
    {
      fields: ['status']
    },
    {
      fields: ['createdAt']
    }
  ]
});

export default Feedback; 