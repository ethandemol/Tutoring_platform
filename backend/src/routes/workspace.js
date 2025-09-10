import express from 'express';
import { Op } from 'sequelize';
import { authenticate } from '../middleware/auth.js';
import Workspace from '../models/Workspace.js';
import User from '../models/User.js';
import workspaceDeletionService from '../services/workspaceDeletionService.js';
import subjectClassifierService from '../services/subjectClassifierService.js';
import File from '../models/File.js'; // Added import for File

const router = express.Router();

// Get all workspaces for the authenticated user
router.get('/', authenticate, async (req, res) => {
  try {
    const workspaces = await Workspace.findAll({
      where: {
        userId: req.user.id,
        isActive: true
      },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: workspaces
    });
  } catch (error) {
    console.error('Get workspaces error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workspaces'
    });
  }
});

// Get a specific workspace by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const workspace = await Workspace.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
        isActive: true
      }
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    res.json({
      success: true,
      data: workspace
    });
  } catch (error) {
    console.error('Get workspace error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workspace'
    });
  }
});

// Create a new workspace
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description } = req.body;

    // Validate input
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Workspace name is required'
      });
    }

    // Check if workspace with same name already exists for this user (only active workspaces)
    const existingWorkspace = await Workspace.findOne({
      where: {
        name: name.trim(),
        userId: req.user.id,
        isActive: true
      }
    });

    if (existingWorkspace) {
      return res.status(400).json({
        success: false,
        message: 'A workspace with this name already exists'
      });
    }

    // Classify the workspace name to get the appropriate emoji
    let emoji = '📚'; // Default emoji
    try {
      const classification = await subjectClassifierService.classifyWorkspace(name.trim());
      emoji = classification.emoji;
    } catch (error) {
      console.warn('Failed to classify workspace emoji, using default:', error);
    }

    const workspace = await Workspace.create({
      name: name.trim(),
      description: description?.trim() || null,
      emoji: emoji,
      userId: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Workspace created successfully',
      data: workspace
    });
  } catch (error) {
    console.error('Create workspace error:', error);
    
    // Handle unique constraint violation specifically
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'A workspace with this name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create workspace'
    });
  }
});

// Update a workspace
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, description } = req.body;
    const workspaceId = req.params.id;

    const workspace = await Workspace.findOne({
      where: {
        id: workspaceId,
        userId: req.user.id,
        isActive: true
      }
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    // Check if new name conflicts with existing workspace (only active workspaces)
    if (name && name.trim() !== workspace.name) {
      const existingWorkspace = await Workspace.findOne({
        where: {
          name: name.trim(),
          userId: req.user.id,
          isActive: true,
          id: { [Op.ne]: workspaceId }
        }
      });

      if (existingWorkspace) {
        return res.status(400).json({
          success: false,
          message: 'A workspace with this name already exists'
        });
      }
    }

    // Keep existing emoji - emoji classification is now handled separately
    const emoji = workspace.emoji; // Keep existing emoji

    // Update workspace
    await workspace.update({
      name: name?.trim() || workspace.name,
      description: description?.trim() || workspace.description,
      emoji: emoji
    });

    res.json({
      success: true,
      message: 'Workspace updated successfully',
      data: workspace
    });
  } catch (error) {
    console.error('Update workspace error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update workspace'
    });
  }
});

// Delete a workspace (comprehensive deletion)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const userId = req.user.id;
    const result = await workspaceDeletionService.deleteWorkspace(workspaceId, userId);
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete workspace',
      error: error.message
    });
  }
});

// Get file categories for a workspace
router.get('/:id/categories', authenticate, async (req, res) => {
  try {
    const workspace = await Workspace.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
        isActive: true
      }
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    res.json({
      success: true,
      data: {
        categories: workspace.fileCategories || ['All', 'Websites', 'Youtube', 'Syllabus', 'Homeworks', 'Notes', 'Slides', 'Exams', 'Practice Questions', 'Quiz', 'Others']
      }
    });
  } catch (error) {
    console.error('Get file categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch file categories'
    });
  }
});

// Update file categories for a workspace
router.put('/:id/categories', authenticate, async (req, res) => {
  try {
    const { categories } = req.body;
    const workspaceId = req.params.id;

    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Categories must be a non-empty array'
      });
    }

    // Ensure 'All' is always included
    if (!categories.includes('All')) {
      categories.unshift('All');
    }

    const workspace = await Workspace.findOne({
      where: {
        id: workspaceId,
        userId: req.user.id,
        isActive: true
      }
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    await workspace.update({
      fileCategories: categories
    });

    res.json({
      success: true,
      message: 'File categories updated successfully',
      data: {
        categories: workspace.fileCategories
      }
    });
  } catch (error) {
    console.error('Update file categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update file categories'
    });
  }
});

// Get emoji classification for workspace name
router.post('/classify', authenticate, async (req, res) => {
  try {
    const { workspaceName } = req.body;

    if (!workspaceName || workspaceName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Workspace name is required'
      });
    }

    const classification = await subjectClassifierService.classifyWorkspace(workspaceName.trim());

    res.json({
      success: true,
      data: {
        workspaceName: workspaceName.trim(),
        category: classification.category,
        emoji: classification.emoji,
        confidence: classification.confidence
      }
    });
  } catch (error) {
    console.error('Workspace classification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to classify workspace'
    });
  }
});

// Update workspace theme
router.patch('/:id/theme', authenticate, async (req, res) => {
  try {
    const { themeId } = req.body;
    const workspaceId = req.params.id;

    if (!themeId) {
      return res.status(400).json({
        success: false,
        message: 'Theme ID is required'
      });
    }

    const workspace = await Workspace.findOne({
      where: {
        id: workspaceId,
        userId: req.user.id,
        isActive: true
      }
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    // Update the theme in settings
    const currentSettings = workspace.settings || {};
    const updatedSettings = {
      ...currentSettings,
      themeId: themeId
    };

    await workspace.update({
      settings: updatedSettings
    });

    res.json({
      success: true,
      message: 'Workspace theme updated successfully',
      data: {
        workspaceId: workspace.id,
        themeId: themeId
      }
    });
  } catch (error) {
    console.error('Update workspace theme error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update workspace theme'
    });
  }
});

// Get all files in a workspace
router.get('/:id/files', authenticate, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const { category } = req.query;

    // Verify workspace exists and belongs to user
    const workspace = await Workspace.findOne({
      where: {
        id: workspaceId,
        userId: req.user.id,
        isActive: true
      }
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    // Build where clause
    const whereClause = {
      workspaceId: workspaceId,
      isActive: true
    };
    if (category && category !== 'All') {
      whereClause.category = category;
    }

    const files = await File.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: files
    });

  } catch (error) {
    console.error('Get workspace files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workspace files'
    });
  }
});

export default router; 