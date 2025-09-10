import express from 'express';
import { Op } from 'sequelize';
import { generateToken } from '../utils/jwt.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import { authenticate } from '../middleware/auth.js';
import { 
  validateRegister, 
  validateLogin, 
  validatePasswordResetRequest,
  validatePasswordReset,
  sanitizeInput 
} from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', sanitizeInput, validateRegister, asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  // Check if user already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User with this email already exists'
    });
  }

  // Create new user
  const user = await User.create({
    name,
    email,
    password
  });

  // Create default workspace for the new user
  const defaultWorkspace = await Workspace.create({
    name: 'My Workspace',
    description: 'Your default workspace for organizing files and projects',
    emoji: '📚',
    userId: user.id,
    isActive: true
  });

  // Generate token
  const token = generateToken({ userId: user.id });

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    token,
    user: user.getPublicProfile()
  });
}));

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', sanitizeInput, validateLogin, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user by email and include password for comparison
  const user = await User.findOne({ 
    where: { email: email.toLowerCase() },
    attributes: { include: ['password'] }
  });
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }

  // Check if user is active
  if (!user.isActive) {
    return res.status(401).json({
      success: false,
      message: 'Account is deactivated'
    });
  }

  // Check password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }

  // Generate token
  const token = generateToken({ userId: user.id });

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  res.json({
    success: true,
    message: 'Login successful',
    token,
    user: user.getPublicProfile()
  });
}));

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // You could implement a blacklist for tokens if needed
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

/**
 * @route   GET /api/auth/verify
 * @desc    Verify token and get user info
 * @access  Private
 */
router.get('/verify', authenticate, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    user: req.user.getPublicProfile()
  });
}));

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Private
 */
router.post('/refresh', authenticate, asyncHandler(async (req, res) => {
  const user = req.user;
  
  // Generate new token
  const token = generateToken({ userId: user.id });

  res.json({
    success: true,
    token,
    user: user.getPublicProfile()
  });
}));

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', sanitizeInput, validatePasswordResetRequest, asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findByEmail(email);
  if (!user) {
    // Don't reveal if user exists or not for security
    return res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent'
    });
  }

  // Generate reset token
  const resetToken = generateToken({ userId: user.id, type: 'reset' }, '1h');
  
  // Store reset token in user document
  user.passwordResetToken = resetToken;
  user.passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour
  await user.save();

  // TODO: Send email with reset link
  // For now, just return the token (in production, send via email)
  res.json({
    success: true,
    message: 'Password reset link sent to your email',
    resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
  });
}));

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', sanitizeInput, validatePasswordReset, asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  // Find user with valid reset token
  const user = await User.findOne({
    where: {
      passwordResetToken: token,
      passwordResetExpires: {
        [Op.gt]: new Date()
      }
    }
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired reset token'
    });
  }

  // Update password and clear reset token
  user.password = password;
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  await user.save();

  res.json({
    success: true,
    message: 'Password reset successfully'
  });
}));

export default router; 