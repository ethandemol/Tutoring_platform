import express from 'express';
import { Todo, Workspace } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get all todos for a workspace
router.get('/workspaces/:workspaceId/todos', authenticate, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const userId = req.user.id;

    // Validate workspace access
    const workspace = await Workspace.findOne({
      where: {
        id: workspaceId,
        userId,
        isActive: true,
      },
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found',
      });
    }

    const todos = await Todo.findAll({
      where: {
        workspaceId,
        userId,
      },
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      data: todos,
    });
  } catch (error) {
    console.error('Error fetching todos:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch todos',
    });
  }
});

// Create a new todo
router.post('/workspaces/:workspaceId/todos', authenticate, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const { text, dueDate } = req.body;
    const userId = req.user.id;

    // Validate workspace access
    const workspace = await Workspace.findOne({
      where: {
        id: workspaceId,
        userId,
        isActive: true,
      },
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found',
      });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Todo text is required',
      });
    }

    const todo = await Todo.create({
      text: text.trim(),
      workspaceId,
      userId,
      dueDate: dueDate || null,
    });

    res.status(201).json({
      success: true,
      data: todo,
    });
  } catch (error) {
    console.error('Error creating todo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create todo',
    });
  }
});

// Toggle todo completion status
router.put('/workspaces/:workspaceId/todos/:todoId/toggle', authenticate, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const todoId = parseInt(req.params.todoId);
    const userId = req.user.id;

    // Validate workspace access
    const workspace = await Workspace.findOne({
      where: {
        id: workspaceId,
        userId,
        isActive: true,
      },
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found',
      });
    }

    const todo = await Todo.findOne({
      where: {
        id: todoId,
        workspaceId,
        userId,
      },
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: 'Todo not found',
      });
    }

    todo.completed = !todo.completed;
    await todo.save();

    res.json({
      success: true,
      data: todo,
    });
  } catch (error) {
    console.error('Error toggling todo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle todo',
    });
  }
});

// Update todo
router.put('/workspaces/:workspaceId/todos/:todoId', authenticate, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const todoId = parseInt(req.params.todoId);
    const { text, completed, dueDate } = req.body;
    const userId = req.user.id;

    // Validate workspace access
    const workspace = await Workspace.findOne({
      where: {
        id: workspaceId,
        userId,
        isActive: true,
      },
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found',
      });
    }

    const todo = await Todo.findOne({
      where: {
        id: todoId,
        workspaceId,
        userId,
      },
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: 'Todo not found',
      });
    }

    if (text !== undefined) {
      todo.text = text.trim();
    }
    if (completed !== undefined) {
      todo.completed = completed;
    }
    if (dueDate !== undefined) {
      todo.dueDate = dueDate || null;
    }

    await todo.save();

    res.json({
      success: true,
      data: todo,
    });
  } catch (error) {
    console.error('Error updating todo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update todo',
    });
  }
});

// Delete todo
router.delete('/workspaces/:workspaceId/todos/:todoId', authenticate, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const todoId = parseInt(req.params.todoId);
    const userId = req.user.id;

    // Validate workspace access
    const workspace = await Workspace.findOne({
      where: {
        id: workspaceId,
        userId,
        isActive: true,
      },
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found',
      });
    }

    const todo = await Todo.findOne({
      where: {
        id: todoId,
        workspaceId,
        userId,
      },
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: 'Todo not found',
      });
    }

    await todo.destroy();

    res.json({
      success: true,
      message: 'Todo deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting todo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete todo',
    });
  }
});

export default router; 