import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const YouTubeTranscript = sequelize.define('YouTubeTranscript', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  videoId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'YouTube video ID'
  },
  videoTitle: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'YouTube video title'
  },
  videoDescription: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'YouTube video description'
  },
  channelName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'YouTube channel name'
  },
  transcriptData: {
    type: DataTypes.JSONB,
    allowNull: false,
    comment: 'Full transcript data including snippets, timestamps, etc.'
  },
  totalDuration: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Total duration in seconds'
  },
  snippetCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Number of transcript snippets'
  },
  processedContent: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Processed transcript content for RAG'
  },
  s3Key: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'S3 key if transcript is stored in S3'
  },
  storageType: {
    type: DataTypes.ENUM('database', 's3'),
    defaultValue: 'database',
    allowNull: false,
    comment: 'Where the transcript is stored'
  },
  lastAccessed: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last time this transcript was accessed'
  },
  accessCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: 'Number of times this transcript has been accessed'
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
  tableName: 'youtube_transcripts',
  timestamps: true,
  indexes: [
    {
      fields: ['videoId'],
      unique: true
    },
    {
      fields: ['lastAccessed']
    },
    {
      fields: ['accessCount']
    }
  ]
});

export default YouTubeTranscript; 