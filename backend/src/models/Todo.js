import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class Todo extends Model {}

Todo.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  workspaceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'workspaces',
      key: 'id',
    },
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  sequelize,
  tableName: 'todos',
  timestamps: true,
  indexes: [
    {
      fields: ['workspaceId'],
    },
    {
      fields: ['userId'],
    },
    {
      fields: ['completed'],
    },
  ],
});

export default Todo; 