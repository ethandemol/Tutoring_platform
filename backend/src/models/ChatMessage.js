import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class ChatMessage extends Model {}

ChatMessage.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sessionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'chat_sessions',
      key: 'id'
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
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  isUser: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  role: {
    type: DataTypes.ENUM('user', 'assistant', 'system'),
    allowNull: false,
    defaultValue: 'user'
  },
  sourceCitations: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'source_citations',
    comment: 'Array of source citations for AI responses'
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
  modelName: 'ChatMessage',
  tableName: 'chat_messages',
  timestamps: true
});

export default ChatMessage; 