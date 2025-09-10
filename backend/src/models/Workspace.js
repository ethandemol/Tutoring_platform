import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Workspace = sequelize.define('Workspace', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 100]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  emoji: {
    type: DataTypes.STRING(10),
    allowNull: true,
    defaultValue: '📚'
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  fileCategories: {
    type: DataTypes.JSONB,
    defaultValue: ['All', 'Websites', 'Youtube', 'Syllabus', 'Homeworks', 'Notes', 'Slides', 'Exams', 'Practice Questions', 'Quiz', 'Flashcards', 'Cheat Sheet', 'Study Guide', 'Others'],
    field: 'file_categories' // Map to the correct database column name
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'workspaces',
  timestamps: true,
  paranoid: true, // Enable soft deletes
  indexes: [
    {
      fields: ['userId']
    }
    // Note: Unique constraint on (name, userId) is handled by database-level partial index
    // that excludes soft-deleted records (workspaces_name_user_id_active)
  ]
});

export default Workspace; 