import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Chunk = sequelize.define('Chunk', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  fileId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'files',
      key: 'id'
    }
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
  chunkIndex: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Order of chunk within the file'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'The actual text content of the chunk'
  },
  tokenCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Number of tokens in this chunk'
  },
  startToken: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Starting token index in the original document'
  },
  endToken: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Ending token index in the original document'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional metadata like page numbers, section info, etc.'
  },
  isEmbedded: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this chunk has been converted to embeddings'
  },
  embeddingId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'ID of the embedding in the vector database'
  },
  embedding: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Vector embedding stored as JSON string'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'chunks',
  timestamps: true,
  indexes: [
    {
      fields: ['fileId']
    },
    {
      fields: ['workspaceId']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['chunkIndex']
    },
    {
      fields: ['isEmbedded']
    },
    {
      fields: ['embeddingId']
    },
    {
      fields: ['fileId', 'chunkIndex'],
      unique: true
    }
  ]
});

export default Chunk; 