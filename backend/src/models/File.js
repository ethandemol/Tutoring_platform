import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const File = sequelize.define('File', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  originalName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  fileName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  fileSize: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  mimeType: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'application/pdf'
  },
  s3Key: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  s3Bucket: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  s3Url: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  workspaceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'workspaces',
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
  category: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'All'
  },
  folderId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'folders',
      key: 'id'
    }
  },
  isProcessed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  processingStatus: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
    defaultValue: 'pending'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'files',
  timestamps: true,
  indexes: [
    {
      fields: ['workspaceId']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['fileName'],
      unique: true
    },
    {
      fields: ['processingStatus']
    },
    {
      fields: ['category']
    }
  ]
});

export default File; 