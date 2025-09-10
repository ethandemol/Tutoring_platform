import express from 'express';
import User from '../models/User.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { 
  validateProfileUpdate, 
  validatePasswordChange,
  sanitizeInput 
} from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * @route   GET /api/user/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticate, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    user: req.user.getPublicProfile()
  });
}));

/**
 * @route   PUT /api/user/profile
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/profile', authenticate, sanitizeInput, validateProfileUpdate, asyncHandler(async (req, res) => {
  const { name, avatar, preferences } = req.body;
  const user = req.user;

  // Update fields if provided
  if (name) user.name = name;
  if (avatar) user.avatar = avatar;
  if (preferences) {
    user.preferences = { ...user.preferences, ...preferences };
  }

  await user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: user.getPublicProfile()
  });
}));

/**
 * @route   PUT /api/user/password
 * @desc    Change user password
 * @access  Private
 */
router.put('/password', authenticate, sanitizeInput, validatePasswordChange, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findByPk(req.user.id, {
    attributes: { include: ['password'] }
  });

  // Verify current password
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  // Update password
  user.password = newPassword;
  await user.save();

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

/**
 * @route   DELETE /api/user/account
 * @desc    Delete user account
 * @access  Private
 */
router.delete('/account', authenticate, asyncHandler(async (req, res) => {
  const user = req.user;

  // Soft delete - mark as inactive instead of actually deleting
  user.isActive = false;
  await user.save();

  res.json({
    success: true,
    message: 'Account deactivated successfully'
  });
}));

/**
 * @route   GET /api/user/:id
 * @desc    Get user by ID (admin only)
 * @access  Private/Admin
 */
router.get('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id, {
    attributes: { exclude: ['password'] }
  });
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.json({
    success: true,
    user: user.getPublicProfile()
  });
}));

/**
 * @route   GET /api/user
 * @desc    Get all users (admin only)
 * @access  Private/Admin
 */
router.get('/', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const users = await User.findAll({
    attributes: { exclude: ['password'] },
    order: [['createdAt', 'DESC']],
    offset: skip,
    limit: limit
  });

  const total = await User.count();

  res.json({
    success: true,
    users: users.map(user => user.getPublicProfile()),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}));

/**
 * @route   PUT /api/user/:id/status
 * @desc    Update user status (admin only)
 * @access  Private/Admin
 */
router.put('/:id/status', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const user = await User.findByPk(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  user.isActive = isActive;
  await user.save();

  res.json({
    success: true,
    message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
    user: user.getPublicProfile()
  });
}));

/**
 * @route   PUT /api/user/:id/role
 * @desc    Update user role (admin only)
 * @access  Private/Admin
 */
router.put('/:id/role', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { role } = req.body;
  const user = await User.findByPk(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid role. Must be "user" or "admin"'
    });
  }

  user.role = role;
  await user.save();

  res.json({
    success: true,
    message: `User role updated to ${role}`,
    user: user.getPublicProfile()
  });
}));

export default router; 