import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class ChatSession extends Model {}

ChatSession.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'New Chat'
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  workspaceId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'workspaces',
      key: 'id'
    }
  },
  fileId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'files',
      key: 'id'
    }
  },
  mode: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'chat',
    validate: {
      isIn: [['chat', 'call']]
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  isStarred: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  lastActivityAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
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
  modelName: 'ChatSession',
  tableName: 'chat_sessions',
  timestamps: true
});

export default ChatSession; 