import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { Folder, File } from '../models/index.js';
import { sequelize } from '../config/database.js';

const router = express.Router();

// Get all folders for a workspace
router.get('/workspace/:workspaceId', authenticate, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    // Verify workspace belongs to user
    const workspace = await sequelize.models.Workspace.findOne({
      where: { id: workspaceId, userId, isActive: true }
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    // Get folders with file count
    const folders = await Folder.findAll({
      where: { workspaceId, userId, isActive: true },
      include: [{
        model: File,
        as: 'files',
        where: { isActive: true },
        required: false,
        attributes: ['id']
      }],
      order: [['createdAt', 'DESC']]
    });

    // Format response
    const formattedFolders = folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      workspaceId: folder.workspaceId,
      createdAt: folder.createdAt,
      fileIds: folder.files.map(file => file.id)
    }));

    res.json({
      success: true,
      data: formattedFolders
    });
  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get folders'
    });
  }
});

// Create a new folder
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, workspaceId, fileIds } = req.body;
    const userId = req.user.id;

    if (!name || !workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Name and workspaceId are required'
      });
    }

    // Verify workspace belongs to user
    const workspace = await sequelize.models.Workspace.findOne({
      where: { id: workspaceId, userId, isActive: true }
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    // Create folder
    const folder = await Folder.create({
      name,
      workspaceId,
      userId
    });

    // Update files to belong to this folder
    if (fileIds && fileIds.length > 0) {
      await File.update(
        { folderId: folder.id },
        { 
          where: { 
            id: fileIds, 
            workspaceId, 
            userId, 
            isActive: true 
          } 
        }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Folder created successfully',
      data: {
        id: folder.id,
        name: folder.name,
        workspaceId: folder.workspaceId,
        createdAt: folder.createdAt,
        fileIds: fileIds || []
      }
    });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create folder'
    });
  }
});

// Update folder name
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    const folder = await Folder.findOne({
      where: { id, userId, isActive: true }
    });

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    await folder.update({ name });

    res.json({
      success: true,
      message: 'Folder updated successfully',
      data: {
        id: folder.id,
        name: folder.name,
        workspaceId: folder.workspaceId,
        createdAt: folder.createdAt
      }
    });
  } catch (error) {
    console.error('Update folder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update folder'
    });
  }
});

// Add files to folder
router.put('/:id/files', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { fileIds } = req.body;
    const userId = req.user.id;

    if (!fileIds || !Array.isArray(fileIds)) {
      return res.status(400).json({
        success: false,
        message: 'fileIds array is required'
      });
    }

    const folder = await Folder.findOne({
      where: { id, userId, isActive: true }
    });

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    // Update files to belong to this folder
    await File.update(
      { folderId: folder.id },
      { 
        where: { 
          id: fileIds, 
          workspaceId: folder.workspaceId, 
          userId, 
          isActive: true 
        } 
      }
    );

    res.json({
      success: true,
      message: 'Files added to folder successfully'
    });
  } catch (error) {
    console.error('Add files to folder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add files to folder'
    });
  }
});

// Move files to folder (for drag and drop)
router.put('/:id/move-files', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { fileIds } = req.body;
    const userId = req.user.id;

    if (!fileIds || !Array.isArray(fileIds)) {
      return res.status(400).json({
        success: false,
        message: 'fileIds array is required'
      });
    }

    const folder = await Folder.findOne({
      where: { id, userId, isActive: true }
    });

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    // Update files to belong to this folder
    await File.update(
      { folderId: folder.id },
      { 
        where: { 
          id: fileIds, 
          workspaceId: folder.workspaceId, 
          userId, 
          isActive: true 
        } 
      }
    );

    res.json({
      success: true,
      message: 'Files moved to folder successfully',
      data: {
        folderId: folder.id,
        movedFileIds: fileIds
      }
    });
  } catch (error) {
    console.error('Move files to folder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to move files to folder'
    });
  }
});

// Delete folder
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const folder = await Folder.findOne({
      where: { id, userId, isActive: true }
    });

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    // Remove folderId from all files in this folder
    await File.update(
      { folderId: null },
      { 
        where: { 
          folderId: folder.id, 
          userId, 
          isActive: true 
        } 
      }
    );

    // Soft delete the folder
    await folder.update({ isActive: false });

    res.json({
      success: true,
      message: 'Folder deleted successfully'
    });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete folder'
    });
  }
});

export default router; 